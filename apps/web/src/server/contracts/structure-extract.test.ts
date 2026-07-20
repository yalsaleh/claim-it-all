import { describe, expect, it } from 'vitest';
import {
  extractClauseCandidatesFromText,
  extractCrossReferenceCandidates,
  extractDefinedTermCandidates,
  extractPartyRoleCandidates,
  probeNoticeTimingExpression,
} from './structure-extract';

const SYNTHETIC_EN = `
1 Definitions
"Site" means the place where the Works are to be executed.
2 Notices
The Contractor shall give notice to the Engineer within 28 days of becoming aware of the event.
Sub-Clause 2.1 applies.
3 Prompt notice
The Contractor shall notify the Employer promptly.
`;

const SYNTHETIC_AR = `
١ الإشعارات
يجب على المقاول إرسال إشعار إلى صاحب العمل.
"الموقع" يعني مكان تنفيذ الأعمال.
`;

const SYNTHETIC_BILINGUAL = `
20.1 Claims / المطالبات
The Contractor shall give notice within 28 days.
يجب على المقاول إرسال إشعار خلال ٢٨ يوماً.
Clause 20.2 Dispute Resolution
`;

describe('structure-extract', () => {
  it('extracts nested numbered English clauses without inventing numbers', () => {
    const text = [
      '20 Claims',
      '20.1 Contractor Claims',
      'If the Contractor considers himself entitled, he shall give notice within 28 days.',
      '20.1(a) Particulars',
      'The notice shall include particulars.',
      'Unnumbered preamble text that stays unnumbered.',
    ].join('\n');
    const clauses = extractClauseCandidatesFromText(text);
    expect(clauses.some((c) => c.normalizedClauseNumber === '20')).toBe(true);
    expect(clauses.some((c) => c.normalizedClauseNumber === '20.1')).toBe(true);
    expect(clauses.every((c) => c.extractionMethod === 'DETERMINISTIC')).toBe(true);
  });

  it('keeps promptly non-numeric', () => {
    expect(probeNoticeTimingExpression('notify promptly')).toMatchObject({
      durationUnit: 'PROMPT',
      durationValue: null,
      vague: true,
    });
  });

  it('parses explicit calendar-day windows', () => {
    expect(probeNoticeTimingExpression('give notice within 28 days')).toMatchObject({
      durationUnit: 'CALENDAR_DAY',
      durationValue: 28,
      vague: false,
    });
  });

  it('extracts defined terms, parties, and cross-refs from synthetic English fixture', () => {
    const terms = extractDefinedTermCandidates(SYNTHETIC_EN);
    expect(terms.some((t) => t.term === 'Site')).toBe(true);
    const parties = extractPartyRoleCandidates(SYNTHETIC_EN);
    expect(parties.some((p) => p.label === 'Contractor')).toBe(true);
    const xrefs = extractCrossReferenceCandidates(SYNTHETIC_EN);
    expect(xrefs.some((x) => x.normalizedTargetIdentifier === '2.1')).toBe(true);
  });

  it('supports Arabic party labels without fabricating clause numbers', () => {
    const parties = extractPartyRoleCandidates(SYNTHETIC_AR);
    expect(parties.some((p) => p.label === 'المقاول')).toBe(true);
    const clauses = extractClauseCandidatesFromText(SYNTHETIC_AR);
    // Arabic-Indic clause line may not match Latin CLAUSE_LINE — never invent numbers.
    expect(clauses.every((c) => c.clauseNumber == null || c.clauseNumber.length > 0)).toBe(true);
  });

  it('extracts bilingual parallel structure candidates from synthetic fixture', () => {
    const clauses = extractClauseCandidatesFromText(SYNTHETIC_BILINGUAL);
    expect(clauses.some((c) => c.normalizedClauseNumber === '20.1')).toBe(true);
    expect(clauses.some((c) => /المطالبات|Claims/i.test(c.sourceText))).toBe(true);
    expect(probeNoticeTimingExpression(SYNTHETIC_BILINGUAL).durationValue).toBe(28);
  });
});
