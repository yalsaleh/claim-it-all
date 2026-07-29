import type { ConnectorScopeRules } from './types';

/** Simple glob-like pattern: * matches any substring. */
export function matchesPattern(pattern: string, value: string): boolean {
  const normalized = value.toLowerCase();
  const p = pattern.toLowerCase();
  if (p === '*') return true;
  if (!p.includes('*')) return normalized === p || normalized.includes(p);
  const parts = p.split('*').filter(Boolean);
  if (parts.length === 0) return true;
  let cursor = 0;
  for (const part of parts) {
    const idx = normalized.indexOf(part, cursor);
    if (idx === -1) return false;
    cursor = idx + part.length;
  }
  return true;
}

export function matchesAnyPattern(patterns: string[], value: string): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((p) => matchesPattern(p, value));
}

/** Include wins when non-empty; exclude always blocks. Empty include = accept all (after exclude). */
export function matchesIncludeExclude(
  includePatterns: string[],
  excludePatterns: string[],
  value: string,
): boolean {
  if (matchesAnyPattern(excludePatterns, value)) return false;
  if (includePatterns.length === 0) return true;
  return matchesAnyPattern(includePatterns, value);
}

export function isWithinDateRange(
  value: string | Date,
  dateFrom: string | null,
  dateTo: string | null,
): boolean {
  const ts = typeof value === 'string' ? Date.parse(value) : value.getTime();
  if (Number.isNaN(ts)) return false;
  if (dateFrom) {
    const from = Date.parse(dateFrom);
    if (!Number.isNaN(from) && ts < from) return false;
  }
  if (dateTo) {
    const to = Date.parse(dateTo);
    if (!Number.isNaN(to) && ts > to) return false;
  }
  return true;
}

export function extractProjectReferences(text: string): string[] {
  const refs = new Set<string>();
  const patterns = [
    /\b((?:PRJ|PROJECT|JOB|REF)[-_:][A-Z0-9][A-Z0-9-]{1,})\b/gi,
    /\b(?:contract|agreement)\s*(?:no|#|number)?\.?\s*([A-Z0-9][A-Z0-9/-]{2,})\b/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      if (m[1]) refs.add(m[1].toUpperCase());
    }
  }
  return [...refs];
}

export function matchesProjectReference(patterns: string[], references: string[]): boolean {
  if (patterns.length === 0) return true;
  if (references.length === 0) return false;
  return references.some((ref) => matchesAnyPattern(patterns, ref));
}

export function normalizeMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  return mimeType.split(';')[0]?.trim().toLowerCase() ?? null;
}

export function isMimeAllowed(mimeType: string | null | undefined, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return false;
  return allowlist.some((allowed) => {
    const a = allowed.toLowerCase();
    if (a.endsWith('/*')) {
      const prefix = a.slice(0, -1);
      return normalized.startsWith(prefix);
    }
    return normalized === a;
  });
}

export type ScopeMatchInput = {
  subjectOrTitle: string;
  bodyPreview?: string | null;
  modifiedAt: string;
  mimeType?: string | null;
  projectReferences?: string[];
};

export function recordMatchesScope(
  rules: ConnectorScopeRules,
  input: ScopeMatchInput,
): { ok: true } | { ok: false; reason: string } {
  const haystack = [input.subjectOrTitle, input.bodyPreview ?? ''].filter(Boolean).join('\n');
  if (!matchesIncludeExclude(rules.includePatterns, rules.excludePatterns, haystack)) {
    return { ok: false, reason: 'INCLUDE_EXCLUDE_MISMATCH' };
  }
  if (!isWithinDateRange(input.modifiedAt, rules.dateFrom, rules.dateTo)) {
    return { ok: false, reason: 'DATE_OUT_OF_RANGE' };
  }
  const refs =
    input.projectReferences && input.projectReferences.length > 0
      ? input.projectReferences
      : extractProjectReferences(haystack);
  if (!matchesProjectReference(rules.projectReferencePatterns, refs)) {
    return { ok: false, reason: 'PROJECT_REFERENCE_MISMATCH' };
  }
  if (!isMimeAllowed(input.mimeType ?? null, rules.mimeAllowlist)) {
    return { ok: false, reason: 'MIME_NOT_ALLOWED' };
  }
  return { ok: true };
}
