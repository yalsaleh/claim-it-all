export const DEPLOYMENT_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
] as const;

export type DeploymentApprovalStatus = (typeof DEPLOYMENT_APPROVAL_STATUSES)[number];

export type DeploymentApproval = {
  approvalId: string;
  releaseId: string;
  status: DeploymentApprovalStatus;
  requestedBy: string;
  approvedBy?: string;
  requestedAt: string;
  decidedAt?: string;
  expiresAt: string;
  environment: 'STAGING' | 'PILOT';
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

export function isDeployAllowed(approval: DeploymentApproval, releaseId: string): boolean {
  if (approval.releaseId !== releaseId) return false;
  if (approval.status !== 'APPROVED') return false;
  if (Date.parse(approval.expiresAt) < Date.now()) return false;
  return Boolean(approval.approvedBy);
}
