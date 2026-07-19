import type { Prisma } from '@prisma/client';
import type { DbClient } from '@/server/db/tenant-context';

export async function writeProcessDocumentOutbox(
  client: DbClient,
  input: {
    tenantId: string;
    projectId: string;
    processingRunId: string;
    documentVersionId: string;
    correlationId: string;
  },
): Promise<void> {
  const idempotencyKey = `process_document_version:${input.processingRunId}`;
  await client.outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      eventType: 'process_document_version',
      aggregateType: 'document_processing_run',
      aggregateId: input.processingRunId,
      payload: {
        processingRunId: input.processingRunId,
        documentVersionId: input.documentVersionId,
        correlationId: input.correlationId,
      } as Prisma.InputJsonValue,
      status: 'PENDING',
      idempotencyKey,
      correlationId: input.correlationId,
    },
  });
}
