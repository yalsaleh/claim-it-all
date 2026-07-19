from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    service_name: str = Field(default="document-intelligence", alias="SERVICE_NAME")
    document_intelligence_internal_token: str = Field(
        alias="DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN"
    )
    database_url: str = Field(
        default="postgresql://contractradar_app:contractradar@127.0.0.1:5432/contractradar",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://127.0.0.1:6379", alias="REDIS_URL")
    arq_queue_name: str = Field(
        default="contractradar:document-processing",
        alias="ARQ_QUEUE_NAME",
    )
    s3_endpoint: str = Field(default="http://127.0.0.1:9000", alias="S3_ENDPOINT")
    s3_region: str = Field(default="us-east-1", alias="S3_REGION")
    s3_access_key_id: str = Field(default="minioadmin", alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field(default="minioadmin", alias="S3_SECRET_ACCESS_KEY")
    s3_bucket: str = Field(default="contractradar-documents", alias="S3_BUCKET")
    s3_force_path_style: bool = Field(default=True, alias="S3_FORCE_PATH_STYLE")
    malware_scanner: Literal["clamav", "fake_test", "disabled_reject_all"] = Field(
        default="clamav", alias="MALWARE_SCANNER"
    )
    clamav_host: Optional[str] = Field(default=None, alias="CLAMAV_HOST")
    clamav_port: int = Field(default=3310, alias="CLAMAV_PORT")
    max_download_bytes: int = Field(default=52_428_800, alias="MAX_DOWNLOAD_BYTES")
    max_pdf_pages: int = Field(default=500, alias="MAX_PDF_PAGES")
    max_workbook_cells: int = Field(default=500_000, alias="MAX_WORKBOOK_CELLS")
    allow_dev_defaults: bool = Field(default=False, alias="ALLOW_DEV_DEFAULTS")
    outbox_poll_seconds: float = Field(default=2.0, alias="OUTBOX_POLL_SECONDS")
    outbox_max_attempts: int = Field(default=10, alias="OUTBOX_MAX_ATTEMPTS")
    processor_name: str = "document-intelligence"
    processor_version: str = "0.2.0"

    @field_validator("document_intelligence_internal_token")
    @classmethod
    def token_min_length(cls, value: str) -> str:
        if len(value) < 16:
            raise ValueError("DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN must be at least 16 characters")
        return value

    @model_validator(mode="after")
    def enforce_scanner_safety(self) -> "Settings":
        app_env = self.app_env.lower()
        is_test = app_env == "test"
        is_prod_like = app_env in {"production", "staging"}

        if self.malware_scanner == "fake_test" and not is_test:
            raise ValueError("MALWARE_SCANNER=fake_test is only allowed when APP_ENV=test")

        if is_prod_like:
            if self.malware_scanner != "clamav":
                raise ValueError("Production/staging require MALWARE_SCANNER=clamav")
            if not self.clamav_host:
                raise ValueError(
                    "CLAMAV_HOST is required when MALWARE_SCANNER=clamav in prod/staging"
                )
            if self.allow_dev_defaults:
                raise ValueError("ALLOW_DEV_DEFAULTS cannot be enabled in production/staging")
            weak = ("dev-internal", "change-me", "minioadmin")
            if any(w in self.document_intelligence_internal_token for w in weak):
                raise ValueError("Weak DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN in production/staging")
            if self.s3_access_key_id in {"minioadmin", "changeme"}:
                raise ValueError("Example S3 credentials are forbidden in production/staging")

        if (
            self.malware_scanner == "clamav"
            and not self.clamav_host
            and not self.allow_dev_defaults
        ):
            raise ValueError("CLAMAV_HOST is required when MALWARE_SCANNER=clamav")

        return self

    @property
    def internal_token(self) -> str:
        return self.document_intelligence_internal_token


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def reset_settings_cache() -> None:
    get_settings.cache_clear()
