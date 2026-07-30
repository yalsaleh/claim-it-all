import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';

const FORBIDDEN_METADATA_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'session',
];

function sanitizeMetadata(
  metadata: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | undefined {
  if (metadata === undefined || metadata === null) {
    return metadata;
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) =>
      sanitizeMetadata(item as Prisma.InputJsonValue),
    ) as Prisma.InputJsonValue;
  }

  if (typeof metadata === 'object') {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(metadata as Record<string, Prisma.InputJsonValue>)) {
      if (FORBIDDEN_METADATA_KEYS.some((blocked) => key.toLowerCase().includes(blocked))) {
        result[key] = '[redacted]';
        continue;
      }
      result[key] = sanitizeMetadata(value) as Prisma.InputJsonValue;
    }
    return result;
  }

  return metadata;
}

export type AuditWriteInput = {
  tenantId?: string | null;
  projectId?: string | null;
  actorUserId?: string | null;
  supportSessionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  correlationId?: string | null;
  previousHash?: string | null;
  integrityHash?: string | null;
  schemaVersion?: number;
};

export async function writeAuditLog(
  input: AuditWriteInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      projectId: input.projectId ?? null,
      actorUserId: input.actorUserId ?? null,
      supportSessionId: input.supportSessionId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: sanitizeMetadata(input.metadata),
      correlationId: input.correlationId ?? null,
      schemaVersion: input.schemaVersion ?? 1,
      previousHash: input.previousHash ?? null,
      integrityHash: input.integrityHash ?? null,
    },
  });
}
