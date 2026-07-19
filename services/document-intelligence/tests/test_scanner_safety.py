"""Scanner safety — unit/contract tests (no live ClamAV required)."""

from __future__ import annotations

import pytest

from document_intelligence.malware.fake import (
    TEST_MALWARE_TOKEN,
    DisabledRejectAllScanner,
    FakeScanner,
)


def test_fake_scanner_clean_and_infected() -> None:
    scanner = FakeScanner()
    clean = scanner.scan(b"%PDF-1.4 clean", "a.pdf")
    assert clean.status == "CLEAN"
    infected = scanner.scan(TEST_MALWARE_TOKEN, "eicar.bin")
    assert infected.status == "INFECTED"


def test_disabled_reject_all_never_clean() -> None:
    scanner = DisabledRejectAllScanner()
    result = scanner.scan(b"%PDF-1.4", "a.pdf")
    assert result.status == "ERROR"
    assert result.status != "CLEAN"


def test_get_scanner_refuses_fake_outside_test(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("MALWARE_SCANNER", "fake_test")
    monkeypatch.setenv(
        "DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN",
        "staging-grade-internal-token-32chars",
    )
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "staging-access-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "staging-secret-key")
    monkeypatch.setenv("CLAMAV_HOST", "clamav")
    from document_intelligence.config import reset_settings_cache
    from document_intelligence.malware import get_scanner

    reset_settings_cache()
    from pydantic import ValidationError

    with pytest.raises((RuntimeError, ValueError, ValidationError)):
        get_scanner()
