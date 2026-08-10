export const DEPLOYMENT_APPROVAL_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'USED',
  'CANCELLED',
  // Slice 10 aliases
  'PENDING',
  'REVOKED',
] as const;

export type DeploymentApprovalStatus = (typeof DEPLOYMENT_APPROVAL_STATUSES)[number];

export type DeploymentApproval = {
  approvalId: string;
  releaseId: string;
  gitSha: string;
  imageDigests: string[];
  status: DeploymentApprovalStatus;
  requestedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  requestedAt: string;
  decidedAt?: string;
  expiresAt: string;
  deploymentWindowStart?: string;
  deploymentWindowEnd?: string;
  environment: 'STAGING' | 'PILOT';
  migrationVersion?: string;
  vulnerabilityPolicyDigest?: string;
  backupEvidenceId?: string;
  restoreEvidenceId?: string;
  pilotSecurityReviewId?: string;
  knownRisks?: string[];
  changeTicket?: string;
  notes?: string;
};

export function validateDeploymentApproval(input: unknown): {
  ok: boolean;
  approval?: DeploymentApproval;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['approval must be an object'] };
  }
  const a = input as Partial<DeploymentApproval>;
  if (!a.approvalId) errors.push('approvalId required');
  if (!a.releaseId) errors.push('releaseId required');
  if (!a.gitSha || !/^[a-f0-9]{7,64}$/i.test(a.gitSha)) errors.push('gitSha required');
  if (!Array.isArray(a.imageDigests) || a.imageDigests.length === 0) {
    errors.push('imageDigests required');
  } else if (a.imageDigests.some((d) => !/^sha256:[a-f0-9]{64}$/i.test(d))) {
    errors.push('imageDigests must be sha256 digests');
  }
  if (!a.status || !(DEPLOYMENT_APPROVAL_STATUSES as readonly string[]).includes(a.status)) {
    errors.push(`status must be one of ${DEPLOYMENT_APPROVAL_STATUSES.join(', ')}`);
  }
  if (!a.requestedBy) errors.push('requestedBy required');
  if (!a.requestedAt || Number.isNaN(Date.parse(a.requestedAt))) {
    errors.push('requestedAt must be ISO timestamp');
  }
  if (!a.expiresAt || Number.isNaN(Date.parse(a.expiresAt))) {
    errors.push('expiresAt must be ISO timestamp');
  }
  if (a.environment !== 'STAGING' && a.environment !== 'PILOT') {
    errors.push('environment must be STAGING or PILOT');
  }
  if (a.status === 'APPROVED' && !a.approvedBy) {
    errors.push('approvedBy required when status is APPROVED');
  }
  if (a.status === 'APPROVED' && a.expiresAt && Date.parse(a.expiresAt) < Date.now()) {
    errors.push('APPROVED approval is past expiresAt');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, approval: a as DeploymentApproval, errors: [] };
}

export function isDeployAllowed(
  approval: DeploymentApproval,
  expected: { releaseId: string; gitSha: string; imageDigests: string[] },
): boolean {
  if (approval.releaseId !== expected.releaseId) return false;
  if (approval.gitSha !== expected.gitSha) return false;
  if (approval.status !== 'APPROVED') return false;
  if (Date.parse(approval.expiresAt) < Date.now()) return false;
  if (!approval.approvedBy) return false;
  const want = new Set(expected.imageDigests.map((d) => d.toLowerCase()));
  const have = new Set(approval.imageDigests.map((d) => d.toLowerCase()));
  if (want.size !== have.size) return false;
  for (const d of want) if (!have.has(d)) return false;
  if (approval.deploymentWindowStart && Date.parse(approval.deploymentWindowStart) > Date.now()) {
    return false;
  }
  if (approval.deploymentWindowEnd && Date.parse(approval.deploymentWindowEnd) < Date.now()) {
    return false;
  }
  return true;
}
