-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'CONTRACT_AMENDMENT', 'LETTER', 'EMAIL', 'RFI', 'ENGINEER_INSTRUCTION', 'SITE_INSTRUCTION', 'DRAWING', 'MEETING_MINUTES', 'DAILY_REPORT', 'PAYMENT_CERTIFICATE', 'PAYMENT_APPLICATION', 'VARIATION', 'SCHEDULE', 'COST_RECORD', 'PHOTOGRAPH', 'SPREADSHEET', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentOrigin" AS ENUM ('MANUAL_UPLOAD', 'EMAIL_IMPORT', 'SHAREPOINT_IMPORT', 'ACONEX_IMPORT', 'PRIMAVERA_IMPORT', 'API_IMPORT', 'SYSTEM_GENERATED');

-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('EN', 'AR', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocumentConfidentiality" AS ENUM ('STANDARD', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SourceDocumentStatus" AS ENUM ('UPLOADING', 'RECEIVED', 'QUARANTINED', 'PROCESSING', 'READY', 'PARTIALLY_PROCESSED', 'FAILED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('INITIATED', 'UPLOAD_AUTHORIZED', 'UPLOADED', 'VALIDATING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "VersionUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'VALIDATING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MalwareScanStatus" AS ENUM ('NOT_SCANNED', 'QUEUED', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR', 'SKIPPED_BY_APPROVED_POLICY');

-- CreateEnum
CREATE TYPE "VersionProcessingStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessingRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('S3_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('PLAIN_TEXT', 'STRUCTURED_TEXT', 'OCR_TEXT', 'PAGE_IMAGE', 'THUMBNAIL', 'METADATA_JSON', 'EMAIL_BODY', 'ATTACHMENT_MANIFEST', 'PDF_PREVIEW', 'SPREADSHEET_SHEET_META', 'WARNING_JSON');

-- CreateEnum
CREATE TYPE "EvidenceSegmentKind" AS ENUM ('PAGE', 'PARAGRAPH', 'SECTION', 'EMAIL_HEADER', 'EMAIL_BODY', 'ATTACHMENT', 'SPREADSHEET_SHEET', 'SPREADSHEET_RANGE', 'SCHEDULE_ACTIVITY', 'METADATA_FIELD', 'LINE_CHUNK', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentRelationshipType" AS ENUM ('SUPERSEDES', 'REPLACES', 'RESPONDS_TO', 'ATTACHMENT_OF', 'AMENDS', 'REFERENCES', 'RELATED_TO', 'DUPLICATE_CONTENT_OF', 'REVISION_OF');

-- CreateTable
CREATE TABLE "source_document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentNumber" TEXT,
    "title" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "description" TEXT,
    "origin" "DocumentOrigin" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "sourceSystem" TEXT,
    "sourceReference" TEXT,
    "correspondenceDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "senderName" TEXT,
    "senderOrganization" TEXT,
    "recipientSummary" TEXT,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'STANDARD',
    "status" "SourceDocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "currentVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "normalizedFilename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'S3_COMPATIBLE',
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageVersionId" TEXT,
    "storageEtag" TEXT,
    "uploadStatus" "VersionUploadStatus" NOT NULL DEFAULT 'PENDING',
    "malwareScanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "processingStatus" "VersionProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_session" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "intendedFilename" TEXT NOT NULL,
    "declaredMediaType" TEXT NOT NULL,
    "declaredSizeBytes" BIGINT NOT NULL,
    "expectedSha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'INITIATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureDetailSafe" TEXT,
    "idempotencyKey" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_processing_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "processingProfile" TEXT NOT NULL DEFAULT 'basic_v1',
    "processorName" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "status" "ProcessingRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_processing_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_artifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "processingRunId" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "mediaType" TEXT NOT NULL,
    "storageBucket" TEXT,
    "storageKey" TEXT,
    "inlineContent" TEXT,
    "sha256" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "processorName" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_segment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "processingRunId" TEXT NOT NULL,
    "artifactId" TEXT,
    "kind" "EvidenceSegmentKind" NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "textContent" TEXT,
    "textSha256" TEXT,
    "locator" JSONB NOT NULL,
    "ocrConfidence" DOUBLE PRECISION,
    "language" "DocumentLanguage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_relationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromSourceDocumentId" TEXT NOT NULL,
    "toSourceDocumentId" TEXT NOT NULL,
    "relationshipType" "DocumentRelationshipType" NOT NULL,
    "createdByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "uploadSessionId" TEXT,
    "processingRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_document_currentVersionId_key" ON "source_document"("currentVersionId");

-- CreateIndex
CREATE INDEX "source_document_tenantId_projectId_status_idx" ON "source_document"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "source_document_tenantId_projectId_documentType_idx" ON "source_document"("tenantId", "projectId", "documentType");

-- CreateIndex
CREATE INDEX "source_document_tenantId_projectId_createdAt_idx" ON "source_document"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "document_version_tenantId_projectId_sha256_idx" ON "document_version"("tenantId", "projectId", "sha256");

-- CreateIndex
CREATE INDEX "document_version_tenantId_projectId_sourceDocumentId_idx" ON "document_version"("tenantId", "projectId", "sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_sourceDocumentId_versionNumber_key" ON "document_version"("sourceDocumentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_tenantId_storageKey_key" ON "document_version"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "upload_session_tenantId_projectId_status_idx" ON "upload_session"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "upload_session_expiresAt_status_idx" ON "upload_session"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "upload_session_tenantId_storageKey_key" ON "upload_session"("tenantId", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "upload_session_tenantId_initiatedByUserId_idempotencyKey_key" ON "upload_session"("tenantId", "initiatedByUserId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "document_processing_run_tenantId_projectId_documentVersionI_idx" ON "document_processing_run"("tenantId", "projectId", "documentVersionId");

-- CreateIndex
CREATE INDEX "document_processing_run_tenantId_status_queuedAt_idx" ON "document_processing_run"("tenantId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "document_processing_run_correlationId_idx" ON "document_processing_run"("correlationId");

-- CreateIndex
CREATE INDEX "extracted_artifact_tenantId_projectId_documentVersionId_idx" ON "extracted_artifact"("tenantId", "projectId", "documentVersionId");

-- CreateIndex
CREATE INDEX "extracted_artifact_processingRunId_idx" ON "extracted_artifact"("processingRunId");

-- CreateIndex
CREATE INDEX "evidence_segment_tenantId_projectId_documentVersionId_idx" ON "evidence_segment"("tenantId", "projectId", "documentVersionId");

-- CreateIndex
CREATE INDEX "evidence_segment_processingRunId_kind_ordinal_idx" ON "evidence_segment"("processingRunId", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "document_relationship_tenantId_projectId_idx" ON "document_relationship"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "document_relationship_tenantId_fromSourceDocumentId_toSourc_key" ON "document_relationship"("tenantId", "fromSourceDocumentId", "toSourceDocumentId", "relationshipType");

-- CreateIndex
CREATE INDEX "ingestion_event_tenantId_projectId_createdAt_idx" ON "ingestion_event"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ingestion_event_sourceDocumentId_createdAt_idx" ON "ingestion_event"("sourceDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "ingestion_event_correlationId_idx" ON "ingestion_event"("correlationId");

-- AddForeignKey
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_run" ADD CONSTRAINT "document_processing_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_run" ADD CONSTRAINT "document_processing_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_run" ADD CONSTRAINT "document_processing_run_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_artifact" ADD CONSTRAINT "extracted_artifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_artifact" ADD CONSTRAINT "extracted_artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_artifact" ADD CONSTRAINT "extracted_artifact_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_artifact" ADD CONSTRAINT "extracted_artifact_processingRunId_fkey" FOREIGN KEY ("processingRunId") REFERENCES "document_processing_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_segment" ADD CONSTRAINT "evidence_segment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_segment" ADD CONSTRAINT "evidence_segment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_segment" ADD CONSTRAINT "evidence_segment_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_segment" ADD CONSTRAINT "evidence_segment_processingRunId_fkey" FOREIGN KEY ("processingRunId") REFERENCES "document_processing_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_segment" ADD CONSTRAINT "evidence_segment_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "extracted_artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relationship" ADD CONSTRAINT "document_relationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relationship" ADD CONSTRAINT "document_relationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relationship" ADD CONSTRAINT "document_relationship_fromSourceDocumentId_fkey" FOREIGN KEY ("fromSourceDocumentId") REFERENCES "source_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relationship" ADD CONSTRAINT "document_relationship_toSourceDocumentId_fkey" FOREIGN KEY ("toSourceDocumentId") REFERENCES "source_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "upload_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_event" ADD CONSTRAINT "ingestion_event_processingRunId_fkey" FOREIGN KEY ("processingRunId") REFERENCES "document_processing_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Slice 2: RLS + tenant/project consistency + immutability guards
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contractradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contractradar_app;

-- Composite FK-style tenant/project consistency for ingestion tables
CREATE OR REPLACE FUNCTION enforce_ingestion_tenant_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_tenant text;
BEGIN
  SELECT "tenantId"::text INTO project_tenant FROM "project" WHERE id = NEW."projectId";
  IF project_tenant IS NULL THEN
    RAISE EXCEPTION 'ingestion row references unknown project';
  END IF;
  IF NEW."tenantId"::text <> project_tenant THEN
    RAISE EXCEPTION 'ingestion row tenantId must match project.tenantId';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'source_document',
    'document_version',
    'upload_session',
    'document_processing_run',
    'extracted_artifact',
    'evidence_segment',
    'document_relationship',
    'ingestion_event'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_tenant_project_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_tenant_project_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_ingestion_tenant_project()',
      t, t
    );
  END LOOP;
END $$;

-- Document version must belong to same tenant/project as its source document
CREATE OR REPLACE FUNCTION enforce_document_version_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_tenant text;
  parent_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO parent_tenant, parent_project
  FROM "source_document" WHERE id = NEW."sourceDocumentId";
  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'document_version references unknown source_document';
  END IF;
  IF NEW."tenantId"::text <> parent_tenant OR NEW."projectId"::text <> parent_project THEN
    RAISE EXCEPTION 'document_version tenant/project must match source_document';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_version_parent_guard ON "document_version";
CREATE TRIGGER document_version_parent_guard
  BEFORE INSERT OR UPDATE ON "document_version"
  FOR EACH ROW EXECUTE FUNCTION enforce_document_version_parent();

-- Processing run / artifact / segment must match version tenant/project
CREATE OR REPLACE FUNCTION enforce_processing_run_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant text;
  v_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text INTO v_tenant, v_project
  FROM "document_version" WHERE id = NEW."documentVersionId";
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'processing_run references unknown document_version';
  END IF;
  IF NEW."tenantId"::text <> v_tenant OR NEW."projectId"::text <> v_project THEN
    RAISE EXCEPTION 'processing_run tenant/project must match document_version';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_processing_run_parent_guard ON "document_processing_run";
CREATE TRIGGER document_processing_run_parent_guard
  BEFORE INSERT OR UPDATE ON "document_processing_run"
  FOR EACH ROW EXECUTE FUNCTION enforce_processing_run_parent();

CREATE OR REPLACE FUNCTION enforce_extracted_artifact_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant text;
  v_project text;
  r_version text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "documentVersionId"::text
    INTO v_tenant, v_project, r_version
  FROM "document_processing_run" WHERE id = NEW."processingRunId";
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'extracted_artifact references unknown processing_run';
  END IF;
  IF NEW."tenantId"::text <> v_tenant OR NEW."projectId"::text <> v_project THEN
    RAISE EXCEPTION 'extracted_artifact tenant/project must match processing_run';
  END IF;
  IF NEW."documentVersionId"::text <> r_version THEN
    RAISE EXCEPTION 'extracted_artifact.documentVersionId must match processing_run.documentVersionId';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS extracted_artifact_parent_guard ON "extracted_artifact";
CREATE TRIGGER extracted_artifact_parent_guard
  BEFORE INSERT OR UPDATE ON "extracted_artifact"
  FOR EACH ROW EXECUTE FUNCTION enforce_extracted_artifact_parent();

CREATE OR REPLACE FUNCTION enforce_evidence_segment_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant text;
  v_project text;
  r_version text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "documentVersionId"::text
    INTO v_tenant, v_project, r_version
  FROM "document_processing_run" WHERE id = NEW."processingRunId";
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'evidence_segment references unknown processing_run';
  END IF;
  IF NEW."tenantId"::text <> v_tenant OR NEW."projectId"::text <> v_project THEN
    RAISE EXCEPTION 'evidence_segment tenant/project must match processing_run';
  END IF;
  IF NEW."documentVersionId"::text <> r_version THEN
    RAISE EXCEPTION 'evidence_segment.documentVersionId must match processing_run.documentVersionId';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_segment_parent_guard ON "evidence_segment";
CREATE TRIGGER evidence_segment_parent_guard
  BEFORE INSERT OR UPDATE ON "evidence_segment"
  FOR EACH ROW EXECUTE FUNCTION enforce_evidence_segment_parent();

-- Accepted document versions are immutable (bytes + checksum + storage key)
CREATE OR REPLACE FUNCTION prevent_accepted_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."uploadStatus" = 'ACCEPTED' THEN
    IF NEW."sha256" IS DISTINCT FROM OLD."sha256"
       OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
       OR NEW."storageBucket" IS DISTINCT FROM OLD."storageBucket"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."mediaType" IS DISTINCT FROM OLD."mediaType"
       OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename"
       OR NEW."sourceDocumentId" IS DISTINCT FROM OLD."sourceDocumentId"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" THEN
      RAISE EXCEPTION 'accepted document_version source bytes and identity are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_version_accepted_immutable ON "document_version";
CREATE TRIGGER document_version_accepted_immutable
  BEFORE UPDATE ON "document_version"
  FOR EACH ROW EXECUTE FUNCTION prevent_accepted_version_mutation();

-- Ingestion events append-only
CREATE OR REPLACE FUNCTION prevent_ingestion_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND app_bypass_rls()
     AND coalesce(current_setting('app.allow_audit_purge', true), 'off') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ingestion_event is append-only: UPDATE and DELETE are forbidden';
END;
$$;

DROP TRIGGER IF EXISTS ingestion_event_immutable_update ON "ingestion_event";
CREATE TRIGGER ingestion_event_immutable_update
  BEFORE UPDATE ON "ingestion_event"
  FOR EACH ROW EXECUTE FUNCTION prevent_ingestion_event_mutation();

DROP TRIGGER IF EXISTS ingestion_event_immutable_delete ON "ingestion_event";
CREATE TRIGGER ingestion_event_immutable_delete
  BEFORE DELETE ON "ingestion_event"
  FOR EACH ROW EXECUTE FUNCTION prevent_ingestion_event_mutation();

-- FORCE RLS on all ingestion tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'source_document',
    'document_version',
    'upload_session',
    'document_processing_run',
    'extracted_artifact',
    'evidence_segment',
    'document_relationship',
    'ingestion_event'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I FOR ALL USING (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id()) WITH CHECK (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id())',
      t, t
    );
  END LOOP;
END $$;
