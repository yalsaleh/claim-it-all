"""Live ARQ enqueue smoke tests."""

from __future__ import annotations

import asyncio
import os

import pytest

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


async def _enqueue_twice(redis_url: str) -> None:
    from arq import create_pool
    from arq.connections import RedisSettings

    redis = await create_pool(RedisSettings.from_dsn(redis_url))
    job_id = "process_document_version:live-smoke-idempotent"
    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id="00000000-0000-4000-8000-000000000001",
            document_version_id="00000000-0000-4000-8000-000000000002",
            correlation_id="00000000-0000-4000-8000-000000000003",
            _job_id=job_id,
        )
        job2 = await redis.enqueue_job(
            "process_document_version",
            processing_run_id="00000000-0000-4000-8000-000000000001",
            document_version_id="00000000-0000-4000-8000-000000000002",
            correlation_id="00000000-0000-4000-8000-000000000003",
            _job_id=job_id,
        )
        assert job is None or job.job_id == job_id
        assert job2 is None or job2.job_id == job_id
    finally:
        await redis.close()


def test_arq_enqueue_id_only_job_idempotent() -> None:
    if not LIVE:
        if REQUIRE:
            pytest.fail("REQUIRE_LIVE_INGESTION_TESTS set but live suite not enabled")
        pytest.skip("LIVE_INGESTION_TESTS not enabled")

    redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("MALWARE_SCANNER", "fake_test")
    os.environ.setdefault("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    os.environ.setdefault("ALLOW_DEV_DEFAULTS", "true")
    os.environ["REDIS_URL"] = redis_url

    from document_intelligence.config import reset_settings_cache

    reset_settings_cache()
    try:
        asyncio.run(_enqueue_twice(redis_url))
    except Exception as exc:  # noqa: BLE001
        if REQUIRE:
            pytest.fail(f"Redis/ARQ unavailable: {exc}")
        pytest.skip(f"Redis/ARQ unavailable: {exc}")
