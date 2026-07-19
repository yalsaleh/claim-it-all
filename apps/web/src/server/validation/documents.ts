import { z } from 'zod';

export const InitiateUploadSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  documentType: z.enum([
    'CONTRACT',
    'CONTRACT_AMENDMENT',
    'LETTER',
    'EMAIL',
    'RFI',
    'ENGINEER_INSTRUCTION',
    'SITE_INSTRUCTION',
    'DRAWING',
    'MEETING_MINUTES',
    'DAILY_REPORT',
    'PAYMENT_CERTIFICATE',
    'PAYMENT_APPLICATION',
    'VARIATION',
    'SCHEDULE',
    'COST_RECORD',
    'PHOTOGRAPH',
    'SPREADSHEET',
    'OTHER',
  ]),
  filename: z.string().min(1).max(512),
  declaredMediaType: z.string().min(1).max(200),
  declaredSizeBytes: z.number().int().positive(),
  documentNumber: z.string().max(120).optional(),
  correspondenceDate: z.string().datetime().optional(),
  language: z.enum(['EN', 'AR', 'MIXED', 'UNKNOWN']).default('UNKNOWN'),
  confidentiality: z.enum(['STANDARD', 'CONFIDENTIAL', 'RESTRICTED']).default('STANDARD'),
  description: z.string().max(4000).optional(),
  expectedSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  /** When linking exact duplicate content to a new logical document occurrence. */
  linkDuplicateOfVersionId: z.string().uuid().optional(),
});

export const CompleteUploadSchema = z.object({
  uploadSessionId: z.string().uuid(),
  clientSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  duplicateDecision: z.enum(['cancel', 'new_occurrence', 'new_version']).optional(),
});

export const CancelUploadSchema = z.object({
  uploadSessionId: z.string().uuid(),
});

export const UpdateDocumentMetadataSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  documentNumber: z.string().max(120).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  correspondenceDate: z.string().datetime().nullable().optional(),
  language: z.enum(['EN', 'AR', 'MIXED', 'UNKNOWN']).optional(),
  confidentiality: z.enum(['STANDARD', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
  documentType: InitiateUploadSchema.shape.documentType.optional(),
});

export const ListDocumentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
