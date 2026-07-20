"""Unit tests for outbox dispatcher diagnostics, time binding, and schema contract."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from document_intelligence.logging import JsonFormatter
from document_intelligence.outbox.dispatcher import (
    OUTBOX_SQL_IDENTIFIERS,
    PROCESS_DOCUMENT_EVENT_TYPE,
)
from document_intelligence.safe_errors import (
    LogThrottle,
    classify_dispatcher_error,
    describe_safe_exception,
    extract_sqlstate,
    sanitize_message,
)
from document_intelligence.timeutil import as_utc_naive, utc_now_naive


class _FakePgError(Exception):
    def __init__(self, message: str, sqlstate: str | None = None) -> None:
        super().__init__(message)
        self.sqlstate = sqlstate


def test_utc_now_naive_has_no_tzinfo() -> None:
    now = utc_now_naive()
    assert now.tzinfo is None
    assert abs((datetime.utcnow() - now).total_seconds()) < 2


def test_as_utc_naive_strips_aware() -> None:
    aware = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    assert as_utc_naive(aware) == datetime(2026, 1, 2, 3, 4, 5)


def test_extract_sqlstate() -> None:
    exc = _FakePgError("boom", sqlstate="22000")
    assert extract_sqlstate(exc) == "22000"


def test_classify_offset_aware_as_terminal() -> None:
    exc = _FakePgError(
        "invalid input for query argument $1: datetime... "
        "(can't subtract offset-naive and offset-aware datetimes)",
        sqlstate="22000",
    )
    assert classify_dispatcher_error(exc) == "terminal"


def test_classify_connection_retryable() -> None:
    class ConnectionFailureError(Exception):
        pass

    assert classify_dispatcher_error(ConnectionFailureError("gone")) == "retryable"


def test_describe_safe_exception_redacts_secrets() -> None:
    exc = _FakePgError(
        "dsn=postgresql://contractradar_app:super-secret@127.0.0.1/db token=abc",
        sqlstate="28000",
    )
    described = describe_safe_exception(exc, stage="claim_pending", operation="fetch")
    assert described["sqlstate"] == "28000"
    assert described["stage"] == "claim_pending"
    assert "super-secret" not in described["exception_message"]
    assert "REDACTED" in described["exception_message"] or "***" in described["exception_message"]


def test_sanitize_message_strips_signed_url_material() -> None:
    msg = sanitize_message("url=https://x/?X-Amz-Signature=abcd Bearer tokensecret")
    assert "abcd" not in msg
    assert "tokensecret" not in msg


def test_log_throttle_suppresses_duplicates() -> None:
    throttle = LogThrottle(window_seconds=60)
    assert throttle.should_emit("a", 0.0)[0] is True
    assert throttle.should_emit("a", 1.0)[0] is False
    assert throttle.should_emit("a", 1.0)[1] == 2
    assert throttle.should_emit("b", 2.0)[0] is True


def test_json_formatter_includes_safe_extras() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg="outbox_loop_error",
        args=(),
        exc_info=None,
    )
    record.exception_class = "DataError"  # type: ignore[attr-defined]
    record.sqlstate = "22000"  # type: ignore[attr-defined]
    record.safe_fields = {"stage": "claim_pending"}  # type: ignore[attr-defined]
    payload = json.loads(formatter.format(record))
    assert payload["message"] == "outbox_loop_error"
    assert payload["exception_class"] == "DataError"
    assert payload["sqlstate"] == "22000"
    assert payload["stage"] == "claim_pending"


def test_process_document_event_type_matches_web_contract() -> None:
    assert PROCESS_DOCUMENT_EVENT_TYPE == "process_document_version"


def test_prisma_outbox_schema_identifiers_match_migration() -> None:
    """Python SQL identifiers must match migration-created quoted camelCase columns."""
    repo = Path(__file__).resolve().parents[3]
    sql = (
        repo
        / "apps/web/prisma/migrations/20260719140000_outbox_and_slice2b/migration.sql"
    ).read_text(encoding="utf-8")
    assert 'CREATE TABLE "outbox_event"' in sql
    for ident in OUTBOX_SQL_IDENTIFIERS:
        assert f'"{ident}"' in sql, f"missing quoted identifier {ident} in migration"


def test_readiness_fails_on_db_query_error() -> None:
    from document_intelligence.outbox import dispatcher as dispatcher_mod

    async def _run() -> None:
        with patch.object(dispatcher_mod.db, "connect", new=AsyncMock()):
            with patch.object(dispatcher_mod.db, "close", new=AsyncMock()):
                with patch.object(
                    dispatcher_mod,
                    "probe_pending_access",
                    new=AsyncMock(
                        side_effect=_FakePgError("relation missing", sqlstate="42P01")
                    ),
                ):
                    try:
                        await dispatcher_mod.run_readiness_check()
                    except _FakePgError:
                        return
                    raise AssertionError("expected _FakePgError")

    asyncio.run(_run())


def test_readiness_fails_on_redis_error() -> None:
    from document_intelligence.outbox import dispatcher as dispatcher_mod

    async def _run() -> None:
        with patch.object(dispatcher_mod.db, "connect", new=AsyncMock()):
            with patch.object(dispatcher_mod.db, "close", new=AsyncMock()):
                with patch.object(
                    dispatcher_mod,
                    "probe_pending_access",
                    new=AsyncMock(
                        return_value={
                            "pending_count": 0,
                            "db_user": "contractradar_app",
                            "database": "contractradar_test",
                            "rls_bypass_set": True,
                            "timestamp_binding": "utc_naive",
                        }
                    ),
                ):
                    with patch.object(
                        dispatcher_mod,
                        "create_arq_redis",
                        new=AsyncMock(side_effect=ConnectionError("redis down")),
                    ):
                        try:
                            await dispatcher_mod.run_readiness_check()
                        except ConnectionError:
                            return
                        raise AssertionError("expected ConnectionError")

    asyncio.run(_run())


def test_claim_pending_uses_naive_datetime() -> None:
    from document_intelligence.outbox import dispatcher as dispatcher_mod

    captured: dict[str, object] = {}

    async def fake_fetch(query: str, *args: object) -> list[object]:
        captured["args"] = args
        return []

    async def _run() -> None:
        with patch.object(dispatcher_mod.db, "fetch", new=fake_fetch):
            await dispatcher_mod.claim_pending(limit=3)

    asyncio.run(_run())
    assert isinstance(captured["args"], tuple)
    ts = captured["args"][0]
    assert isinstance(ts, datetime)
    assert ts.tzinfo is None
