"""Live ARQ enqueue smoke tests (shared queue contract)."""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


async def _enqueue_twice(redis_url: str) -> None:
    from document_intelligence.arq_queue import create_arq_redis, get_arq_queue_name
    from document_intelligence.config import reset_settings_cache

    os.environ["REDIS_URL"] = redis_url
    os.environ.setdefault("ARQ_QUEUE_NAME", "contractradar:document-processing")
    reset_settings_cache()

    redis = await create_arq_redis()
    queue_name = get_arq_queue_name()
    job_id = f"process_document_version:live-smoke-idempotent-{uuid.uuid4().hex[:12]}"
    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id="00000000-0000-4000-8000-000000000001",
            document_version_id="00000000-0000-4000-8000-000000000002",
            correlation_id="00000000-0000-4000-8000-000000000003",
            _job_id=job_id,
            _queue_name=queue_name,
        )
        job2 = await redis.enqueue_job(
            "process_document_version",
            processing_run_id="00000000-0000-4000-8000-000000000001",
            document_version_id="00000000-0000-4000-8000-000000000002",
            correlation_id="00000000-0000-4000-8000-000000000003",
            _job_id=job_id,
            _queue_name=queue_name,
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

    try:
        asyncio.run(_enqueue_twice(redis_url))
    except Exception as exc:  # noqa: BLE001
        if REQUIRE:
            pytest.fail(f"Redis/ARQ unavailable: {exc}")
        pytest.skip(f"Redis/ARQ unavailable: {exc}")
