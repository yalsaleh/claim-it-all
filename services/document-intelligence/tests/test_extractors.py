from document_intelligence.extractors.eml import extract_eml
from document_intelligence.extractors.registry import extract_for_media
from document_intelligence.extractors.text_csv import extract_text_or_csv
from document_intelligence.malware.fake import TEST_MALWARE_TOKEN, FakeScanner


def test_txt_arabic_english() -> None:
    data = "Notice / إشعار\nDeadline within 28 days.".encode()
    result = extract_text_or_csv(data, "txt")
    assert result.status == "SUCCEEDED"
    assert result.plain_text is not None
    assert "إشعار" in result.plain_text
    assert result.segments


def test_eml_headers_and_body() -> None:
    raw = b"""From: sender@example.com\r
To: recv@example.com\r
Subject: RFI-001\r
Date: Fri, 18 Jul 2026 10:00:00 +0000\r
Content-Type: text/plain; charset=utf-8\r
\r
Please advise on variation.\r
"""
    result = extract_eml(raw)
    assert result.status == "SUCCEEDED"
    assert any(s.kind == "EMAIL_HEADER" for s in result.segments)
    assert any(s.kind == "EMAIL_BODY" for s in result.segments)


def test_msg_unsupported() -> None:
    result = extract_for_media("application/octet-stream", "msg", b"not-a-real-msg")
    assert result.status == "FAILED"
    assert "msg_unsupported" in result.warnings


def test_fake_scanner_eicar() -> None:
    scanner = FakeScanner()
    infected = scanner.scan(b"prefix " + TEST_MALWARE_TOKEN + b" suffix", "x.bin")
    assert infected.status == "INFECTED"
    clean = scanner.scan(b"ordinary construction letter", "letter.txt")
    assert clean.status == "CLEAN"
