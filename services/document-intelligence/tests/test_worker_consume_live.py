"""Prove a live ARQ worker can consume an id-only job (missing DB rows → controlled rejection).

Pinned dependency: arq==0.26.1
In 0.26.x, Job.info() returns JobDef while the job is queued (no .success).
After completion, prefer Job.status() == JobStatus.complete and Job.result_info() → JobResult.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


async def _enqueue_and_assert_consumed(redis_url: str) -> dict[str, object]:
    import arq
    from arq import create_pool
    from arq.connections import RedisSettings
    from arq.jobs import Job, JobResult, JobStatus

    arq_version = getattr(arq, "__version__", "unknown")
    assert arq_version.startswith("0.26"), f"Expected pinned arq 0.26.x, got {arq_version}"

    redis = await create_pool(RedisSettings.from_dsn(redis_url))
    run_token = uuid.uuid4().hex
    job_id = f"process_document_version:live-consume-{run_token}"
    processing_run_id = "00000000-0000-4000-8000-000000000101"
    document_version_id = "00000000-0000-4000-8000-000000000102"
    correlation_id = f"00000000-0000-4000-8000-{run_token[:12]}"

    try:
        job = await redis.enqueue_job(
            "process_document_version",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            _job_id=job_id,
        )
        assert job is not None

        queued = await Job(job_id, redis).info()
        assert queued is not None
        assert queued.function == "process_document_version"
        assert queued.kwargs == {
            "processing_run_id": processing_run_id,
            "document_version_id": document_version_id,
            "correlation_id": correlation_id,
        }
        deadline = asyncio.get_event_loop().time() + 45
        while asyncio.get_event_loop().time() < deadline:
            status = await Job(job_id, redis).status()
            if status == JobStatus.complete:
                result_info = await Job(job_id, redis).result_info()
                assert isinstance(result_info, JobResult)
                assert result_info.success is True
                assert result_info.function == "process_document_version"
                assert result_info.kwargs["correlation_id"] == correlation_id
                # Controlled rejection for nonexistent run IDs (not a worker crash).
                assert result_info.result == {"status": "missing_run"}
                # No longer queued / in progress.
                assert status not in {JobStatus.queued, JobStatus.in_progress, JobStatus.deferred}
                return {
                    "arq_version": arq_version,
                    "status": status.value,
                    "result": result_info.result,
                    "job_id": job_id,
                }
            if status == JobStatus.not_found:
                # Result may have expired; treat as failure for this suite.
                break
            await asyncio.sleep(0.5)

        final_status = await Job(job_id, redis).status()
        raise AssertionError(
            f"Worker did not reach JobStatus.complete (arq={arq_version}, status={final_status})"
        )
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

    outcome = asyncio.run(_enqueue_and_assert_consumed(redis_url))
    assert outcome["status"] == "complete"
    assert outcome["result"] == {"status": "missing_run"}
