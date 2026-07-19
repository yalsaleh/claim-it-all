"""Prove a live ARQ worker consumes jobs on the shared queue contract.

Pinned: arq==0.26.1
- Job.info() while queued returns JobDef (no .success)
- After completion use Job.status() / Job.result_info() → JobResult
"""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

import pytest

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


def _safe_worker_log_tail(lines: int = 40) -> list[str]:
    path = Path(os.environ.get("ARQ_WORKER_LOG", "/tmp/arq-worker.log"))
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8", errors="replace").splitlines()
    sanitized: list[str] = []
    for line in text[-lines:]:
        lower = line.lower()
        if any(s in lower for s in ("password", "secret", "token=", "authorization")):
            sanitized.append("[redacted-line]")
        else:
            sanitized.append(line[:300])
    return sanitized


def _worker_pid() -> Optional[int]:
    pid_path = Path(os.environ.get("ARQ_WORKER_PID_FILE", "/tmp/arq-worker.pid"))
    if not pid_path.is_file():
        return None
    try:
        return int(pid_path.read_text().strip())
    except ValueError:
        return None


def _pid_alive(pid: Optional[int]) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


async def _print_queue_diagnostics(redis_url: str) -> dict[str, object]:
    import arq

    from document_intelligence.arq_queue import (
        create_arq_redis,
        get_arq_queue_name,
        health_check_key,
        sanitize_redis_url_for_logs,
    )
    from document_intelligence.config import get_settings
    from document_intelligence.workers import WorkerSettings

    settings = get_settings()
    queue_name = get_arq_queue_name()
    redis = await create_arq_redis()
    try:
        queued = await redis.zcard(queue_name)
        in_progress_keys = await redis.keys("arq:in-progress:*")
        health = await redis.get(health_check_key(queue_name))
        pid = _worker_pid()
        diag = {
            "arq_version": getattr(arq, "__version__", "unknown"),
            "redis": sanitize_redis_url_for_logs(redis_url),
            "enqueue_queue_name": queue_name,
            "worker_queue_name": getattr(WorkerSettings, "queue_name", None),
            "health_check_key": health_check_key(queue_name),
            "health_check_present": bool(health),
            "registered_functions": [
                getattr(f, "__name__", str(f)) for f in WorkerSettings.functions
            ],
            "worker_pid": pid,
            "worker_alive": _pid_alive(pid),
            "queued_job_count": int(queued),
            "in_progress_key_count": len(in_progress_keys),
            "worker_log_tail": _safe_worker_log_tail(),
            "settings_queue": settings.arq_queue_name,
        }
        print("arq_live_diagnostics", diag)
        return diag
    finally:
        await redis.close()


async def _enqueue_probe_and_assert(redis_url: str) -> dict[str, object]:
    from arq.jobs import Job, JobResult, JobStatus

    from document_intelligence.arq_queue import create_arq_redis, get_arq_queue_name

    queue_name = get_arq_queue_name()
    redis = await create_arq_redis()
    correlation_id = str(uuid.uuid4())
    job_id = f"arq_live_probe:{uuid.uuid4().hex}"
    try:
        job = await redis.enqueue_job(
            "arq_live_probe",
            correlation_id=correlation_id,
            _job_id=job_id,
            _queue_name=queue_name,
        )
        assert job is not None

        deadline = asyncio.get_event_loop().time() + 45
        while asyncio.get_event_loop().time() < deadline:
            status = await Job(job_id, redis, _queue_name=queue_name).status()
            if status == JobStatus.complete:
                result_info = await Job(job_id, redis, _queue_name=queue_name).result_info()
                assert isinstance(result_info, JobResult)
                assert result_info.success is True
                assert result_info.function == "arq_live_probe"
                assert result_info.result == {
                    "status": "ok",
                    "correlation_id": correlation_id,
                }
                return {
                    "status": status.value,
                    "result": result_info.result,
                    "job_id": job_id,
                    "queue_name": queue_name,
                }
            await asyncio.sleep(0.5)

        final = await Job(job_id, redis, _queue_name=queue_name).status()
        raise AssertionError(
            f"Probe job not consumed (queue={queue_name}, status={final}). "
            f"See arq_live_diagnostics above and artifacts/arq-worker.log"
        )
    finally:
        await redis.close()


async def _enqueue_missing_run_and_assert() -> dict[str, object]:
    from arq.jobs import Job, JobResult, JobStatus

    from document_intelligence.arq_queue import create_arq_redis, get_arq_queue_name

    queue_name = get_arq_queue_name()
    redis = await create_arq_redis()
    run_token = uuid.uuid4().hex
    job_id = f"process_document_version:live-consume-{run_token}"
    processing_run_id = "00000000-0000-4000-8000-000000000101"
    document_version_id = "00000000-0000-4000-8000-000000000102"
    correlation_id = str(uuid.uuid4())
    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            _job_id=job_id,
            _queue_name=queue_name,
        )
        assert job is not None

        deadline = asyncio.get_event_loop().time() + 45
        while asyncio.get_event_loop().time() < deadline:
            status = await Job(job_id, redis, _queue_name=queue_name).status()
            if status == JobStatus.complete:
                result_info = await Job(job_id, redis, _queue_name=queue_name).result_info()
                assert isinstance(result_info, JobResult)
                assert result_info.success is True
                assert result_info.result == {"status": "missing_run"}
                assert result_info.kwargs["correlation_id"] == correlation_id
                return {"status": status.value, "result": result_info.result}
            await asyncio.sleep(0.5)
        final = await Job(job_id, redis, _queue_name=queue_name).status()
        raise AssertionError(f"missing_run job not consumed (status={final})")
    finally:
        await redis.close()


def test_live_worker_probe_reaches_complete() -> None:
    if not LIVE:
        if REQUIRE:
            pytest.fail("REQUIRE_LIVE_INGESTION_TESTS set but live suite not enabled")
        pytest.skip("LIVE_INGESTION_TESTS not enabled")
    if os.environ.get("LIVE_ARQ_WORKER", "").lower() not in {"1", "true", "yes"}:
        if REQUIRE and os.environ.get("CI"):
            pytest.fail("LIVE_ARQ_WORKER must be true in CI live-ingestion job")
        pytest.skip("LIVE_ARQ_WORKER not enabled (start ARQ worker first)")

    redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    os.environ.setdefault("ALLOW_DEV_DEFAULTS", "true")
    os.environ.setdefault("ARQ_QUEUE_NAME", "contractradar:document-processing")

    from document_intelligence.config import reset_settings_cache

    reset_settings_cache()

    async def _run() -> None:
        await _print_queue_diagnostics(redis_url)
        outcome = await _enqueue_probe_and_assert(redis_url)
        assert outcome["status"] == "complete"

    asyncio.run(_run())


def test_live_worker_missing_run_is_controlled_rejection() -> None:
    if not LIVE:
        if REQUIRE:
            pytest.fail("REQUIRE_LIVE_INGESTION_TESTS set but live suite not enabled")
        pytest.skip("LIVE_INGESTION_TESTS not enabled")
    if os.environ.get("LIVE_ARQ_WORKER", "").lower() not in {"1", "true", "yes"}:
        if REQUIRE and os.environ.get("CI"):
            pytest.fail("LIVE_ARQ_WORKER must be true in CI live-ingestion job")
        pytest.skip("LIVE_ARQ_WORKER not enabled (start ARQ worker first)")

    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    os.environ.setdefault("ALLOW_DEV_DEFAULTS", "true")
    os.environ.setdefault("ARQ_QUEUE_NAME", "contractradar:document-processing")

    from document_intelligence.config import reset_settings_cache

    reset_settings_cache()
    outcome = asyncio.run(_enqueue_missing_run_and_assert())
    assert outcome["result"] == {"status": "missing_run"}
