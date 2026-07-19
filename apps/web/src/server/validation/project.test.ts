import { describe, expect, it } from 'vitest';
import {
  AddProjectMemberInputSchema,
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
} from './project';

describe('CreateProjectInputSchema', () => {
  it('accepts valid project input', () => {
    const parsed = CreateProjectInputSchema.parse({
      name: 'Gulf Crossing Interchange',
      code: 'GCI-01',
      countryCode: 'KW',
      defaultCurrency: 'KWD',
      timezone: 'Asia/Kuwait',
    });
    expect(parsed.code).toBe('GCI-01');
  });

  it('rejects client-provided tenantId via strict mode', () => {
    const result = CreateProjectInputSchema.safeParse({
      name: 'Gulf Crossing Interchange',
      code: 'GCI-01',
      countryCode: 'KW',
      defaultCurrency: 'KWD',
      timezone: 'Asia/Kuwait',
      tenantId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateProjectInputSchema', () => {
  it('rejects empty updates', () => {
    expect(UpdateProjectInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('AddProjectMemberInputSchema', () => {
  it('accepts project roles', () => {
    const parsed = AddProjectMemberInputSchema.parse({
      userId: 'cluser000000000000000000001',
      role: 'REVIEWER',
    });
    expect(parsed.role).toBe('REVIEWER');
  });
});
