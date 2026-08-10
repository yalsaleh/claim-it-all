import { describe, expect, it } from 'vitest';
import { isDeployAllowed, validateDeploymentApproval } from './deployment-approval';

describe('deployment approval', () => {
  it('requires approver for APPROVED status', () => {
    const result = validateDeploymentApproval({
      approvalId: 'a1',
      releaseId: 'r1',
      status: 'APPROVED',
      requestedBy: 'ops',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      environment: 'PILOT',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('approvedBy'))).toBe(true);
  });

  it('allows deploy only for unexpired APPROVED matching release', () => {
    const approval = {
      approvalId: 'a1',
      releaseId: 'r1',
      status: 'APPROVED' as const,
      requestedBy: 'ops',
      approvedBy: 'security',
      requestedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      environment: 'PILOT' as const,
    };
    expect(validateDeploymentApproval(approval).ok).toBe(true);
    expect(isDeployAllowed(approval, 'r1')).toBe(true);
    expect(isDeployAllowed(approval, 'other')).toBe(false);
  });
});
