"""Poll Postgres outbox and enqueue ARQ jobs (at-least-once).

Run: python -m document_intelligence.outbox.dispatcher
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from document_intelligence.arq_queue import create_arq_redis
from document_intelligence.config import get_settings
from document_intelligence.db import db
from document_intelligence.logging import configure_logging

logger = logging.getLogger(__name__)


async def claim_pending(limit: int = 20) -> list[Any]:
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
        datetime.now(timezone.utc),
        limit,
    )
    return rows


async def mark_dispatched(event_id: str) -> None:
    await db.execute(
        '''
        UPDATE outbox_event
        SET status = 'DISPATCHED', "dispatchedAt" = $2, "updatedAt" = $2, "lastErrorSafe" = NULL
        WHERE id = $1
        ''',
        event_id,
        datetime.now(timezone.utc),
    )


async def mark_failed(event_id: str, attempts: int, error: str, max_attempts: int) -> None:
    status = "DEAD_LETTERED" if attempts >= max_attempts else "FAILED"
    delay = min(300, 2 ** min(attempts, 8))
    await db.execute(
        '''
        UPDATE outbox_event
        SET status = $2, "lastErrorSafe" = $3, "availableAt" = $4, "updatedAt" = $5
        WHERE id = $1
        ''',
        event_id,
        status,
        error[:500],
        datetime.now(timezone.utc) + timedelta(seconds=delay),
        datetime.now(timezone.utc),
    )


async def dispatch_once() -> int:
    settings = get_settings()
    rows = await claim_pending()
    if not rows:
        return 0

    redis = await create_arq_redis()
    dispatched = 0
    try:
        for row in rows:
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            try:
                job = await redis.enqueue_job(
                    "process_document_version",
                    processing_run_id=payload["processingRunId"],
                    document_version_id=payload["documentVersionId"],
                    correlation_id=payload["correlationId"],
                    _job_id=row["idempotencyKey"],
                    _queue_name=settings.arq_queue_name,
                )
                await mark_dispatched(row["id"])
                dispatched += 1
                logger.info(
                    "outbox_dispatched",
                    extra={
                        "outbox_id": row["id"],
                        "job_id": job.job_id if job else row["idempotencyKey"],
                        "correlation_id": row["correlationId"],
                    },
                )
            except Exception as exc:  # noqa: BLE001
                await mark_failed(
                    row["id"],
                    int(row["attempts"]),
                    f"{exc.__class__.__name__}",
                    settings.outbox_max_attempts,
                )
                logger.warning(
                    "outbox_dispatch_failed",
                    extra={"outbox_id": row["id"], "error": exc.__class__.__name__},
                )
    finally:
        await redis.close()
    return dispatched


async def run_loop() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    await db.connect()
    logger.info(
        "outbox_dispatcher_started",
        extra={
            "poll": settings.outbox_poll_seconds,
            "arq_queue_name": settings.arq_queue_name,
        },
    )
    try:
        while True:
            try:
                count = await dispatch_once()
                if count:
                    logger.info("outbox_dispatch_batch", extra={"dispatched": count})
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "outbox_loop_error",
                    extra={"error": exc.__class__.__name__, "detail": str(exc)[:200]},
                )
            await asyncio.sleep(settings.outbox_poll_seconds)
    finally:
        await db.close()


def main() -> None:
    asyncio.run(run_loop())


if __name__ == "__main__":
    main()
