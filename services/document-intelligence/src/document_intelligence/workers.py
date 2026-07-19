"""ARQ worker entrypoint.

Run:
  arq document_intelligence.workers.WorkerSettings
"""

from typing import Any

from document_intelligence.arq_queue import redis_settings_from_url
from document_intelligence.config import Settings, get_settings
from document_intelligence.db import db
from document_intelligence.jobs.arq_probe import arq_live_probe
from document_intelligence.jobs.process_document import process_document_version

_worker_settings: Settings = get_settings()


async def startup(ctx: dict[str, Any]) -> None:
    await db.connect()


async def shutdown(ctx: dict[str, Any]) -> None:
    await db.close()


class WorkerSettings:
    """Queue name and Redis must match producers (dispatcher / live tests / API)."""

    functions = [process_document_version, arq_live_probe]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 2
    job_timeout = 600
    keep_result = 3600
    # Evaluated at import; CI exports ARQ_QUEUE_NAME / REDIS_URL before `arq` starts.
    queue_name = _worker_settings.arq_queue_name
    redis_settings = redis_settings_from_url(_worker_settings.redis_url)
    health_check_interval = 15


def run_worker() -> None:
    from arq.worker import run_worker as arq_run

    arq_run(WorkerSettings)  # type: ignore[arg-type]
