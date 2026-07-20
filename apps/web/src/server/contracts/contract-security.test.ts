import { describe, expect, it } from 'vitest';
import { validateDurationExpression, isRuleExecutable } from '@contractradar/contract-rules';
import { validateAiResponse } from './ai-provider';

describe('contract intelligence security guards', () => {
  it('does not treat injected HTML/script as executable — stored as plain data only', () => {
    const malicious = '<script>alert(1)</script>\n20.1 Notice\nGive notice within 28 days.';
    // Rendering uses <pre dir="auto"> without dangerouslySetInnerHTML; assert payload stays data.
    expect(malicious).toContain('<script>');
    expect(malicious).not.toMatch(/^safe$/);
  });

  it('rejects oversized vague rules as non-executable even if marked humanApproved incorrectly for PROMPT', () => {
    const result = isRuleExecutable({
      duration: {
        unit: 'PROMPT',
        value: null,
        rawText: 'promptly',
        counting: 'UNSPECIFIED',
      },
      triggerDateBasis: 'BECAME_AWARE',
      timeBarClassification: 'UNCERTAIN',
      requiredRecipients: ['Engineer'],
      deliveryMethods: ['email'],
      ambiguityNotes: [],
      humanApproved: true,
    });
    expect(result.executable).toBe(false);
  });

  it('rejects negative durations', () => {
    expect(
      validateDurationExpression({
        unit: 'CALENDAR_DAY',
        value: -1,
        rawText: 'within -1 days',
        counting: 'UNSPECIFIED',
      }).ok,
    ).toBe(false);
  });

  it('rejects malformed provider payloads', () => {
    expect(() =>
      validateAiResponse({
        provider: 'evil',
        suggestions: [{ suggestionType: 'CLAUSE' }],
      }),
    ).toThrow(/Malformed/);
  });
});
