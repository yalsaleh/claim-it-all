"""Controlled ARQ connectivity probe (not a document-processing job)."""

from typing import Any


async def arq_live_probe(
    ctx: dict[str, Any],
    *,
    correlation_id: str,
) -> dict[str, str]:
    """Return a safe structured result so CI can prove worker consumption."""
    _ = ctx
    return {"status": "ok", "correlation_id": correlation_id}
