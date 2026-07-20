-- Slice 3: Contract structure, obligations, notice rules, human-verified configuration
-- FORCE RLS + tenant/project/package integrity triggers + approved-revision immutability

-- CreateEnum
CREATE TYPE "ContractPackageStatus" AS ENUM ('DRAFT', 'INGESTING', 'STRUCTURING', 'REVIEW_REQUIRED', 'PARTIALLY_APPROVED', 'APPROVED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractDocumentType" AS ENUM ('AGREEMENT', 'LETTER_OF_ACCEPTANCE', 'CONDITIONS_OF_CONTRACT', 'GENERAL_CONDITIONS', 'PARTICULAR_CONDITIONS', 'CONTRACT_DATA', 'APPENDIX_TO_TENDER', 'EMPLOYERS_REQUIREMENTS', 'SPECIFICATIONS', 'BILL_OF_QUANTITIES', 'DRAWINGS', 'SCHEDULES', 'ADDENDUM', 'AMENDMENT', 'SUPPLEMENTAL_AGREEMENT', 'CLARIFICATION', 'TENDER_SUBMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractDocumentStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractDocumentRelationshipType" AS ENUM ('AMENDS', 'REPLACES', 'SUPPLEMENTS', 'INCORPORATES', 'OVERRIDES', 'CLARIFIES', 'FORMS_PART_OF', 'PRECEDES', 'SAME_INSTRUMENT_AS');

-- CreateEnum
CREATE TYPE "ContractConfirmationStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'HUMAN_CONFIRMED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ContractPrecedenceScope" AS ENUM ('GLOBAL', 'CLAUSE_SPECIFIC', 'SUBJECT_SPECIFIC', 'LANGUAGE_VERSION', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ClauseReviewStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'CORRECTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ClauseExtractionMethod" AS ENUM ('DETERMINISTIC', 'AI_ASSISTED', 'HUMAN_ENTERED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ClauseTextRevisionKind" AS ENUM ('NORMALIZATION', 'HUMAN_CORRECTION', 'BILINGUAL_ALIGNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClauseTextRevisionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ClauseRelationshipType" AS ENUM ('AMENDED_BY', 'REPLACED_BY', 'SUPPLEMENTED_BY', 'OVERRIDES', 'REFERENCES', 'DEFINES', 'DEPENDS_ON', 'EXCEPTION_TO', 'PROCEDURE_FOR', 'CONDITION_PRECEDENT_TO', 'BILINGUAL_EQUIVALENT_OF');

-- CreateEnum
CREATE TYPE "ClauseRelationshipOrigin" AS ENUM ('EXPLICIT_IN_CONTRACT', 'MACHINE_SUGGESTED', 'HUMAN_CONFIRMED');

-- CreateEnum
CREATE TYPE "DefinedTermStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CrossReferenceResolutionStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'AMBIGUOUS', 'NOT_APPLICABLE', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractPartyType" AS ENUM ('EMPLOYER', 'CONTRACTOR', 'SUBCONTRACTOR', 'ENGINEER', 'CONSULTANT', 'PROJECT_MANAGER', 'EMPLOYERS_REPRESENTATIVE', 'CONTRACTORS_REPRESENTATIVE', 'SUPPLIER', 'AUTHORITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractPartyStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ContractRoleType" AS ENUM ('ENGINEER', 'EMPLOYERS_REPRESENTATIVE', 'CONTRACT_ADMINISTRATOR', 'CONTRACTORS_REPRESENTATIVE', 'DISPUTE_ADJUDICATION_BOARD', 'NOMINATED_NOTICE_RECIPIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactDeliveryMethod" AS ENUM ('EMAIL', 'PHYSICAL_DELIVERY', 'HAND_DELIVERY', 'COURIER', 'EDMS', 'PORTAL', 'FAX', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactPointStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('NOTICE', 'SUBMISSION', 'RESPONSE', 'APPROVAL', 'PAYMENT', 'CERTIFICATION', 'RECORD_KEEPING', 'ACCESS_PROVISION', 'INFORMATION_PROVISION', 'INSTRUCTION', 'CONSULTATION', 'MITIGATION', 'CLAIM_PARTICULARS', 'PROGRAMME_UPDATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ObligationReviewStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ObligationTriggerCategory" AS ENUM ('AWARENESS_OF_EVENT', 'OCCURRENCE_OF_EVENT', 'INSTRUCTION_RECEIVED', 'ACCESS_DENIED', 'DRAWING_DUE_DATE_MISSED', 'PAYMENT_CERTIFICATE_ISSUED', 'PAYMENT_DUE_DATE_REACHED', 'PHYSICAL_CONDITION_ENCOUNTERED', 'ENGINEER_DETERMINATION_RECEIVED', 'REJECTION_RECEIVED', 'WORK_SUSPENDED', 'VARIATION_INSTRUCTED', 'OTHER');

-- CreateEnum
CREATE TYPE "ObligationTriggerStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ObligationRecipientKind" AS ENUM ('REQUIRED', 'COPIED', 'ROLE_BASED', 'ADDRESS_SPECIFIC');

-- CreateEnum
CREATE TYPE "ObligationEvidenceRequirementKind" AS ENUM ('EXPRESSLY_REQUIRED', 'RECOMMENDED', 'INTERNAL_POLICY');

-- CreateEnum
CREATE TYPE "NoticeDurationUnit" AS ENUM ('CALENDAR_DAY', 'BUSINESS_DAY', 'WEEK', 'MONTH', 'IMMEDIATE', 'PROMPT', 'REASONABLE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NoticeCalendarBasis" AS ENUM ('CALENDAR_DAYS', 'BUSINESS_DAYS', 'CONTRACT_WORKING_DAYS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NoticeCountingConvention" AS ENUM ('INCLUSIVE', 'EXCLUSIVE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "TimeBarClassification" AS ENUM ('EXPRESS_CONDITION_PRECEDENT', 'EXPRESS_TIME_BAR', 'PROCEDURAL_DEADLINE', 'RECOMMENDED_INTERNAL_DEADLINE', 'UNCERTAIN', 'NOT_A_TIME_BAR');

-- CreateEnum
CREATE TYPE "NoticeRuleReviewStatus" AS ENUM ('MACHINE_SUGGESTED', 'REVIEW_REQUIRED', 'VERIFIED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NoticeAmbiguityStatus" AS ENUM ('CLEAR', 'PARTIALLY_AMBIGUOUS', 'AMBIGUOUS', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "CalendarRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfigurationRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ConfigurationIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKING');

-- CreateEnum
CREATE TYPE "ConfigurationIssueCategory" AS ENUM ('MISSING_CONTRACT_DOCUMENT', 'UNREADABLE_CLAUSE', 'CONFLICTING_AMENDMENT', 'UNCLEAR_DEADLINE', 'AMBIGUOUS_RECIPIENT', 'MISSING_ADDRESS', 'BILINGUAL_CONFLICT', 'UNRESOLVED_CROSS_REFERENCE', 'UNCERTAIN_TIME_BAR', 'MISSING_EXECUTION_DATE', 'MISSING_CONTRACT_DATA', 'REVIEWER_QUESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfigurationIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('ACCEPTED_SUGGESTION', 'CORRECTED_EXTRACTION', 'REJECTED_INTERPRETATION', 'APPROVED_RULE', 'CHANGED_ROLE', 'RESOLVED_AMBIGUITY', 'MARKED_NON_APPLICABLE', 'REQUESTED_CHANGES', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractAnalysisRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PARTIALLY_SUCCEEDED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "ContractExtractionSuggestionType" AS ENUM ('CLAUSE', 'DEFINED_TERM', 'PARTY', 'ROLE', 'CROSS_REFERENCE', 'OBLIGATION', 'NOTICE_RULE', 'PRECEDENCE', 'AMENDMENT_RELATIONSHIP', 'ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractExtractionSuggestionStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'ACCEPTED_WITH_CHANGES', 'REJECTED', 'DUPLICATE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "contract_package" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contractReference" TEXT,
    "contractFormFamily" TEXT,
    "contractFormEdition" TEXT,
    "governingLaw" TEXT,
    "jurisdiction" TEXT,
    "governingLanguage" "DocumentLanguage",
    "secondaryLanguage" "DocumentLanguage",
    "effectiveDate" TIMESTAMP(3),
    "commencementDate" TIMESTAMP(3),
    "status" "ContractPackageStatus" NOT NULL DEFAULT 'DRAFT',
    "currentConfigurationRevisionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "contractDocumentType" "ContractDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "executionDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "language" "DocumentLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "precedenceRank" INTEGER,
    "isExecuted" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "status" "ContractDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_document_relationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "fromContractDocumentId" TEXT NOT NULL,
    "toContractDocumentId" TEXT NOT NULL,
    "relationshipType" "ContractDocumentRelationshipType" NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "scopeDescription" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "confirmationStatus" "ContractConfirmationStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_document_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_precedence_rule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT,
    "rank" INTEGER NOT NULL,
    "contractDocumentId" TEXT,
    "contractDocumentType" "ContractDocumentType",
    "scope" "ContractPrecedenceScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeDescription" TEXT,
    "sourceClauseId" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "status" "ContractConfirmationStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_precedence_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_clause" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "contractDocumentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "parentClauseId" TEXT,
    "clauseNumber" TEXT,
    "normalizedClauseNumber" TEXT,
    "heading" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "sourceText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "textChecksum" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "extractionMethod" "ClauseExtractionMethod" NOT NULL DEFAULT 'DETERMINISTIC',
    "extractionConfidence" DOUBLE PRECISION,
    "reviewStatus" "ClauseReviewStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_text_revision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractClauseId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revisedText" TEXT NOT NULL,
    "revisionReason" TEXT,
    "revisionKind" "ClauseTextRevisionKind" NOT NULL,
    "status" "ClauseTextRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "clause_text_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_relationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "fromClauseId" TEXT NOT NULL,
    "toClauseId" TEXT NOT NULL,
    "relationshipType" "ClauseRelationshipType" NOT NULL,
    "origin" "ClauseRelationshipOrigin" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "confirmationStatus" "ContractConfirmationStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "notes" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defined_term" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "definitionText" TEXT NOT NULL,
    "sourceClauseId" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "scopeDescription" TEXT,
    "effectiveContractDocumentId" TEXT,
    "status" "DefinedTermStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "configurationRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defined_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_term_reference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "contractClauseId" TEXT NOT NULL,
    "definedTermId" TEXT,
    "exactText" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "confirmationStatus" "ContractConfirmationStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_term_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_reference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "sourceClauseId" TEXT NOT NULL,
    "rawReferenceText" TEXT NOT NULL,
    "normalizedTargetId" TEXT,
    "resolvedTargetType" TEXT,
    "resolvedTargetId" TEXT,
    "resolutionStatus" "CrossReferenceResolutionStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "ambiguityReason" TEXT,
    "confirmationStatus" "ContractConfirmationStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_party" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "partyType" "ContractPartyType" NOT NULL,
    "registrationId" TEXT,
    "address" TEXT,
    "nameEn" TEXT,
    "nameAr" TEXT,
    "status" "ContractPartyStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "sourceClauseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleType" "ContractRoleType" NOT NULL,
    "assignedPartyId" TEXT,
    "scopeDescription" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sourceClauseId" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "reviewStatus" "ClauseReviewStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_point" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "contractPartyId" TEXT,
    "contractRoleId" TEXT,
    "namedPerson" TEXT,
    "organization" TEXT,
    "physicalAddress" TEXT,
    "emailAddress" TEXT,
    "platformAddress" TEXT,
    "attentionLine" TEXT,
    "permittedDeliveryMethod" "ContactDeliveryMethod",
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sourceClauseId" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "status" "ContactPointStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_obligation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "sourceClauseId" TEXT NOT NULL,
    "obligationType" "ObligationType" NOT NULL,
    "obligatedPartyId" TEXT,
    "obligatedRoleId" TEXT,
    "beneficiaryPartyId" TEXT,
    "beneficiaryRoleId" TEXT,
    "actionDescription" TEXT NOT NULL,
    "triggerDescription" TEXT,
    "conditionDescription" TEXT,
    "timingExpression" TEXT,
    "requiredForm" TEXT,
    "requiredContent" TEXT,
    "requiredDeliveryMethod" "ContactDeliveryMethod",
    "consequenceOfNonCompliance" TEXT,
    "isTimeBarredCandidate" BOOLEAN NOT NULL DEFAULT false,
    "isConditionPrecedentCandidate" BOOLEAN NOT NULL DEFAULT false,
    "machineInterpretation" TEXT,
    "humanApprovedInterpretation" TEXT,
    "confidence" DOUBLE PRECISION,
    "reviewStatus" "ObligationReviewStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "configurationRevisionId" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_trigger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "triggerCategory" "ObligationTriggerCategory" NOT NULL,
    "sourceText" TEXT,
    "normalizedTrigger" TEXT,
    "triggeringActor" TEXT,
    "triggerDateBasis" TEXT,
    "ambiguityNotes" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "status" "ObligationTriggerStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_trigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_recipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "recipientKind" "ObligationRecipientKind" NOT NULL,
    "contractRoleId" TEXT,
    "contactPointId" TEXT,
    "deliveryPlatform" TEXT,
    "deliverySequence" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_evidence_requirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "kind" "ObligationEvidenceRequirementKind" NOT NULL DEFAULT 'EXPRESSLY_REQUIRED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_evidence_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_rule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "noticeCategory" TEXT,
    "triggerBasis" TEXT,
    "durationValue" DECIMAL(12,4),
    "durationUnit" "NoticeDurationUnit",
    "calendarBasis" "NoticeCalendarBasis",
    "countingConvention" "NoticeCountingConvention" NOT NULL DEFAULT 'UNSPECIFIED',
    "startDateRule" TEXT,
    "endDateRule" TEXT,
    "businessDayAdjustment" TEXT,
    "holidayCalendarRuleId" TEXT,
    "deliveryVersusPreparation" TEXT,
    "continuingEventTreatment" TEXT,
    "recurringNoticeRequirement" TEXT,
    "interimParticularsRequirement" TEXT,
    "finalParticularsRequirement" TEXT,
    "recipientRequirements" TEXT,
    "deliveryMethodRequirements" TEXT,
    "contentRequirements" TEXT,
    "consequenceText" TEXT,
    "timeBarClassification" "TimeBarClassification" NOT NULL DEFAULT 'UNCERTAIN',
    "ambiguityStatus" "NoticeAmbiguityStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "reviewStatus" "NoticeRuleReviewStatus" NOT NULL DEFAULT 'MACHINE_SUGGESTED',
    "configurationRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_rule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "workingWeekMask" TEXT,
    "weekendDays" JSONB,
    "publicHolidays" JSONB,
    "contractBusinessDays" JSONB,
    "exceptionalHolidays" JSONB,
    "jurisdictionCode" TEXT,
    "status" "CalendarRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "configurationRevisionId" TEXT,
    "supersedesRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_configuration_revision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "ConfigurationRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "basedOnDocumentVersions" JSONB,
    "isActiveApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "supersedesRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_configuration_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_configuration_issue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT,
    "severity" "ConfigurationIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "category" "ConfigurationIssueCategory" NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "description" TEXT NOT NULL,
    "suggestedResolution" TEXT,
    "assigneeUserId" TEXT,
    "status" "ConfigurationIssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_configuration_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT,
    "decisionType" "ReviewDecisionType" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "rationale" TEXT,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_analysis_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "configurationRevisionId" TEXT,
    "analysisProfile" TEXT NOT NULL DEFAULT 'structure_v1',
    "status" "ContractAnalysisRunStatus" NOT NULL DEFAULT 'QUEUED',
    "processorName" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "promptSchemaVersion" TEXT,
    "sourceDocumentVersions" JSONB,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "correlationId" TEXT NOT NULL,
    "suggestionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_analysis_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_extraction_suggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractPackageId" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "suggestionType" "ContractExtractionSuggestionType" NOT NULL,
    "proposedData" JSONB NOT NULL,
    "evidenceSegmentId" TEXT,
    "evidenceLocator" JSONB,
    "confidence" DOUBLE PRECISION,
    "extractionMethod" "ClauseExtractionMethod" NOT NULL DEFAULT 'DETERMINISTIC',
    "modelProvider" TEXT,
    "modelName" TEXT,
    "modelMetadata" JSONB,
    "status" "ContractExtractionSuggestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewerDecisionId" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_extraction_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_package_currentConfigurationRevisionId_key" ON "contract_package"("currentConfigurationRevisionId");

-- CreateIndex
CREATE INDEX "contract_package_tenantId_projectId_status_idx" ON "contract_package"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "contract_package_tenantId_projectId_createdAt_idx" ON "contract_package"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "contract_document_tenantId_projectId_contractPackageId_idx" ON "contract_document"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_document_sourceDocumentId_idx" ON "contract_document"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "contract_document_documentVersionId_idx" ON "contract_document"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_document_contractPackageId_sourceDocumentId_docume_key" ON "contract_document"("contractPackageId", "sourceDocumentId", "documentVersionId");

-- CreateIndex
CREATE INDEX "contract_document_relationship_tenantId_projectId_contractP_idx" ON "contract_document_relationship"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_document_relationship_contractPackageId_fromContra_key" ON "contract_document_relationship"("contractPackageId", "fromContractDocumentId", "toContractDocumentId", "relationshipType");

-- CreateIndex
CREATE INDEX "contract_precedence_rule_tenantId_projectId_contractPackage_idx" ON "contract_precedence_rule"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_precedence_rule_contractPackageId_rank_idx" ON "contract_precedence_rule"("contractPackageId", "rank");

-- CreateIndex
CREATE INDEX "contract_precedence_rule_configurationRevisionId_idx" ON "contract_precedence_rule"("configurationRevisionId");

-- CreateIndex
CREATE INDEX "contract_clause_tenantId_projectId_contractPackageId_idx" ON "contract_clause"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_clause_contractDocumentId_sequence_idx" ON "contract_clause"("contractDocumentId", "sequence");

-- CreateIndex
CREATE INDEX "contract_clause_parentClauseId_idx" ON "contract_clause"("parentClauseId");

-- CreateIndex
CREATE INDEX "contract_clause_documentVersionId_idx" ON "contract_clause"("documentVersionId");

-- CreateIndex
CREATE INDEX "clause_text_revision_tenantId_projectId_contractClauseId_idx" ON "clause_text_revision"("tenantId", "projectId", "contractClauseId");

-- CreateIndex
CREATE UNIQUE INDEX "clause_text_revision_contractClauseId_revisionNumber_key" ON "clause_text_revision"("contractClauseId", "revisionNumber");

-- CreateIndex
CREATE INDEX "clause_relationship_tenantId_projectId_contractPackageId_idx" ON "clause_relationship"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "clause_relationship_contractPackageId_fromClauseId_toClause_key" ON "clause_relationship"("contractPackageId", "fromClauseId", "toClauseId", "relationshipType");

-- CreateIndex
CREATE INDEX "defined_term_tenantId_projectId_contractPackageId_idx" ON "defined_term"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "defined_term_contractPackageId_normalizedTerm_idx" ON "defined_term"("contractPackageId", "normalizedTerm");

-- CreateIndex
CREATE INDEX "clause_term_reference_tenantId_projectId_contractPackageId_idx" ON "clause_term_reference"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "clause_term_reference_contractClauseId_idx" ON "clause_term_reference"("contractClauseId");

-- CreateIndex
CREATE INDEX "clause_term_reference_definedTermId_idx" ON "clause_term_reference"("definedTermId");

-- CreateIndex
CREATE INDEX "cross_reference_tenantId_projectId_contractPackageId_idx" ON "cross_reference"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "cross_reference_sourceClauseId_idx" ON "cross_reference"("sourceClauseId");

-- CreateIndex
CREATE INDEX "contract_party_tenantId_projectId_contractPackageId_idx" ON "contract_party"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_role_tenantId_projectId_contractPackageId_idx" ON "contract_role"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_role_assignedPartyId_idx" ON "contract_role"("assignedPartyId");

-- CreateIndex
CREATE INDEX "contact_point_tenantId_projectId_contractPackageId_idx" ON "contact_point"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_obligation_tenantId_projectId_contractPackageId_idx" ON "contract_obligation"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_obligation_sourceClauseId_idx" ON "contract_obligation"("sourceClauseId");

-- CreateIndex
CREATE INDEX "contract_obligation_configurationRevisionId_idx" ON "contract_obligation"("configurationRevisionId");

-- CreateIndex
CREATE INDEX "obligation_trigger_tenantId_projectId_obligationId_idx" ON "obligation_trigger"("tenantId", "projectId", "obligationId");

-- CreateIndex
CREATE INDEX "obligation_recipient_tenantId_projectId_obligationId_idx" ON "obligation_recipient"("tenantId", "projectId", "obligationId");

-- CreateIndex
CREATE INDEX "obligation_evidence_requirement_tenantId_projectId_obligati_idx" ON "obligation_evidence_requirement"("tenantId", "projectId", "obligationId");

-- CreateIndex
CREATE INDEX "notice_rule_tenantId_projectId_contractPackageId_idx" ON "notice_rule"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "notice_rule_obligationId_idx" ON "notice_rule"("obligationId");

-- CreateIndex
CREATE INDEX "notice_rule_configurationRevisionId_idx" ON "notice_rule"("configurationRevisionId");

-- CreateIndex
CREATE INDEX "calendar_rule_tenantId_projectId_contractPackageId_idx" ON "calendar_rule"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_configuration_revision_tenantId_projectId_contract_idx" ON "contract_configuration_revision"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_configuration_revision_contractPackageId_status_idx" ON "contract_configuration_revision"("contractPackageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_configuration_revision_contractPackageId_revisionN_key" ON "contract_configuration_revision"("contractPackageId", "revisionNumber");

-- CreateIndex
CREATE INDEX "contract_configuration_issue_tenantId_projectId_contractPac_idx" ON "contract_configuration_issue"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_configuration_issue_configurationRevisionId_status_idx" ON "contract_configuration_issue"("configurationRevisionId", "status");

-- CreateIndex
CREATE INDEX "review_decision_tenantId_projectId_contractPackageId_create_idx" ON "review_decision"("tenantId", "projectId", "contractPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "review_decision_entityType_entityId_idx" ON "review_decision"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "review_decision_configurationRevisionId_idx" ON "review_decision"("configurationRevisionId");

-- CreateIndex
CREATE INDEX "contract_analysis_run_tenantId_projectId_contractPackageId_idx" ON "contract_analysis_run"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_analysis_run_tenantId_status_queuedAt_idx" ON "contract_analysis_run"("tenantId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "contract_analysis_run_correlationId_idx" ON "contract_analysis_run"("correlationId");

-- CreateIndex
CREATE INDEX "contract_extraction_suggestion_tenantId_projectId_contractP_idx" ON "contract_extraction_suggestion"("tenantId", "projectId", "contractPackageId");

-- CreateIndex
CREATE INDEX "contract_extraction_suggestion_analysisRunId_status_idx" ON "contract_extraction_suggestion"("analysisRunId", "status");

-- CreateIndex
CREATE INDEX "contract_extraction_suggestion_status_idx" ON "contract_extraction_suggestion"("status");

-- AddForeignKey
ALTER TABLE "contract_package" ADD CONSTRAINT "contract_package_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_package" ADD CONSTRAINT "contract_package_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_package" ADD CONSTRAINT "contract_package_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_package" ADD CONSTRAINT "contract_package_currentConfigurationRevisionId_fkey" FOREIGN KEY ("currentConfigurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_relationship" ADD CONSTRAINT "contract_document_relationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_relationship" ADD CONSTRAINT "contract_document_relationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_relationship" ADD CONSTRAINT "contract_document_relationship_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_relationship" ADD CONSTRAINT "contract_document_relationship_fromContractDocumentId_fkey" FOREIGN KEY ("fromContractDocumentId") REFERENCES "contract_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_relationship" ADD CONSTRAINT "contract_document_relationship_toContractDocumentId_fkey" FOREIGN KEY ("toContractDocumentId") REFERENCES "contract_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_contractDocumentId_fkey" FOREIGN KEY ("contractDocumentId") REFERENCES "contract_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_precedence_rule" ADD CONSTRAINT "contract_precedence_rule_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_contractDocumentId_fkey" FOREIGN KEY ("contractDocumentId") REFERENCES "contract_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_parentClauseId_fkey" FOREIGN KEY ("parentClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_text_revision" ADD CONSTRAINT "clause_text_revision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_text_revision" ADD CONSTRAINT "clause_text_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_text_revision" ADD CONSTRAINT "clause_text_revision_contractClauseId_fkey" FOREIGN KEY ("contractClauseId") REFERENCES "contract_clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_text_revision" ADD CONSTRAINT "clause_text_revision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_text_revision" ADD CONSTRAINT "clause_text_revision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_relationship" ADD CONSTRAINT "clause_relationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_relationship" ADD CONSTRAINT "clause_relationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_relationship" ADD CONSTRAINT "clause_relationship_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_relationship" ADD CONSTRAINT "clause_relationship_fromClauseId_fkey" FOREIGN KEY ("fromClauseId") REFERENCES "contract_clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_relationship" ADD CONSTRAINT "clause_relationship_toClauseId_fkey" FOREIGN KEY ("toClauseId") REFERENCES "contract_clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_effectiveContractDocumentId_fkey" FOREIGN KEY ("effectiveContractDocumentId") REFERENCES "contract_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defined_term" ADD CONSTRAINT "defined_term_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_term_reference" ADD CONSTRAINT "clause_term_reference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_term_reference" ADD CONSTRAINT "clause_term_reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_term_reference" ADD CONSTRAINT "clause_term_reference_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_term_reference" ADD CONSTRAINT "clause_term_reference_contractClauseId_fkey" FOREIGN KEY ("contractClauseId") REFERENCES "contract_clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_term_reference" ADD CONSTRAINT "clause_term_reference_definedTermId_fkey" FOREIGN KEY ("definedTermId") REFERENCES "defined_term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_reference" ADD CONSTRAINT "cross_reference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_reference" ADD CONSTRAINT "cross_reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_reference" ADD CONSTRAINT "cross_reference_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_reference" ADD CONSTRAINT "cross_reference_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_party" ADD CONSTRAINT "contract_party_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_party" ADD CONSTRAINT "contract_party_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_party" ADD CONSTRAINT "contract_party_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_party" ADD CONSTRAINT "contract_party_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_role" ADD CONSTRAINT "contract_role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_role" ADD CONSTRAINT "contract_role_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_role" ADD CONSTRAINT "contract_role_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_role" ADD CONSTRAINT "contract_role_assignedPartyId_fkey" FOREIGN KEY ("assignedPartyId") REFERENCES "contract_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_role" ADD CONSTRAINT "contract_role_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_contractPartyId_fkey" FOREIGN KEY ("contractPartyId") REFERENCES "contract_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_contractRoleId_fkey" FOREIGN KEY ("contractRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_point" ADD CONSTRAINT "contact_point_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "contract_clause"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_obligatedPartyId_fkey" FOREIGN KEY ("obligatedPartyId") REFERENCES "contract_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_obligatedRoleId_fkey" FOREIGN KEY ("obligatedRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_beneficiaryPartyId_fkey" FOREIGN KEY ("beneficiaryPartyId") REFERENCES "contract_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_beneficiaryRoleId_fkey" FOREIGN KEY ("beneficiaryRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_trigger" ADD CONSTRAINT "obligation_trigger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_trigger" ADD CONSTRAINT "obligation_trigger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_trigger" ADD CONSTRAINT "obligation_trigger_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "contract_obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_recipient" ADD CONSTRAINT "obligation_recipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_recipient" ADD CONSTRAINT "obligation_recipient_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_recipient" ADD CONSTRAINT "obligation_recipient_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "contract_obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_recipient" ADD CONSTRAINT "obligation_recipient_contractRoleId_fkey" FOREIGN KEY ("contractRoleId") REFERENCES "contract_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_recipient" ADD CONSTRAINT "obligation_recipient_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "contact_point"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_evidence_requirement" ADD CONSTRAINT "obligation_evidence_requirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_evidence_requirement" ADD CONSTRAINT "obligation_evidence_requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_evidence_requirement" ADD CONSTRAINT "obligation_evidence_requirement_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "contract_obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "contract_obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_holidayCalendarRuleId_fkey" FOREIGN KEY ("holidayCalendarRuleId") REFERENCES "calendar_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_rule" ADD CONSTRAINT "notice_rule_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_rule" ADD CONSTRAINT "calendar_rule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_rule" ADD CONSTRAINT "calendar_rule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_rule" ADD CONSTRAINT "calendar_rule_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_rule" ADD CONSTRAINT "calendar_rule_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_rule" ADD CONSTRAINT "calendar_rule_supersedesRuleId_fkey" FOREIGN KEY ("supersedesRuleId") REFERENCES "calendar_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_revision" ADD CONSTRAINT "contract_configuration_revision_supersedesRevisionId_fkey" FOREIGN KEY ("supersedesRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_configuration_issue" ADD CONSTRAINT "contract_configuration_issue_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_analysis_run" ADD CONSTRAINT "contract_analysis_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_analysis_run" ADD CONSTRAINT "contract_analysis_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_analysis_run" ADD CONSTRAINT "contract_analysis_run_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_analysis_run" ADD CONSTRAINT "contract_analysis_run_configurationRevisionId_fkey" FOREIGN KEY ("configurationRevisionId") REFERENCES "contract_configuration_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction_suggestion" ADD CONSTRAINT "contract_extraction_suggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction_suggestion" ADD CONSTRAINT "contract_extraction_suggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction_suggestion" ADD CONSTRAINT "contract_extraction_suggestion_contractPackageId_fkey" FOREIGN KEY ("contractPackageId") REFERENCES "contract_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction_suggestion" ADD CONSTRAINT "contract_extraction_suggestion_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "contract_analysis_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Slice 3: integrity triggers + FORCE RLS + grants
-- ---------------------------------------------------------------------------

-- At most one active approved configuration revision per package
CREATE UNIQUE INDEX "contract_configuration_revision_one_active_approved_per_package"
  ON "contract_configuration_revision" ("contractPackageId")
  WHERE "isActiveApproved" = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contractradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contractradar_app;

-- Tenant/project consistency for all Slice 3 tenant tables
CREATE OR REPLACE FUNCTION enforce_contract_tenant_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_tenant text;
BEGIN
  SELECT "tenantId"::text INTO project_tenant FROM "project" WHERE id = NEW."projectId";
  IF project_tenant IS NULL THEN
    RAISE EXCEPTION 'contract row references unknown project';
  END IF;
  IF NEW."tenantId"::text <> project_tenant THEN
    RAISE EXCEPTION 'contract row tenantId must match project.tenantId';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contract_package',
    'contract_document',
    'contract_document_relationship',
    'contract_precedence_rule',
    'contract_clause',
    'clause_text_revision',
    'clause_relationship',
    'defined_term',
    'clause_term_reference',
    'cross_reference',
    'contract_party',
    'contract_role',
    'contact_point',
    'contract_obligation',
    'obligation_trigger',
    'obligation_recipient',
    'obligation_evidence_requirement',
    'notice_rule',
    'calendar_rule',
    'contract_configuration_revision',
    'contract_configuration_issue',
    'review_decision',
    'contract_analysis_run',
    'contract_extraction_suggestion'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_tenant_project_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_tenant_project_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_contract_tenant_project()',
      t, t
    );
  END LOOP;
END $$;

-- Contract package must belong to project/tenant (covered above); documents must match package
CREATE OR REPLACE FUNCTION enforce_contract_document_package()
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
    RAISE EXCEPTION 'contract_document references unknown contract_package';
  END IF;
  IF NEW."tenantId"::text <> pkg_tenant OR NEW."projectId"::text <> pkg_project THEN
    RAISE EXCEPTION 'contract_document tenant/project must match contract_package';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_document_package_guard ON "contract_document";
CREATE TRIGGER contract_document_package_guard
  BEFORE INSERT OR UPDATE ON "contract_document"
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_document_package();

-- Contract document sourceDocument/version must belong to same project (and version to document)
CREATE OR REPLACE FUNCTION enforce_contract_document_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sd_tenant text;
  sd_project text;
  dv_tenant text;
  dv_project text;
  dv_source text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO sd_tenant, sd_project
  FROM "source_document" WHERE id = NEW."sourceDocumentId";
  IF sd_tenant IS NULL THEN
    RAISE EXCEPTION 'contract_document references unknown source_document';
  END IF;
  IF NEW."tenantId"::text <> sd_tenant OR NEW."projectId"::text <> sd_project THEN
    RAISE EXCEPTION 'contract_document sourceDocument must belong to same tenant/project';
  END IF;

  SELECT "tenantId"::text, "projectId"::text, "sourceDocumentId"::text
    INTO dv_tenant, dv_project, dv_source
  FROM "document_version" WHERE id = NEW."documentVersionId";
  IF dv_tenant IS NULL THEN
    RAISE EXCEPTION 'contract_document references unknown document_version';
  END IF;
  IF NEW."tenantId"::text <> dv_tenant OR NEW."projectId"::text <> dv_project THEN
    RAISE EXCEPTION 'contract_document documentVersion must belong to same tenant/project';
  END IF;
  IF dv_source <> NEW."sourceDocumentId"::text THEN
    RAISE EXCEPTION 'contract_document documentVersion must belong to sourceDocument';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_document_source_guard ON "contract_document";
CREATE TRIGGER contract_document_source_guard
  BEFORE INSERT OR UPDATE ON "contract_document"
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_document_source();

-- Clause must belong to same package as its contract document; version must match document
CREATE OR REPLACE FUNCTION enforce_contract_clause_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc_tenant text;
  doc_project text;
  doc_package text;
  doc_version text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "contractPackageId"::text, "documentVersionId"::text
    INTO doc_tenant, doc_project, doc_package, doc_version
  FROM "contract_document" WHERE id = NEW."contractDocumentId";
  IF doc_tenant IS NULL THEN
    RAISE EXCEPTION 'contract_clause references unknown contract_document';
  END IF;
  IF NEW."tenantId"::text <> doc_tenant OR NEW."projectId"::text <> doc_project THEN
    RAISE EXCEPTION 'contract_clause tenant/project must match contract_document';
  END IF;
  IF NEW."contractPackageId"::text <> doc_package THEN
    RAISE EXCEPTION 'contract_clause.contractPackageId must match contract_document.contractPackageId';
  END IF;
  IF NEW."documentVersionId"::text <> doc_version THEN
    RAISE EXCEPTION 'contract_clause.documentVersionId must match contract_document.documentVersionId';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_clause_document_guard ON "contract_clause";
CREATE TRIGGER contract_clause_document_guard
  BEFORE INSERT OR UPDATE ON "contract_clause"
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_clause_document();

-- Package-scoped children must match parent package tenant/project
CREATE OR REPLACE FUNCTION enforce_contract_child_package()
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
    RAISE EXCEPTION '% references unknown contract_package', TG_TABLE_NAME;
  END IF;
  IF NEW."tenantId"::text <> pkg_tenant OR NEW."projectId"::text <> pkg_project THEN
    RAISE EXCEPTION '% tenant/project must match contract_package', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contract_document_relationship',
    'contract_precedence_rule',
    'contract_clause',
    'clause_relationship',
    'defined_term',
    'clause_term_reference',
    'cross_reference',
    'contract_party',
    'contract_role',
    'contact_point',
    'contract_obligation',
    'notice_rule',
    'calendar_rule',
    'contract_configuration_revision',
    'contract_configuration_issue',
    'review_decision',
    'contract_analysis_run',
    'contract_extraction_suggestion'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_package_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_package_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_contract_child_package()',
      t, t
    );
  END LOOP;
END $$;

-- Obligation children must match obligation tenant/project
CREATE OR REPLACE FUNCTION enforce_obligation_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ob_tenant text;
  ob_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO ob_tenant, ob_project
  FROM "contract_obligation" WHERE id = NEW."obligationId";
  IF ob_tenant IS NULL THEN
    RAISE EXCEPTION '% references unknown contract_obligation', TG_TABLE_NAME;
  END IF;
  IF NEW."tenantId"::text <> ob_tenant OR NEW."projectId"::text <> ob_project THEN
    RAISE EXCEPTION '% tenant/project must match contract_obligation', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obligation_trigger',
    'obligation_recipient',
    'obligation_evidence_requirement'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_obligation_guard ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_obligation_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_obligation_child()',
      t, t
    );
  END LOOP;
END $$;

-- Notice rule obligation must belong to same package
CREATE OR REPLACE FUNCTION enforce_notice_rule_obligation_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ob_package text;
BEGIN
  SELECT "contractPackageId"::text INTO ob_package
  FROM "contract_obligation" WHERE id = NEW."obligationId";
  IF ob_package IS NULL THEN
    RAISE EXCEPTION 'notice_rule references unknown contract_obligation';
  END IF;
  IF NEW."contractPackageId"::text <> ob_package THEN
    RAISE EXCEPTION 'notice_rule.contractPackageId must match obligation.contractPackageId';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notice_rule_obligation_package_guard ON "notice_rule";
CREATE TRIGGER notice_rule_obligation_package_guard
  BEFORE INSERT OR UPDATE ON "notice_rule"
  FOR EACH ROW EXECUTE FUNCTION enforce_notice_rule_obligation_package();

-- Clause text revision must match clause tenant/project
CREATE OR REPLACE FUNCTION enforce_clause_text_revision_clause()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  c_tenant text;
  c_project text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text
    INTO c_tenant, c_project
  FROM "contract_clause" WHERE id = NEW."contractClauseId";
  IF c_tenant IS NULL THEN
    RAISE EXCEPTION 'clause_text_revision references unknown contract_clause';
  END IF;
  IF NEW."tenantId"::text <> c_tenant OR NEW."projectId"::text <> c_project THEN
    RAISE EXCEPTION 'clause_text_revision tenant/project must match contract_clause';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clause_text_revision_clause_guard ON "clause_text_revision";
CREATE TRIGGER clause_text_revision_clause_guard
  BEFORE INSERT OR UPDATE ON "clause_text_revision"
  FOR EACH ROW EXECUTE FUNCTION enforce_clause_text_revision_clause();

-- Extraction suggestion must match analysis run package/tenant/project
CREATE OR REPLACE FUNCTION enforce_extraction_suggestion_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r_tenant text;
  r_project text;
  r_package text;
BEGIN
  SELECT "tenantId"::text, "projectId"::text, "contractPackageId"::text
    INTO r_tenant, r_project, r_package
  FROM "contract_analysis_run" WHERE id = NEW."analysisRunId";
  IF r_tenant IS NULL THEN
    RAISE EXCEPTION 'contract_extraction_suggestion references unknown contract_analysis_run';
  END IF;
  IF NEW."tenantId"::text <> r_tenant OR NEW."projectId"::text <> r_project THEN
    RAISE EXCEPTION 'contract_extraction_suggestion tenant/project must match analysis run';
  END IF;
  IF NEW."contractPackageId"::text <> r_package THEN
    RAISE EXCEPTION 'contract_extraction_suggestion.contractPackageId must match analysis run';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_extraction_suggestion_run_guard ON "contract_extraction_suggestion";
CREATE TRIGGER contract_extraction_suggestion_run_guard
  BEFORE INSERT OR UPDATE ON "contract_extraction_suggestion"
  FOR EACH ROW EXECUTE FUNCTION enforce_extraction_suggestion_run();

-- isActiveApproved may only be true when status = APPROVED
CREATE OR REPLACE FUNCTION enforce_configuration_revision_active_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."isActiveApproved" = true AND NEW.status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'isActiveApproved requires status APPROVED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_configuration_revision_active_flag_guard ON "contract_configuration_revision";
CREATE TRIGGER contract_configuration_revision_active_flag_guard
  BEFORE INSERT OR UPDATE ON "contract_configuration_revision"
  FOR EACH ROW EXECUTE FUNCTION enforce_configuration_revision_active_flag();

-- Approved configuration revisions are immutable, except supersession:
-- APPROVED → SUPERSEDED with isActiveApproved cleared (payload otherwise unchanged).
CREATE OR REPLACE FUNCTION prevent_approved_configuration_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED' THEN
      RAISE EXCEPTION 'approved contract_configuration_revision cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'APPROVED' THEN
    IF NEW.status = 'SUPERSEDED'
       AND NEW."isActiveApproved" = false
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."projectId" IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."contractPackageId" IS NOT DISTINCT FROM OLD."contractPackageId"
       AND NEW."revisionNumber" IS NOT DISTINCT FROM OLD."revisionNumber"
       AND NEW.summary IS NOT DISTINCT FROM OLD.summary
       AND NEW."basedOnDocumentVersions" IS NOT DISTINCT FROM OLD."basedOnDocumentVersions"
       AND NEW."createdByUserId" IS NOT DISTINCT FROM OLD."createdByUserId"
       AND NEW."submittedByUserId" IS NOT DISTINCT FROM OLD."submittedByUserId"
       AND NEW."approvedByUserId" IS NOT DISTINCT FROM OLD."approvedByUserId"
       AND NEW."submittedAt" IS NOT DISTINCT FROM OLD."submittedAt"
       AND NEW."approvedAt" IS NOT DISTINCT FROM OLD."approvedAt"
       AND NEW."supersedesRevisionId" IS NOT DISTINCT FROM OLD."supersedesRevisionId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       -- updatedAt may change on supersession
       THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved contract_configuration_revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_configuration_revision_immutable_update ON "contract_configuration_revision";
CREATE TRIGGER contract_configuration_revision_immutable_update
  BEFORE UPDATE ON "contract_configuration_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_configuration_revision_mutation();

DROP TRIGGER IF EXISTS contract_configuration_revision_immutable_delete ON "contract_configuration_revision";
CREATE TRIGGER contract_configuration_revision_immutable_delete
  BEFORE DELETE ON "contract_configuration_revision"
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_configuration_revision_mutation();

-- FORCE RLS on all Slice 3 tenant tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contract_package',
    'contract_document',
    'contract_document_relationship',
    'contract_precedence_rule',
    'contract_clause',
    'clause_text_revision',
    'clause_relationship',
    'defined_term',
    'clause_term_reference',
    'cross_reference',
    'contract_party',
    'contract_role',
    'contact_point',
    'contract_obligation',
    'obligation_trigger',
    'obligation_recipient',
    'obligation_evidence_requirement',
    'notice_rule',
    'calendar_rule',
    'contract_configuration_revision',
    'contract_configuration_issue',
    'review_decision',
    'contract_analysis_run',
    'contract_extraction_suggestion'
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
  "contract_package",
  "contract_document",
  "contract_document_relationship",
  "contract_precedence_rule",
  "contract_clause",
  "clause_text_revision",
  "clause_relationship",
  "defined_term",
  "clause_term_reference",
  "cross_reference",
  "contract_party",
  "contract_role",
  "contact_point",
  "contract_obligation",
  "obligation_trigger",
  "obligation_recipient",
  "obligation_evidence_requirement",
  "notice_rule",
  "calendar_rule",
  "contract_configuration_revision",
  "contract_configuration_issue",
  "review_decision",
  "contract_analysis_run",
  "contract_extraction_suggestion"
TO contractradar_app;
