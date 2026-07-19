import { z } from 'zod';

/** Job payload enqueued by web → consumed by document-intelligence ARQ workers. */
export const ProcessDocumentJobSchema = z
  .object({
    jobName: z.literal('process_document_version'),
    processingRunId: z.string().uuid(),
    documentVersionId: z.string().uuid(),
    correlationId: z.string().min(8).max(128),
  })
  .strict();

export type ProcessDocumentJob = z.infer<typeof ProcessDocumentJobSchema>;

export const SUPPORTED_UPLOAD_MEDIA_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'message/rfc822',
  'application/xml',
  'text/xml',
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const;

export type SupportedUploadMediaType = (typeof SUPPORTED_UPLOAD_MEDIA_TYPES)[number];

export const EXTENSION_MEDIA_TYPE: Record<string, SupportedUploadMediaType> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  eml: 'message/rfc822',
  xml: 'application/xml',
  xer: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** Default resource limits (overridable via env). */
export const DEFAULT_INGESTION_LIMITS = {
  maxUploadBytes: 50 * 1024 * 1024,
  maxActiveUploadsPerUser: 10,
  maxActiveUploadsPerProject: 50,
  uploadSessionTtlSeconds: 15 * 60,
  downloadUrlTtlSeconds: 5 * 60,
  maxPdfPages: 500,
  maxWorkbookCells: 500_000,
  maxCsvBytes: 20 * 1024 * 1024,
  maxTextBytes: 10 * 1024 * 1024,
} as const;
