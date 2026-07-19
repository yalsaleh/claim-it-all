from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from document_intelligence import __version__
from document_intelligence.arq_queue import create_arq_redis, sanitize_redis_url_for_logs
from document_intelligence.config import get_settings
from document_intelligence.db import db
from document_intelligence.logging import configure_logging
from document_intelligence.malware.clamav import maybe_clamav
from document_intelligence.storage import head_ok

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(
    title="ContractRadar Document Intelligence",
    version=__version__,
    docs_url=None if settings.app_env == "production" else "/docs",
    redoc_url=None,
)

# Max clock skew for signed internal requests (seconds)
_INTERNAL_MAX_SKEW = 300


class EnqueueProcessBody(BaseModel):
    processing_run_id: str = Field(min_length=8)
    document_version_id: str = Field(min_length=8)
    correlation_id: str = Field(min_length=8)


def _require_token(token: Optional[str]) -> None:
    if token != settings.internal_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def _require_internal(
    token: Optional[str],
    timestamp: Optional[str],
    signature: Optional[str],
    body_raw: bytes,
) -> None:
    """Token + optional HMAC(timestamp + body) for replay resistance."""
    _require_token(token)
    if settings.app_env.lower() in {"production", "staging"}:
        if not timestamp or not signature:
            raise HTTPException(status_code=401, detail="Signed internal request required")
        try:
            ts = int(timestamp)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid timestamp") from exc
        if abs(int(time.time()) - ts) > _INTERNAL_MAX_SKEW:
            raise HTTPException(status_code=401, detail="Expired internal request")
        expected = hmac.new(
            settings.internal_token.encode("utf-8"),
            f"{timestamp}.".encode() + body_raw,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")


@app.on_event("startup")
async def on_startup() -> None:
    # Force settings validation at boot (refuses fake_test outside tests).
    get_settings()
    try:
        await db.connect()
    except Exception:
        # Readiness will report DB down; process still starts for liveness.
        pass


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await db.close()


@app.get("/health/live")
def live() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": __version__,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


async def _redis_ok() -> bool:
    try:
        redis = await create_arq_redis()
        try:
            pong = await redis.ping()
            return bool(pong)
        finally:
            await redis.close()
    except Exception:
        return False


async def _db_ok() -> bool:
    try:
        await db.fetchrow("SELECT 1 AS ok")
        return True
    except Exception:
        return False


def _clamav_ok() -> Dict[str, str]:
    if settings.malware_scanner == "fake_test":
        return {"status": "ok", "mode": "fake_test"}
    if settings.malware_scanner == "disabled_reject_all":
        return {"status": "error", "mode": "disabled_reject_all"}
    scanner = maybe_clamav(settings.clamav_host, settings.clamav_port)
    if scanner is None:
        return {"status": "error", "mode": "clamav", "detail": "host_unset"}
    # Lightweight TCP connect via scan of empty buffer path — use ping-style socket
    try:
        import socket

        with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=3):
            return {"status": "ok", "mode": "clamav"}
    except OSError:
        return {"status": "error", "mode": "clamav", "detail": "unreachable"}


@app.get("/health/ready")
async def ready(
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
) -> Dict[str, Any]:
    _require_token(x_internal_token)
    checks = {
        "config": {"status": "ok"},
        "database": {"status": "ok" if await _db_ok() else "error"},
        "redis": {"status": "ok" if await _redis_ok() else "error"},
        "object_storage": {"status": "ok" if head_ok(settings.s3_bucket) else "error"},
        "malware_scanner": _clamav_ok(),
    }
    ready_ok = all(c.get("status") == "ok" for c in checks.values())
    return {
        "status": "ok" if ready_ok else "not_ready",
        "service": settings.service_name,
        "version": __version__,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "checks": checks,
    }


@app.post("/internal/jobs/process-document")
async def enqueue_process_document(
    body: EnqueueProcessBody,
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
    x_internal_timestamp: Optional[str] = Header(default=None, alias="X-Internal-Timestamp"),
    x_internal_signature: Optional[str] = Header(default=None, alias="X-Internal-Signature"),
) -> Dict[str, Any]:
    """Direct enqueue (legacy/admin). Prefer transactional outbox dispatcher."""
    raw = body.model_dump_json().encode("utf-8")
    _require_internal(x_internal_token, x_internal_timestamp, x_internal_signature, raw)
    redis = await create_arq_redis()
    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id=body.processing_run_id,
            document_version_id=body.document_version_id,
            correlation_id=body.correlation_id,
            _job_id=f"process_document_version:{body.processing_run_id}",
            _queue_name=settings.arq_queue_name,
        )
    finally:
        await redis.close()
    return {
        "status": "queued",
        "job_id": job.job_id if job else f"process_document_version:{body.processing_run_id}",
        "correlation_id": body.correlation_id,
        "queue_name": settings.arq_queue_name,
        "redis": sanitize_redis_url_for_logs(settings.redis_url),
    }


def run() -> None:
    import uvicorn

    uvicorn.run("document_intelligence.main:app", host="0.0.0.0", port=8000, reload=False)
