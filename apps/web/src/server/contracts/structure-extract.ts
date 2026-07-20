import { createHash } from 'node:crypto';
import { normalizeClauseNumber, parseCrossReferenceCandidate } from '@contractradar/contract-rules';
import { z } from 'zod';

/** Deterministic clause-boundary candidates from plain text (no LLM). */
export type ClauseCandidate = {
  clauseNumber: string | null;
  normalizedClauseNumber: string | null;
  heading: string | null;
  sourceText: string;
  textChecksum: string;
  level: number;
  sequence: number;
  extractionMethod: 'DETERMINISTIC';
  extractionConfidence: number;
};

const CLAUSE_LINE =
  /^(?:Clause|Sub-?Clause|Article)?\s*([0-9]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*)\s*(?:[–—:-]\s*|\s+)(.+)$/i;

export function extractClauseCandidatesFromText(text: string): ClauseCandidate[] {
  const lines = text.split(/\r?\n/);
  const candidates: ClauseCandidate[] = [];
  let buffer: { number: string | null; heading: string | null; body: string[] } | null = null;
  let sequence = 0;

  const flush = () => {
    if (!buffer) return;
    const sourceText = [buffer.heading, ...buffer.body].filter(Boolean).join('\n').trim();
    if (!sourceText) {
      buffer = null;
      return;
    }
    sequence += 1;
    const level = buffer.number ? buffer.number.split(/[.(]/).filter(Boolean).length : 1;
    candidates.push({
      clauseNumber: buffer.number,
      normalizedClauseNumber: normalizeClauseNumber(buffer.number),
      heading: buffer.heading,
      sourceText,
      textChecksum: createHash('sha256').update(sourceText).digest('hex'),
      level,
      sequence,
      extractionMethod: 'DETERMINISTIC',
      extractionConfidence: buffer.number ? 0.7 : 0.4,
    });
    buffer = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(CLAUSE_LINE);
    if (match) {
      flush();
      buffer = {
        number: match[1] ?? null,
        heading: (match[2] ?? '').trim() || null,
        body: [],
      };
      continue;
    }
    if (!buffer) {
      buffer = { number: null, heading: null, body: [line] };
    } else {
      buffer.body.push(line);
    }
  }
  flush();
  return candidates;
}

export const NoticeTimingProbeSchema = z.object({
  rawText: z.string().min(1),
});

export function probeNoticeTimingExpression(rawText: string): {
  durationUnit: 'CALENDAR_DAY' | 'PROMPT' | 'REASONABLE_TIME' | 'CUSTOM' | null;
  durationValue: number | null;
  vague: boolean;
} {
  const text = rawText.toLowerCase();
  if (/\bpromptly\b|\bimmediate(ly)?\b/.test(text)) {
    return { durationUnit: 'PROMPT', durationValue: null, vague: true };
  }
  if (/\breasonable\b/.test(text)) {
    return { durationUnit: 'REASONABLE_TIME', durationValue: null, vague: true };
  }
  const days = text.match(/\bwithin\s+(\d+)\s+(calendar\s+)?days?\b/);
  if (days) {
    return {
      durationUnit: 'CALENDAR_DAY',
      durationValue: Number(days[1]),
      vague: false,
    };
  }
  return { durationUnit: null, durationValue: null, vague: true };
}

const DEFINED_TERM_LINE =
  /^["“]?([A-Z][A-Za-z][A-Za-z ]{1,60})["”]?\s+means\b|^["“]?([^\s]{2,40})["”]?\s+يعني\b/u;

export function extractDefinedTermCandidates(text: string): Array<{
  term: string;
  definitionText: string;
  extractionMethod: 'DETERMINISTIC';
  extractionConfidence: number;
}> {
  const out: Array<{
    term: string;
    definitionText: string;
    extractionMethod: 'DETERMINISTIC';
    extractionConfidence: number;
  }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(DEFINED_TERM_LINE);
    if (!match) continue;
    const term = (match[1] ?? match[2] ?? '').trim();
    if (!term) continue;
    out.push({
      term,
      definitionText: line,
      extractionMethod: 'DETERMINISTIC',
      extractionConfidence: 0.55,
    });
  }
  return out;
}

export function extractPartyRoleCandidates(text: string): Array<{
  kind: 'PARTY' | 'ROLE';
  label: string;
  partyTypeHint: string | null;
  extractionMethod: 'DETERMINISTIC';
  extractionConfidence: number;
}> {
  const patterns: Array<{ re: RegExp; kind: 'PARTY' | 'ROLE'; label: string; hint: string }> = [
    { re: /\bthe Employer\b/i, kind: 'PARTY', label: 'Employer', hint: 'EMPLOYER' },
    { re: /\bthe Contractor\b/i, kind: 'PARTY', label: 'Contractor', hint: 'CONTRACTOR' },
    { re: /\bthe Engineer\b/i, kind: 'ROLE', label: 'Engineer', hint: 'ENGINEER' },
    { re: /صاحب العمل/, kind: 'PARTY', label: 'صاحب العمل', hint: 'EMPLOYER' },
    { re: /المقاول/, kind: 'PARTY', label: 'المقاول', hint: 'CONTRACTOR' },
  ];
  const seen = new Set<string>();
  const out: Array<{
    kind: 'PARTY' | 'ROLE';
    label: string;
    partyTypeHint: string | null;
    extractionMethod: 'DETERMINISTIC';
    extractionConfidence: number;
  }> = [];
  for (const p of patterns) {
    if (!p.re.test(text) || seen.has(p.label)) continue;
    seen.add(p.label);
    out.push({
      kind: p.kind,
      label: p.label,
      partyTypeHint: p.hint,
      extractionMethod: 'DETERMINISTIC',
      extractionConfidence: 0.5,
    });
  }
  return out;
}

export function extractCrossReferenceCandidates(text: string): Array<{
  rawReferenceText: string;
  normalizedTargetIdentifier: string | null;
  ambiguous: boolean;
  extractionMethod: 'DETERMINISTIC';
  extractionConfidence: number;
}> {
  const matches = text.matchAll(
    /(?:Sub-?Clause|Clause|Article|Appendix|Schedule)\s+[0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))*/gi,
  );
  const out: Array<{
    rawReferenceText: string;
    normalizedTargetIdentifier: string | null;
    ambiguous: boolean;
    extractionMethod: 'DETERMINISTIC';
    extractionConfidence: number;
  }> = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const raw = m[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    const parsed = parseCrossReferenceCandidate(raw);
    out.push({
      ...parsed,
      extractionMethod: 'DETERMINISTIC',
      extractionConfidence: parsed.ambiguous ? 0.3 : 0.6,
    });
  }
  return out;
}
