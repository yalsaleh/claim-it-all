import { describe, expect, it } from 'vitest';
import { isDeployAllowed, validateDeploymentApproval } from './deployment-approval';

const digest = `sha256:${'a'.repeat(64)}`;

describe('deployment approval', () => {
  it('requires approver for APPROVED status', () => {
    const result = validateDeploymentApproval({
      approvalId: 'a1',
      releaseId: 'r1',
      gitSha: 'abc1234',
      imageDigests: [digest],
      status: 'APPROVED',
      requestedBy: 'ops',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      environment: 'PILOT',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('approvedBy'))).toBe(true);
  });

  it('allows deploy only for unexpired APPROVED matching release+sha+digests', () => {
    const approval = {
      approvalId: 'a1',
      releaseId: 'r1',
      gitSha: 'abc1234',
      imageDigests: [digest],
      status: 'APPROVED' as const,
      requestedBy: 'ops',
      approvedBy: 'security',
      requestedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      environment: 'PILOT' as const,
    };
    expect(validateDeploymentApproval(approval).ok).toBe(true);
    expect(
      isDeployAllowed(approval, { releaseId: 'r1', gitSha: 'abc1234', imageDigests: [digest] }),
    ).toBe(true);
    expect(
      isDeployAllowed(approval, { releaseId: 'other', gitSha: 'abc1234', imageDigests: [digest] }),
    ).toBe(false);
    expect(
      isDeployAllowed(approval, {
        releaseId: 'r1',
        gitSha: 'deadbeef',
        imageDigests: [digest],
      }),
    ).toBe(false);
  });
});
