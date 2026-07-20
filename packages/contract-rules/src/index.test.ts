import { describe, expect, it } from 'vitest';
import {
  isRuleExecutable,
  normalizeArabicIndicDigits,
  normalizeClauseNumber,
  parseCrossReferenceCandidate,
  validateDurationExpression,
} from './index';

describe('contract-rules', () => {
  it('rejects negative durations', () => {
    const result = validateDurationExpression({
      unit: 'CALENDAR_DAY',
      value: -1,
      rawText: '-1 days',
    });
    expect(result.ok).toBe(false);
  });

  it('preserves PROMPT as non-numeric', () => {
    const ok = validateDurationExpression({
      unit: 'PROMPT',
      value: null,
      rawText: 'promptly',
    });
    expect(ok.ok).toBe(true);
    const bad = validateDurationExpression({
      unit: 'PROMPT',
      value: 3,
      rawText: 'promptly',
    });
    expect(bad.ok).toBe(false);
  });

  it('requires approval and recipients before executable', () => {
    const result = isRuleExecutable({
      duration: { unit: 'CALENDAR_DAY', value: 28, rawText: '28 days' },
      triggerDateBasis: 'BECAME_AWARE',
      timeBarClassification: 'EXPRESS_TIME_BAR',
      requiredRecipients: [],
      deliveryMethods: ['email'],
      ambiguityNotes: [],
      humanApproved: false,
    });
    expect(result.executable).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/human-approved|recipient/i);
  });

  it('normalizes Arabic-Indic digits without inventing clause numbers', () => {
    expect(normalizeArabicIndicDigits('٢٠.١')).toBe('20.1');
    expect(normalizeClauseNumber('  20.1 (a) ')).toBe('20.1 (a)');
    expect(normalizeClauseNumber('')).toBeNull();
  });

  it('parses explicit cross-references and marks ambiguous ones', () => {
    const ok = parseCrossReferenceCandidate('see Sub-Clause 20.2');
    expect(ok.normalizedTargetIdentifier).toBe('20.2');
    expect(ok.ambiguous).toBe(false);
    const amb = parseCrossReferenceCandidate('as stated elsewhere');
    expect(amb.ambiguous).toBe(true);
  });
});
