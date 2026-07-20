import { z } from 'zod';
import { ConfidenceBandSchema, DetectionCategorySchema, EvidenceRoleSchema } from './types';

/**
 * Strict AI-assisted detection output schema (ADR-050).
 * Services must reject invented evidence IDs / unsupported categories.
 */
export const AiDetectionSuggestionSchema = z.object({
  category: DetectionCategorySchema,
  subcategory: z.string().max(100).nullable(),
  title: z.string().min(1).max(300),
  factualStatements: z.array(z.string().max(1000)).max(20),
  inferredStatements: z.array(z.string().max(1000)).max(20),
  evidenceSegmentIds: z.array(z.string().uuid()).min(1).max(20),
  evidenceRoles: z
    .array(
      z.object({
        segmentId: z.string().uuid(),
        role: EvidenceRoleSchema,
        quote: z.string().max(500),
      }),
    )
    .max(20),
  dateCandidates: z
    .array(
      z.object({
        dateType: z.string().max(64),
        suggestedValue: z.string().nullable(),
        precision: z.string().max(64),
        basis: z.string().max(1000),
        segmentId: z.string().uuid().nullable(),
      }),
    )
    .max(10),
  assumptions: z.array(z.string().max(1000)).max(20),
  contradictions: z.array(z.string().max(1000)).max(20),
  missingEvidence: z.array(z.string().max(1000)).max(20),
  candidateRuleSnapshotIds: z.array(z.string().uuid()).max(20),
  confidenceBand: ConfidenceBandSchema,
  rationale: z.string().max(2000),
});

export const AiDetectionResponseSchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().nullable(),
  promptSchemaVersion: z.string().min(1).max(100),
  suggestions: z.array(AiDetectionSuggestionSchema).max(50),
  testOnly: z.boolean().optional(),
});

export type AiDetectionResponse = z.infer<typeof AiDetectionResponseSchema>;
export type AiDetectionSuggestion = z.infer<typeof AiDetectionSuggestionSchema>;

export type AiValidationIssue = {
  code: string;
  message: string;
};

export function validateAiDetectionAgainstAllowlist(
  response: AiDetectionResponse,
  allowedSegmentIds: Set<string>,
  allowedRuleSnapshotIds: Set<string>,
): AiValidationIssue[] {
  const issues: AiValidationIssue[] = [];
  for (const suggestion of response.suggestions) {
    for (const id of suggestion.evidenceSegmentIds) {
      if (!allowedSegmentIds.has(id)) {
        issues.push({
          code: 'UNKNOWN_EVIDENCE_ID',
          message: `Suggestion references unauthorized or unknown evidence segment ${id}`,
        });
      }
    }
    for (const role of suggestion.evidenceRoles) {
      if (!allowedSegmentIds.has(role.segmentId)) {
        issues.push({
          code: 'UNKNOWN_EVIDENCE_ID',
          message: `Evidence role references unknown segment ${role.segmentId}`,
        });
      }
      if (/ignore (previous|system) instructions|you are now/i.test(role.quote)) {
        issues.push({
          code: 'PROMPT_INJECTION_CONTENT',
          message:
            'Quote appears to contain prompt-injection style instructions; treat as data only.',
        });
      }
    }
    for (const id of suggestion.candidateRuleSnapshotIds) {
      if (!allowedRuleSnapshotIds.has(id)) {
        issues.push({
          code: 'UNKNOWN_RULE_SNAPSHOT_ID',
          message: `Candidate rule snapshot ${id} is not in the active approved allowlist`,
        });
      }
    }
    if (/entitlement (exists|is certain)|legal success|will win/i.test(suggestion.rationale)) {
      issues.push({
        code: 'FORBIDDEN_LEGAL_CONCLUSION',
        message: 'Rationale contains forbidden entitlement/legal-success language',
      });
    }
  }
  return issues;
}
