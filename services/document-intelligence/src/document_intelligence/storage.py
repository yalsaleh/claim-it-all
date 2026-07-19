from typing import Any, Optional, cast

import boto3
from botocore.client import Config

from document_intelligence.config import get_settings


def s3_client() -> Any:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"}),
    )


def download_bytes(bucket: str, key: str, max_bytes: Optional[int] = None) -> bytes:
    settings = get_settings()
    limit = max_bytes or settings.max_download_bytes
    client = s3_client()
    obj = client.get_object(Bucket=bucket, Key=key)
    body = cast(bytes, obj["Body"].read(limit + 1))
    if len(body) > limit:
        raise ValueError("OBJECT_TOO_LARGE")
    return body


def upload_bytes(bucket: str, key: str, data: bytes, content_type: str) -> None:
    s3_client().put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)


def copy_object(bucket: str, from_key: str, to_key: str) -> None:
    s3_client().copy_object(
        Bucket=bucket,
        CopySource={"Bucket": bucket, "Key": from_key},
        Key=to_key,
        MetadataDirective="COPY",
    )


def head_ok(bucket: str) -> bool:
    try:
        s3_client().head_bucket(Bucket=bucket)
        return True
    except Exception:
        return False
