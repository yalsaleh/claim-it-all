"""Shared ARQ queue contract for worker, dispatcher, API, and live tests.

Producers and consumers must use the same queue name and Redis database.
Do not rely on ARQ's implicit default (`arq:queue`) in application code.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse, urlunparse

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from document_intelligence.config import get_settings

DEFAULT_ARQ_QUEUE_NAME = "contractradar:document-processing"


def get_arq_queue_name() -> str:
    return get_settings().arq_queue_name


def redis_settings_from_url(redis_url: str) -> RedisSettings:
    return RedisSettings.from_dsn(redis_url)


def sanitize_redis_url_for_logs(redis_url: str) -> dict[str, Any]:
    parsed = urlparse(redis_url)
    db = 0
    if parsed.path and parsed.path not in {"", "/"}:
        try:
            db = int(parsed.path.lstrip("/").split("/")[0] or "0")
        except ValueError:
            db = 0
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 6379,
        "database": db,
        "scheme": parsed.scheme or "redis",
    }


def strip_prisma_schema_param(database_url: str) -> str:
    """asyncpg rejects/forwards Prisma's `?schema=` as a server GUC — strip it."""
    parsed = urlparse(database_url)
    if not parsed.query:
        return database_url
    kept = [
        part
        for part in parsed.query.split("&")
        if part and not part.lower().startswith("schema=")
    ]
    return urlunparse(parsed._replace(query="&".join(kept)))


async def create_arq_redis() -> ArqRedis:
    settings = get_settings()
    return await create_pool(
        redis_settings_from_url(settings.redis_url),
        default_queue_name=settings.arq_queue_name,
    )


def health_check_key(queue_name: str | None = None) -> str:
    name = queue_name or get_arq_queue_name()
    return f"{name}:health-check"
