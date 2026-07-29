import { z } from 'zod';
import { NOTICE_SECTION_TYPES } from './types';

/** Strict structured output for AI-assisted notice drafting. */

export const AiDraftSectionSchema = z.object({
  sectionType: z.enum(NOTICE_SECTION_TYPES),
  draftedText: z.string().trim().min(1).max(8000),
  sourceFactIds: z.array(z.string().uuid()).max(50),
  sourceEvidenceIds: z.array(z.string().uuid()).max(50),
  sourceClauseIds: z.array(z.string().uuid()).max(20),
  warnings: z.array(z.string().max(500)).max(20).default([]),
  unsupportedContentFlags: z.array(z.string().max(200)).max(20).default([]),
});

export const AiDraftResponseSchema = z.object({
  language: z.enum(['en', 'ar']),
  sections: z.array(AiDraftSectionSchema).min(1).max(30),
  overallWarnings: z.array(z.string().max(500)).max(30).default([]),
});

export type AiDraftResponse = z.infer<typeof AiDraftResponseSchema>;

const FORBIDDEN_PATTERNS: Array<{ code: string; re: RegExp }> = [
  {
    code: 'LEGAL_CONCLUSION',
    re: /\b(you\s+will\s+win|guaranteed\s+entitlement|certain\s+to\s+succeed)\b/i,
  },
  { code: 'INTERNAL_COMMENT', re: /\[INTERNAL\]|INTERNAL\s+ONLY|DO\s+NOT\s+EXPORT/i },
  {
    code: 'CHAIN_OF_THOUGHT',
    re: /\b(chain[- ]of[- ]thought|let\s+me\s+think\s+step\s+by\s+step)\b/i,
  },
];

export type AiValidationInput = {
  response: unknown;
  allowedFactIds: Set<string>;
  allowedEvidenceIds: Set<string>;
  allowedClauseIds: Set<string>;
  approvedDeadlineIso: string | null;
  approvedFactValuesByType: Map<string, string>;
  maxSectionChars?: number;
};

export type AiValidationResult =
  | { ok: true; data: AiDraftResponse; warnings: string[] }
  | { ok: false; errors: string[] };

export function validateAiDraftOutput(input: AiValidationInput): AiValidationResult {
  const parsed = AiDraftResponseSchema.safeParse(input.response);
  if (!parsed.success) {
    return {
      ok: false,
      errors: ['MALFORMED_AI_OUTPUT', ...parsed.error.issues.map((i) => i.message)],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [...parsed.data.overallWarnings];
  const maxChars = input.maxSectionChars ?? 8000;

  for (const section of parsed.data.sections) {
    if (section.draftedText.length > maxChars) {
      errors.push('SECTION_TOO_LONG');
    }
    for (const id of section.sourceFactIds) {
      if (!input.allowedFactIds.has(id)) errors.push(`UNKNOWN_FACT:${id}`);
    }
    for (const id of section.sourceEvidenceIds) {
      if (!input.allowedEvidenceIds.has(id)) errors.push(`UNKNOWN_EVIDENCE:${id}`);
    }
    for (const id of section.sourceClauseIds) {
      if (!input.allowedClauseIds.has(id)) errors.push(`UNKNOWN_CLAUSE:${id}`);
    }
    if (section.unsupportedContentFlags.length > 0) {
      errors.push(`UNSUPPORTED_CONTENT:${section.unsupportedContentFlags.join(',')}`);
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.re.test(section.draftedText)) {
        errors.push(pattern.code);
      }
    }
    // Reject invented dates that contradict approved EVENT_DATE / deadline facts.
    const eventDate = input.approvedFactValuesByType.get('EVENT_DATE');
    if (eventDate && /\b\d{4}-\d{2}-\d{2}\b/.test(section.draftedText)) {
      const dates = section.draftedText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
      for (const d of dates) {
        if (
          d !== eventDate.slice(0, 10) &&
          input.approvedDeadlineIso &&
          d !== input.approvedDeadlineIso.slice(0, 10)
        ) {
          const known = new Set(
            [...input.approvedFactValuesByType.values()].map((v) => v.slice(0, 10)),
          );
          if (input.approvedDeadlineIso) known.add(input.approvedDeadlineIso.slice(0, 10));
          if (!known.has(d)) errors.push(`INVENTED_DATE:${d}`);
        }
      }
    }
    if (
      (input.approvedDeadlineIso && /deadline/i.test(section.sectionType)) ||
      section.sectionType === 'DEADLINE_STATEMENT'
    ) {
      const deadlineDay = input.approvedDeadlineIso?.slice(0, 10);
      if (deadlineDay && /\b\d{4}-\d{2}-\d{2}\b/.test(section.draftedText)) {
        const dates = section.draftedText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
        for (const d of dates) {
          if (d !== deadlineDay) errors.push(`DEADLINE_MISMATCH:${d}`);
        }
      }
    }
    warnings.push(...section.warnings);
  }

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, data: parsed.data, warnings: [...new Set(warnings)] };
}
