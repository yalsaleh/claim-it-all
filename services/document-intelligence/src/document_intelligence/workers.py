"""ARQ worker entrypoint.

Run:
  arq document_intelligence.workers.WorkerSettings
"""

from typing import Any

from arq.connections import RedisSettings

from document_intelligence.config import get_settings
from document_intelligence.db import db
from document_intelligence.jobs.process_document import process_document_version


async def startup(ctx: dict[str, Any]) -> None:
    await db.connect()


async def shutdown(ctx: dict[str, Any]) -> None:
    await db.close()


class WorkerSettings:
    functions = [process_document_version]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 2
    job_timeout = 600
    keep_result = 3600
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)


def run_worker() -> None:
    from arq.worker import run_worker as arq_run

    arq_run(WorkerSettings)  # type: ignore[arg-type]
