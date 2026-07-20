import { PHRASE_PATTERNS } from './patterns';
import {
  DETECTOR_RULESET_VERSION,
  quoteChecksum,
  type Detector,
  type DetectorFinding,
  type DetectorInput,
  type EvidenceSegmentInput,
} from './types';

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
const RELATIVE_YESTERDAY = /\byesterday\b/i;
const RELATIVE_TODAY = /\btoday\b/i;
const ARABIC_YESTERDAY = /أمس/;

function boundedQuote(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + matchLength + 80);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 500);
}

function resolveRelativeDate(
  segment: EvidenceSegmentInput,
  kind: 'yesterday' | 'today',
): { value: string; precision: 'EXACT_DATE'; basis: string } | null {
  if (!segment.sourceTimestamp) return null;
  const base = new Date(segment.sourceTimestamp);
  if (Number.isNaN(base.getTime())) return null;
  const d = new Date(base);
  if (kind === 'yesterday') d.setUTCDate(d.getUTCDate() - 1);
  const iso = d.toISOString().slice(0, 10);
  return {
    value: `${iso}T00:00:00.000Z`,
    precision: 'EXACT_DATE',
    basis: `Relative "${kind}" resolved from reliable sourceTimestamp ${segment.sourceTimestamp}`,
  };
}

function extractExplicitDate(text: string): string | null {
  const m = text.match(ISO_DATE);
  return m?.[1] ?? null;
}

function buildFinding(input: {
  category: DetectorFinding['category'];
  subcategory: string | null;
  title: string;
  segment: EvidenceSegmentInput;
  quote: string;
  signals: string[];
  confidenceBand: DetectorFinding['confidenceBand'];
  facts: string[];
  inferences: string[];
  ambiguities: string[];
  contradictions: string[];
  missingEvidence: DetectorFinding['missingEvidence'];
  dateCandidates: DetectorFinding['dateCandidates'];
  confidenceExplanation: string;
  evidenceRole?: DetectorFinding['evidence'][number]['role'];
}): DetectorFinding {
  return {
    category: input.category,
    subcategory: input.subcategory,
    title: input.title,
    description: input.facts.join(' '),
    facts: input.facts,
    inferences: input.inferences,
    assumptions: [],
    ambiguities: input.ambiguities,
    contradictions: input.contradictions,
    missingEvidence: input.missingEvidence,
    evidence: [
      {
        segmentId: input.segment.id,
        role: input.evidenceRole ?? 'PRIMARY_SUPPORT',
        quote: input.quote,
        explanation: `Matched signals: ${input.signals.join(', ')}`,
      },
    ],
    dateCandidates: input.dateCandidates,
    confidenceBand: input.confidenceBand,
    confidenceExplanation: input.confidenceExplanation,
    matchedSignals: input.signals,
    rulesetVersion: DETECTOR_RULESET_VERSION,
  };
}

/**
 * Conservative multi-category phrase detector.
 * Does not assert entitlement, lateness without due basis, or legal foreseeability.
 */
export const phraseDetector: Detector = {
  id: 'phrase-detector-v1',
  category: 'LATE_DRAWING_OR_APPROVAL',
  rulesetVersion: DETECTOR_RULESET_VERSION,

  detect(input: DetectorInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];

    for (const segment of input.segments) {
      const text = segment.text;
      if (!text.trim()) continue;

      const hits = PHRASE_PATTERNS.map((p) => {
        const m = text.match(p.pattern);
        return m ? { pattern: p, match: m } : null;
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      if (hits.length === 0) continue;

      // Group hits by category
      const byCategory = new Map<string, typeof hits>();
      for (const hit of hits) {
        const key = hit.pattern.category;
        const list = byCategory.get(key) ?? [];
        list.push(hit);
        byCategory.set(key, list);
      }

      for (const [category, catHits] of byCategory) {
        const positives = catHits.filter((h) => h.pattern.polarity === 'POSITIVE');
        const negations = catHits.filter((h) => h.pattern.polarity === 'NEGATION');
        const disclosed = catHits.filter((h) => h.pattern.polarity === 'DISCLOSED');
        const contractor = catHits.filter((h) => h.pattern.polarity === 'CONTRACTOR_CAUSED');

        if (positives.length === 0) continue;

        // Clear negation / disclosed / contractor-caused → skip positive suggestion
        if (negations.length > 0 || disclosed.length > 0) {
          continue;
        }

        const primary = positives[0]!;
        const quote = boundedQuote(text, primary.match.index ?? 0, primary.match[0]?.length ?? 0);
        const signals = catHits.map((h) => h.pattern.signal);
        const subcategory = primary.pattern.subcategory;

        const missingEvidence: DetectorFinding['missingEvidence'] = [];
        const ambiguities: string[] = [];
        const contradictions: string[] = [];
        const inferences: string[] = [];
        const dateCandidates: DetectorFinding['dateCandidates'] = [];
        let confidenceBand: DetectorFinding['confidenceBand'] = 'LOW';

        if (contractor.length > 0) {
          contradictions.push(
            'Text also suggests contractor-internal or safety-driven stoppage; employer responsibility is not assumed.',
          );
          confidenceBand = 'LOW';
        }

        // Relative dates
        if (RELATIVE_YESTERDAY.test(text) || ARABIC_YESTERDAY.test(text)) {
          const resolved = resolveRelativeDate(segment, 'yesterday');
          if (resolved) {
            dateCandidates.push({
              dateType:
                category === 'SUSPENSION_OR_RESTRICTED_ACCESS'
                  ? 'ACCESS_DENIAL_DATE'
                  : 'OCCURRENCE_DATE',
              suggestedValue: resolved.value,
              timezone: segment.sourceTimezone ?? null,
              precision: resolved.precision,
              basis: resolved.basis,
              ambiguity: null,
              segmentId: segment.id,
              extractionText: 'yesterday / أمس',
            });
            confidenceBand = 'MEDIUM';
          } else {
            ambiguities.push(
              'Relative date ("yesterday") could not be resolved — source timestamp missing or unreliable.',
            );
            dateCandidates.push({
              dateType: 'OCCURRENCE_DATE',
              suggestedValue: null,
              timezone: null,
              precision: 'UNKNOWN',
              basis: 'Unresolved relative date',
              ambiguity: 'Source timestamp required',
              segmentId: segment.id,
              extractionText: 'yesterday',
            });
          }
        } else if (RELATIVE_TODAY.test(text)) {
          const resolved = resolveRelativeDate(segment, 'today');
          if (resolved) {
            dateCandidates.push({
              dateType: 'OCCURRENCE_DATE',
              suggestedValue: resolved.value,
              timezone: segment.sourceTimezone ?? null,
              precision: resolved.precision,
              basis: resolved.basis,
              ambiguity: null,
              segmentId: segment.id,
              extractionText: 'today',
            });
          }
        }

        const explicit = extractExplicitDate(text);
        if (explicit) {
          dateCandidates.push({
            dateType: category === 'DELAYED_PAYMENT' ? 'PAYMENT_DUE_DATE' : 'OCCURRENCE_DATE',
            suggestedValue: null,
            timezone: segment.sourceTimezone ?? null,
            precision: 'EXACT_DATE',
            basis: `Explicit date token in text: ${explicit} (not auto-normalized to ISO without review)`,
            ambiguity: 'Token requires human normalization to project timezone',
            segmentId: segment.id,
            extractionText: explicit,
          });
          if (confidenceBand === 'LOW') confidenceBand = 'MEDIUM';
        }

        // Category-specific missing evidence / lateness gates
        if (category === 'LATE_DRAWING_OR_APPROVAL') {
          const hasDueSignal = signals.includes('explicit_due_date');
          if (!hasDueSignal) {
            missingEvidence.push({
              code: 'NO_DUE_DATE',
              description: 'No verified contractual or promised due date found in evidence.',
              whyItMatters: 'Lateness cannot be asserted without an expected date basis.',
              suggestedSourceType: 'ENGINEER_INSTRUCTION',
              priority: 'HIGH',
            });
            ambiguities.push('Candidate may indicate waiting, not proven lateness.');
            confidenceBand = 'LOW';
          }
          missingEvidence.push({
            code: 'NO_AFFECTED_ACTIVITY',
            description: 'Affected work / dependency not evidenced.',
            whyItMatters: 'Impact remains unproven.',
            suggestedSourceType: 'DAILY_REPORT',
            priority: 'MEDIUM',
          });
        }

        if (category === 'SUSPENSION_OR_RESTRICTED_ACCESS') {
          missingEvidence.push({
            code: 'NO_IDLE_RESOURCE_RECORD',
            description: 'No manpower/equipment idle record linked.',
            whyItMatters: 'Practical inability to proceed is incomplete without resource evidence.',
            suggestedSourceType: 'DAILY_REPORT',
            priority: 'MEDIUM',
          });
          inferences.push(
            'Suspension/access language detected; responsibility party is not concluded.',
          );
        }

        if (category === 'DELAYED_PAYMENT') {
          const hasDue = signals.includes('payment_due_date') || explicit;
          if (!hasDue) {
            missingEvidence.push({
              code: 'NO_PAYMENT_DUE_DATE',
              description: 'No payment due-date proof in evidence.',
              whyItMatters: 'Delayed payment cannot be asserted without a date basis.',
              suggestedSourceType: 'PAYMENT_CERTIFICATE',
              priority: 'HIGH',
            });
            confidenceBand = 'LOW';
          }
        }

        if (category === 'UNFORESEEN_SITE_CONDITION') {
          missingEvidence.push({
            code: 'NO_TENDER_COMPARISON',
            description: 'Tender/site investigation disclosure not checked.',
            whyItMatters: 'Condition may already have been disclosed.',
            suggestedSourceType: 'CONTRACT',
            priority: 'HIGH',
          });
          inferences.push(
            'Physical-condition language detected; legal foreseeability is not concluded.',
          );
        }

        if (category === 'SCOPE_CHANGE_OR_ADDITIONAL_WORK') {
          missingEvidence.push({
            code: 'NO_WRITTEN_INSTRUCTION',
            description: 'Formal variation/instruction document may be missing.',
            whyItMatters: 'Scope-change claims usually need written instruction evidence.',
            suggestedSourceType: 'ENGINEER_INSTRUCTION',
            priority: 'HIGH',
          });
        }

        const titlePrefix =
          category === 'LATE_DRAWING_OR_APPROVAL'
            ? 'Possible late drawing/approval'
            : category === 'SUSPENSION_OR_RESTRICTED_ACCESS'
              ? 'Possible suspension/access restriction'
              : category === 'SCOPE_CHANGE_OR_ADDITIONAL_WORK'
                ? 'Possible scope change/additional work'
                : category === 'DELAYED_PAYMENT'
                  ? 'Possible delayed payment'
                  : 'Possible unforeseen site condition';

        findings.push(
          buildFinding({
            category: category as DetectorFinding['category'],
            subcategory,
            title: `${titlePrefix} — ${segment.documentType}`,
            segment,
            quote,
            signals,
            confidenceBand,
            facts: [
              `Source segment ${segment.id} contains language consistent with ${category}.`,
              `Quote checksum ${quoteChecksum(quote)}.`,
            ],
            inferences,
            ambiguities,
            contradictions,
            missingEvidence,
            dateCandidates,
            confidenceExplanation:
              confidenceBand === 'MEDIUM'
                ? 'Clear language match with partial date or due-date support.'
                : 'Language match only; critical proof gaps remain. Detection confidence ≠ entitlement strength.',
          }),
        );
      }
    }

    return findings;
  },
};

export function runAllDetectors(input: DetectorInput): DetectorFinding[] {
  return phraseDetector.detect(input);
}

export function scoreDuplicateCandidates(
  a: Pick<DetectorFinding, 'category' | 'dateCandidates' | 'evidence' | 'title'>,
  b: Pick<DetectorFinding, 'category' | 'dateCandidates' | 'evidence' | 'title'>,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (a.category === b.category) {
    score += 0.4;
    reasons.push('same_category');
  }
  const aSeg = new Set(a.evidence.map((e) => e.segmentId));
  const shared = b.evidence.filter((e) => aSeg.has(e.segmentId)).length;
  if (shared > 0) {
    score += 0.4;
    reasons.push('shared_evidence');
  }
  const aDate = a.dateCandidates.find((d) => d.suggestedValue)?.suggestedValue?.slice(0, 10);
  const bDate = b.dateCandidates.find((d) => d.suggestedValue)?.suggestedValue?.slice(0, 10);
  if (aDate && bDate && aDate === bDate) {
    score += 0.2;
    reasons.push('same_date');
  }
  return { score: Math.min(1, score), reasons };
}
