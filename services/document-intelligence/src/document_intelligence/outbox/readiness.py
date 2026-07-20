"""Outbox dispatcher readiness probe (not PID liveness).

Run: python -m document_intelligence.outbox.readiness
"""

from __future__ import annotations

import asyncio
import json

from document_intelligence.logging import configure_logging
from document_intelligence.outbox.dispatcher import run_readiness_check
from document_intelligence.safe_errors import describe_safe_exception


async def _main() -> int:
    configure_logging("info")
    try:
        result = await run_readiness_check()
        print(json.dumps({"dispatcher_ready": True, **result}, default=str))
        return 0
    except Exception as exc:  # noqa: BLE001
        safe = describe_safe_exception(exc, stage="readiness", operation="run_readiness_check")
        print(json.dumps({"dispatcher_ready": False, "error": safe}, default=str))
        return 1


def main() -> None:
    raise SystemExit(asyncio.run(_main()))


if __name__ == "__main__":
    main()
