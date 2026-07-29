-- CreateEnum
CREATE TYPE "ConnectorAccountStatus" AS ENUM ('DRAFT', 'VALIDATION_REQUIRED', 'VALIDATED', 'APPROVED', 'DISABLED', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConnectorScopeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConnectorScopeDirection" AS ENUM ('IMPORT_ONLY', 'FUTURE_EXPORT_RESERVED');

-- CreateEnum
CREATE TYPE "ConnectorSyncRunType" AS ENUM ('MANUAL', 'SCHEDULED', 'INCREMENTAL', 'RESCAN');

-- CreateEnum
CREATE TYPE "ConnectorSyncRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PARTIALLY_SUCCEEDED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "ExternalRecordType" AS ENUM ('EMAIL', 'EMAIL_ATTACHMENT', 'LETTER', 'RFI', 'INSTRUCTION', 'MEETING_MINUTES', 'DAILY_REPORT', 'PAYMENT_RECORD', 'DRAWING', 'SPREADSHEET', 'PHOTOGRAPH', 'EDMS_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalRecordImportStatus" AS ENUM ('DISCOVERED', 'QUEUED', 'IMPORTING', 'IMPORTED', 'SKIPPED', 'DUPLICATE', 'FAILED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "OperationalAlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "OperationalTaskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationalTaskType" AS ENUM ('REVIEW_EVENT_SUGGESTION', 'VERIFY_EVENT_DATE', 'PROVIDE_EVIDENCE', 'REVIEW_DEADLINE', 'PREPARE_NOTICE', 'REVIEW_NOTICE', 'APPROVE_NOTICE', 'AUTHORIZE_DISPATCH', 'VERIFY_DISPATCH', 'CONFIRM_RECEIPT', 'FIX_CONNECTOR', 'REVIEW_CONTRACT_CONFIGURATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InternalNotificationChannel" AS ENUM ('IN_APP', 'LOCAL_CAPTURE', 'FUTURE_EMAIL', 'FUTURE_SLACK', 'FUTURE_TEAMS', 'DIGEST');

-- CreateEnum
CREATE TYPE "InternalNotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'DISMISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EscalationPolicyStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'DISABLED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "connector_account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ConnectorAccountStatus" NOT NULL DEFAULT 'DRAFT',
    "secretReference" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalTenantId" TEXT,
    "configuredByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastValidationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_project_scope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "externalMailboxOrFolder" TEXT NOT NULL,
    "externalProjectId" TEXT,
    "includeRules" JSONB NOT NULL,
    "excludeRules" JSONB NOT NULL,
    "approvedDocumentTypes" JSONB NOT NULL,
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "direction" "ConnectorScopeDirection" NOT NULL DEFAULT 'IMPORT_ONLY',
    "status" "ConnectorScopeStatus" NOT NULL DEFAULT 'DRAFT',
    "lastCheckpoint" JSONB,
    "configuredByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_project_scope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_scope_approval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectorProjectScopeId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "scopeSnapshot" JSONB NOT NULL,

    CONSTRAINT "connector_scope_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_sync_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "connectorProjectScopeId" TEXT NOT NULL,
    "scopeSnapshot" JSONB NOT NULL,
    "runType" "ConnectorSyncRunType" NOT NULL,
    "status" "ConnectorSyncRunStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checkpointBefore" JSONB,
    "checkpointAfter" JSONB,
    "recordsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "recordsImported" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "duplicatesDetected" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "processorVersion" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "connectorProjectScopeId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "externalSystem" TEXT NOT NULL,
    "externalRecordId" TEXT NOT NULL,
    "externalThreadId" TEXT,
    "externalParentId" TEXT,
    "recordType" "ExternalRecordType" NOT NULL,
    "subjectOrTitle" TEXT,
    "sourceTimestamp" TIMESTAMP(3),
    "senderAuthorSnapshot" JSONB,
    "recipientSnapshot" JSONB,
    "externalVersionId" TEXT NOT NULL DEFAULT '',
    "externalChecksum" TEXT,
    "importedChecksum" TEXT,
    "sourceMetadata" JSONB,
    "importStatus" "ExternalRecordImportStatus" NOT NULL DEFAULT 'DISCOVERED',
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),
    "deletedExternally" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_provider_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalResourceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureStatus" TEXT NOT NULL,
    "payloadChecksum" TEXT NOT NULL,
    "redactedPayload" JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "linkedSyncRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_provider_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" "OperationalAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "ownerRoleId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "rulesetVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_alert_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_alert_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_policy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "alertTypes" JSONB NOT NULL,
    "severityThreshold" "OperationalAlertSeverity" NOT NULL,
    "status" "EscalationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "businessCalendarId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_step" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "escalationPolicyId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "afterMinutes" INTEGER NOT NULL,
    "targetUserId" TEXT,
    "targetRoleId" TEXT,
    "severityChange" "OperationalAlertSeverity",
    "createTask" BOOLEAN NOT NULL DEFAULT true,
    "requireAcknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "repeatBehavior" TEXT,

    CONSTRAINT "escalation_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceAlertId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "OperationalTaskType" NOT NULL,
    "priority" TEXT NOT NULL,
    "status" "OperationalTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assignedUserId" TEXT,
    "assignedRoleId" TEXT,
    "dueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "recipientUserId" TEXT NOT NULL,
    "channel" "InternalNotificationChannel" NOT NULL,
    "status" "InternalNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "internal_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_saved_view" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_saved_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_timeline_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_timeline_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_operations_summary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "criticalAlertCount" INTEGER NOT NULL DEFAULT 0,
    "openAlertCount" INTEGER NOT NULL DEFAULT 0,
    "deadlinesDueSoonCount" INTEGER NOT NULL DEFAULT 0,
    "overdueDeadlineCount" INTEGER NOT NULL DEFAULT 0,
    "pendingSuggestionCount" INTEGER NOT NULL DEFAULT 0,
    "noticeBlockerCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "rebuiltAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_operations_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_account_tenantId_status_idx" ON "connector_account"("tenantId", "status");

-- CreateIndex
CREATE INDEX "connector_account_tenantId_provider_idx" ON "connector_account"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "connector_project_scope_tenantId_projectId_status_idx" ON "connector_project_scope"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connector_project_scope_connectorAccountId_projectId_extern_key" ON "connector_project_scope"("connectorAccountId", "projectId", "externalMailboxOrFolder");

-- CreateIndex
CREATE INDEX "connector_scope_approval_tenantId_connectorProjectScopeId_d_idx" ON "connector_scope_approval"("tenantId", "connectorProjectScopeId", "decidedAt");

-- CreateIndex
CREATE INDEX "connector_sync_run_tenantId_projectId_status_createdAt_idx" ON "connector_sync_run"("tenantId", "projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "connector_sync_run_connectorProjectScopeId_idx" ON "connector_sync_run"("connectorProjectScopeId");

-- CreateIndex
CREATE INDEX "connector_sync_run_correlationId_idx" ON "connector_sync_run"("correlationId");

-- CreateIndex
CREATE INDEX "external_record_tenantId_projectId_importStatus_idx" ON "external_record"("tenantId", "projectId", "importStatus");

-- CreateIndex
CREATE INDEX "external_record_syncRunId_idx" ON "external_record"("syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "external_record_connectorAccountId_connectorProjectScopeId__key" ON "external_record"("connectorAccountId", "connectorProjectScopeId", "externalRecordId", "externalVersionId");

-- CreateIndex
CREATE INDEX "connector_provider_event_tenantId_connectorAccountId_receiv_idx" ON "connector_provider_event"("tenantId", "connectorAccountId", "receivedAt");

-- CreateIndex
CREATE INDEX "connector_provider_event_linkedSyncRunId_idx" ON "connector_provider_event"("linkedSyncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "connector_provider_event_provider_providerEventId_key" ON "connector_provider_event"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "operational_alert_tenantId_dedupeKey_idx" ON "operational_alert"("tenantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "operational_alert_tenantId_projectId_status_idx" ON "operational_alert"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "operational_alert_tenantId_severity_status_idx" ON "operational_alert"("tenantId", "severity", "status");

-- CreateIndex
CREATE INDEX "operational_alert_event_tenantId_alertId_createdAt_idx" ON "operational_alert_event"("tenantId", "alertId", "createdAt");

-- CreateIndex
CREATE INDEX "escalation_policy_tenantId_projectId_status_idx" ON "escalation_policy"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "escalation_step_tenantId_escalationPolicyId_stepOrder_idx" ON "escalation_step"("tenantId", "escalationPolicyId", "stepOrder");

-- CreateIndex
CREATE INDEX "operational_task_tenantId_projectId_status_idx" ON "operational_task"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "operational_task_assignedUserId_status_idx" ON "operational_task"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "operational_task_sourceAlertId_idx" ON "operational_task"("sourceAlertId");

-- CreateIndex
CREATE INDEX "internal_notification_tenantId_recipientUserId_status_idx" ON "internal_notification"("tenantId", "recipientUserId", "status");

-- CreateIndex
CREATE INDEX "internal_notification_tenantId_projectId_idx" ON "internal_notification"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "operational_saved_view_tenantId_ownerUserId_idx" ON "operational_saved_view"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "project_timeline_event_tenantId_projectId_occurredAt_idx" ON "project_timeline_event"("tenantId", "projectId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_operations_summary_projectId_key" ON "project_operations_summary"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_operations_summary_tenantId_projectId_key" ON "project_operations_summary"("tenantId", "projectId");

-- AddForeignKey
ALTER TABLE "connector_account" ADD CONSTRAINT "connector_account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_account" ADD CONSTRAINT "connector_account_configuredByUserId_fkey" FOREIGN KEY ("configuredByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_account" ADD CONSTRAINT "connector_account_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "connector_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_configuredByUserId_fkey" FOREIGN KEY ("configuredByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_project_scope" ADD CONSTRAINT "connector_project_scope_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_scope_approval" ADD CONSTRAINT "connector_scope_approval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_scope_approval" ADD CONSTRAINT "connector_scope_approval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_scope_approval" ADD CONSTRAINT "connector_scope_approval_connectorProjectScopeId_fkey" FOREIGN KEY ("connectorProjectScopeId") REFERENCES "connector_project_scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_scope_approval" ADD CONSTRAINT "connector_scope_approval_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_run" ADD CONSTRAINT "connector_sync_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_run" ADD CONSTRAINT "connector_sync_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_run" ADD CONSTRAINT "connector_sync_run_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "connector_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_run" ADD CONSTRAINT "connector_sync_run_connectorProjectScopeId_fkey" FOREIGN KEY ("connectorProjectScopeId") REFERENCES "connector_project_scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_run" ADD CONSTRAINT "connector_sync_run_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "connector_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_connectorProjectScopeId_fkey" FOREIGN KEY ("connectorProjectScopeId") REFERENCES "connector_project_scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "connector_sync_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_record" ADD CONSTRAINT "external_record_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_provider_event" ADD CONSTRAINT "connector_provider_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_provider_event" ADD CONSTRAINT "connector_provider_event_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "connector_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_provider_event" ADD CONSTRAINT "connector_provider_event_linkedSyncRunId_fkey" FOREIGN KEY ("linkedSyncRunId") REFERENCES "connector_sync_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert" ADD CONSTRAINT "operational_alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert" ADD CONSTRAINT "operational_alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert" ADD CONSTRAINT "operational_alert_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert" ADD CONSTRAINT "operational_alert_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_event" ADD CONSTRAINT "operational_alert_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_event" ADD CONSTRAINT "operational_alert_event_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "operational_alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_event" ADD CONSTRAINT "operational_alert_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_businessCalendarId_fkey" FOREIGN KEY ("businessCalendarId") REFERENCES "project_calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_step" ADD CONSTRAINT "escalation_step_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_step" ADD CONSTRAINT "escalation_step_escalationPolicyId_fkey" FOREIGN KEY ("escalationPolicyId") REFERENCES "escalation_policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_step" ADD CONSTRAINT "escalation_step_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_step" ADD CONSTRAINT "escalation_step_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_sourceAlertId_fkey" FOREIGN KEY ("sourceAlertId") REFERENCES "operational_alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_assignedRoleId_fkey" FOREIGN KEY ("assignedRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notification" ADD CONSTRAINT "internal_notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notification" ADD CONSTRAINT "internal_notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notification" ADD CONSTRAINT "internal_notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_saved_view" ADD CONSTRAINT "operational_saved_view_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_saved_view" ADD CONSTRAINT "operational_saved_view_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_saved_view" ADD CONSTRAINT "operational_saved_view_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_timeline_event" ADD CONSTRAINT "project_timeline_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_timeline_event" ADD CONSTRAINT "project_timeline_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_timeline_event" ADD CONSTRAINT "project_timeline_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_operations_summary" ADD CONSTRAINT "project_operations_summary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_operations_summary" ADD CONSTRAINT "project_operations_summary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Slice 8: FORCE RLS + grants + immutability

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'connector_account',
    'connector_project_scope',
    'connector_scope_approval',
    'connector_sync_run',
    'external_record',
    'connector_provider_event',
    'operational_alert',
    'operational_alert_event',
    'escalation_policy',
    'escalation_step',
    'operational_task',
    'internal_notification',
    'operational_saved_view',
    'project_timeline_event',
    'project_operations_summary'
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

CREATE OR REPLACE FUNCTION prevent_connector_sync_run_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_ops_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED', 'PARTIALLY_SUCCEEDED')
     AND TG_OP = 'UPDATE' THEN
    -- Allow only status transitions while RUNNING/QUEUED; block edits after terminal
    IF OLD.status IN ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTERED') THEN
      RAISE EXCEPTION 'completed connector_sync_run is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'connector_sync_run delete forbidden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connector_sync_run_immutable ON "connector_sync_run";
CREATE TRIGGER connector_sync_run_immutable
  BEFORE UPDATE OR DELETE ON "connector_sync_run"
  FOR EACH ROW EXECUTE FUNCTION prevent_connector_sync_run_mutation();

CREATE OR REPLACE FUNCTION prevent_connector_provider_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_ops_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'connector_provider_event is append-only';
END;
$$;

DROP TRIGGER IF EXISTS connector_provider_event_append_only ON "connector_provider_event";
CREATE TRIGGER connector_provider_event_append_only
  BEFORE UPDATE OR DELETE ON "connector_provider_event"
  FOR EACH ROW EXECUTE FUNCTION prevent_connector_provider_event_mutation();

CREATE OR REPLACE FUNCTION prevent_scope_approval_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_ops_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'connector_scope_approval is append-only';
END;
$$;

DROP TRIGGER IF EXISTS connector_scope_approval_append_only ON "connector_scope_approval";
CREATE TRIGGER connector_scope_approval_append_only
  BEFORE UPDATE OR DELETE ON "connector_scope_approval"
  FOR EACH ROW EXECUTE FUNCTION prevent_scope_approval_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "connector_account",
  "connector_project_scope",
  "connector_scope_approval",
  "connector_sync_run",
  "external_record",
  "connector_provider_event",
  "operational_alert",
  "operational_alert_event",
  "escalation_policy",
  "escalation_step",
  "operational_task",
  "internal_notification",
  "operational_saved_view",
  "project_timeline_event",
  "project_operations_summary"
TO contractradar_app;
