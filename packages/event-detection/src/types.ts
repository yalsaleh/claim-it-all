/**
 * @contractradar/event-detection — pure deterministic detectors (ADR-049).
 * No DB, AI, authz, or file I/O.
 */

import { z } from 'zod';

export const DETECTOR_RULESET_VERSION = 'event-detection-ruleset-v1';

export const DetectionCategorySchema = z.enum([
  'LATE_DRAWING_OR_APPROVAL',
  'SUSPENSION_OR_RESTRICTED_ACCESS',
  'SCOPE_CHANGE_OR_ADDITIONAL_WORK',
  'DELAYED_PAYMENT',
  'UNFORESEEN_SITE_CONDITION',
]);
export type DetectionCategory = z.infer<typeof DetectionCategorySchema>;

export const ConfidenceBandSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;

export const EvidenceRoleSchema = z.enum([
  'PRIMARY_SUPPORT',
  'SUPPORTING',
  'DATE_SUPPORT',
  'PARTY_SUPPORT',
  'IMPACT_SUPPORT',
  'CONTRADICTING',
  'CONTEXT',
  'DUPLICATE_SIGNAL',
  'MISSING_EXPECTED_EVIDENCE',
]);
export type EvidenceRole = z.infer<typeof EvidenceRoleSchema>;

export const DateCandidateTypeSchema = z.enum([
  'OCCURRENCE_DATE',
  'AWARENESS_DATE',
  'INSTRUCTION_DATE',
  'RECEIPT_DATE',
  'ACCESS_DENIAL_DATE',
  'PAYMENT_DUE_DATE',
  'CERTIFICATE_DATE',
  'DISCOVERY_DATE',
  'CONTINUING_EVENT_START',
  'CONTINUING_EVENT_END',
  'CUSTOM',
]);

export const DatePrecisionSchema = z.enum([
  'EXACT_DATETIME',
  'EXACT_DATE',
  'APPROXIMATE_DATE',
  'DATE_RANGE',
  'UNKNOWN',
]);

export const EvidenceSegmentInputSchema = z.object({
  id: z.string().uuid(),
  documentVersionId: z.string().uuid(),
  sourceDocumentId: z.string().uuid().optional(),
  documentType: z.string(),
  text: z.string().max(50_000),
  language: z.enum(['EN', 'AR', 'MIXED', 'UNKNOWN']).optional(),
  /** ISO timestamp of the source record when reliable (email sentAt, letter date). */
  sourceTimestamp: z.string().datetime({ offset: true }).nullable().optional(),
  sourceTimezone: z.string().nullable().optional(),
});
export type EvidenceSegmentInput = z.infer<typeof EvidenceSegmentInputSchema>;

export const DetectorFindingSchema = z.object({
  category: DetectionCategorySchema,
  subcategory: z.string().nullable(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000),
  facts: z.array(z.string().max(1000)).max(20),
  inferences: z.array(z.string().max(1000)).max(20),
  assumptions: z.array(z.string().max(1000)).max(20),
  ambiguities: z.array(z.string().max(1000)).max(20),
  contradictions: z.array(z.string().max(1000)).max(20),
  missingEvidence: z.array(
    z.object({
      code: z.string(),
      description: z.string().max(1000),
      whyItMatters: z.string().max(1000),
      suggestedSourceType: z.string().nullable(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    }),
  ),
  evidence: z.array(
    z.object({
      segmentId: z.string().uuid(),
      role: EvidenceRoleSchema,
      quote: z.string().max(500),
      explanation: z.string().max(1000),
    }),
  ),
  dateCandidates: z.array(
    z.object({
      dateType: DateCandidateTypeSchema,
      suggestedValue: z.string().nullable(),
      timezone: z.string().nullable(),
      precision: DatePrecisionSchema,
      basis: z.string().max(1000),
      ambiguity: z.string().nullable(),
      segmentId: z.string().uuid().nullable(),
      extractionText: z.string().max(500).nullable(),
    }),
  ),
  confidenceBand: ConfidenceBandSchema,
  confidenceExplanation: z.string().max(2000),
  matchedSignals: z.array(z.string().max(200)).max(30),
  rulesetVersion: z.string(),
});
export type DetectorFinding = z.infer<typeof DetectorFindingSchema>;

export type DetectorInput = {
  segments: EvidenceSegmentInput[];
  /** Optional ISO date for "today" relative resolution in tests. */
  asOf?: string;
};

export type Detector = {
  readonly id: string;
  readonly category: DetectionCategory;
  readonly rulesetVersion: string;
  detect(input: DetectorInput): DetectorFinding[];
};

export function quoteChecksum(quote: string): string {
  // Lightweight stable checksum for tests/services (not cryptographic proof).
  let h = 0;
  for (let i = 0; i < quote.length; i += 1) {
    h = (Math.imul(31, h) + quote.charCodeAt(i)) | 0;
  }
  return `q${(h >>> 0).toString(16)}`;
}

export function mapDetectionCategoryToProjectEventCategory(
  category: DetectionCategory,
  subcategory: string | null,
): string {
  switch (category) {
    case 'LATE_DRAWING_OR_APPROVAL':
      return 'LATE_DRAWING_OR_APPROVAL';
    case 'SUSPENSION_OR_RESTRICTED_ACCESS':
      if (subcategory === 'RESTRICTED_ACCESS') return 'RESTRICTED_ACCESS';
      return 'SUSPENSION';
    case 'SCOPE_CHANGE_OR_ADDITIONAL_WORK':
      if (subcategory === 'ADDITIONAL_WORK') return 'ADDITIONAL_WORK';
      return 'SCOPE_CHANGE';
    case 'DELAYED_PAYMENT':
      return 'DELAYED_PAYMENT';
    case 'UNFORESEEN_SITE_CONDITION':
      return 'UNFORESEEN_SITE_CONDITION';
    default:
      return 'OTHER';
  }
}
