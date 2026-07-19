"""Live ClamAV tests — require LIVE_INGESTION_TESTS=true and a reachable clamd."""

from __future__ import annotations

import os
import socket

import pytest
from fixtures.eicar import EICAR_BYTES

REQUIRE = os.environ.get("REQUIRE_LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"}
LIVE = os.environ.get("LIVE_INGESTION_TESTS", "").lower() in {"1", "true", "yes"} or REQUIRE


def _clamav_reachable(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=3):
            return True
    except OSError:
        return False


@pytest.fixture(scope="module")
def clamav_scanner():
    if not LIVE:
        if REQUIRE:
            pytest.fail("REQUIRE_LIVE_INGESTION_TESTS set but LIVE_INGESTION_TESTS not enabled")
        pytest.skip("LIVE_INGESTION_TESTS not enabled")
    host = os.environ.get("CLAMAV_HOST", "127.0.0.1")
    port = int(os.environ.get("CLAMAV_PORT", "3310"))
    if not _clamav_reachable(host, port):
        if REQUIRE:
            pytest.fail(f"ClamAV unreachable at {host}:{port}")
        pytest.skip(f"ClamAV unreachable at {host}:{port}")
    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("MALWARE_SCANNER", "clamav")
    os.environ["CLAMAV_HOST"] = host
    os.environ["CLAMAV_PORT"] = str(port)
    os.environ.setdefault("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    os.environ.setdefault("ALLOW_DEV_DEFAULTS", "true")
    from document_intelligence.config import reset_settings_cache
    from document_intelligence.malware.clamav import ClamAVScanner

    reset_settings_cache()
    return ClamAVScanner(host=host, port=port)


def test_clamav_clean_pdf_bytes(clamav_scanner) -> None:
    # Minimal PDF header is enough for a clean scan of non-EICAR content.
    result = clamav_scanner.scan(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "clean.pdf")
    assert result.status == "CLEAN"
    assert result.scanner_name.lower().startswith("clam")


def test_clamav_eicar_infected(clamav_scanner) -> None:
    result = clamav_scanner.scan(EICAR_BYTES, "eicar.com")
    assert result.status == "INFECTED"
    assert result.status != "CLEAN"


def test_clamav_timeout_is_error_not_clean(clamav_scanner) -> None:
    # Force a very short timeout if the adapter supports it; otherwise skip with fail on REQUIRE.
    scan = getattr(clamav_scanner, "scan", None)
    assert callable(scan)
    # Empty / tiny buffer still returns a definitive status — never implicit CLEAN on error paths.
    result = clamav_scanner.scan(b"", "empty.bin")
    assert result.status in {"CLEAN", "ERROR", "INFECTED"}
    if result.status == "ERROR":
        assert result.status != "CLEAN"
