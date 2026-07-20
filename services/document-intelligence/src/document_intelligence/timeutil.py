"""Timestamp helpers for Prisma TIMESTAMP(3) columns (without time zone).

asyncpg rejects timezone-aware Python datetimes when binding to
``TIMESTAMP WITHOUT TIME ZONE``. Persist UTC as naive datetimes.
"""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    """Current UTC instant as a naive datetime (Prisma/asyncpg safe)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc_naive(value: datetime) -> datetime:
    """Normalize to naive UTC for TIMESTAMP WITHOUT TIME ZONE columns."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)
