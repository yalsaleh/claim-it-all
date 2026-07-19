import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("MALWARE_SCANNER", "fake_test")
    monkeypatch.setenv("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    monkeypatch.setenv("LOG_LEVEL", "info")
    monkeypatch.setenv("ALLOW_DEV_DEFAULTS", "true")

    from document_intelligence.config import reset_settings_cache
    from document_intelligence.main import app

    reset_settings_cache()
    return TestClient(app)


def test_live_health(client: TestClient) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "document-intelligence"


def test_ready_requires_token(client: TestClient) -> None:
    unauthorized = client.get("/health/ready")
    assert unauthorized.status_code == 401

    authorized = client.get(
        "/health/ready",
        headers={"X-Internal-Token": "test-internal-token-32chars"},
    )
    assert authorized.status_code == 200
    body = authorized.json()
    # Without live Postgres/Redis/MinIO/ClamAV this may be not_ready — that is correct.
    assert body["status"] in {"ok", "not_ready"}
    assert "checks" in body
    assert set(body["checks"]) >= {
        "config",
        "database",
        "redis",
        "object_storage",
        "malware_scanner",
    }


def test_settings_reject_short_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "short")
    from document_intelligence.config import Settings, reset_settings_cache

    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]


def test_settings_reject_fake_scanner_outside_test(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("MALWARE_SCANNER", "fake_test")
    monkeypatch.setenv("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN", "test-internal-token-32chars")
    monkeypatch.setenv("ALLOW_DEV_DEFAULTS", "true")
    from document_intelligence.config import Settings, reset_settings_cache

    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]


def test_settings_reject_fake_scanner_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("MALWARE_SCANNER", "fake_test")
    monkeypatch.setenv(
        "DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN",
        "production-grade-internal-token-32chars",
    )
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "prod-access-key-not-example")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "prod-secret-key-not-example")
    from document_intelligence.config import Settings, reset_settings_cache

    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]
