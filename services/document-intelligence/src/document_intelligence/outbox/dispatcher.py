"""Poll Postgres outbox and enqueue ARQ jobs (at-least-once).

Run: python -m document_intelligence.outbox.dispatcher

Privilege model (ADR-025):
  Connects as ``contractradar_app`` (NOSUPERUSER, NOBYPASSRLS).
  Each DB call sets transaction-local ``app.bypass_rls=on`` via ``db.py``.
  Browser/API paths must never set this GUC; only trusted workers/dispatcher.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import timedelta
from typing import Any, Optional

from document_intelligence.arq_queue import create_arq_redis, get_arq_queue_name
from document_intelligence.config import get_settings
from document_intelligence.db import db
from document_intelligence.logging import configure_logging
from document_intelligence.safe_errors import (
    LogThrottle,
    classify_dispatcher_error,
    describe_safe_exception,
)
from document_intelligence.timeutil import utc_now_naive

logger = logging.getLogger(__name__)

PROCESS_DOCUMENT_EVENT_TYPE = "process_document_version"
HEARTBEAT_KEY_SUFFIX = "outbox-dispatcher:heartbeat"
HEARTBEAT_TTL_SECONDS = 60

# Columns referenced by dispatcher SQL — must match Prisma @@map("outbox_event")
# camelCase columns (no @map) exactly as created in migrations.
OUTBOX_SQL_IDENTIFIERS = (
    "outbox_event",
    "id",
    "eventType",
    "payload",
    "idempotencyKey",
    "correlationId",
    "attempts",
    "status",
    "availableAt",
    "updatedAt",
    "dispatchedAt",
    "lastErrorSafe",
)


async def _db_identity() -> tuple[Optional[str], Optional[str]]:
    try:
        row = await db.fetchrow("SELECT current_user AS db_user, current_database() AS database")
        if row is None:
            return None, None
        return str(row["db_user"]), str(row["database"])
    except Exception:  # noqa: BLE001
        return None, None


async def claim_pending(limit: int = 20) -> list[Any]:
    now = utc_now_naive()
    rows = await db.fetch(
        '''
        UPDATE outbox_event
        SET status = 'DISPATCHING', attempts = attempts + 1, "updatedAt" = $1
        WHERE id IN (
          SELECT id FROM outbox_event
          WHERE status IN ('PENDING', 'FAILED')
            AND "availableAt" <= $1
          ORDER BY "availableAt" ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "eventType", payload, "idempotencyKey", "correlationId", attempts
        ''',
        now,
        limit,
    )
    return rows


async def mark_dispatched(event_id: str) -> None:
    now = utc_now_naive()
    await db.execute(
        '''
        UPDATE outbox_event
        SET status = 'DISPATCHED', "dispatchedAt" = $2, "updatedAt" = $2, "lastErrorSafe" = NULL
        WHERE id = $1
        ''',
        event_id,
        now,
    )


async def mark_failed(event_id: str, attempts: int, error: str, max_attempts: int) -> None:
    status = "DEAD_LETTERED" if attempts >= max_attempts else "FAILED"
    delay = min(300, 2 ** min(attempts, 8))
    now = utc_now_naive()
    await db.execute(
        '''
        UPDATE outbox_event
        SET status = $2::"OutboxStatus",
            "lastErrorSafe" = $3,
            "availableAt" = $4,
            "updatedAt" = $5
        WHERE id = $1
        ''',
        event_id,
        status,
        error[:500],
        now + timedelta(seconds=delay),
        now,
    )


def heartbeat_redis_key(queue_name: Optional[str] = None) -> str:
    base = queue_name or get_arq_queue_name()
    return f"{base}:{HEARTBEAT_KEY_SUFFIX}"


async def write_heartbeat(*, detail: Optional[dict[str, Any]] = None) -> str:
    settings = get_settings()
    key = heartbeat_redis_key(settings.arq_queue_name)
    redis = await create_arq_redis()
    try:
        payload = {
            "ts": utc_now_naive().isoformat() + "Z",
            "arq_queue_name": settings.arq_queue_name,
            **(detail or {}),
        }
        await redis.set(key, json.dumps(payload), ex=HEARTBEAT_TTL_SECONDS)
        return key
    finally:
        await redis.close()


async def read_heartbeat() -> Optional[dict[str, Any]]:
    settings = get_settings()
    key = heartbeat_redis_key(settings.arq_queue_name)
    redis = await create_arq_redis()
    try:
        raw = await redis.get(key)
        if not raw:
            return None
        text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    finally:
        await redis.close()


def _parse_payload(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8")
    if isinstance(raw, str):
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("outbox_payload_not_object")


async def dispatch_once() -> int:
    settings = get_settings()
    rows = await claim_pending()
    if not rows:
        await write_heartbeat(detail={"claimed": 0})
        return 0

    redis = await create_arq_redis()
    dispatched = 0
    try:
        for row in rows:
            event_id = str(row["id"])
            event_type = str(row["eventType"])
            try:
                if event_type != PROCESS_DOCUMENT_EVENT_TYPE:
                    raise ValueError(f"unknown_event_type:{event_type}")
                payload = _parse_payload(row["payload"])
                required = ("processingRunId", "documentVersionId", "correlationId")
                missing = [k for k in required if not payload.get(k)]
                if missing:
                    raise ValueError(f"payload_missing:{','.join(missing)}")

                job = await redis.enqueue_job(
                    "process_document_version",
                    processing_run_id=payload["processingRunId"],
                    document_version_id=payload["documentVersionId"],
                    correlation_id=payload["correlationId"],
                    _job_id=row["idempotencyKey"],
                    _queue_name=settings.arq_queue_name,
                )
                await mark_dispatched(event_id)
                dispatched += 1
                logger.info(
                    "outbox_dispatched",
                    extra={
                        "outbox_id": event_id,
                        "job_id": job.job_id if job else row["idempotencyKey"],
                        "correlation_id": payload["correlationId"],
                    },
                )
            except Exception as exc:  # noqa: BLE001
                safe = describe_safe_exception(
                    exc,
                    stage="dispatch_event",
                    operation="enqueue_or_mark",
                    outbox_id=event_id,
                    attempts=int(row["attempts"]),
                )
                await mark_failed(
                    event_id,
                    int(row["attempts"]),
                    f"{safe['exception_class']}:{safe['exception_message']}",
                    settings.outbox_max_attempts,
                )
                logger.warning(
                    "outbox_dispatch_failed",
                    extra={"safe_fields": safe},
                )
    finally:
        await redis.close()

    await write_heartbeat(detail={"claimed": len(rows), "dispatched": dispatched})
    return dispatched


async def probe_pending_access() -> dict[str, Any]:
    """Prove outbox table + RLS bypass + timestamp binding without claiming rows."""
    now = utc_now_naive()
    row = await db.fetchrow(
        '''
        SELECT count(*)::int AS pending_count
        FROM outbox_event
        WHERE status IN ('PENDING', 'FAILED')
          AND "availableAt" <= $1
        ''',
        now,
    )
    db_user, database = await _db_identity()
    return {
        "pending_count": int(row["pending_count"]) if row else 0,
        "db_user": db_user,
        "database": database,
        "rls_bypass_set": True,
        "timestamp_binding": "utc_naive",
    }


async def run_readiness_check() -> dict[str, Any]:
    """Single successful polling iteration proof (not PID liveness)."""
    settings = get_settings()
    result: dict[str, Any] = {
        "ok": False,
        "arq_queue_name": settings.arq_queue_name,
        "stage": "start",
    }
    await db.connect()
    result["stage"] = "db_connected"
    result["connection_ok"] = True
    try:
        access = await probe_pending_access()
        result.update(access)
        result["stage"] = "outbox_query_ok"
        result["transaction_begun"] = True

        redis = await create_arq_redis()
        try:
            pong = await redis.ping()
            result["redis_ping"] = bool(pong)
            result["stage"] = "redis_ok"
        finally:
            await redis.close()

        # Empty claim proves UPDATE path + FOR UPDATE SKIP LOCKED + datetime bind.
        await claim_pending(limit=0)
        result["stage"] = "claim_pending_ok"

        key = await write_heartbeat(detail={"readiness": True})
        result["heartbeat_key"] = key
        result["stage"] = "heartbeat_ok"
        result["ok"] = True
        return result
    except Exception as exc:  # noqa: BLE001
        db_user, database = await _db_identity()
        safe = describe_safe_exception(
            exc,
            stage=str(result.get("stage")),
            operation="readiness",
            db_user=db_user,
            database=database,
            connection_ok=bool(result.get("connection_ok")),
            transaction_begun=bool(result.get("transaction_begun")),
            rls_bypass_set=True,
        )
        result["ok"] = False
        result["error"] = safe
        raise
    finally:
        await db.close()


async def run_loop() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    await db.connect()
    db_user, database = await _db_identity()
    logger.info(
        "outbox_dispatcher_started",
        extra={
            "poll": settings.outbox_poll_seconds,
            "arq_queue_name": settings.arq_queue_name,
            "db_user": db_user,
            "database": database,
            "rls_bypass_set": True,
        },
    )
    throttle = LogThrottle(window_seconds=30.0)
    consecutive_terminal = 0
    try:
        while True:
            try:
                count = await dispatch_once()
                consecutive_terminal = 0
                if count:
                    logger.info("outbox_dispatch_batch", extra={"dispatched": count})
            except Exception as exc:  # noqa: BLE001
                classification = classify_dispatcher_error(exc)
                safe = describe_safe_exception(
                    exc,
                    stage="dispatch_once",
                    operation="claim_or_enqueue_batch",
                    db_user=db_user,
                    database=database,
                    connection_ok=True,
                    transaction_begun=True,
                    rls_bypass_set=True,
                )
                fingerprint = (
                    f"{safe['exception_class']}|{safe['sqlstate']}|{safe['exception_message']}"
                )
                emit, suppressed = throttle.should_emit(fingerprint, time.monotonic())
                if emit:
                    logger.exception(
                        "outbox_loop_error",
                        extra={
                            "safe_fields": safe,
                            "suppressed_count": suppressed,
                            "classification": classification,
                        },
                    )
                if classification == "terminal":
                    consecutive_terminal += 1
                    if consecutive_terminal >= 3:
                        logger.error(
                            "outbox_dispatcher_terminal_halt",
                            extra={
                                "safe_fields": safe,
                                "consecutive_terminal": consecutive_terminal,
                            },
                        )
                        raise SystemExit(2) from exc
                else:
                    consecutive_terminal = 0
            await asyncio.sleep(settings.outbox_poll_seconds)
    finally:
        await db.close()


def main() -> None:
    asyncio.run(run_loop())


if __name__ == "__main__":
    main()
