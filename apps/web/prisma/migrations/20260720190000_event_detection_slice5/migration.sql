-- CreateEnum
CREATE TYPE "DetectionRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PARTIALLY_SUCCEEDED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "DetectionRunType" AS ENUM ('MANUAL_HISTORICAL_SCAN', 'DOCUMENT_RESCAN', 'PROJECT_INCREMENTAL_SCAN', 'FUTURE_LIVE_MONITORING');

-- CreateEnum
CREATE TYPE "DetectionAnalysisProfile" AS ENUM ('DETERMINISTIC_ONLY', 'HYBRID_STANDARD', 'HYBRID_ARABIC_ENGLISH', 'PAYMENT_FOCUSED', 'ACCESS_DELAY_FOCUSED', 'CHANGE_FOCUSED');

-- CreateEnum
CREATE TYPE "ProjectEventSuggestionStatus" AS ENUM ('PENDING_REVIEW', 'NEEDS_MORE_EVIDENCE', 'ACCEPTED', 'ACCEPTED_WITH_CHANGES', 'REJECTED', 'DUPLICATE', 'MERGED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DetectionConfidenceBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SuggestionEvidenceRole" AS ENUM ('PRIMARY_SUPPORT', 'SUPPORTING', 'DATE_SUPPORT', 'PARTY_SUPPORT', 'IMPACT_SUPPORT', 'CONTRADICTING', 'CONTEXT', 'DUPLICATE_SIGNAL', 'MISSING_EXPECTED_EVIDENCE');

-- CreateEnum
CREATE TYPE "DateSuggestionStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DetectionGapStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SuggestionRuleCandidateStatus" AS ENUM ('CANDIDATE', 'REVIEWED', 'SELECTED', 'REJECTED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "DetectionContextType" AS ENUM ('EMAIL_THREAD', 'RFI_THREAD', 'INSTRUCTION_RESPONSE', 'FOLLOW_UP_SEQUENCE', 'MEETING_SEQUENCE', 'DAILY_REPORT_SEQUENCE', 'PAYMENT_SEQUENCE', 'DRAWING_REVISION_CHAIN', 'VARIATION_CHAIN', 'OTHER');

-- AlterEnum
ALTER TYPE "ProjectEventSource" ADD VALUE 'DETECTION_ACCEPTED';

-- CreateTable
CREATE TABLE "project_event_detection_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analysisProfile" "DetectionAnalysisProfile" NOT NULL DEFAULT 'DETERMINISTIC_ONLY',
    "status" "DetectionRunStatus" NOT NULL DEFAULT 'QUEUED',
    "runType" "DetectionRunType" NOT NULL,
    "sourceScope" JSONB,
    "sourceDocumentVersionIds" JSONB,
    "startedByUserId" TEXT NOT NULL,
    "processorName" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "rulesetVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "correlationId" TEXT NOT NULL,
    "documentsConsidered" INTEGER NOT NULL DEFAULT 0,
    "segmentsConsidered" INTEGER NOT NULL DEFAULT 0,
    "suggestionsCreated" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_event_detection_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_context_group" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionRunId" TEXT,
    "contextType" "DetectionContextType" NOT NULL,
    "documentVersionIds" JSONB,
    "evidenceSegmentIds" JSONB,
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "participants" JSONB,
    "groupingMethod" TEXT NOT NULL,
    "confidenceBand" "DetectionConfidenceBand" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_context_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_suggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionRunId" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "eventSubcategory" TEXT,
    "suggestedTitle" TEXT NOT NULL,
    "suggestedDescription" TEXT,
    "suggestedStatus" TEXT,
    "suggestedOccurredAt" TIMESTAMP(3),
    "suggestedAwarenessAt" TIMESTAMP(3),
    "suggestedReceivedAt" TIMESTAMP(3),
    "suggestedInstructionDate" TIMESTAMP(3),
    "datePrecision" TEXT,
    "dateBasis" TEXT,
    "confidenceBand" "DetectionConfidenceBand" NOT NULL DEFAULT 'LOW',
    "confidenceScore" DOUBLE PRECISION,
    "confidenceExplanation" TEXT,
    "interpretationSummary" TEXT,
    "factsSummary" TEXT,
    "assumptions" JSONB,
    "ambiguities" JSONB,
    "missingEvidenceSummary" JSONB,
    "contradictions" JSONB,
    "status" "ProjectEventSuggestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "acceptedProjectEventId" TEXT,
    "duplicateOfSuggestionId" TEXT,
    "duplicateOfProjectEventId" TEXT,
    "detectorSource" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_event_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_suggestion_evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "evidenceSegmentId" TEXT NOT NULL,
    "evidenceRole" "SuggestionEvidenceRole" NOT NULL,
    "relevanceExplanation" TEXT,
    "selectedQuote" TEXT NOT NULL,
    "quoteChecksum" TEXT NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "confidenceBand" "DetectionConfidenceBand" NOT NULL DEFAULT 'LOW',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_event_suggestion_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_event_date_suggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "dateType" "ProjectEventDateType" NOT NULL,
    "suggestedValue" TIMESTAMP(3),
    "timezone" TEXT,
    "precision" "ProjectEventDatePrecision" NOT NULL,
    "evidenceSegmentId" TEXT,
    "extractionText" TEXT,
    "basis" TEXT,
    "ambiguity" TEXT,
    "alternatives" JSONB,
    "status" "DateSuggestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewerDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_event_date_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_evidence_gap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "gapCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "suggestedSourceType" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "DetectionGapStatus" NOT NULL DEFAULT 'OPEN',
    "reviewerResolution" TEXT,
    "linkedEvidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detection_evidence_gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_rule_candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "approvedRuleSnapshotId" TEXT NOT NULL,
    "matchReason" TEXT,
    "matchedCategory" TEXT,
    "matchedTriggerType" TEXT,
    "partyRoleAlignment" TEXT,
    "sourceClauseId" TEXT,
    "confidenceBand" "DetectionConfidenceBand" NOT NULL DEFAULT 'LOW',
    "blockingIssues" JSONB,
    "status" "SuggestionRuleCandidateStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewerDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_rule_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_party_candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "suggestedName" TEXT,
    "contractPartyId" TEXT,
    "contractRoleId" TEXT,
    "confidenceBand" "DetectionConfidenceBand" NOT NULL DEFAULT 'LOW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_party_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_reviewer_feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "falsePositiveReason" TEXT,
    "correctedCategory" TEXT,
    "notes" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_reviewer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_event_detection_run_tenantId_projectId_status_queue_idx" ON "project_event_detection_run"("tenantId", "projectId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "project_event_detection_run_correlationId_idx" ON "project_event_detection_run"("correlationId");

-- CreateIndex
CREATE INDEX "detection_context_group_tenantId_projectId_contextType_idx" ON "detection_context_group"("tenantId", "projectId", "contextType");

-- CreateIndex
CREATE INDEX "project_event_suggestion_tenantId_projectId_status_idx" ON "project_event_suggestion"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_event_suggestion_detectionRunId_idx" ON "project_event_suggestion"("detectionRunId");

-- CreateIndex
CREATE INDEX "project_event_suggestion_acceptedProjectEventId_idx" ON "project_event_suggestion"("acceptedProjectEventId");

-- CreateIndex
CREATE INDEX "project_event_suggestion_evidence_tenantId_projectId_sugges_idx" ON "project_event_suggestion_evidence"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "project_event_suggestion_evidence_evidenceSegmentId_idx" ON "project_event_suggestion_evidence"("evidenceSegmentId");

-- CreateIndex
CREATE INDEX "project_event_date_suggestion_tenantId_projectId_suggestion_idx" ON "project_event_date_suggestion"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "detection_evidence_gap_tenantId_projectId_suggestionId_idx" ON "detection_evidence_gap"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "suggestion_rule_candidate_tenantId_projectId_suggestionId_idx" ON "suggestion_rule_candidate"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "suggestion_rule_candidate_approvedRuleSnapshotId_idx" ON "suggestion_rule_candidate"("approvedRuleSnapshotId");

-- CreateIndex
CREATE INDEX "suggestion_party_candidate_tenantId_projectId_suggestionId_idx" ON "suggestion_party_candidate"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "detection_reviewer_feedback_tenantId_projectId_suggestionId_idx" ON "detection_reviewer_feedback"("tenantId", "projectId", "suggestionId");

-- CreateIndex
CREATE INDEX "detection_reviewer_feedback_suggestionId_createdAt_idx" ON "detection_reviewer_feedback"("suggestionId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_event_detection_run" ADD CONSTRAINT "project_event_detection_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_detection_run" ADD CONSTRAINT "project_event_detection_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_detection_run" ADD CONSTRAINT "project_event_detection_run_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_context_group" ADD CONSTRAINT "detection_context_group_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_context_group" ADD CONSTRAINT "detection_context_group_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_context_group" ADD CONSTRAINT "detection_context_group_detectionRunId_fkey" FOREIGN KEY ("detectionRunId") REFERENCES "project_event_detection_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_detectionRunId_fkey" FOREIGN KEY ("detectionRunId") REFERENCES "project_event_detection_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_acceptedProjectEventId_fkey" FOREIGN KEY ("acceptedProjectEventId") REFERENCES "project_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_duplicateOfProjectEventId_fkey" FOREIGN KEY ("duplicateOfProjectEventId") REFERENCES "project_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion" ADD CONSTRAINT "project_event_suggestion_duplicateOfSuggestionId_fkey" FOREIGN KEY ("duplicateOfSuggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_suggestion_evidence" ADD CONSTRAINT "project_event_suggestion_evidence_evidenceSegmentId_fkey" FOREIGN KEY ("evidenceSegmentId") REFERENCES "evidence_segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date_suggestion" ADD CONSTRAINT "project_event_date_suggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date_suggestion" ADD CONSTRAINT "project_event_date_suggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date_suggestion" ADD CONSTRAINT "project_event_date_suggestion_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_event_date_suggestion" ADD CONSTRAINT "project_event_date_suggestion_evidenceSegmentId_fkey" FOREIGN KEY ("evidenceSegmentId") REFERENCES "evidence_segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_evidence_gap" ADD CONSTRAINT "detection_evidence_gap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_evidence_gap" ADD CONSTRAINT "detection_evidence_gap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_evidence_gap" ADD CONSTRAINT "detection_evidence_gap_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_rule_candidate" ADD CONSTRAINT "suggestion_rule_candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_rule_candidate" ADD CONSTRAINT "suggestion_rule_candidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_rule_candidate" ADD CONSTRAINT "suggestion_rule_candidate_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_rule_candidate" ADD CONSTRAINT "suggestion_rule_candidate_approvedRuleSnapshotId_fkey" FOREIGN KEY ("approvedRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_party_candidate" ADD CONSTRAINT "suggestion_party_candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_party_candidate" ADD CONSTRAINT "suggestion_party_candidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_party_candidate" ADD CONSTRAINT "suggestion_party_candidate_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_reviewer_feedback" ADD CONSTRAINT "detection_reviewer_feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_reviewer_feedback" ADD CONSTRAINT "detection_reviewer_feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_reviewer_feedback" ADD CONSTRAINT "detection_reviewer_feedback_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "project_event_suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_reviewer_feedback" ADD CONSTRAINT "detection_reviewer_feedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- FORCE RLS for Slice 5 detection tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_event_detection_run',
    'detection_context_group',
    'project_event_suggestion',
    'project_event_suggestion_evidence',
    'project_event_date_suggestion',
    'detection_evidence_gap',
    'suggestion_rule_candidate',
    'suggestion_party_candidate',
    'detection_reviewer_feedback'
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

-- Completed detection runs immutable except test purge
CREATE OR REPLACE FUNCTION prevent_completed_detection_run_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTERED','PARTIALLY_SUCCEEDED')
       AND coalesce(current_setting('app.allow_detection_purge', true), 'off') <> 'on'
    THEN
      RAISE EXCEPTION 'completed project_event_detection_run cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTERED','PARTIALLY_SUCCEEDED') THEN
    IF coalesce(current_setting('app.allow_detection_purge', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'completed project_event_detection_run is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS detection_run_immutable_update ON "project_event_detection_run";
CREATE TRIGGER detection_run_immutable_update
  BEFORE UPDATE ON "project_event_detection_run"
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_detection_run_mutation();

DROP TRIGGER IF EXISTS detection_run_immutable_delete ON "project_event_detection_run";
CREATE TRIGGER detection_run_immutable_delete
  BEFORE DELETE ON "project_event_detection_run"
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_detection_run_mutation();

-- Reviewer feedback append-only
CREATE OR REPLACE FUNCTION prevent_detection_feedback_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('app.allow_detection_purge', true), 'off') = 'on' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND coalesce(current_setting('app.allow_detection_purge', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'detection_reviewer_feedback is append-only';
END;
$$;

DROP TRIGGER IF EXISTS detection_feedback_append_only_update ON "detection_reviewer_feedback";
CREATE TRIGGER detection_feedback_append_only_update
  BEFORE UPDATE ON "detection_reviewer_feedback"
  FOR EACH ROW EXECUTE FUNCTION prevent_detection_feedback_mutation();

DROP TRIGGER IF EXISTS detection_feedback_append_only_delete ON "detection_reviewer_feedback";
CREATE TRIGGER detection_feedback_append_only_delete
  BEFORE DELETE ON "detection_reviewer_feedback"
  FOR EACH ROW EXECUTE FUNCTION prevent_detection_feedback_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "project_event_detection_run",
  "detection_context_group",
  "project_event_suggestion",
  "project_event_suggestion_evidence",
  "project_event_date_suggestion",
  "detection_evidence_gap",
  "suggestion_rule_candidate",
  "suggestion_party_candidate",
  "detection_reviewer_feedback"
TO contractradar_app;
