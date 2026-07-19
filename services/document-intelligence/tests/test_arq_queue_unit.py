"""Unit tests for shared ARQ queue configuration helpers."""

from __future__ import annotations

import os

from document_intelligence.arq_queue import (
    DEFAULT_ARQ_QUEUE_NAME,
    health_check_key,
    sanitize_redis_url_for_logs,
    strip_prisma_schema_param,
)
from document_intelligence.config import reset_settings_cache


def test_default_queue_name_is_explicit() -> None:
    assert DEFAULT_ARQ_QUEUE_NAME == "contractradar:document-processing"
    assert health_check_key(DEFAULT_ARQ_QUEUE_NAME) == (
        "contractradar:document-processing:health-check"
    )


def test_strip_prisma_schema_param() -> None:
    raw = "postgresql://u:p@127.0.0.1:5432/db?schema=public&sslmode=prefer"
    cleaned = strip_prisma_schema_param(raw)
    assert "schema=" not in cleaned
    assert "sslmode=prefer" in cleaned


def test_sanitize_redis_url_hides_credentials() -> None:
    info = sanitize_redis_url_for_logs("redis://user:secret@127.0.0.1:6379/2")
    assert info["host"] == "127.0.0.1"
    assert info["database"] == 2
    assert "secret" not in str(info)


def test_settings_arq_queue_name_from_env() -> None:
    os.environ["DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN"] = "test-internal-token-32chars"
    os.environ["APP_ENV"] = "test"
    os.environ["ALLOW_DEV_DEFAULTS"] = "true"
    os.environ["MALWARE_SCANNER"] = "fake_test"
    os.environ["ARQ_QUEUE_NAME"] = "contractradar:document-processing"
    reset_settings_cache()
    from document_intelligence.config import get_settings

    assert get_settings().arq_queue_name == "contractradar:document-processing"
    reset_settings_cache()
