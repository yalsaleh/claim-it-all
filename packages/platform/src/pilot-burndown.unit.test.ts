import { describe, expect, it } from 'vitest';
import { evaluatePilotBurndown } from './pilot-burndown';

describe('pilot burndown', () => {
  it('blocks FIX_BEFORE_PILOT active exceptions', () => {
    const result = evaluatePilotBurndown([
      {
        id: 'EXC-X',
        advisoryId: '1',
        package: 'x',
        severity: 'high',
        classification: 'runtime',
        status: 'active',
        expiresAt: '2099-01-01',
        burndownClass: 'FIX_BEFORE_PILOT',
      },
    ]);
    expect(result.status).toBe('BLOCKED');
  });

  it('blocks UPSTREAM_BLOCKED without pilot decision unless synthetic', () => {
    const ex = {
      id: 'EXC-2026-005',
      advisoryId: '1124066',
      package: 'sharp',
      severity: 'high',
      classification: 'runtime',
      status: 'active' as const,
      expiresAt: '2099-01-01',
      burndownClass: 'UPSTREAM_BLOCKED' as const,
      pilotDecisionStatus: 'PENDING',
    };
    expect(evaluatePilotBurndown([ex]).status).toBe('BLOCKED');
    expect(evaluatePilotBurndown([ex], { synthetic: true }).status).toBe(
      'PASS_WITH_APPROVED_EXCEPTIONS',
    );
  });

  it('accepts DEV_ONLY_ACCEPT_TEMPORARILY with exceptions status', () => {
    const result = evaluatePilotBurndown([
      {
        id: 'EXC-2026-001',
        advisoryId: '1120126',
        package: 'vitest',
        severity: 'critical',
        classification: 'development',
        status: 'active',
        expiresAt: '2099-01-01',
        burndownClass: 'DEV_ONLY_ACCEPT_TEMPORARILY',
      },
    ]);
    expect(result.status).toBe('PASS_WITH_APPROVED_EXCEPTIONS');
  });
});
