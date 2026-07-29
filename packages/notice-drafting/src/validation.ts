import {
  NOTICE_VALIDATION_RULESET_VERSION,
  type ValidationIssue,
  type ValidationResult,
} from './types';

export type DraftValidationInput = {
  contractPackageId: string;
  expectedContractPackageId: string;
  configurationRevisionId: string;
  expectedConfigurationRevisionId: string;
  approvedRuleSnapshotId: string;
  expectedApprovedRuleSnapshotId: string;
  projectEventId: string;
  expectedProjectEventId: string;
  calculationStatus: string;
  calculationId: string;
  expectedCalculationId: string;
  hasVerifiedTriggerDate: boolean;
  hasVerifiedDeadline: boolean;
  clauseReferencePresent: boolean;
  language: string;
  requiredLanguage?: string | null;
  recipients: Array<{
    verificationStatus: string;
    copiedRecipient: boolean;
    hasContact: boolean;
    selectedMethod: string | null;
    permittedMethod: string | null;
  }>;
  openBlockingQuestions: number;
  completenessStatus: string;
  unapprovedFactsInDraft: number;
  hasInternalOnlyInExportCandidate: boolean;
  controlledExceptionsForBlockers: number;
  nonWaivableBlockers: string[];
  staleEvidenceAssessment: boolean;
  supersededCalculation: boolean;
  reservationPresent: boolean;
  reservationRequired: boolean;
  attachmentMissingRequired: boolean;
};

function issue(
  severity: ValidationIssue['severity'],
  code: string,
  message: string,
  field?: string,
): ValidationIssue {
  return { severity, code, message, field };
}

export function validateNoticeDraft(input: DraftValidationInput): ValidationResult {
  const blocking: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const notes: ValidationIssue[] = [];

  if (input.contractPackageId !== input.expectedContractPackageId) {
    blocking.push(
      issue('blocking', 'WRONG_CONTRACT_PACKAGE', 'Draft is bound to a different contract package'),
    );
  }
  if (input.configurationRevisionId !== input.expectedConfigurationRevisionId) {
    blocking.push(
      issue(
        'blocking',
        'STALE_CONFIGURATION',
        'Configuration revision does not match package binding',
      ),
    );
  }
  if (input.approvedRuleSnapshotId !== input.expectedApprovedRuleSnapshotId) {
    blocking.push(issue('blocking', 'WRONG_RULE_SNAPSHOT', 'Approved rule snapshot mismatch'));
  }
  if (input.projectEventId !== input.expectedProjectEventId) {
    blocking.push(issue('blocking', 'WRONG_PROJECT_EVENT', 'Project event mismatch'));
  }
  if (input.calculationId !== input.expectedCalculationId || input.supersededCalculation) {
    blocking.push(
      issue('blocking', 'STALE_CALCULATION', 'Deadline calculation is stale or superseded'),
    );
  }
  if (input.calculationStatus !== 'VERIFIED') {
    blocking.push(
      issue('blocking', 'CALCULATION_NOT_VERIFIED', 'Deadline calculation is not verified'),
    );
  }
  if (!input.hasVerifiedTriggerDate) {
    blocking.push(issue('blocking', 'MISSING_TRIGGER_DATE', 'Verified trigger date is required'));
  }
  if (!input.hasVerifiedDeadline) {
    blocking.push(
      issue('blocking', 'MISSING_VERIFIED_DEADLINE', 'Verified contractual deadline is required'),
    );
  }
  if (!input.clauseReferencePresent) {
    blocking.push(
      issue(
        'blocking',
        'MISSING_CLAUSE_REFERENCE',
        'Exact clause reference from approved snapshot is required',
      ),
    );
  }
  if (input.requiredLanguage && input.language !== input.requiredLanguage) {
    warnings.push(
      issue(
        'warning',
        'LANGUAGE_MISMATCH',
        'Draft language differs from governing-language requirement',
      ),
    );
  }

  const requiredRecipients = input.recipients.filter((r) => !r.copiedRecipient);
  if (requiredRecipients.length === 0) {
    blocking.push(
      issue('blocking', 'MISSING_RECIPIENT', 'At least one required recipient is needed'),
    );
  }
  for (const r of requiredRecipients) {
    if (r.verificationStatus !== 'VERIFIED') {
      blocking.push(
        issue(
          'blocking',
          'UNVERIFIED_RECIPIENT',
          'Required recipient is not verified',
          'recipient',
        ),
      );
    }
    if (!r.hasContact) {
      blocking.push(
        issue(
          'blocking',
          'MISSING_CONTACT_POINT',
          'Recipient lacks verified contact point',
          'recipient',
        ),
      );
    }
    if (r.permittedMethod && r.selectedMethod && r.selectedMethod !== r.permittedMethod) {
      warnings.push(
        issue(
          'warning',
          'DELIVERY_METHOD_DEVIATION',
          'Selected delivery method differs from permitted method',
        ),
      );
    }
  }

  if (input.openBlockingQuestions > 0) {
    blocking.push(
      issue(
        'blocking',
        'OPEN_QUESTIONS',
        `${input.openBlockingQuestions} required questions remain open`,
      ),
    );
  }
  if (input.completenessStatus === 'INCOMPLETE' || input.completenessStatus === 'BLOCKED') {
    if (input.controlledExceptionsForBlockers <= 0) {
      blocking.push(
        issue(
          'blocking',
          'EVIDENCE_INCOMPLETE',
          'Evidence completeness is incomplete without controlled exception',
        ),
      );
    } else {
      warnings.push(
        issue(
          'warning',
          'EVIDENCE_EXCEPTION',
          'Proceeding with controlled exception for evidence gaps',
        ),
      );
    }
  }
  if (input.completenessStatus === 'NOT_ASSESSED') {
    blocking.push(
      issue('blocking', 'EVIDENCE_NOT_ASSESSED', 'Evidence completeness has not been assessed'),
    );
  }
  if (input.unapprovedFactsInDraft > 0) {
    blocking.push(
      issue('blocking', 'UNAPPROVED_FACTS', 'Draft references facts not approved for drafting'),
    );
  }
  if (input.hasInternalOnlyInExportCandidate) {
    blocking.push(
      issue('blocking', 'INTERNAL_CONTENT_IN_EXPORT', 'Internal-only content cannot be exported'),
    );
  }
  if (input.staleEvidenceAssessment) {
    blocking.push(
      issue('blocking', 'STALE_EVIDENCE_ASSESSMENT', 'Evidence assessment revision is stale'),
    );
  }
  if (input.reservationRequired && !input.reservationPresent) {
    blocking.push(
      issue('blocking', 'MISSING_RESERVATION', 'Required reservation language is missing'),
    );
  }
  if (input.attachmentMissingRequired) {
    warnings.push(
      issue('warning', 'MISSING_ATTACHMENTS', 'Some recommended attachments are missing'),
    );
  }
  for (const code of input.nonWaivableBlockers) {
    blocking.push(issue('blocking', code, `Non-waivable blocker: ${code}`));
  }

  notes.push(
    issue(
      'info',
      'NO_DELIVERY',
      'Validation does not authorize sending; export-only in this slice',
    ),
  );

  return {
    rulesetVersion: NOTICE_VALIDATION_RULESET_VERSION,
    ok: blocking.length === 0,
    blocking,
    warnings,
    notes,
  };
}

export const NON_WAIVABLE_EXCEPTION_CODES = [
  'NO_VERIFIED_EVENT',
  'NO_APPROVED_RULE_SNAPSHOT',
  'NO_VERIFIED_DEADLINE',
  'CROSS_PROJECT_EVIDENCE',
  'INVENTED_RECIPIENT',
  'UNSUPPORTED_CLAUSE',
  'UNAUTHORIZED_APPROVER',
] as const;

export function isNonWaivableException(code: string): boolean {
  return (NON_WAIVABLE_EXCEPTION_CODES as readonly string[]).includes(code);
}
