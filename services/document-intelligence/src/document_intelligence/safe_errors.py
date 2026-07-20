"""Safe structured exception diagnostics for outbox dispatcher / DI workers."""

from __future__ import annotations

import re
from typing import Any, Optional

_SENSITIVE = re.compile(
    r"(password|secret|token|authorization|cookie|credential|"
    r"X-Amz-[A-Za-z0-9_-]+=\S+|Bearer\s+\S+|"
    r"postgresql://[^@\s]+@)",
    re.IGNORECASE,
)


def sanitize_message(message: str, *, limit: int = 500) -> str:
    text = _SENSITIVE.sub("REDACTED", message)
    text = re.sub(r"postgresql://[^@\s]+@", "postgresql://***@", text, flags=re.IGNORECASE)
    return text[:limit]


def extract_sqlstate(exc: BaseException) -> Optional[str]:
    sqlstate = getattr(exc, "sqlstate", None)
    if sqlstate is not None:
        return str(sqlstate)
    cause = getattr(exc, "__cause__", None) or getattr(exc, "cause", None)
    if isinstance(cause, BaseException):
        return extract_sqlstate(cause)
    return None


def extract_driver_code(exc: BaseException) -> Optional[str]:
    for attr in ("sqlstate", "pgcode", "code"):
        value = getattr(exc, attr, None)
        if value is not None:
            return str(value)
    return None


# PostgreSQL / asyncpg classes that indicate configuration/schema problems.
_TERMINAL_NAME_FRAGMENTS = (
    "UndefinedTable",
    "UndefinedColumn",
    "UndefinedFunction",
    "InsufficientPrivilege",
    "InvalidSchemaName",
    "DatatypeMismatch",
    "SyntaxError",
    "InvalidColumnReference",
    "FeatureNotSupported",
)

_RETRYABLE_NAME_FRAGMENTS = (
    "ConnectionDoesNotExist",
    "ConnectionFailure",
    "InterfaceError",
    "TooManyConnections",
    "CannotConnectNow",
    "QueryCanceled",
    "DeadlockDetected",
    "SerializationFailure",
    "TimeoutError",
    "ConnectionError",
    "OSError",
    "Redis",
    "BusyLoading",
)


def classify_dispatcher_error(exc: BaseException) -> str:
    """Return ``terminal``, ``retryable``, or ``unknown``."""
    name = type(exc).__name__
    message = str(exc)
    if "offset-aware" in message or "timezone-aware" in message:
        return "terminal"
    if any(frag in name for frag in _TERMINAL_NAME_FRAGMENTS):
        return "terminal"
    if any(frag in name for frag in _RETRYABLE_NAME_FRAGMENTS):
        return "retryable"
    sqlstate = extract_sqlstate(exc) or ""
    # Class 08 = connection exception; 40 = transaction rollback (serialization/deadlock)
    if sqlstate.startswith("08") or sqlstate in {"40001", "40P01"}:
        return "retryable"
    # Class 42 = syntax/access rule; 28 = invalid auth; 3F = invalid schema
    if sqlstate.startswith(("42", "28", "3F", "22")):
        return "terminal"
    return "unknown"


def describe_safe_exception(
    exc: BaseException,
    *,
    stage: str,
    operation: Optional[str] = None,
    outbox_id: Optional[str] = None,
    attempts: Optional[int] = None,
    db_user: Optional[str] = None,
    database: Optional[str] = None,
    connection_ok: Optional[bool] = None,
    transaction_begun: Optional[bool] = None,
    rls_bypass_set: Optional[bool] = None,
) -> dict[str, Any]:
    return {
        "stage": stage,
        "operation": operation,
        "exception_class": type(exc).__name__,
        "exception_message": sanitize_message(str(exc)),
        "sqlstate": extract_sqlstate(exc),
        "driver_code": extract_driver_code(exc),
        "classification": classify_dispatcher_error(exc),
        "outbox_id": outbox_id,
        "attempts": attempts,
        "db_user": db_user,
        "database": database,
        "connection_ok": connection_ok,
        "transaction_begun": transaction_begun,
        "rls_bypass_set": rls_bypass_set,
    }


class LogThrottle:
    """Emit identical error fingerprints at most once per window."""

    def __init__(self, window_seconds: float = 30.0) -> None:
        self.window_seconds = window_seconds
        self._last_fingerprint: Optional[str] = None
        self._last_emitted_at: float = 0.0
        self._suppressed: int = 0

    def should_emit(self, fingerprint: str, now: float) -> tuple[bool, int]:
        if (
            fingerprint == self._last_fingerprint
            and (now - self._last_emitted_at) < self.window_seconds
        ):
            self._suppressed += 1
            return False, self._suppressed
        suppressed = self._suppressed
        self._last_fingerprint = fingerprint
        self._last_emitted_at = now
        self._suppressed = 0
        return True, suppressed
