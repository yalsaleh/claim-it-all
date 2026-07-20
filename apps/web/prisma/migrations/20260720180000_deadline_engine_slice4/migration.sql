-- CreateEnum
CREATE TYPE "ProjectEventCategory" AS ENUM ('LATE_DRAWING_OR_APPROVAL', 'SUSPENSION', 'RESTRICTED_ACCESS', 'SCOPE_CHANGE', 'ADDITIONAL_WORK', 'DELAYED_PAYMENT', 'UNFORESEEN_SITE_CONDITION', 'INSTRUCTION', 'REJECTION', 'CERTIFICATION', 'PAYMENT_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectEventStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'CONFIRMED', 'DISPUTED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProjectEventConfirmationStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED_FACT', 'CONFIRMED_FOR_DEADLINE_ANALYSIS', 'DISPUTED', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "ProjectEventSource" AS ENUM ('MANUAL', 'IMPORTED', 'HUMAN_CONFIRMED_RECORD');

-- CreateEnum
CREATE TYPE "ProjectEventDateType" AS ENUM ('OCCURRENCE_DATE', 'AWARENESS_DATE', 'INSTRUCTION_DATE', 'RECEIPT_DATE', 'ACCESS_DENIAL_DATE', 'PAYMENT_DUE_DATE', 'CERTIFICATE_DATE', 'DISCOVERY_DATE', 'CONTINUING_EVENT_START', 'CONTINUING_EVENT_END', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProjectEventDatePrecision" AS ENUM ('EXACT_DATETIME', 'EXACT_DATE', 'APPROXIMATE_DATE', 'DATE_RANGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProjectEventDateVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProjectEventEvidencePurpose" AS ENUM ('PROVES_OCCURRENCE', 'PROVES_AWARENESS', 'PROVES_RECEIPT', 'PROVES_INSTRUCTION', 'PROVES_CONTINUING_EFFECT', 'SUPPORTS_CLASSIFICATION', 'CONTRADICTS_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectEventRoleType" AS ENUM ('ISSUING_PARTY', 'RECEIVING_PARTY', 'AFFECTED_PARTY', 'CONFIRMING_REVIEWER', 'RESPONSIBLE_INTERNAL_OWNER', 'CONTRACTUAL_RECIPIENT', 'EVENT_CAUSING_PARTY');

-- CreateEnum
CREATE TYPE "EventRuleApplicabilityStatus" AS ENUM ('CANDIDATE', 'SELECTED_FOR_ANALYSIS', 'APPLICABLE', 'NOT_APPLICABLE', 'UNCERTAIN', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "EventRuleAssessmentSource" AS ENUM ('DETERMINISTIC_MATCH', 'HUMAN_SELECTED', 'HUMAN_CONFIRMED', 'IMPORTED', 'FUTURE_AI_SUGGESTION');

-- CreateEnum
CREATE TYPE "ProjectCalendarSource" AS ENUM ('CONTRACT_DEFINED', 'JURISDICTIONAL', 'PROJECT_POLICY', 'INTERNAL_POLICY');

-- CreateEnum
CREATE TYPE "ProjectCalendarStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectCalendarRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CalendarExceptionKind" AS ENUM ('PUBLIC_HOLIDAY', 'DECLARED_HOLIDAY', 'WORKING_DAY_OVERRIDE', 'WEEKEND_OVERRIDE', 'EMERGENCY_CLOSURE', 'PARTIAL_DAY', 'PROJECT_SPECIFIC_CLOSURE');

-- CreateEnum
CREATE TYPE "DeadlineCalculationStatus" AS ENUM ('DRAFT', 'BLOCKED', 'CALCULATED', 'REVIEW_REQUIRED', 'VERIFIED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeadlineMilestoneKind" AS ENUM ('INITIAL_NOTICE', 'UPDATED_NOTICE', 'DETAILED_PARTICULARS', 'FINAL_CLAIM_SUBMISSION', 'RECURRING_MONTHLY_UPDATE', 'RESPONSE_DEADLINE', 'INTERNAL_REVIEW_TARGET', 'INTERNAL_ESCALATION_TARGET');

-- CreateEnum
CREATE TYPE "DeadlineMilestoneClassification" AS ENUM ('CONTRACTUAL', 'INTERNAL', 'ADVISORY', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "DeadlineWarningPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectDeadlineStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'COMPLETED', 'CANCELLED', 'SUPERSEDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProjectDeadlineRiskStatus" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "NotificationIntentStatus" AS ENUM ('PENDING', 'SUPPRESSED', 'CANCELLED', 'FUTURE_DELIVERY');

-- CreateTable
CREATE TABLE "approved_notice_rule_snapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT NOT NULL,
    "sourceNoticeRuleId" TEXT NOT NULL,
    "sourceObligationId" TEXT NOT NULL,
    "sourceClauseId" TEXT,
    "durationValue" DECIMAL(12,4),
    "durationUnit" "NoticeDurationUnit",
    "calendarBasis" "NoticeCalendarBasis",
    "countingConvention" "NoticeCountingConvention" NOT NULL,
    "startDateRule" TEXT,
    "endDateRule" TEXT,
    "businessDayAdjustment" TEXT,
    "timeBarClassification" "TimeBarClassification" NOT NULL,
    "ambiguityStatus" "NoticeAmbiguityStatus" NOT NULL,
    "recipientRequirements" TEXT,
    "deliveryMethodRequirements" TEXT,
    "contentRequirements" TEXT,
    "consequenceText" TEXT,
    "triggerBasis" TEXT,
    "noticeCategory" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "structuredRule" JSONB NOT NULL,
    "reviewDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approved_notice_rule_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT,
    "eventReference" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventCategory" "ProjectEventCategory" NOT NULL,
    "eventSubcategory" TEXT,
    "eventStatus" "ProjectEventStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmationStatus" "ProjectEventConfirmationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "occurredAt" TIMESTAMP(3),
    "becameKnownAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "instructionDate" TIMESTAMP(3),
    "awarenessDate" TIMESTAMP(3),
    "continuingEventStartAt" TIMESTAMP(3),
    "continuingEventEndAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" "ProjectEventSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_date" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "dateType" "ProjectEventDateType" NOT NULL,
    "dateValue" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "precision" "ProjectEventDatePrecision" NOT NULL,
    "verificationStatus" "ProjectEventDateVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "assertedByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_event_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "evidenceSegmentId" TEXT,
    "purpose" "ProjectEventEvidencePurpose" NOT NULL,
    "factualNote" TEXT,
    "linkedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_event_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "roleType" "ProjectEventRoleType" NOT NULL,
    "partyName" TEXT,
    "organization" TEXT,
    "contractPartyId" TEXT,
    "contractRoleId" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_event_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rule_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT NOT NULL,
    "approvedRuleSnapshotId" TEXT NOT NULL,
    "applicabilityStatus" "EventRuleApplicabilityStatus" NOT NULL DEFAULT 'CANDIDATE',
    "assessmentSource" "EventRuleAssessmentSource" NOT NULL,
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rationale" TEXT,
    "assumptions" JSONB,
    "unresolvedIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rule_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_calendar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "workingWeekMask" TEXT,
    "defaultWorkingHours" JSONB,
    "weekendDays" JSONB,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "source" "ProjectCalendarSource" NOT NULL DEFAULT 'PROJECT_POLICY',
    "status" "ProjectCalendarStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_calendar_revision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectCalendarId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "workingWeekMask" TEXT,
    "weekendDays" JSONB NOT NULL,
    "holidayDates" JSONB,
    "specialWorkingDays" JSONB,
    "partialWorkingDays" JSONB,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" "ProjectCalendarRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceEvidence" JSONB,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersedesRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_calendar_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exception" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "calendarRevisionId" TEXT NOT NULL,
    "exceptionDate" DATE NOT NULL,
    "kind" "CalendarExceptionKind" NOT NULL,
    "description" TEXT,
    "partialHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_calculation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "eventRuleAssessmentId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT NOT NULL,
    "approvedRuleSnapshotId" TEXT NOT NULL,
    "calendarRevisionId" TEXT NOT NULL,
    "projectCalendarId" TEXT NOT NULL,
    "calculationStatus" "DeadlineCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "triggerDateType" "ProjectEventDateType" NOT NULL,
    "triggerDateValue" TIMESTAMP(3) NOT NULL,
    "triggerTimezone" TEXT NOT NULL,
    "triggerDateEvidence" JSONB,
    "durationValue" DECIMAL(12,4),
    "durationUnit" "NoticeDurationUnit",
    "countingConvention" "NoticeCountingConvention",
    "startDateRule" TEXT,
    "endDateRule" TEXT,
    "businessDayAdjustment" TEXT,
    "calculatedDeadlineAt" TIMESTAMP(3),
    "calculatedDeadlineDate" TEXT,
    "deadlineTimezone" TEXT NOT NULL,
    "blockedReason" TEXT,
    "ambiguityFlags" JSONB,
    "calculationTrace" JSONB NOT NULL,
    "calculatedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "supersedesCalculationId" TEXT,
    "recalculationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadline_calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_milestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "deadlineCalculationId" TEXT NOT NULL,
    "kind" "DeadlineMilestoneKind" NOT NULL,
    "classification" "DeadlineMilestoneClassification" NOT NULL,
    "label" TEXT,
    "dueAt" TIMESTAMP(3),
    "dueDate" TEXT,
    "timezone" TEXT NOT NULL,
    "offsetDaysBeforeDeadline" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadline_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_warning_policy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deadlineType" TEXT,
    "warningOffsets" JSONB NOT NULL,
    "escalationOffsets" JSONB,
    "responsibleRoleType" TEXT,
    "channelPlaceholder" TEXT,
    "severity" TEXT,
    "status" "DeadlineWarningPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedRevisionNumber" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadline_warning_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deadline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "deadlineCalculationId" TEXT NOT NULL,
    "deadlineMilestoneId" TEXT,
    "title" TEXT NOT NULL,
    "deadlineType" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL,
    "status" "ProjectDeadlineStatus" NOT NULL DEFAULT 'UPCOMING',
    "riskStatus" "ProjectDeadlineRiskStatus" NOT NULL DEFAULT 'UNKNOWN',
    "responsibleUserId" TEXT,
    "responsibleRoleId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionEvidence" JSONB,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_status_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectDeadlineId" TEXT NOT NULL,
    "fromStatus" "ProjectDeadlineStatus",
    "toStatus" "ProjectDeadlineStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "deadline_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_intent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectDeadlineId" TEXT NOT NULL,
    "deadlineMilestoneId" TEXT,
    "recipientUserId" TEXT,
    "recipientRoleId" TEXT,
    "channelType" TEXT NOT NULL,
    "status" "NotificationIntentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "payloadTemplate" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_intent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approved_notice_rule_snapshot_tenantId_projectId_contractPa_idx" ON "approved_notice_rule_snapshot"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "approved_notice_rule_snapshot_configurationRevisionId_idx" ON "approved_notice_rule_snapshot"("configurationRevisionId");

-- CreateIndex
CREATE INDEX "approved_notice_rule_snapshot_sourceNoticeRuleId_idx" ON "approved_notice_rule_snapshot"("sourceNoticeRuleId");

-- CreateIndex
CREATE INDEX "project_event_tenantId_projectId_eventStatus_idx" ON "project_event"("tenantId", "projectId", "eventStatus");

-- CreateIndex
CREATE INDEX "project_event_tenantId_projectId_confirmationStatus_idx" ON "project_event"("tenantId", "projectId", "confirmationStatus");

-- CreateIndex
CREATE INDEX "project_event_contractPackageId_idx" ON "project_event"("contractPackageId");

-- CreateIndex
CREATE INDEX "project_event_date_tenantId_projectId_projectEventId_idx" ON "project_event_date"("tenantId", "projectId", "projectEventId");

-- CreateIndex
CREATE INDEX "project_event_date_projectEventId_dateType_idx" ON "project_event_date"("projectEventId", "dateType");

-- CreateIndex
CREATE INDEX "project_event_evidence_tenantId_projectId_projectEventId_idx" ON "project_event_evidence"("tenantId", "projectId", "projectEventId");

-- CreateIndex
CREATE INDEX "project_event_evidence_sourceDocumentId_idx" ON "project_event_evidence"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "project_event_evidence_documentVersionId_idx" ON "project_event_evidence"("documentVersionId");

-- CreateIndex
CREATE INDEX "project_event_role_tenantId_projectId_projectEventId_idx" ON "project_event_role"("tenantId", "projectId", "projectEventId");

-- CreateIndex
CREATE INDEX "event_rule_assessment_tenantId_projectId_projectEventId_idx" ON "event_rule_assessment"("tenantId", "projectId", "projectEventId");

-- CreateIndex
CREATE INDEX "event_rule_assessment_projectEventId_applicabilityStatus_idx" ON "event_rule_assessment"("projectEventId", "applicabilityStatus");

-- CreateIndex
CREATE INDEX "event_rule_assessment_approvedRuleSnapshotId_idx" ON "event_rule_assessment"("approvedRuleSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "project_calendar_currentRevisionId_key" ON "project_calendar"("currentRevisionId");

-- CreateIndex
CREATE INDEX "project_calendar_tenantId_projectId_status_idx" ON "project_calendar"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_calendar_revision_tenantId_projectId_projectCalenda_idx" ON "project_calendar_revision"("tenantId", "projectId", "projectCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "project_calendar_revision_projectCalendarId_revisionNumber_key" ON "project_calendar_revision"("projectCalendarId", "revisionNumber");

-- CreateIndex
CREATE INDEX "calendar_exception_tenantId_projectId_calendarRevisionId_idx" ON "calendar_exception"("tenantId", "projectId", "calendarRevisionId");

-- CreateIndex
CREATE INDEX "calendar_exception_calendarRevisionId_exceptionDate_idx" ON "calendar_exception"("calendarRevisionId", "exceptionDate");

-- CreateIndex
CREATE INDEX "deadline_calculation_tenantId_projectId_projectEventId_idx" ON "deadline_calculation"("tenantId", "projectId", "projectEventId");

-- CreateIndex
CREATE INDEX "deadline_calculation_projectEventId_calculationStatus_idx" ON "deadline_calculation"("projectEventId", "calculationStatus");

-- CreateIndex
CREATE INDEX "deadline_calculation_approvedRuleSnapshotId_idx" ON "deadline_calculation"("approvedRuleSnapshotId");

-- CreateIndex
CREATE INDEX "deadline_calculation_calendarRevisionId_idx" ON "deadline_calculation"("calendarRevisionId");

-- CreateIndex
CREATE INDEX "deadline_milestone_tenantId_projectId_deadlineCalculationId_idx" ON "deadline_milestone"("tenantId", "projectId", "deadlineCalculationId");

-- CreateIndex
CREATE INDEX "deadline_warning_policy_tenantId_projectId_status_idx" ON "deadline_warning_policy"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_deadline_supersededById_key" ON "project_deadline"("supersededById");

-- CreateIndex
CREATE INDEX "project_deadline_tenantId_projectId_status_idx" ON "project_deadline"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_deadline_projectEventId_idx" ON "project_deadline"("projectEventId");

-- CreateIndex
CREATE INDEX "project_deadline_deadlineCalculationId_idx" ON "project_deadline"("deadlineCalculationId");

-- CreateIndex
CREATE INDEX "deadline_status_history_tenantId_projectId_projectDeadlineI_idx" ON "deadline_status_history"("tenantId", "projectId", "projectDeadlineId");

-- CreateIndex
CREATE INDEX "deadline_status_history_projectDeadlineId_changedAt_idx" ON "deadline_status_history"("projectDeadlineId", "changedAt");

-- CreateIndex
CREATE INDEX "notification_intent_tenantId_projectId_status_scheduledAt_idx" ON "notification_intent"("tenantId", "projectId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "notification_intent_projectDeadlineId_idx" ON "notification_intent"("projectDeadlineId");

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_sourceNoticeRuleId_fkey" FOREIGN KEY ("sourceNoticeRuleId") REFERENCES "notice_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_sourceObligationId_fkey" FOREIGN KEY ("sourceObligationId") REFERENCES "contract_obligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_notice_rule_snapshot" ADD CONSTRAINT "approved_notice_rule_snapshot_reviewDecisionId_fkey" FOREIGN KEY ("reviewDecisionId") REFERENCES "review_decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date" ADD CONSTRAINT "project_event_date_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date" ADD CONSTRAINT "project_event_date_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date" ADD CONSTRAINT "project_event_date_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date" ADD CONSTRAINT "project_event_date_assertedByUserId_fkey" FOREIGN KEY ("assertedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date" ADD CONSTRAINT "project_event_date_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_evidenceSegmentId_fkey" FOREIGN KEY ("evidenceSegmentId") REFERENCES "evidence_segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_evidence" ADD CONSTRAINT "project_event_evidence_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_contractPartyId_fkey" FOREIGN KEY ("contractPartyId") REFERENCES "contract_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_contractRoleId_fkey" FOREIGN KEY ("contractRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_role" ADD CONSTRAINT "project_event_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_approvedRuleSnapshotId_fkey" FOREIGN KEY ("approvedRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rule_assessment" ADD CONSTRAINT "event_rule_assessment_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar" ADD CONSTRAINT "project_calendar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar" ADD CONSTRAINT "project_calendar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar" ADD CONSTRAINT "project_calendar_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar" ADD CONSTRAINT "project_calendar_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar" ADD CONSTRAINT "project_calendar_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "project_calendar_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar_revision" ADD CONSTRAINT "project_calendar_revision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar_revision" ADD CONSTRAINT "project_calendar_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar_revision" ADD CONSTRAINT "project_calendar_revision_projectCalendarId_fkey" FOREIGN KEY ("projectCalendarId") REFERENCES "project_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar_revision" ADD CONSTRAINT "project_calendar_revision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_calendar_revision" ADD CONSTRAINT "project_calendar_revision_supersedesRevisionId_fkey" FOREIGN KEY ("supersedesRevisionId") REFERENCES "project_calendar_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_exception" ADD CONSTRAINT "calendar_exception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_exception" ADD CONSTRAINT "calendar_exception_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_exception" ADD CONSTRAINT "calendar_exception_calendarRevisionId_fkey" FOREIGN KEY ("calendarRevisionId") REFERENCES "project_calendar_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_eventRuleAssessmentId_fkey" FOREIGN KEY ("eventRuleAssessmentId") REFERENCES "event_rule_assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_approvedRuleSnapshotId_fkey" FOREIGN KEY ("approvedRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_calendarRevisionId_fkey" FOREIGN KEY ("calendarRevisionId") REFERENCES "project_calendar_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_projectCalendarId_fkey" FOREIGN KEY ("projectCalendarId") REFERENCES "project_calendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_calculatedByUserId_fkey" FOREIGN KEY ("calculatedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_calculation" ADD CONSTRAINT "deadline_calculation_supersedesCalculationId_fkey" FOREIGN KEY ("supersedesCalculationId") REFERENCES "deadline_calculation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_milestone" ADD CONSTRAINT "deadline_milestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_milestone" ADD CONSTRAINT "deadline_milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_milestone" ADD CONSTRAINT "deadline_milestone_deadlineCalculationId_fkey" FOREIGN KEY ("deadlineCalculationId") REFERENCES "deadline_calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_warning_policy" ADD CONSTRAINT "deadline_warning_policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_warning_policy" ADD CONSTRAINT "deadline_warning_policy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_warning_policy" ADD CONSTRAINT "deadline_warning_policy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_warning_policy" ADD CONSTRAINT "deadline_warning_policy_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_deadlineCalculationId_fkey" FOREIGN KEY ("deadlineCalculationId") REFERENCES "deadline_calculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_deadlineMilestoneId_fkey" FOREIGN KEY ("deadlineMilestoneId") REFERENCES "deadline_milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadline" ADD CONSTRAINT "project_deadline_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "project_deadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_status_history" ADD CONSTRAINT "deadline_status_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_status_history" ADD CONSTRAINT "deadline_status_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_status_history" ADD CONSTRAINT "deadline_status_history_projectDeadlineId_fkey" FOREIGN KEY ("projectDeadlineId") REFERENCES "project_deadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_status_history" ADD CONSTRAINT "deadline_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_projectDeadlineId_fkey" FOREIGN KEY ("projectDeadlineId") REFERENCES "project_deadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_deadlineMilestoneId_fkey" FOREIGN KEY ("deadlineMilestoneId") REFERENCES "deadline_milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_recipientRoleId_fkey" FOREIGN KEY ("recipientRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Slice 4: integrity triggers + FORCE RLS + grants
-- ---------------------------------------------------------------------------

-- Tenant/project consistency for all Slice 4 tenant tables
CREATE OR REPLACE FUNCTION enforce_deadline_tenant_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_tenant text;
BEGIN
  SELECT "tenantId"::text INTO project_tenant FROM "project" WHERE id = NEW."projectId";
  IF project_tenant IS NULL THEN
    RAISE EXCEPTION 'deadline row references unknown project';
  END IF;
  IF NEW."tenantId"::text <> project_tenant THEN
    RAISE EXCEPTION 'deadline row tenantId must match project.tenantId';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'approved_notice_rule_snapshot',
    'project_event',
    'project_event_date',
    'project_event_evidence',
    'project_event_role',
    'event_rule_assessment',
    'project_calendar',
    'project_calendar_revision',
    'calendar_exception',
    'deadline_calculation',
    'deadline_milestone',
    'deadline_warning_policy',
    'project_deadline',
    'deadline_status_history',
    'notification_intent'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_tenant_project_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_tenant_project_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_deadline_tenant_project()',
      t, t
    );
  END LOOP;
END $$;

-- Package-scoped snapshots must match contract package tenant/project
CREATE OR REPLACE FUNCTION enforce_approved_snapshot_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  pkg_tenant text;
  pkg_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO pkg_tenant, pkg_project
  FROM "contract_package" WHERE id = NEW."contractPackageId";
  IF pkg_tenant IS NULL THEN
    RAISE EXCEPTION 'approved_notice_rule_snapshot references unknown contract_package';
  END IF;
  IF NEW."tenantId"::text <> pkg_tenant OR NEW."projectId"::text <> pkg_project THEN
    RAISE EXCEPTION 'approved_notice_rule_snapshot tenant/project must match contract_package';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approved_notice_rule_snapshot_package_guard ON "approved_notice_rule_snapshot";
CREATE TRIGGER approved_notice_rule_snapshot_package_guard
  BEFORE INSERT OR UPDATE ON "approved_notice_rule_snapshot"
  FOR EACH ROW EXECUTE FUNCTION enforce_approved_snapshot_package();

-- Project event children must match parent event tenant/project
CREATE OR REPLACE FUNCTION enforce_project_event_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ev_tenant text;
  ev_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO ev_tenant, ev_project
  FROM "project_event" WHERE id = NEW."projectEventId";
  IF ev_tenant IS NULL THEN
    RAISE EXCEPTION '% references unknown project_event', TG_TABLE_NAME;
  END IF;
  IF NEW."tenantId"::text <> ev_tenant OR NEW."projectId"::text <> ev_project THEN
    RAISE EXCEPTION '% tenant/project must match project_event', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_event_date',
    'project_event_evidence',
    'project_event_role',
    'event_rule_assessment',
    'deadline_calculation',
    'project_deadline'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_event_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_event_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_project_event_child()',
      t, t
    );
  END LOOP;
END $$;

-- Event evidence: source document/version/segment must belong to same tenant/project
CREATE OR REPLACE FUNCTION enforce_project_event_evidence_documents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sd_tenant text;
  sd_project text;
  dv_tenant text;
  dv_project text;
  dv_source text;
  seg_tenant text;
  seg_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO sd_tenant, sd_project
  FROM "source_document" WHERE id = NEW."sourceDocumentId";
  IF sd_tenant IS NULL THEN
    RAISE EXCEPTION 'project_event_evidence references unknown source_document';
  END IF;
  IF NEW."tenantId"::text <> sd_tenant OR NEW."projectId"::text <> sd_project THEN
    RAISE EXCEPTION 'project_event_evidence sourceDocument must belong to same tenant/project';
  END IF;

  SELECT "tenantId"::text, "projectId"::text, "sourceDocumentId"::text
    INTO dv_tenant, dv_project, dv_source
  FROM "document_version" WHERE id = NEW."documentVersionId";
  IF dv_tenant IS NULL THEN
    RAISE EXCEPTION 'project_event_evidence references unknown document_version';
  END IF;
  IF NEW."tenantId"::text <> dv_tenant OR NEW."projectId"::text <> dv_project THEN
    RAISE EXCEPTION 'project_event_evidence documentVersion must belong to same tenant/project';
  END IF;
  IF dv_source <> NEW."sourceDocumentId"::text THEN
    RAISE EXCEPTION 'project_event_evidence documentVersion must belong to sourceDocument';
  END IF;

  IF NEW."evidenceSegmentId" IS NOT NULL THEN
    SELECT "tenantId"::text, "projectId"::text
      INTO seg_tenant, seg_project
    FROM "evidence_segment" WHERE id = NEW."evidenceSegmentId";
    IF seg_tenant IS NULL THEN
      RAISE EXCEPTION 'project_event_evidence references unknown evidence_segment';
    END IF;
    IF NEW."tenantId"::text <> seg_tenant OR NEW."projectId"::text <> seg_project THEN
      RAISE EXCEPTION 'project_event_evidence evidenceSegment must belong to same tenant/project';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_event_evidence_document_guard ON "project_event_evidence";
CREATE TRIGGER project_event_evidence_document_guard
  BEFORE INSERT OR UPDATE ON "project_event_evidence"
  FOR EACH ROW EXECUTE FUNCTION enforce_project_event_evidence_documents();

-- Event rule assessment: snapshot and configuration revision must align with package/project
CREATE OR REPLACE FUNCTION enforce_event_rule_assessment_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snap_tenant text;
  snap_project text;
  snap_package text;
  snap_revision text;
  rev_tenant text;
  rev_project text;
  rev_package text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "contractPackageId"::text, "configurationRevisionId"::text
    INTO snap_tenant, snap_project, snap_package, snap_revision
  FROM "approved_notice_rule_snapshot" WHERE id = NEW."approvedRuleSnapshotId";
  IF snap_tenant IS NULL THEN
    RAISE EXCEPTION 'event_rule_assessment references unknown approved_notice_rule_snapshot';
  END IF;
  IF NEW."tenantId"::text <> snap_tenant
     OR NEW."projectId"::text <> snap_project
     OR NEW."contractPackageId"::text <> snap_package
     OR NEW."configurationRevisionId"::text <> snap_revision THEN
    RAISE EXCEPTION 'event_rule_assessment must match approved_notice_rule_snapshot tenant/project/package/revision';
  END IF;

  SELECT "tenantId"::text, "projectId"::text, "contractPackageId"::text
    INTO rev_tenant, rev_project, rev_package
  FROM "contract_configuration_revision" WHERE id = NEW."configurationRevisionId";
  IF rev_tenant IS NULL THEN
    RAISE EXCEPTION 'event_rule_assessment references unknown contract_configuration_revision';
  END IF;
  IF NEW."tenantId"::text <> rev_tenant
     OR NEW."projectId"::text <> rev_project
     OR NEW."contractPackageId"::text <> rev_package THEN
    RAISE EXCEPTION 'event_rule_assessment must match contract_configuration_revision tenant/project/package';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rule_assessment_integrity_guard ON "event_rule_assessment";
CREATE TRIGGER event_rule_assessment_integrity_guard
  BEFORE INSERT OR UPDATE ON "event_rule_assessment"
  FOR EACH ROW EXECUTE FUNCTION enforce_event_rule_assessment_integrity();

-- Deadline calculation: cross-entity tenant/project/package/revision integrity
CREATE OR REPLACE FUNCTION enforce_deadline_calculation_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assess_tenant text;
  assess_project text;
  assess_event text;
  assess_package text;
  assess_revision text;
  assess_snapshot text;
  snap_revision text;
  cal_tenant text;
  cal_project text;
  cal_calendar text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "projectEventId"::text,
         "contractPackageId"::text, "configurationRevisionId"::text, "approvedRuleSnapshotId"::text
    INTO assess_tenant, assess_project, assess_event, assess_package, assess_revision, assess_snapshot
  FROM "event_rule_assessment" WHERE id = NEW."eventRuleAssessmentId";
  IF assess_tenant IS NULL THEN
    RAISE EXCEPTION 'deadline_calculation references unknown event_rule_assessment';
  END IF;
  IF NEW."tenantId"::text <> assess_tenant
     OR NEW."projectId"::text <> assess_project
     OR NEW."projectEventId"::text <> assess_event
     OR NEW."contractPackageId"::text <> assess_package
     OR NEW."configurationRevisionId"::text <> assess_revision
     OR NEW."approvedRuleSnapshotId"::text <> assess_snapshot THEN
    RAISE EXCEPTION 'deadline_calculation must match event_rule_assessment scope';
  END IF;

  SELECT "configurationRevisionId"::text INTO snap_revision
  FROM "approved_notice_rule_snapshot" WHERE id = NEW."approvedRuleSnapshotId";
  IF snap_revision IS NULL THEN
    RAISE EXCEPTION 'deadline_calculation references unknown approved_notice_rule_snapshot';
  END IF;
  IF NEW."configurationRevisionId"::text <> snap_revision THEN
    RAISE EXCEPTION 'deadline_calculation configurationRevisionId must match approved_notice_rule_snapshot';
  END IF;

  SELECT "tenantId"::text, "projectId"::text, "projectCalendarId"::text
    INTO cal_tenant, cal_project, cal_calendar
  FROM "project_calendar_revision" WHERE id = NEW."calendarRevisionId";
  IF cal_tenant IS NULL THEN
    RAISE EXCEPTION 'deadline_calculation references unknown project_calendar_revision';
  END IF;
  IF NEW."tenantId"::text <> cal_tenant
     OR NEW."projectId"::text <> cal_project
     OR NEW."projectCalendarId"::text <> cal_calendar THEN
    RAISE EXCEPTION 'deadline_calculation must match project_calendar_revision scope';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deadline_calculation_integrity_guard ON "deadline_calculation";
CREATE TRIGGER deadline_calculation_integrity_guard
  BEFORE INSERT OR UPDATE ON "deadline_calculation"
  FOR EACH ROW EXECUTE FUNCTION enforce_deadline_calculation_integrity();

-- Calendar revision must match parent calendar tenant/project
CREATE OR REPLACE FUNCTION enforce_calendar_revision_calendar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cal_tenant text;
  cal_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO cal_tenant, cal_project
  FROM "project_calendar" WHERE id = NEW."projectCalendarId";
  IF cal_tenant IS NULL THEN
    RAISE EXCEPTION 'project_calendar_revision references unknown project_calendar';
  END IF;
  IF NEW."tenantId"::text <> cal_tenant OR NEW."projectId"::text <> cal_project THEN
    RAISE EXCEPTION 'project_calendar_revision tenant/project must match project_calendar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_calendar_revision_calendar_guard ON "project_calendar_revision";
CREATE TRIGGER project_calendar_revision_calendar_guard
  BEFORE INSERT OR UPDATE ON "project_calendar_revision"
  FOR EACH ROW EXECUTE FUNCTION enforce_calendar_revision_calendar();

-- Calendar exception must match revision tenant/project
CREATE OR REPLACE FUNCTION enforce_calendar_exception_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rev_tenant text;
  rev_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO rev_tenant, rev_project
  FROM "project_calendar_revision" WHERE id = NEW."calendarRevisionId";
  IF rev_tenant IS NULL THEN
    RAISE EXCEPTION 'calendar_exception references unknown project_calendar_revision';
  END IF;
  IF NEW."tenantId"::text <> rev_tenant OR NEW."projectId"::text <> rev_project THEN
    RAISE EXCEPTION 'calendar_exception tenant/project must match project_calendar_revision';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_exception_revision_guard ON "calendar_exception";
CREATE TRIGGER calendar_exception_revision_guard
  BEFORE INSERT OR UPDATE ON "calendar_exception"
  FOR EACH ROW EXECUTE FUNCTION enforce_calendar_exception_revision();

-- Approved notice-rule snapshots are immutable (delete only via contract revision test purge)
CREATE OR REPLACE FUNCTION prevent_approved_notice_rule_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'approved_notice_rule_snapshot is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('app.allow_contract_revision_purge', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'approved_notice_rule_snapshot cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS approved_notice_rule_snapshot_immutable_update ON "approved_notice_rule_snapshot";
CREATE TRIGGER approved_notice_rule_snapshot_immutable_update
  BEFORE UPDATE ON "approved_notice_rule_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_rule_snapshot_mutation();

DROP TRIGGER IF EXISTS approved_notice_rule_snapshot_immutable_delete ON "approved_notice_rule_snapshot";
CREATE TRIGGER approved_notice_rule_snapshot_immutable_delete
  BEFORE DELETE ON "approved_notice_rule_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_rule_snapshot_mutation();

-- Verified deadline calculations are immutable except test purge
CREATE OR REPLACE FUNCTION prevent_verified_deadline_calculation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."calculationStatus" = 'VERIFIED'
       AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') <> 'on'
    THEN
      RAISE EXCEPTION 'verified deadline_calculation cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."calculationStatus" = 'VERIFIED' THEN
    IF coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF NEW."calculationStatus" = 'SUPERSEDED'
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."projectId" IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."projectEventId" IS NOT DISTINCT FROM OLD."projectEventId"
       AND NEW."eventRuleAssessmentId" IS NOT DISTINCT FROM OLD."eventRuleAssessmentId"
       AND NEW."contractPackageId" IS NOT DISTINCT FROM OLD."contractPackageId"
       AND NEW."configurationRevisionId" IS NOT DISTINCT FROM OLD."configurationRevisionId"
       AND NEW."approvedRuleSnapshotId" IS NOT DISTINCT FROM OLD."approvedRuleSnapshotId"
       AND NEW."calendarRevisionId" IS NOT DISTINCT FROM OLD."calendarRevisionId"
       AND NEW."projectCalendarId" IS NOT DISTINCT FROM OLD."projectCalendarId"
       AND NEW."calculationVersion" IS NOT DISTINCT FROM OLD."calculationVersion"
       AND NEW."triggerDateType" IS NOT DISTINCT FROM OLD."triggerDateType"
       AND NEW."triggerDateValue" IS NOT DISTINCT FROM OLD."triggerDateValue"
       AND NEW."triggerTimezone" IS NOT DISTINCT FROM OLD."triggerTimezone"
       AND NEW."triggerDateEvidence" IS NOT DISTINCT FROM OLD."triggerDateEvidence"
       AND NEW."durationValue" IS NOT DISTINCT FROM OLD."durationValue"
       AND NEW."durationUnit" IS NOT DISTINCT FROM OLD."durationUnit"
       AND NEW."countingConvention" IS NOT DISTINCT FROM OLD."countingConvention"
       AND NEW."startDateRule" IS NOT DISTINCT FROM OLD."startDateRule"
       AND NEW."endDateRule" IS NOT DISTINCT FROM OLD."endDateRule"
       AND NEW."businessDayAdjustment" IS NOT DISTINCT FROM OLD."businessDayAdjustment"
       AND NEW."calculatedDeadlineAt" IS NOT DISTINCT FROM OLD."calculatedDeadlineAt"
       AND NEW."calculatedDeadlineDate" IS NOT DISTINCT FROM OLD."calculatedDeadlineDate"
       AND NEW."deadlineTimezone" IS NOT DISTINCT FROM OLD."deadlineTimezone"
       AND NEW."blockedReason" IS NOT DISTINCT FROM OLD."blockedReason"
       AND NEW."ambiguityFlags" IS NOT DISTINCT FROM OLD."ambiguityFlags"
       AND NEW."calculationTrace" IS NOT DISTINCT FROM OLD."calculationTrace"
       AND NEW."calculatedByUserId" IS NOT DISTINCT FROM OLD."calculatedByUserId"
       AND NEW."reviewedByUserId" IS NOT DISTINCT FROM OLD."reviewedByUserId"
       AND NEW."reviewedAt" IS NOT DISTINCT FROM OLD."reviewedAt"
       AND NEW."supersedesCalculationId" IS NOT DISTINCT FROM OLD."supersedesCalculationId"
       AND NEW."recalculationReason" IS NOT DISTINCT FROM OLD."recalculationReason"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'verified deadline_calculation is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deadline_calculation_immutable_update ON "deadline_calculation";
CREATE TRIGGER deadline_calculation_immutable_update
  BEFORE UPDATE ON "deadline_calculation"
  FOR EACH ROW EXECUTE FUNCTION prevent_verified_deadline_calculation_mutation();

DROP TRIGGER IF EXISTS deadline_calculation_immutable_delete ON "deadline_calculation";
CREATE TRIGGER deadline_calculation_immutable_delete
  BEFORE DELETE ON "deadline_calculation"
  FOR EACH ROW EXECUTE FUNCTION prevent_verified_deadline_calculation_mutation();

-- Approved project calendar revisions are immutable except supersession
CREATE OR REPLACE FUNCTION prevent_approved_project_calendar_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED'
       AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') <> 'on'
    THEN
      RAISE EXCEPTION 'approved project_calendar_revision cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'APPROVED' THEN
    IF coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'SUPERSEDED'
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."projectId" IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."projectCalendarId" IS NOT DISTINCT FROM OLD."projectCalendarId"
       AND NEW."revisionNumber" IS NOT DISTINCT FROM OLD."revisionNumber"
       AND NEW.timezone IS NOT DISTINCT FROM OLD.timezone
       AND NEW."workingWeekMask" IS NOT DISTINCT FROM OLD."workingWeekMask"
       AND NEW."weekendDays" IS NOT DISTINCT FROM OLD."weekendDays"
       AND NEW."holidayDates" IS NOT DISTINCT FROM OLD."holidayDates"
       AND NEW."specialWorkingDays" IS NOT DISTINCT FROM OLD."specialWorkingDays"
       AND NEW."partialWorkingDays" IS NOT DISTINCT FROM OLD."partialWorkingDays"
       AND NEW."effectiveFrom" IS NOT DISTINCT FROM OLD."effectiveFrom"
       AND NEW."effectiveTo" IS NOT DISTINCT FROM OLD."effectiveTo"
       AND NEW."sourceEvidence" IS NOT DISTINCT FROM OLD."sourceEvidence"
       AND NEW."approvedByUserId" IS NOT DISTINCT FROM OLD."approvedByUserId"
       AND NEW."approvedAt" IS NOT DISTINCT FROM OLD."approvedAt"
       AND NEW."supersedesRevisionId" IS NOT DISTINCT FROM OLD."supersedesRevisionId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved project_calendar_revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_calendar_revision_immutable_update ON "project_calendar_revision";
CREATE TRIGGER project_calendar_revision_immutable_update
  BEFORE UPDATE ON "project_calendar_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_project_calendar_revision_mutation();

DROP TRIGGER IF EXISTS project_calendar_revision_immutable_delete ON "project_calendar_revision";
CREATE TRIGGER project_calendar_revision_immutable_delete
  BEFORE DELETE ON "project_calendar_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_project_calendar_revision_mutation();

-- Deadline status history is append-only (test purge via app.allow_deadline_purge)
CREATE OR REPLACE FUNCTION prevent_deadline_status_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on'
  THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on'
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'deadline_status_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS deadline_status_history_append_only_update ON "deadline_status_history";
CREATE TRIGGER deadline_status_history_append_only_update
  BEFORE UPDATE ON "deadline_status_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_deadline_status_history_mutation();

DROP TRIGGER IF EXISTS deadline_status_history_append_only_delete ON "deadline_status_history";
CREATE TRIGGER deadline_status_history_append_only_delete
  BEFORE DELETE ON "deadline_status_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_deadline_status_history_mutation();

-- FORCE RLS on all Slice 4 tenant tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'approved_notice_rule_snapshot',
    'project_event',
    'project_event_date',
    'project_event_evidence',
    'project_event_role',
    'event_rule_assessment',
    'project_calendar',
    'project_calendar_revision',
    'calendar_exception',
    'deadline_calculation',
    'deadline_milestone',
    'deadline_warning_policy',
    'project_deadline',
    'deadline_status_history',
    'notification_intent'
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

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "approved_notice_rule_snapshot",
  "project_event",
  "project_event_date",
  "project_event_evidence",
  "project_event_role",
  "event_rule_assessment",
  "project_calendar",
  "project_calendar_revision",
  "calendar_exception",
  "deadline_calculation",
  "deadline_milestone",
  "deadline_warning_policy",
  "project_deadline",
  "deadline_status_history",
  "notification_intent"
TO contractradar_app;
