import { z } from 'zod';

/**
 * Stable internal citation for future entitlement findings.
 * Must not depend on frontend URLs. Resolves via IDs + locator JSON.
 */
export const EvidenceLocatorSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    kind: z.enum([
      'page',
      'paragraph',
      'section',
      'email_header',
      'email_body',
      'attachment',
      'spreadsheet_sheet',
      'spreadsheet_range',
      'schedule_activity',
      'metadata_field',
      'line_chunk',
      'other',
    ]),
    pageNumber: z.number().int().positive().optional(),
    charStart: z.number().int().nonnegative().optional(),
    charEnd: z.number().int().nonnegative().optional(),
    sheetName: z.string().max(256).optional(),
    cellRange: z.string().max(64).optional(),
    boundingBox: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        unit: z.enum(['pt', 'px', 'normalized']).default('pt'),
      })
      .optional(),
    label: z.string().max(512).optional(),
  })
  .strict();

export const EvidenceReferenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
    sourceDocumentId: z.string().uuid(),
    documentVersionId: z.string().uuid(),
    processingRunId: z.string().uuid(),
    artifactId: z.string().uuid().optional(),
    evidenceSegmentId: z.string().uuid().optional(),
    locator: EvidenceLocatorSchema.optional(),
    selectedTextSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    /** Short quote only — never store large uncontrolled excerpts on findings. */
    quotedText: z.string().max(2000).optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export function parseEvidenceReference(input: unknown): EvidenceReference {
  return EvidenceReferenceSchema.parse(input);
}
