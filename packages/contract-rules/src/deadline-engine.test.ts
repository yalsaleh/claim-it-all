import { describe, expect, it } from 'vitest';
import { calculateDeadline, compareCalculationResults } from './deadline-engine';

const baseRule = {
  durationUnit: 'CALENDAR_DAY' as const,
  durationValue: 7,
  counting: 'EXCLUSIVE' as const,
  startDateConvention: 'EXCLUDE_TRIGGER_DAY' as const,
  endDateConvention: 'END_OF_DAY' as const,
  nonWorkingAdjustment: 'NONE' as const,
  timeBarClassification: 'PROCEDURAL_DEADLINE' as const,
  ambiguityNotes: [] as string[],
  humanApproved: true,
  requiredRecipientsApproved: true,
};

const calendar = {
  timezone: 'Asia/Dubai',
  weekendDays: [5, 6], // Fri-Sat synthetic GCC-style week
  holidays: [] as string[],
  specialWorkingDays: [] as string[],
};

describe('deadline engine', () => {
  it('calculates seven calendar days after receipt (exclude trigger)', () => {
    const result = calculateDeadline({
      rule: baseRule,
      triggerDateIso: '2026-07-01T10:00:00+04:00',
      triggerPrecision: 'EXACT_DATETIME',
      calendar,
      internalWarningOffsetsDays: [3, 1],
    });
    expect(result.status).toBe('CALCULATED');
    expect(result.contractualDeadlineDate).toBe('2026-07-08');
    expect(result.trace.some((s) => s.operation === 'ADD_CALENDAR_DAYS')).toBe(true);
    expect(result.internalMilestones.every((m) => m.kind === 'INTERNAL')).toBe(true);
  });

  it('blocks promptly', () => {
    const result = calculateDeadline({
      rule: { ...baseRule, durationUnit: 'PROMPT', durationValue: null },
      triggerDateIso: '2026-07-01T10:00:00+04:00',
      triggerPrecision: 'EXACT_DATE',
      calendar,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockedReasons.some((r) => /PROMPT/.test(r))).toBe(true);
  });

  it('adds business days skipping synthetic weekend', () => {
    const result = calculateDeadline({
      rule: {
        ...baseRule,
        durationUnit: 'BUSINESS_DAY',
        durationValue: 5,
        nonWorkingAdjustment: 'NONE',
      },
      // Wednesday
      triggerDateIso: '2026-07-01T09:00:00+04:00',
      triggerPrecision: 'EXACT_DATETIME',
      calendar,
    });
    expect(result.status).toBe('CALCULATED');
    // Wed+5 business days with Fri-Sat weekend → next Wednesday 2026-07-08
    expect(result.contractualDeadlineDate).toBe('2026-07-08');
  });

  it('is reproducible', () => {
    const input = {
      rule: baseRule,
      triggerDateIso: '2026-07-01T10:00:00+04:00',
      triggerPrecision: 'EXACT_DATETIME' as const,
      calendar,
      internalWarningOffsetsDays: [7],
    };
    const a = calculateDeadline(input);
    const b = calculateDeadline(input);
    expect(compareCalculationResults(a, b).equal).toBe(true);
  });

  it('blocks unspecified counting', () => {
    const result = calculateDeadline({
      rule: { ...baseRule, counting: 'UNSPECIFIED' },
      triggerDateIso: '2026-07-01',
      triggerPrecision: 'EXACT_DATE',
      calendar,
    });
    expect(result.status).toBe('BLOCKED');
  });

  it('handles immediate without grace period', () => {
    const result = calculateDeadline({
      rule: {
        ...baseRule,
        durationUnit: 'IMMEDIATE',
        durationValue: null,
        counting: 'EXCLUSIVE',
      },
      triggerDateIso: '2026-07-01T12:00:00+04:00',
      triggerPrecision: 'EXACT_DATETIME',
      calendar,
    });
    expect(result.status).toBe('CALCULATED');
    expect(result.immediate).toBe(true);
    expect(result.contractualDeadlineAt).toContain('2026-07-01');
  });

  it('adjusts calendar deadline forward off weekend', () => {
    const result = calculateDeadline({
      rule: {
        ...baseRule,
        durationValue: 2,
        nonWorkingAdjustment: 'FORWARD',
      },
      // Thursday → +2 = Saturday → forward to Sunday? weekend Fri-Sat, so Sun
      triggerDateIso: '2026-07-02T10:00:00+04:00',
      triggerPrecision: 'EXACT_DATETIME',
      calendar,
    });
    expect(result.status).toBe('CALCULATED');
    expect(result.contractualDeadlineDate).toBe('2026-07-05');
  });
});
