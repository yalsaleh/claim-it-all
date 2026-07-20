from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional
from uuid import uuid4

from document_intelligence.config import get_settings
from document_intelligence.db import db
from document_intelligence.extractors.registry import extract_for_media
from document_intelligence.malware import get_scanner
from document_intelligence.storage import copy_object, download_bytes
from document_intelligence.timeutil import utc_now_naive

logger = logging.getLogger(__name__)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_stage(
    stage: str,
    *,
    processing_run_id: str,
    document_version_id: str,
    correlation_id: str,
    outcome: Optional[str] = None,
    error_code: Optional[str] = None,
) -> None:
    logger.info(
        "document_job_stage",
        extra={
            "stage": stage,
            "processing_run_id": processing_run_id,
            "document_version_id": document_version_id,
            "correlation_id": correlation_id,
            "outcome": outcome,
            "error_code": error_code,
        },
    )


async def process_document_version(
    ctx: dict[str, Any],
    *,
    processing_run_id: str,
    document_version_id: str,
    correlation_id: str,
) -> dict[str, str]:
    """ARQ job: malware scan → promote original → extract → persist artifacts/segments."""
    settings = get_settings()
    _safe_stage(
        "job-received",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
    )
    run = await db.fetchrow(
        """
        SELECT r.id, r."tenantId", r."projectId", r."documentVersionId", r.status, r."attemptNumber"
        FROM document_processing_run r
        WHERE r.id = $1
        """,
        processing_run_id,
    )
    if run is None:
        logger.warning("processing_run_missing", extra={"correlation_id": correlation_id})
        _safe_stage(
            "database-finalized",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            outcome="missing_run",
        )
        return {"status": "missing_run"}

    version = await db.fetchrow(
        """
        SELECT v.id, v."tenantId", v."projectId", v."sourceDocumentId", v."storageBucket",
               v."storageKey", v."mediaType", v.extension, v.sha256, v."uploadStatus",
               v."malwareScanStatus", v."processingStatus", v."originalFilename"
        FROM document_version v
        WHERE v.id = $1
        """,
        document_version_id,
    )
    if version is None:
        _safe_stage(
            "database-finalized",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            outcome="missing_version",
        )
        return {"status": "missing_version"}

    _safe_stage(
        "authoritative-records-loaded",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
    )

    # Reject queue payload tampering
    if (
        version["tenantId"] != run["tenantId"]
        or version["projectId"] != run["projectId"]
        or run["documentVersionId"] != document_version_id
    ):
        logger.error("queue_payload_tamper_rejected", extra={"correlation_id": correlation_id})
        await db.execute(
            """
            UPDATE document_processing_run
            SET status = 'DEAD_LETTERED', "completedAt" = $2,
                "failureCode" = 'PAYLOAD_TAMPER', "failureMessageSafe" = $3
            WHERE id = $1
            """,
            processing_run_id,
            utc_now_naive(),
            "Job payload did not match database records",
        )
        return {"status": "dead_lettered"}

    # Idempotent success short-circuit
    if run["status"] == "SUCCEEDED":
        _safe_stage(
            "database-finalized",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            outcome="already_complete",
        )
        return {"status": "already_succeeded"}

    now = utc_now_naive()
    await db.execute(
        """
        UPDATE document_processing_run
        SET status = 'RUNNING', "startedAt" = COALESCE("startedAt", $2)
        WHERE id = $1
        """,
        processing_run_id,
        now,
    )
    await db.execute(
        """
        UPDATE document_version SET "processingStatus" = 'RUNNING', "malwareScanStatus" = 'SCANNING'
        WHERE id = $1
        """,
        document_version_id,
    )
    await db.execute(
        """
        INSERT INTO ingestion_event
          (id, "tenantId", "projectId", "sourceDocumentId", "documentVersionId",
           "processingRunId", "eventType", metadata, "correlationId", "createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,'processing.started',$7,$8,$9)
        """,
        str(uuid4()),
        version["tenantId"],
        version["projectId"],
        version["sourceDocumentId"],
        document_version_id,
        processing_run_id,
        json.dumps({"attempt": run["attemptNumber"]}),
        correlation_id,
        now,
    )

    data = download_bytes(
        version["storageBucket"],
        version["storageKey"],
        settings.max_download_bytes,
    )
    digest = _sha256(data)
    if digest != version["sha256"]:
        await _fail_run(
            processing_run_id,
            document_version_id,
            version,
            correlation_id,
            "CHECKSUM_MISMATCH",
            "Stored object checksum no longer matches the accepted record",
            retryable=False,
        )
        return {"status": "failed"}

    _safe_stage(
        "scanner-started",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
    )
    scan = get_scanner().scan(data, version["originalFilename"])
    _safe_stage(
        "scanner-completed",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
        outcome=scan.status,
    )
    await db.execute(
        """
        INSERT INTO ingestion_event
          (id, "tenantId", "projectId", "sourceDocumentId", "documentVersionId",
           "processingRunId", "eventType", metadata, "correlationId", "createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        """,
        str(uuid4()),
        version["tenantId"],
        version["projectId"],
        version["sourceDocumentId"],
        document_version_id,
        processing_run_id,
        "malware.scan_completed",
        json.dumps({"status": scan.status, "scanner": scan.scanner_name}),
        correlation_id,
        utc_now_naive(),
    )

    if scan.status != "CLEAN":
        malware_status = scan.status if scan.status in {"INFECTED", "ERROR"} else "ERROR"
        await db.execute(
            """
            UPDATE document_version
            SET "malwareScanStatus" = $2, "processingStatus" = 'FAILED', "uploadStatus" = 'REJECTED'
            WHERE id = $1
            """,
            document_version_id,
            malware_status,
        )
        await db.execute(
            """
            UPDATE source_document SET status = 'REJECTED', "updatedAt" = $2 WHERE id = $1
            """,
            version["sourceDocumentId"],
            utc_now_naive(),
        )
        await db.execute(
            """
            UPDATE document_processing_run
            SET status = 'FAILED', "completedAt" = $2,
                "failureCode" = $3, "failureMessageSafe" = $4
            WHERE id = $1
            """,
            processing_run_id,
            utc_now_naive(),
            f"MALWARE_{scan.status}",
            scan.detail_safe,
        )
        _safe_stage(
            "database-finalized",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
            outcome="infected" if scan.status == "INFECTED" else "scanner_error",
            error_code=f"MALWARE_{scan.status}",
        )
        return {"status": "malware_blocked"}

    # Promote quarantine → originals if needed (verify checksum before ACCEPTED)
    storage_key = version["storageKey"]
    if "/quarantine/" in storage_key:
        _safe_stage(
            "promotion-started",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
        )
        original_key = (
            f"tenants/{version['tenantId']}/projects/{version['projectId']}/"
            f"originals/{document_version_id}/{uuid4().hex}"
        )
        try:
            copy_object(version["storageBucket"], storage_key, original_key)
            promoted = download_bytes(
                version["storageBucket"],
                original_key,
                settings.max_download_bytes,
            )
            if _sha256(promoted) != version["sha256"]:
                raise ValueError("PROMOTION_CHECKSUM_MISMATCH")
        except Exception as exc:  # noqa: BLE001
            await _fail_run(
                processing_run_id,
                document_version_id,
                version,
                correlation_id,
                "PROMOTION_FAILED",
                f"Quarantine promotion failed: {exc.__class__.__name__}",
                retryable=True,
            )
            _safe_stage(
                "database-finalized",
                processing_run_id=processing_run_id,
                document_version_id=document_version_id,
                correlation_id=correlation_id,
                outcome="promotion_error",
                error_code="PROMOTION_FAILED",
            )
            return {"status": "failed"}
        storage_key = original_key
        _safe_stage(
            "promotion-completed",
            processing_run_id=processing_run_id,
            document_version_id=document_version_id,
            correlation_id=correlation_id,
        )

    await db.execute(
        """
        UPDATE document_version
        SET "malwareScanStatus" = 'CLEAN',
            "uploadStatus" = 'ACCEPTED',
            "acceptedAt" = COALESCE("acceptedAt", $2),
            "storageKey" = $3
        WHERE id = $1
        """,
        document_version_id,
        utc_now_naive(),
        storage_key,
    )

    _safe_stage(
        "extraction-started",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
    )
    extraction = extract_for_media(version["mediaType"], version["extension"], data)
    artifact_id = str(uuid4())
    text_bytes = (extraction.plain_text or "").encode("utf-8")
    await db.execute(
        """
        INSERT INTO extracted_artifact
          (id, "tenantId", "projectId", "documentVersionId", "processingRunId",
           "artifactType", "mediaType", "inlineContent", sha256, "sizeBytes",
           "processorName", "processorVersion", "createdAt")
        VALUES ($1,$2,$3,$4,$5,'PLAIN_TEXT','text/plain',$6,$7,$8,$9,$10,$11)
        """,
        artifact_id,
        version["tenantId"],
        version["projectId"],
        document_version_id,
        processing_run_id,
        (extraction.plain_text or "")[:500_000],
        _sha256(text_bytes) if text_bytes else _sha256(b""),
        len(text_bytes),
        settings.processor_name,
        settings.processor_version,
        utc_now_naive(),
    )

    meta_id = str(uuid4())
    meta_json = json.dumps(
        {
            **extraction.metadata,
            "warnings": extraction.warnings,
            "ocrUsed": extraction.ocr_used,
            "contentMayBeIncomplete": extraction.content_may_be_incomplete,
        }
    )
    await db.execute(
        """
        INSERT INTO extracted_artifact
          (id, "tenantId", "projectId", "documentVersionId", "processingRunId",
           "artifactType", "mediaType", "inlineContent", sha256, "sizeBytes",
           "processorName", "processorVersion", "createdAt")
        VALUES ($1,$2,$3,$4,$5,'METADATA_JSON','application/json',$6,$7,$8,$9,$10,$11)
        """,
        meta_id,
        version["tenantId"],
        version["projectId"],
        document_version_id,
        processing_run_id,
        meta_json,
        _sha256(meta_json.encode("utf-8")),
        len(meta_json.encode("utf-8")),
        settings.processor_name,
        settings.processor_version,
        utc_now_naive(),
    )

    for segment in extraction.segments:
        text = segment.text
        await db.execute(
            """
            INSERT INTO evidence_segment
              (id, "tenantId", "projectId", "documentVersionId", "processingRunId",
               "artifactId", kind, ordinal, label, "textContent", "textSha256",
               locator, language, "createdAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
            """,
            str(uuid4()),
            version["tenantId"],
            version["projectId"],
            document_version_id,
            processing_run_id,
            artifact_id,
            segment.kind,
            segment.ordinal,
            segment.label,
            text,
            _sha256(text.encode("utf-8")) if text else None,
            json.dumps(segment.locator),
            segment.language,
            utc_now_naive(),
        )

    run_status = extraction.status
    if run_status not in {"SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED"}:
        run_status = "FAILED"

    version_processing = (
        "SUCCEEDED"
        if run_status == "SUCCEEDED"
        else "PARTIALLY_SUCCEEDED"
        if run_status == "PARTIALLY_SUCCEEDED"
        else "FAILED"
    )
    doc_status = (
        "READY"
        if run_status == "SUCCEEDED"
        else "PARTIALLY_PROCESSED"
        if run_status == "PARTIALLY_SUCCEEDED"
        else "FAILED"
    )

    await db.execute(
        """
        UPDATE document_processing_run
        SET status = $2, "completedAt" = $3,
            "failureCode" = $4, "failureMessageSafe" = $5
        WHERE id = $1
        """,
        processing_run_id,
        run_status,
        utc_now_naive(),
        None if run_status != "FAILED" else "EXTRACTION_FAILED",
        None if run_status != "FAILED" else ";".join(extraction.warnings)[:500],
    )
    await db.execute(
        """
        UPDATE document_version SET "processingStatus" = $2 WHERE id = $1
        """,
        document_version_id,
        version_processing,
    )
    await db.execute(
        """
        UPDATE source_document SET status = $2, "updatedAt" = $3 WHERE id = $1
        """,
        version["sourceDocumentId"],
        doc_status,
        utc_now_naive(),
    )
    await db.execute(
        """
        INSERT INTO ingestion_event
          (id, "tenantId", "projectId", "sourceDocumentId", "documentVersionId",
           "processingRunId", "eventType", metadata, "correlationId", "createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,'extraction.completed',$7,$8,$9)
        """,
        str(uuid4()),
        version["tenantId"],
        version["projectId"],
        version["sourceDocumentId"],
        document_version_id,
        processing_run_id,
        json.dumps(
            {
                "status": run_status,
                "segmentCount": len(extraction.segments),
                "ocrUsed": extraction.ocr_used,
            }
        ),
        correlation_id,
        utc_now_naive(),
    )

    _safe_stage(
        "extraction-completed",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
        outcome=run_status,
    )
    _safe_stage(
        "database-finalized",
        processing_run_id=processing_run_id,
        document_version_id=document_version_id,
        correlation_id=correlation_id,
        outcome=run_status.lower(),
        error_code=None if run_status != "FAILED" else "EXTRACTION_FAILED",
    )
    logger.info(
        "processing_completed",
        extra={
            "correlation_id": correlation_id,
            "processing_run_id": processing_run_id,
            "status": run_status,
            "media_type": version["mediaType"],
            "size_bytes": len(data),
        },
    )
    return {"status": run_status.lower()}


async def _fail_run(
    processing_run_id: str,
    document_version_id: str,
    version: Any,
    correlation_id: str,
    code: str,
    message: str,
    retryable: bool,
) -> None:
    status = "FAILED"
    await db.execute(
        """
        UPDATE document_processing_run
        SET status = $2, "completedAt" = $3, "failureCode" = $4, "failureMessageSafe" = $5
        WHERE id = $1
        """,
        processing_run_id,
        status,
        utc_now_naive(),
        code,
        message,
    )
    await db.execute(
        """
        UPDATE document_version SET "processingStatus" = 'FAILED' WHERE id = $1
        """,
        document_version_id,
    )
    # Preserve source document identity; mark FAILED without deleting version
    await db.execute(
        """
        UPDATE source_document SET status = 'FAILED', "updatedAt" = $2 WHERE id = $1
        """,
        version["sourceDocumentId"],
        utc_now_naive(),
    )
    logger.warning(
        "processing_failed",
        extra={
            "correlation_id": correlation_id,
            "code": code,
            "retryable": retryable,
        },
    )
