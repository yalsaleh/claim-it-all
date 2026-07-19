"""Prove a live ARQ worker can consume an id-only job (missing DB rows → safe no-op)."""

from __future__ import annotations

import asyncio
import os
import time

import pytest

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


async def _enqueue_and_wait(redis_url: str) -> str:
    from arq import create_pool
    from arq.connections import RedisSettings
    from arq.jobs import Job

    redis = await create_pool(RedisSettings.from_dsn(redis_url))
    job_id = f"process_document_version:live-consume-{int(time.time())}"
    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id="00000000-0000-4000-8000-000000000101",
            document_version_id="00000000-0000-4000-8000-000000000102",
            correlation_id="00000000-0000-4000-8000-000000000103",
            _job_id=job_id,
        )
        assert job is not None
        # Poll for completion up to 30s (worker must be running).
        deadline = time.time() + 30
        while time.time() < deadline:
            info = await Job(job_id, redis).info()
            if info and info.success is not None:
                return "completed" if info.success else "failed"
            await asyncio.sleep(0.5)
        return "timeout"
    finally:
        await redis.close()


def test_live_worker_consumes_id_only_job() -> None:
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

    result = asyncio.run(_enqueue_and_wait(redis_url))
    assert result in {"completed", "failed"}, f"Worker did not consume job: {result}"
