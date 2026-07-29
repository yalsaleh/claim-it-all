-- CreateEnum
CREATE TYPE "NoticePackageStatus" AS ENUM ('DRAFT', 'EVIDENCE_INCOMPLETE', 'READY_FOR_DRAFT', 'DRAFTING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED', 'WITHDRAWN', 'EXPORTED', 'ARCHIVED', 'SENT');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('INITIAL_NOTICE', 'NOTICE_OF_CLAIM', 'NOTICE_OF_DELAY', 'NOTICE_OF_VARIATION', 'NOTICE_OF_ADDITIONAL_COST', 'NOTICE_OF_RESTRICTED_ACCESS', 'NOTICE_OF_SUSPENSION', 'NOTICE_OF_LATE_INFORMATION', 'NOTICE_OF_DELAYED_PAYMENT', 'NOTICE_OF_UNFORESEEN_CONDITION', 'INTERIM_PARTICULARS', 'FINAL_PARTICULARS', 'RESERVATION_OF_RIGHTS', 'RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NoticeEvidenceRequirementCategory" AS ENUM ('EVENT_OCCURRENCE', 'TRIGGER_DATE', 'AWARENESS_DATE', 'INSTRUCTION', 'RECEIPT', 'CONTRACTUAL_BASIS', 'RECIPIENT', 'DELIVERY_ADDRESS', 'DELIVERY_METHOD', 'AFFECTED_WORK', 'CAUSE', 'EFFECT', 'DELAY_IMPACT', 'COST_IMPACT', 'CONTEMPORARY_RECORDS', 'MITIGATION', 'QUANTUM_SUPPORT', 'PROGRAMME_SUPPORT', 'PHOTOGRAPHS', 'DAILY_REPORTS', 'CORRESPONDENCE', 'PAYMENT_RECORD', 'CERTIFICATE', 'INVOICE', 'SITE_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeEvidenceMandatoryStatus" AS ENUM ('CONTRACTUALLY_REQUIRED', 'INTERNALLY_REQUIRED', 'RECOMMENDED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "NoticeEvidenceSatisfactionStatus" AS ENUM ('MISSING', 'PARTIAL', 'SATISFIED', 'NOT_APPLICABLE', 'WAIVED_BY_REVIEWER', 'DISPUTED');

-- CreateEnum
CREATE TYPE "NoticeEvidenceLinkRole" AS ENUM ('PRIMARY', 'SUPPORTING', 'DATE_PROOF', 'RECIPIENT_PROOF', 'DELIVERY_PROOF', 'IMPACT_PROOF', 'COST_PROOF', 'CONTRADICTING', 'CONTEXT', 'ATTACHMENT_CANDIDATE');

-- CreateEnum
CREATE TYPE "EvidenceCompletenessStatus" AS ENUM ('NOT_ASSESSED', 'INCOMPLETE', 'CONDITIONALLY_READY', 'READY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NoticeQuestionCategory" AS ENUM ('FACT', 'DATE', 'RECIPIENT', 'CONTRACT_BASIS', 'AFFECTED_WORK', 'CAUSATION', 'IMPACT', 'COST', 'MITIGATION', 'DELIVERY_METHOD', 'ATTACHMENT', 'LANGUAGE', 'APPROVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED', 'DISPUTED', 'NOT_APPLICABLE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NoticeQuestionAnswerType" AS ENUM ('FREE_TEXT', 'DATE', 'DATETIME', 'YES_NO', 'PERSON', 'PARTY', 'ROLE', 'DOCUMENT', 'EVIDENCE_REFERENCE', 'NUMBER', 'CURRENCY', 'ENUM', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "NoticeQuestionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NoticeFactType" AS ENUM ('EVENT_DATE', 'AWARENESS_DATE', 'INSTRUCTION_DATE', 'RECEIPT_DATE', 'PARTY_NAME', 'ROLE_NAME', 'PROJECT_NAME', 'CONTRACT_REFERENCE', 'NOTICE_REFERENCE', 'AFFECTED_LOCATION', 'AFFECTED_ACTIVITY', 'DESCRIPTION_OF_EVENT', 'DESCRIPTION_OF_EFFECT', 'DELAY_PERIOD', 'COST_AMOUNT', 'PAYMENT_AMOUNT', 'CERTIFICATE_NUMBER', 'INVOICE_NUMBER', 'DRAWING_REFERENCE', 'RFI_REFERENCE', 'INSTRUCTION_REFERENCE', 'REQUESTED_ACTION', 'RESPONSE_DEADLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeFactVerificationStatus" AS ENUM ('UNVERIFIED', 'EVIDENCE_BACKED', 'HUMAN_CONFIRMED', 'DISPUTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeFactSourceType" AS ENUM ('PROJECT_EVENT', 'PROJECT_EVENT_DATE', 'PROJECT_EVENT_EVIDENCE', 'SOURCE_DOCUMENT', 'EVIDENCE_SEGMENT', 'REVIEWER_ENTERED', 'QUESTION_RESPONSE', 'REQUIREMENT_SNAPSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeTemplateStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "NoticeDraftRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NoticeDraftSectionType" AS ENUM ('SENDER', 'RECIPIENT', 'PROJECT_CONTRACT_REFERENCE', 'NOTICE_TITLE', 'CONTRACTUAL_BASIS', 'FACTUAL_BACKGROUND', 'EVENT_DESCRIPTION', 'TRIGGER_DATE', 'DEADLINE_STATEMENT', 'IMPACT_STATEMENT', 'RESERVATION_OF_RIGHTS', 'REQUESTED_ACTION', 'RECORDS_EVIDENCE', 'CONTINUING_EVENT', 'ATTACHMENTS', 'CLOSING');

-- CreateEnum
CREATE TYPE "NoticeDraftSectionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "NoticeDeliveryVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED', 'MISSING', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeAttachmentCategory" AS ENUM ('CORRESPONDENCE', 'INSTRUCTION', 'DRAWING', 'RFI', 'DAILY_REPORT', 'PHOTOGRAPH', 'PAYMENT_RECORD', 'CERTIFICATE', 'INVOICE', 'PROGRAMME_EXTRACT', 'COST_RECORD', 'SITE_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeAttachmentInclusionStatus" AS ENUM ('PROPOSED', 'INCLUDED', 'EXCLUDED', 'MISSING', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeReviewCommentType" AS ENUM ('FACTUAL', 'CONTRACTUAL', 'LEGAL', 'COMMERCIAL', 'LANGUAGE', 'FORMATTING', 'EVIDENCE', 'RECIPIENT', 'DEADLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeReviewCommentStatus" AS ENUM ('OPEN', 'RESOLVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NoticeApprovalDecisionType" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED', 'RECOMMENDED_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeExportFormat" AS ENUM ('PDF', 'DOCX', 'JSON_MANIFEST', 'ATTACHMENT_ZIP', 'PLAIN_TEXT');

-- CreateEnum
CREATE TYPE "NoticeLanguageLayout" AS ENUM ('ENGLISH_ONLY', 'ARABIC_ONLY', 'BILINGUAL_PARALLEL', 'BILINGUAL_SEQUENTIAL');

-- CreateTable
CREATE TABLE "notice_package" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT NOT NULL,
    "approvedNoticeRuleSnapshotId" TEXT NOT NULL,
    "projectEventId" TEXT NOT NULL,
    "eventRuleAssessmentId" TEXT NOT NULL,
    "deadlineCalculationId" TEXT NOT NULL,
    "projectDeadlineId" TEXT,
    "noticeType" "NoticeType" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "status" "NoticePackageStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL,
    "secondaryLanguage" TEXT,
    "languageLayout" "NoticeLanguageLayout" NOT NULL DEFAULT 'ENGLISH_ONLY',
    "governingLanguage" TEXT,
    "priority" "NoticePriority" NOT NULL DEFAULT 'NORMAL',
    "deadlineAt" TIMESTAMP(3),
    "deadlineTimezone" TEXT,
    "internalOwnerUserId" TEXT,
    "reviewLeadUserId" TEXT,
    "approverUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "activeApprovedRevisionId" TEXT,
    "sodEnforced" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_requirement_snapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "approvedNoticeRuleSnapshotId" TEXT NOT NULL,
    "sourceObligationId" TEXT,
    "sourceClauseId" TEXT,
    "sourceClauseReference" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "requiredRecipients" TEXT,
    "requiredCopiedRecipients" TEXT,
    "requiredDeliveryMethods" TEXT,
    "requiredTimingExpression" TEXT,
    "verifiedDeadlineAt" TIMESTAMP(3),
    "verifiedDeadlineTimezone" TEXT,
    "requiredContentItems" TEXT,
    "requiredAttachments" TEXT,
    "requiredRecords" TEXT,
    "requiredFormOrTemplate" TEXT,
    "requiredReferenceFields" TEXT,
    "requiredReservationLanguage" TEXT,
    "continuingEventRequirements" TEXT,
    "interimParticularsRequirements" TEXT,
    "finalParticularsRequirements" TEXT,
    "consequenceText" TEXT,
    "timeBarClassification" TEXT,
    "ambiguityFlags" JSONB,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_requirement_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_evidence_requirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "category" "NoticeEvidenceRequirementCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceContractualBasis" TEXT,
    "approvedRuleSnapshotId" TEXT,
    "mandatoryStatus" "NoticeEvidenceMandatoryStatus" NOT NULL,
    "satisfactionStatus" "NoticeEvidenceSatisfactionStatus" NOT NULL DEFAULT 'MISSING',
    "reviewerNotes" TEXT,
    "waiverRationale" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_evidence_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_evidence_link" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "evidenceRequirementId" TEXT NOT NULL,
    "role" "NoticeEvidenceLinkRole" NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "evidenceSegmentId" TEXT,
    "projectEventEvidenceId" TEXT,
    "evidenceLocator" JSONB,
    "reviewerAuthoredStatement" TEXT,
    "externalPlaceholder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_evidence_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_completeness_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "assessmentRevision" INTEGER NOT NULL,
    "completenessStatus" "EvidenceCompletenessStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "blockingIssues" JSONB,
    "nonBlockingWarnings" JSONB,
    "assessedByUserId" TEXT,
    "assessedAt" TIMESTAMP(3),
    "rulesetVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_completeness_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_review_question" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "category" "NoticeQuestionCategory" NOT NULL,
    "questionText" TEXT NOT NULL,
    "reason" TEXT,
    "relatedEvidenceRequirementId" TEXT,
    "relatedClauseOrRuleRef" TEXT,
    "assignedToUserId" TEXT,
    "assignedToRoleId" TEXT,
    "priority" "NoticeQuestionPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NoticeQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "answerType" "NoticeQuestionAnswerType" NOT NULL,
    "responseText" TEXT,
    "responseEvidence" JSONB,
    "responseVerified" BOOLEAN NOT NULL DEFAULT false,
    "becameApprovedFact" BOOLEAN NOT NULL DEFAULT false,
    "raisedByUserId" TEXT NOT NULL,
    "answeredByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "notice_review_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_fact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "factType" "NoticeFactType" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "sourceType" "NoticeFactSourceType" NOT NULL,
    "sourceEvidence" JSONB,
    "projectEventId" TEXT,
    "reviewerEntered" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "NoticeFactVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "certaintyLabel" TEXT,
    "approvedForDrafting" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'SYSTEM',
    "contractFormFamily" TEXT,
    "noticeType" "NoticeType" NOT NULL,
    "language" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "templateName" TEXT NOT NULL,
    "description" TEXT,
    "status" "NoticeTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "notice_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_template_section" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "noticeTemplateId" TEXT NOT NULL,
    "sectionType" "NoticeDraftSectionType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "conditionalInclusion" TEXT,
    "allowedFactTypes" JSONB,
    "allowedClauseRefs" JSONB,
    "language" TEXT NOT NULL,
    "reviewerInstructions" TEXT,
    "externalContentHint" TEXT,
    "internalGuidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_template_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_draft_revision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "NoticeDraftRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatorVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "providerMetadata" JSONB,
    "basedOnEvidenceAssessmentRevision" INTEGER,
    "basedOnRequirementSnapshotId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "supersedesRevisionId" TEXT,
    "validationSnapshot" JSONB,

    CONSTRAINT "notice_draft_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_draft_section" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "draftRevisionId" TEXT NOT NULL,
    "sectionType" "NoticeDraftSectionType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceFactIds" JSONB,
    "sourceEvidenceRefs" JSONB,
    "sourceClauseRefs" JSONB,
    "machineGenerated" BOOLEAN NOT NULL DEFAULT true,
    "humanEdited" BOOLEAN NOT NULL DEFAULT false,
    "internalOnly" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "NoticeDraftSectionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_draft_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_delivery_preparation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "recipientRole" TEXT,
    "recipientParty" TEXT,
    "namedRecipient" TEXT,
    "physicalAddress" TEXT,
    "emailAddress" TEXT,
    "platformAddress" TEXT,
    "attentionLine" TEXT,
    "permittedMethod" TEXT,
    "selectedMethod" TEXT,
    "copiedRecipient" BOOLEAN NOT NULL DEFAULT false,
    "sourceClauseRef" TEXT,
    "sourceEvidence" JSONB,
    "verificationStatus" "NoticeDeliveryVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "reviewerApproved" BOOLEAN NOT NULL DEFAULT false,
    "contactPointId" TEXT,
    "obligationRecipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_delivery_preparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "evidenceLocator" JSONB,
    "category" "NoticeAttachmentCategory" NOT NULL,
    "externalFilename" TEXT NOT NULL,
    "description" TEXT,
    "inclusionStatus" "NoticeAttachmentInclusionStatus" NOT NULL DEFAULT 'PROPOSED',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "confidentialityLabel" TEXT,
    "checksumSha256" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_export_bundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "draftRevisionId" TEXT NOT NULL,
    "format" "NoticeExportFormat" NOT NULL,
    "artifactChecksum" TEXT NOT NULL,
    "storageKey" TEXT,
    "artifactBytes" INTEGER,
    "manifest" JSONB NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notice_export_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_review_comment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "draftRevisionId" TEXT NOT NULL,
    "sectionId" TEXT,
    "commentType" "NoticeReviewCommentType" NOT NULL,
    "commentText" TEXT NOT NULL,
    "internalOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" "NoticeReviewCommentStatus" NOT NULL DEFAULT 'OPEN',
    "raisedByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "notice_review_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_approval_decision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "draftRevisionId" TEXT NOT NULL,
    "decision" "NoticeApprovalDecisionType" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT,
    "rationale" TEXT,
    "conditions" TEXT,
    "validationSnapshot" JSONB,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_approval_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_controlled_exception" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noticePackageId" TEXT NOT NULL,
    "issueCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "risk" TEXT,
    "contractualImpact" TEXT,
    "approvedException" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT NOT NULL,
    "expiryOrReviewAt" TIMESTAMP(3),
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_controlled_exception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notice_package_activeApprovedRevisionId_key" ON "notice_package"("activeApprovedRevisionId");

-- CreateIndex
CREATE INDEX "notice_package_tenantId_projectId_status_idx" ON "notice_package"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "notice_package_projectEventId_idx" ON "notice_package"("projectEventId");

-- CreateIndex
CREATE INDEX "notice_package_deadlineCalculationId_idx" ON "notice_package"("deadlineCalculationId");

-- CreateIndex
CREATE INDEX "notice_requirement_snapshot_tenantId_projectId_noticePackag_idx" ON "notice_requirement_snapshot"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_evidence_requirement_tenantId_projectId_noticePackag_idx" ON "notice_evidence_requirement"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_evidence_link_tenantId_projectId_noticePackageId_idx" ON "notice_evidence_link"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_evidence_link_evidenceRequirementId_idx" ON "notice_evidence_link"("evidenceRequirementId");

-- CreateIndex
CREATE INDEX "evidence_completeness_assessment_tenantId_projectId_noticeP_idx" ON "evidence_completeness_assessment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_completeness_assessment_noticePackageId_assessment_key" ON "evidence_completeness_assessment"("noticePackageId", "assessmentRevision");

-- CreateIndex
CREATE INDEX "notice_review_question_tenantId_projectId_noticePackageId_s_idx" ON "notice_review_question"("tenantId", "projectId", "noticePackageId", "status");

-- CreateIndex
CREATE INDEX "notice_fact_tenantId_projectId_noticePackageId_idx" ON "notice_fact"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_template_tenantId_noticeType_language_status_idx" ON "notice_template"("tenantId", "noticeType", "language", "status");

-- CreateIndex
CREATE INDEX "notice_template_section_noticeTemplateId_sequence_idx" ON "notice_template_section"("noticeTemplateId", "sequence");

-- CreateIndex
CREATE INDEX "notice_draft_revision_tenantId_projectId_noticePackageId_idx" ON "notice_draft_revision"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE UNIQUE INDEX "notice_draft_revision_noticePackageId_revisionNumber_key" ON "notice_draft_revision"("noticePackageId", "revisionNumber");

-- CreateIndex
CREATE INDEX "notice_draft_section_tenantId_projectId_draftRevisionId_idx" ON "notice_draft_section"("tenantId", "projectId", "draftRevisionId");

-- CreateIndex
CREATE INDEX "notice_delivery_preparation_tenantId_projectId_noticePackag_idx" ON "notice_delivery_preparation"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_attachment_tenantId_projectId_noticePackageId_idx" ON "notice_attachment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_export_bundle_tenantId_projectId_noticePackageId_idx" ON "notice_export_bundle"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_export_bundle_draftRevisionId_idx" ON "notice_export_bundle"("draftRevisionId");

-- CreateIndex
CREATE INDEX "notice_review_comment_tenantId_projectId_noticePackageId_idx" ON "notice_review_comment"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_approval_decision_tenantId_projectId_noticePackageId_idx" ON "notice_approval_decision"("tenantId", "projectId", "noticePackageId");

-- CreateIndex
CREATE INDEX "notice_approval_decision_draftRevisionId_decidedAt_idx" ON "notice_approval_decision"("draftRevisionId", "decidedAt");

-- CreateIndex
CREATE INDEX "notice_controlled_exception_tenantId_projectId_noticePackag_idx" ON "notice_controlled_exception"("tenantId", "projectId", "noticePackageId");

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_approvedNoticeRuleSnapshotId_fkey" FOREIGN KEY ("approvedNoticeRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_projectEventId_fkey" FOREIGN KEY ("projectEventId") REFERENCES "project_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_eventRuleAssessmentId_fkey" FOREIGN KEY ("eventRuleAssessmentId") REFERENCES "event_rule_assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_deadlineCalculationId_fkey" FOREIGN KEY ("deadlineCalculationId") REFERENCES "deadline_calculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_projectDeadlineId_fkey" FOREIGN KEY ("projectDeadlineId") REFERENCES "project_deadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_internalOwnerUserId_fkey" FOREIGN KEY ("internalOwnerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_reviewLeadUserId_fkey" FOREIGN KEY ("reviewLeadUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_package" ADD CONSTRAINT "notice_package_activeApprovedRevisionId_fkey" FOREIGN KEY ("activeApprovedRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_requirement_snapshot" ADD CONSTRAINT "notice_requirement_snapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_requirement_snapshot" ADD CONSTRAINT "notice_requirement_snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_requirement_snapshot" ADD CONSTRAINT "notice_requirement_snapshot_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_requirement_snapshot" ADD CONSTRAINT "notice_requirement_snapshot_approvedNoticeRuleSnapshotId_fkey" FOREIGN KEY ("approvedNoticeRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_requirement" ADD CONSTRAINT "notice_evidence_requirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_requirement" ADD CONSTRAINT "notice_evidence_requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_requirement" ADD CONSTRAINT "notice_evidence_requirement_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_requirement" ADD CONSTRAINT "notice_evidence_requirement_approvedRuleSnapshotId_fkey" FOREIGN KEY ("approvedRuleSnapshotId") REFERENCES "approved_notice_rule_snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_requirement" ADD CONSTRAINT "notice_evidence_requirement_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_link" ADD CONSTRAINT "notice_evidence_link_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_link" ADD CONSTRAINT "notice_evidence_link_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_link" ADD CONSTRAINT "notice_evidence_link_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_evidence_link" ADD CONSTRAINT "notice_evidence_link_evidenceRequirementId_fkey" FOREIGN KEY ("evidenceRequirementId") REFERENCES "notice_evidence_requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_completeness_assessment" ADD CONSTRAINT "evidence_completeness_assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_completeness_assessment" ADD CONSTRAINT "evidence_completeness_assessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_completeness_assessment" ADD CONSTRAINT "evidence_completeness_assessment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_completeness_assessment" ADD CONSTRAINT "evidence_completeness_assessment_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_relatedEvidenceRequirementId_fkey" FOREIGN KEY ("relatedEvidenceRequirementId") REFERENCES "notice_evidence_requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_question" ADD CONSTRAINT "notice_review_question_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_fact" ADD CONSTRAINT "notice_fact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_fact" ADD CONSTRAINT "notice_fact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_fact" ADD CONSTRAINT "notice_fact_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_fact" ADD CONSTRAINT "notice_fact_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_template" ADD CONSTRAINT "notice_template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_template" ADD CONSTRAINT "notice_template_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_template" ADD CONSTRAINT "notice_template_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_template_section" ADD CONSTRAINT "notice_template_section_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_template_section" ADD CONSTRAINT "notice_template_section_noticeTemplateId_fkey" FOREIGN KEY ("noticeTemplateId") REFERENCES "notice_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_revision" ADD CONSTRAINT "notice_draft_revision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_revision" ADD CONSTRAINT "notice_draft_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_revision" ADD CONSTRAINT "notice_draft_revision_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_revision" ADD CONSTRAINT "notice_draft_revision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_revision" ADD CONSTRAINT "notice_draft_revision_supersedesRevisionId_fkey" FOREIGN KEY ("supersedesRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_section" ADD CONSTRAINT "notice_draft_section_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_section" ADD CONSTRAINT "notice_draft_section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_draft_section" ADD CONSTRAINT "notice_draft_section_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_delivery_preparation" ADD CONSTRAINT "notice_delivery_preparation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_delivery_preparation" ADD CONSTRAINT "notice_delivery_preparation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_delivery_preparation" ADD CONSTRAINT "notice_delivery_preparation_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachment" ADD CONSTRAINT "notice_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachment" ADD CONSTRAINT "notice_attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachment" ADD CONSTRAINT "notice_attachment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachment" ADD CONSTRAINT "notice_attachment_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachment" ADD CONSTRAINT "notice_attachment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_export_bundle" ADD CONSTRAINT "notice_export_bundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_export_bundle" ADD CONSTRAINT "notice_export_bundle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_export_bundle" ADD CONSTRAINT "notice_export_bundle_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_export_bundle" ADD CONSTRAINT "notice_export_bundle_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_export_bundle" ADD CONSTRAINT "notice_export_bundle_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "notice_draft_section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_review_comment" ADD CONSTRAINT "notice_review_comment_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_approval_decision" ADD CONSTRAINT "notice_approval_decision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_approval_decision" ADD CONSTRAINT "notice_approval_decision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_approval_decision" ADD CONSTRAINT "notice_approval_decision_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_approval_decision" ADD CONSTRAINT "notice_approval_decision_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "notice_draft_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_approval_decision" ADD CONSTRAINT "notice_approval_decision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_controlled_exception" ADD CONSTRAINT "notice_controlled_exception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_controlled_exception" ADD CONSTRAINT "notice_controlled_exception_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_controlled_exception" ADD CONSTRAINT "notice_controlled_exception_noticePackageId_fkey" FOREIGN KEY ("noticePackageId") REFERENCES "notice_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_controlled_exception" ADD CONSTRAINT "notice_controlled_exception_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- FORCE RLS for Slice 6 notice tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notice_package',
    'notice_requirement_snapshot',
    'notice_evidence_requirement',
    'notice_evidence_link',
    'evidence_completeness_assessment',
    'notice_review_question',
    'notice_fact',
    'notice_template',
    'notice_template_section',
    'notice_draft_revision',
    'notice_draft_section',
    'notice_delivery_preparation',
    'notice_attachment',
    'notice_export_bundle',
    'notice_review_comment',
    'notice_approval_decision',
    'notice_controlled_exception'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    IF t IN ('notice_template', 'notice_template_section') THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId" IS NULL
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         ) WITH CHECK (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId" IS NULL
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         )', t);
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         ) WITH CHECK (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         )', t);
    END IF;
  END LOOP;
END $$;

-- Immutable requirement snapshots
CREATE OR REPLACE FUNCTION prevent_notice_requirement_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'notice_requirement_snapshot is immutable';
END;
$$;

DROP TRIGGER IF EXISTS notice_requirement_snapshot_immutable_update ON "notice_requirement_snapshot";
CREATE TRIGGER notice_requirement_snapshot_immutable_update
  BEFORE UPDATE ON "notice_requirement_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_requirement_snapshot_mutation();

DROP TRIGGER IF EXISTS notice_requirement_snapshot_immutable_delete ON "notice_requirement_snapshot";
CREATE TRIGGER notice_requirement_snapshot_immutable_delete
  BEFORE DELETE ON "notice_requirement_snapshot"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_requirement_snapshot_mutation();

-- Approved draft revisions immutable (only APPROVED -> SUPERSEDED allowed)
CREATE OR REPLACE FUNCTION prevent_approved_notice_draft_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED' THEN
      RAISE EXCEPTION 'approved notice_draft_revision cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'APPROVED' THEN
    IF NEW.status = 'SUPERSEDED'
       AND NEW."revisionNumber" = OLD."revisionNumber"
       AND NEW."noticePackageId" = OLD."noticePackageId"
       AND NEW."generatorVersion" = OLD."generatorVersion"
       AND NEW."templateVersion" = OLD."templateVersion"
       AND NEW.language = OLD.language
       AND NEW."createdByUserId" = OLD."createdByUserId"
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved notice_draft_revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notice_draft_revision_immutable_update ON "notice_draft_revision";
CREATE TRIGGER notice_draft_revision_immutable_update
  BEFORE UPDATE ON "notice_draft_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_draft_mutation();

DROP TRIGGER IF EXISTS notice_draft_revision_immutable_delete ON "notice_draft_revision";
CREATE TRIGGER notice_draft_revision_immutable_delete
  BEFORE DELETE ON "notice_draft_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_draft_mutation();

-- Approved draft sections immutable when parent approved
CREATE OR REPLACE FUNCTION prevent_approved_notice_section_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status text;
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT status::text INTO parent_status FROM "notice_draft_revision" WHERE id = OLD."draftRevisionId";
  IF parent_status = 'APPROVED' THEN
    RAISE EXCEPTION 'sections of approved notice_draft_revision are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notice_draft_section_immutable_update ON "notice_draft_section";
CREATE TRIGGER notice_draft_section_immutable_update
  BEFORE UPDATE ON "notice_draft_section"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_section_mutation();

DROP TRIGGER IF EXISTS notice_draft_section_immutable_delete ON "notice_draft_section";
CREATE TRIGGER notice_draft_section_immutable_delete
  BEFORE DELETE ON "notice_draft_section"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_notice_section_mutation();

-- Approval decisions append-only
CREATE OR REPLACE FUNCTION prevent_notice_approval_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'notice_approval_decision is append-only';
END;
$$;

DROP TRIGGER IF EXISTS notice_approval_append_only_update ON "notice_approval_decision";
CREATE TRIGGER notice_approval_append_only_update
  BEFORE UPDATE ON "notice_approval_decision"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_approval_mutation();

DROP TRIGGER IF EXISTS notice_approval_append_only_delete ON "notice_approval_decision";
CREATE TRIGGER notice_approval_append_only_delete
  BEFORE DELETE ON "notice_approval_decision"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_approval_mutation();

-- Export bundles immutable
CREATE OR REPLACE FUNCTION prevent_notice_export_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'notice_export_bundle is immutable';
END;
$$;

DROP TRIGGER IF EXISTS notice_export_immutable_update ON "notice_export_bundle";
CREATE TRIGGER notice_export_immutable_update
  BEFORE UPDATE ON "notice_export_bundle"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_export_mutation();

DROP TRIGGER IF EXISTS notice_export_immutable_delete ON "notice_export_bundle";
CREATE TRIGGER notice_export_immutable_delete
  BEFORE DELETE ON "notice_export_bundle"
  FOR EACH ROW EXECUTE FUNCTION prevent_notice_export_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "notice_package",
  "notice_requirement_snapshot",
  "notice_evidence_requirement",
  "notice_evidence_link",
  "evidence_completeness_assessment",
  "notice_review_question",
  "notice_fact",
  "notice_template",
  "notice_template_section",
  "notice_draft_revision",
  "notice_draft_section",
  "notice_delivery_preparation",
  "notice_attachment",
  "notice_export_bundle",
  "notice_review_comment",
  "notice_approval_decision",
  "notice_controlled_exception"
TO contractradar_app;
