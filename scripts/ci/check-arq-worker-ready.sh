#!/usr/bin/env bash
# Prove an ARQ worker is alive and listening on ARQ_QUEUE_NAME (not merely Redis PING).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}/services/document-intelligence"

export APP_ENV="${APP_ENV:-test}"
export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
export ARQ_QUEUE_NAME="${ARQ_QUEUE_NAME:-contractradar:document-processing}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN:?token required}"

PID_FILE="${ARQ_WORKER_PID_FILE:-/tmp/arq-worker.pid}"
LOG_FILE="${ARQ_WORKER_LOG:-/tmp/arq-worker.log}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "FAIL: ARQ worker pid file missing (${PID_FILE})"
  tail -n 80 "${LOG_FILE}" 2>/dev/null || true
  exit 1
fi
PID="$(cat "${PID_FILE}")"
if ! kill -0 "${PID}" 2>/dev/null; then
  echo "FAIL: ARQ worker pid ${PID} is not alive"
  tail -n 80 "${LOG_FILE}" 2>/dev/null || true
  exit 1
fi
echo "OK arq worker pid=${PID} alive"

python - <<'PY'
import asyncio
import os
import sys
import uuid

from document_intelligence.arq_queue import (
    create_arq_redis,
    get_arq_queue_name,
    health_check_key,
    sanitize_redis_url_for_logs,
)
from document_intelligence.config import reset_settings_cache
from document_intelligence.workers import WorkerSettings
from arq.jobs import Job, JobStatus

reset_settings_cache()


async def main() -> int:
    queue = get_arq_queue_name()
    worker_queue = getattr(WorkerSettings, "queue_name", None)
    print("redis", sanitize_redis_url_for_logs(os.environ["REDIS_URL"]))
    print("enqueue_queue_name", queue)
    print("worker_queue_name", worker_queue)
    print("registered_functions", [getattr(f, "__name__", str(f)) for f in WorkerSettings.functions])
    if worker_queue != queue:
        print(f"FAIL: worker queue {worker_queue!r} != configured {queue!r}")
        return 1

    redis = await create_arq_redis()
    try:
        health = await redis.get(health_check_key(queue))
        print("health_check_key", health_check_key(queue), "present=", bool(health))
        correlation_id = str(uuid.uuid4())
        job_id = f"arq_live_probe:ready-{uuid.uuid4().hex}"
        job = await redis.enqueue_job(
            "arq_live_probe",
            correlation_id=correlation_id,
            _job_id=job_id,
            _queue_name=queue,
        )
        if job is None:
            print("FAIL: could not enqueue readiness probe")
            return 1
        for _ in range(60):
            status = await Job(job_id, redis, _queue_name=queue).status()
            if status == JobStatus.complete:
                info = await Job(job_id, redis, _queue_name=queue).result_info()
                assert info is not None and info.success is True
                assert info.result == {"status": "ok", "correlation_id": correlation_id}
                print("OK arq worker consumed readiness probe")
                return 0
            await asyncio.sleep(0.5)
        print("FAIL: readiness probe stayed", await Job(job_id, redis, _queue_name=queue).status())
        return 1
    finally:
        await redis.close()


sys.exit(asyncio.run(main()))
PY
