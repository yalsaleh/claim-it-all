from typing import Any, AsyncIterator, Optional
from uuid import uuid4

import asyncpg

from document_intelligence.arq_queue import strip_prisma_schema_param
from document_intelligence.config import get_settings


class Database:
    def __init__(self) -> None:
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        if self._pool is None:
            dsn = strip_prisma_schema_param(get_settings().database_url)
            self._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def fetchrow(self, query: str, *args: Any) -> Optional[asyncpg.Record]:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("SELECT set_config('app.bypass_rls', 'on', true)")
                return await conn.fetchrow(query, *args)

    async def fetch(self, query: str, *args: Any) -> list[asyncpg.Record]:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("SELECT set_config('app.bypass_rls', 'on', true)")
                rows = await conn.fetch(query, *args)
                return list(rows)

    async def execute(self, query: str, *args: Any) -> str:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("SELECT set_config('app.bypass_rls', 'on', true)")
                result = await conn.execute(query, *args)
                return str(result)

    async def transaction(self) -> AsyncIterator[asyncpg.Connection]:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("SELECT set_config('app.bypass_rls', 'on', true)")
                yield conn


db = Database()


def new_id() -> str:
    return str(uuid4())
