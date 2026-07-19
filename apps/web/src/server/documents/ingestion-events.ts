import type { Prisma } from '@prisma/client';
import type { DbClient } from '@/server/db/tenant-context';

export async function writeIngestionEvent(
  client: DbClient,
  input: {
    tenantId: string;
    projectId: string;
    sourceDocumentId?: string | null;
    documentVersionId?: string | null;
    uploadSessionId?: string | null;
    processingRunId?: string | null;
    eventType: string;
    metadata?: Prisma.InputJsonValue;
    correlationId?: string | null;
  },
): Promise<void> {
  await client.ingestionEvent.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      sourceDocumentId: input.sourceDocumentId ?? null,
      documentVersionId: input.documentVersionId ?? null,
      uploadSessionId: input.uploadSessionId ?? null,
      processingRunId: input.processingRunId ?? null,
      eventType: input.eventType,
      metadata: input.metadata,
      correlationId: input.correlationId ?? null,
    },
  });
}
