/** Evidence completeness helpers for notice packages. */

export type EvidenceRequirementState = {
  category: string;
  mandatoryStatus: 'CONTRACTUALLY_REQUIRED' | 'INTERNALLY_REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  satisfactionStatus:
    | 'MISSING'
    | 'PARTIAL'
    | 'SATISFIED'
    | 'NOT_APPLICABLE'
    | 'WAIVED_BY_REVIEWER'
    | 'DISPUTED';
  waiverReason?: string | null;
};

export type CompletenessResult = {
  status: 'NOT_ASSESSED' | 'INCOMPLETE' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED';
  blockingIssues: string[];
  warnings: string[];
};

export function assessEvidenceCompleteness(
  requirements: EvidenceRequirementState[],
  opts?: { assessed?: boolean },
): CompletenessResult {
  if (!opts?.assessed && requirements.length === 0) {
    return { status: 'NOT_ASSESSED', blockingIssues: ['NOT_ASSESSED'], warnings: [] };
  }
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let waivedMandatory = 0;

  for (const req of requirements) {
    const mandatory =
      req.mandatoryStatus === 'CONTRACTUALLY_REQUIRED' ||
      req.mandatoryStatus === 'INTERNALLY_REQUIRED';
    if (req.satisfactionStatus === 'SATISFIED' || req.satisfactionStatus === 'NOT_APPLICABLE') {
      continue;
    }
    if (req.satisfactionStatus === 'WAIVED_BY_REVIEWER') {
      if (!req.waiverReason?.trim()) {
        blockingIssues.push(`${req.category}:WAIVER_WITHOUT_REASON`);
      } else if (mandatory) {
        waivedMandatory += 1;
        warnings.push(`${req.category}:WAIVED_STILL_CONTRACTUAL`);
      }
      continue;
    }
    if (req.satisfactionStatus === 'DISPUTED' && mandatory) {
      blockingIssues.push(`${req.category}:DISPUTED`);
      continue;
    }
    if (
      mandatory &&
      (req.satisfactionStatus === 'MISSING' || req.satisfactionStatus === 'PARTIAL')
    ) {
      blockingIssues.push(`${req.category}:${req.satisfactionStatus}`);
      continue;
    }
    if (req.mandatoryStatus === 'RECOMMENDED' && req.satisfactionStatus === 'MISSING') {
      warnings.push(`${req.category}:RECOMMENDED_MISSING`);
    }
  }

  if (blockingIssues.length > 0) {
    return { status: 'BLOCKED', blockingIssues, warnings };
  }
  if (waivedMandatory > 0) {
    return { status: 'CONDITIONALLY_READY', blockingIssues: [], warnings };
  }
  if (warnings.length > 0) {
    return { status: 'CONDITIONALLY_READY', blockingIssues: [], warnings };
  }
  return { status: 'READY', blockingIssues: [], warnings };
}

export const DEFAULT_EVIDENCE_CATEGORIES = [
  'EVENT_OCCURRENCE',
  'TRIGGER_DATE',
  'CONTRACTUAL_BASIS',
  'RECIPIENT',
  'DELIVERY_METHOD',
  'CONTEMPORARY_RECORDS',
] as const;
