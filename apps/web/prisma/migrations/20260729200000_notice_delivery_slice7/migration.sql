-- CreateEnum
CREATE TYPE "NoticeDispatchAuthorizationStatus" AS ENUM ('DRAFT', 'REQUESTED', 'UNDER_REVIEW', 'AUTHORIZED', 'REJECTED', 'EXPIRED', 'REVOKED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoticeDispatchAttemptStatus" AS ENUM ('PREPARED', 'QUEUED', 'SENDING', 'SUBMITTED', 'SENT', 'DELIVERY_PENDING', 'DELIVERED', 'FAILED', 'CANCELLED', 'PARTIALLY_DELIVERED', 'MANUAL_DISPATCH_RECORDED', 'AWAITING_EVIDENCE', 'UNCERTAIN_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "NoticeDispatchRecipientStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SENT', 'DELIVERED', 'BOUNCED', 'REJECTED', 'FAILED', 'ACKNOWLEDGED', 'UNKNOWN', 'MANUALLY_CONFIRMED');

-- CreateEnum
CREATE TYPE "DispatchEvidenceType" AS ENUM ('EMAIL_PROVIDER_ACCEPTANCE', 'EMAIL_DELIVERY_CONFIRMATION', 'EMAIL_BOUNCE', 'READ_RECEIPT', 'MANUAL_SENT_EMAIL_COPY', 'COURIER_RECEIPT', 'POSTAL_RECEIPT', 'HAND_DELIVERY_RECEIPT', 'EDMS_SUBMISSION_CONFIRMATION', 'SCREENSHOT', 'ACKNOWLEDGMENT_EMAIL', 'SIGNED_RECEIPT', 'TRACKING_RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "DispatchEvidenceVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeReceiptStatus" AS ENUM ('UNKNOWN', 'PROVIDER_ACCEPTED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'BOUNCED', 'REFUSED', 'DISPUTED', 'MANUALLY_CONFIRMED');

-- CreateEnum
CREATE TYPE "ContractualServiceStatus" AS ENUM ('NOT_ASSESSED', 'EVIDENCE_INCOMPLETE', 'POTENTIALLY_SATISFIED', 'REVIEW_REQUIRED', 'HUMAN_CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "NoticeAcknowledgmentStatus" AS ENUM ('RECORDED', 'VERIFIED', 'DISPUTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DeliveryProviderConfigStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPROVED', 'DISABLED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NoticePackageStatus" ADD VALUE 'AUTHORIZATION_PENDING';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'AUTHORIZED_FOR_DISPATCH';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DISPATCH_IN_PROGRESS';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DELIVERY_PENDING';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DELIVERY_PARTIAL';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DELIVERY_CONFIRMED';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'RECEIPT_UNCONFIRMED';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'RECEIPT_CONFIRMED';
ALTER TYPE "NoticePackageStatus" ADD VALUE 'DELIVERY_FAILED';

-- CreateTable
CREATE TABLE "notice_dispatch_package_snapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "approvedDraftRevisionId" TEXT NOT NULL,
    "noticeExportId" TEXT,
    "exportManifestChecksum" TEXT NOT NULL,
    "bundleChecksum" TEXT NOT NULL,
    "noticeChecksum" TEXT NOT NULL,
    "attachmentManifestChecksum" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "governingLanguage" TEXT,
    "subject" TEXT NOT NULL,
    "externalFilename" TEXT,
    "recipientSnapshot" JSONB NOT NULL,
    "copiedRecipientSnapshot" JSONB NOT NULL,
    "deliveryMethodSnapshot" JSONB NOT NULL,
    "attachmentSnapshot" JSONB NOT NULL,
    "coverMessageSnapshot" JSONB NOT NULL,
    "channel" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_dispatch_package_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_dispatch_cover_message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "subject" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "htmlSafe" TEXT,
    "checksumSha256" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notice_dispatch_cover_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_dispatch_authorization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "dispatchPackageSnapshotId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "authorizedByUserId" TEXT,
    "status" "NoticeDispatchAuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "intendedSendWindowStart" TIMESTAMP(3),
    "intendedSendWindowEnd" TIMESTAMP(3),
    "selectedChannel" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "copiedRecipientCount" INTEGER NOT NULL,
    "deliveryRiskAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "controlledExceptions" JSONB,
    "rationale" TEXT,
    "conditions" TEXT,
    "recipientsReviewed" BOOLEAN NOT NULL DEFAULT false,
    "methodReviewed" BOOLEAN NOT NULL DEFAULT false,
    "attachmentsReviewed" BOOLEAN NOT NULL DEFAULT false,
    "deadlineReviewed" BOOLEAN NOT NULL DEFAULT false,
    "scopeReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_dispatch_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_dispatch_attempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "dispatchAuthorizationId" TEXT NOT NULL,
    "dispatchPackageSnapshotId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountReference" TEXT,
    "status" "NoticeDispatchAttemptStatus" NOT NULL DEFAULT 'PREPARED',
    "initiatedByUserId" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "providerSubmissionId" TEXT,
    "trackingNumber" TEXT,
    "externalReference" TEXT,
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "retryClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_dispatch_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_dispatch_recipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "preparationId" TEXT,
    "partyOrRoleRef" TEXT,
    "displayName" TEXT NOT NULL,
    "addressOrEmail" TEXT,
    "copiedRecipient" BOOLEAN NOT NULL DEFAULT false,
    "requiredRecipient" BOOLEAN NOT NULL DEFAULT true,
    "method" TEXT NOT NULL,
    "status" "NoticeDispatchRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "providerRecipientId" TEXT,
    "providerResponseCode" TEXT,
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "receiptEvidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_dispatch_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_dispatch_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "dispatchedByUserId" TEXT NOT NULL,
    "dispatchAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "courierOrProviderName" TEXT,
    "trackingNumber" TEXT,
    "handDeliveredToName" TEXT,
    "externalSubmissionReference" TEXT,
    "physicalReceiptReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_dispatch_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT NOT NULL,
    "dispatchRecipientId" TEXT,
    "evidenceType" "DispatchEvidenceType" NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "storageKey" TEXT,
    "filename" TEXT,
    "checksumSha256" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurredAt" TIMESTAMP(3),
    "recordedByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verificationStatus" "DispatchEvidenceVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_receipt_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT NOT NULL,
    "dispatchRecipientId" TEXT,
    "receiptStatus" "NoticeReceiptStatus" NOT NULL DEFAULT 'UNKNOWN',
    "receiptAt" TIMESTAMP(3),
    "receiptTimezone" TEXT,
    "source" TEXT,
    "evidenceId" TEXT,
    "deemedReceiptRule" TEXT,
    "deemedReceiptResult" JSONB,
    "contractualServiceStatus" "ContractualServiceStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rationale" TEXT,
    "ambiguity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_receipt_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deemed_receipt_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "receiptAssessmentId" TEXT NOT NULL,
    "ruleKind" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "calculationTrace" JSONB NOT NULL,
    "advisoryAt" TIMESTAMP(3),
    "ambiguity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deemed_receipt_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_acknowledgment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT NOT NULL,
    "dispatchRecipientId" TEXT,
    "acknowledgmentType" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL,
    "sourceEvidenceId" TEXT,
    "summary" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "status" "NoticeAcknowledgmentStatus" NOT NULL DEFAULT 'RECORDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_provider_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureStatus" TEXT NOT NULL,
    "payloadChecksum" TEXT NOT NULL,
    "redactedPayload" JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "dispatchAttemptId" TEXT,
    "dispatchRecipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_provider_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_provider_configuration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedChannels" JSONB NOT NULL,
    "secretReferenceId" TEXT,
    "senderIdentity" TEXT,
    "senderDomain" TEXT,
    "webhookConfigured" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeliveryProviderConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_provider_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notice_dispatch_package_snapshot_tenantId_projectId_noticeP_idx" ON "notice_dispatch_package_snapshot"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_dispatch_package_snapshot_approvedDraftRevisionId_idx" ON "notice_dispatch_package_snapshot"("approvedDraftRevisionId");

-- CreateIndex
CREATE INDEX "notice_dispatch_package_snapshot_noticeExportId_idx" ON "notice_dispatch_package_snapshot"("noticeExportId");

-- CreateIndex
CREATE INDEX "notice_dispatch_cover_message_tenantId_projectId_noticePack_idx" ON "notice_dispatch_cover_message"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_dispatch_cover_message_snapshotId_idx" ON "notice_dispatch_cover_message"("snapshotId");

-- CreateIndex
CREATE INDEX "notice_dispatch_authorization_tenantId_projectId_noticePack_idx" ON "notice_dispatch_authorization"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_dispatch_authorization_dispatchPackageSnapshotId_idx" ON "notice_dispatch_authorization"("dispatchPackageSnapshotId");

-- CreateIndex
CREATE INDEX "notice_dispatch_authorization_status_idx" ON "notice_dispatch_authorization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notice_dispatch_authorization_tenantId_id_key" ON "notice_dispatch_authorization"("tenantId", "id");

-- CreateIndex
CREATE INDEX "notice_dispatch_attempt_tenantId_projectId_noticePackageId_idx" ON "notice_dispatch_attempt"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_dispatch_attempt_dispatchPackageSnapshotId_idx" ON "notice_dispatch_attempt"("dispatchPackageSnapshotId");

-- CreateIndex
CREATE INDEX "notice_dispatch_attempt_status_idx" ON "notice_dispatch_attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notice_dispatch_attempt_dispatchAuthorizationId_attemptNumb_key" ON "notice_dispatch_attempt"("dispatchAuthorizationId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "notice_dispatch_attempt_idempotencyKey_key" ON "notice_dispatch_attempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notice_dispatch_recipient_tenantId_projectId_dispatchAttemp_idx" ON "notice_dispatch_recipient"("tenantId", "projectId", "dispatchAttemptId");

-- CreateIndex
CREATE INDEX "notice_dispatch_recipient_preparationId_idx" ON "notice_dispatch_recipient"("preparationId");

-- CreateIndex
CREATE UNIQUE INDEX "manual_dispatch_record_dispatchAttemptId_key" ON "manual_dispatch_record"("dispatchAttemptId");

-- CreateIndex
CREATE INDEX "manual_dispatch_record_tenantId_projectId_idx" ON "manual_dispatch_record"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "dispatch_evidence_tenantId_projectId_dispatchAttemptId_idx" ON "dispatch_evidence"("tenantId", "projectId", "dispatchAttemptId");

-- CreateIndex
CREATE INDEX "dispatch_evidence_dispatchRecipientId_idx" ON "dispatch_evidence"("dispatchRecipientId");

-- CreateIndex
CREATE INDEX "notice_receipt_assessment_tenantId_projectId_noticePackageI_idx" ON "notice_receipt_assessment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_receipt_assessment_dispatchAttemptId_idx" ON "notice_receipt_assessment"("dispatchAttemptId");

-- CreateIndex
CREATE INDEX "notice_receipt_assessment_dispatchRecipientId_idx" ON "notice_receipt_assessment"("dispatchRecipientId");

-- CreateIndex
CREATE INDEX "deemed_receipt_assessment_tenantId_projectId_noticePackageI_idx" ON "deemed_receipt_assessment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "deemed_receipt_assessment_receiptAssessmentId_idx" ON "deemed_receipt_assessment"("receiptAssessmentId");

-- CreateIndex
CREATE INDEX "notice_acknowledgment_tenantId_projectId_noticePackageId_idx" ON "notice_acknowledgment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_acknowledgment_dispatchAttemptId_idx" ON "notice_acknowledgment"("dispatchAttemptId");

-- CreateIndex
CREATE INDEX "notice_acknowledgment_dispatchRecipientId_idx" ON "notice_acknowledgment"("dispatchRecipientId");

-- CreateIndex
CREATE INDEX "delivery_provider_event_tenantId_providerMessageId_idx" ON "delivery_provider_event"("tenantId", "providerMessageId");

-- CreateIndex
CREATE INDEX "delivery_provider_event_dispatchAttemptId_idx" ON "delivery_provider_event"("dispatchAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_provider_event_provider_providerEventId_key" ON "delivery_provider_event"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "delivery_provider_configuration_tenantId_scope_providerType_idx" ON "delivery_provider_configuration"("tenantId", "scope", "providerType");

-- CreateIndex
CREATE INDEX "delivery_provider_configuration_status_idx" ON "delivery_provider_configuration"("status");

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_approvedDraftRevisionId_fkey" FOREIGN KEY ("approvedDraftRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_noticeExportId_fkey" FOREIGN KEY ("noticeExportId") REFERENCES "notice_export_bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_package_snapshot" ADD CONSTRAINT "notice_dispatch_package_snapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_cover_message" ADD CONSTRAINT "notice_dispatch_cover_message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_cover_message" ADD CONSTRAINT "notice_dispatch_cover_message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_cover_message" ADD CONSTRAINT "notice_dispatch_cover_message_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_cover_message" ADD CONSTRAINT "notice_dispatch_cover_message_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "notice_dispatch_package_snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_cover_message" ADD CONSTRAINT "notice_dispatch_cover_message_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_dispatchPackageSnapshotId_fkey" FOREIGN KEY ("dispatchPackageSnapshotId") REFERENCES "notice_dispatch_package_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_authorization" ADD CONSTRAINT "notice_dispatch_authorization_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_dispatchAuthorizationId_fkey" FOREIGN KEY ("dispatchAuthorizationId") REFERENCES "notice_dispatch_authorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_dispatchPackageSnapshotId_fkey" FOREIGN KEY ("dispatchPackageSnapshotId") REFERENCES "notice_dispatch_package_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_attempt" ADD CONSTRAINT "notice_dispatch_attempt_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_recipient" ADD CONSTRAINT "notice_dispatch_recipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_recipient" ADD CONSTRAINT "notice_dispatch_recipient_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_recipient" ADD CONSTRAINT "notice_dispatch_recipient_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_recipient" ADD CONSTRAINT "notice_dispatch_recipient_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "notice_delivery_preparation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_dispatch_recipient" ADD CONSTRAINT "notice_dispatch_recipient_receiptEvidenceId_fkey" FOREIGN KEY ("receiptEvidenceId") REFERENCES "dispatch_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_dispatch_record" ADD CONSTRAINT "manual_dispatch_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_dispatch_record" ADD CONSTRAINT "manual_dispatch_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_dispatch_record" ADD CONSTRAINT "manual_dispatch_record_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_dispatch_record" ADD CONSTRAINT "manual_dispatch_record_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_dispatchRecipientId_fkey" FOREIGN KEY ("dispatchRecipientId") REFERENCES "notice_dispatch_recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_evidence" ADD CONSTRAINT "dispatch_evidence_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_dispatchRecipientId_fkey" FOREIGN KEY ("dispatchRecipientId") REFERENCES "notice_dispatch_recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "dispatch_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_receipt_assessment" ADD CONSTRAINT "notice_receipt_assessment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deemed_receipt_assessment" ADD CONSTRAINT "deemed_receipt_assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deemed_receipt_assessment" ADD CONSTRAINT "deemed_receipt_assessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deemed_receipt_assessment" ADD CONSTRAINT "deemed_receipt_assessment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deemed_receipt_assessment" ADD CONSTRAINT "deemed_receipt_assessment_receiptAssessmentId_fkey" FOREIGN KEY ("receiptAssessmentId") REFERENCES "notice_receipt_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_dispatchRecipientId_fkey" FOREIGN KEY ("dispatchRecipientId") REFERENCES "notice_dispatch_recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_sourceEvidenceId_fkey" FOREIGN KEY ("sourceEvidenceId") REFERENCES "dispatch_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgment" ADD CONSTRAINT "notice_acknowledgment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_event" ADD CONSTRAINT "delivery_provider_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_event" ADD CONSTRAINT "delivery_provider_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_event" ADD CONSTRAINT "delivery_provider_event_dispatchAttemptId_fkey" FOREIGN KEY ("dispatchAttemptId") REFERENCES "notice_dispatch_attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_event" ADD CONSTRAINT "delivery_provider_event_dispatchRecipientId_fkey" FOREIGN KEY ("dispatchRecipientId") REFERENCES "notice_dispatch_recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_configuration" ADD CONSTRAINT "delivery_provider_configuration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_configuration" ADD CONSTRAINT "delivery_provider_configuration_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_provider_configuration" ADD CONSTRAINT "delivery_provider_configuration_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Slice 7: FORCE RLS + grants + immutability / append-only triggers

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notice_dispatch_package_snapshot',
    'notice_dispatch_cover_message',
    'notice_dispatch_authorization',
    'notice_dispatch_attempt',
    'notice_dispatch_recipient',
    'manual_dispatch_record',
    'dispatch_evidence',
    'notice_receipt_assessment',
    'deemed_receipt_assessment',
    'notice_acknowledgment',
    'delivery_provider_event',
    'delivery_provider_configuration'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (
         coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
         OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
       ) WITH CHECK (
         coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
         OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
       )', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION prevent_dispatch_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'notice_dispatch_package_snapshot is immutable';
END;
$$;

DROP TRIGGER IF EXISTS notice_dispatch_snapshot_immutable_update ON "notice_dispatch_package_snapshot";
CREATE TRIGGER notice_dispatch_snapshot_immutable_update
  BEFORE UPDATE ON "notice_dispatch_package_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_dispatch_snapshot_mutation();

DROP TRIGGER IF EXISTS notice_dispatch_snapshot_immutable_delete ON "notice_dispatch_package_snapshot";
CREATE TRIGGER notice_dispatch_snapshot_immutable_delete
  BEFORE DELETE ON "notice_dispatch_package_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_dispatch_snapshot_mutation();

CREATE OR REPLACE FUNCTION prevent_provider_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'delivery_provider_event is append-only';
END;
$$;

DROP TRIGGER IF EXISTS delivery_provider_event_append_only_update ON "delivery_provider_event";
CREATE TRIGGER delivery_provider_event_append_only_update
  BEFORE UPDATE ON "delivery_provider_event"
  FOR EACH ROW EXECUTE FUNCTION prevent_provider_event_mutation();

DROP TRIGGER IF EXISTS delivery_provider_event_append_only_delete ON "delivery_provider_event";
CREATE TRIGGER delivery_provider_event_append_only_delete
  BEFORE DELETE ON "delivery_provider_event"
  FOR EACH ROW EXECUTE FUNCTION prevent_provider_event_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "notice_dispatch_package_snapshot",
  "notice_dispatch_cover_message",
  "notice_dispatch_authorization",
  "notice_dispatch_attempt",
  "notice_dispatch_recipient",
  "manual_dispatch_record",
  "dispatch_evidence",
  "notice_receipt_assessment",
  "deemed_receipt_assessment",
  "notice_acknowledgment",
  "delivery_provider_event",
  "delivery_provider_configuration"
TO contractradar_app;
