from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

# Extra keys that may appear on LogRecord for structured diagnostics.
_SAFE_EXTRA_KEYS = (
    "correlation_id",
    "correlationId",
    "stage",
    "operation",
    "exception_class",
    "exception_message",
    "sqlstate",
    "driver_code",
    "classification",
    "outbox_id",
    "attempts",
    "db_user",
    "database",
    "connection_ok",
    "transaction_begun",
    "rls_bypass_set",
    "arq_queue_name",
    "poll",
    "dispatched",
    "suppressed_count",
    "error",
    "detail",
    "heartbeat_key",
    "processing_run_id",
    "document_version_id",
    "outcome",
    "error_code",
    "job_id",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        for key in _SAFE_EXTRA_KEYS:
            if hasattr(record, key):
                value = getattr(record, key)
                if value is not None:
                    payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        safe_fields = getattr(record, "safe_fields", None)
        if isinstance(safe_fields, dict):
            payload.update(safe_fields)
        return json.dumps(payload, ensure_ascii=True, default=str)


def configure_logging(level: str = "info") -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(level.upper())
