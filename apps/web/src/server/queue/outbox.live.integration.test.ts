/**
 * Outbox durability tests against real Postgres.
 * Isolated synthetic fixtures — does not wipe the whole database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { setRlsContext } from '@/server/db/tenant-context';
import { describePrismaError, formatLiveError } from '@/server/live/live-diagnostics';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';

const databaseUrl = (() => {
  try {
    return requireTestDatabaseUrl();
  } catch {
    return null;
  }
})();

type OutboxFixture = {
  tenantId: string;
  projectId: string;
  userId: string;
};

async function readSessionGucs(tx: {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}): Promise<{ role: string; tenant: string; bypass: string }> {
  const rows = await tx.$queryRaw<
    { role: string; tenant: string; bypass: string }[]
  >`SELECT current_user AS role,
           coalesce(current_setting('app.current_tenant_id', true), '') AS tenant,
           coalesce(current_setting('app.bypass_rls', true), 'off') AS bypass`;
  return rows[0] ?? { role: 'unknown', tenant: '', bypass: 'off' };
}

async function bootstrapOutboxFixture(prisma: PrismaClient): Promise<OutboxFixture> {
  const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    const user = await tx.user.create({
      data: {
        email: `outbox-${stamp}@live-test.example`,
        name: 'Outbox Live',
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    const tenant = await tx.tenant.create({
      data: { name: `Outbox ${stamp}`, slug: `outbox-${stamp}`.slice(0, 64) },
    });
    const project = await tx.project.create({
      data: {
        tenantId: tenant.id,
        name: `Outbox Project ${stamp}`,
        code: `OB-${stamp}`.slice(0, 32),
        countryCode: 'AE',
        defaultCurrency: 'AED',
        timezone: 'Asia/Dubai',
        status: 'ACTIVE',
      },
    });
    return { tenantId: tenant.id, projectId: project.id, userId: user.id };
  });
}

function failWithDiagnostics(
  stage: string,
  error: unknown,
  fixture: OutboxFixture,
  gucs?: { role: string; tenant: string; bypass: string },
): never {
  const diagnostic = {
    stage,
    fixture,
    gucs,
    prisma: describePrismaError(error),
  };
  console.error('[outbox-live-failure]', JSON.stringify(diagnostic));
  const err = new Error(formatLiveError(error, stage));
  (err as Error & { cause?: unknown }).cause = error;
  throw err;
}

describe('outbox transactional durability', () => {
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : null;
  let enabled = false;

  beforeAll(async () => {
    try {
      requireLiveServices('postgres-outbox', Boolean(databaseUrl && prisma));
      if (!prisma) return;
      await prisma.$connect();
      enabled = true;
    } catch (error) {
      if (isLiveSkip(error)) {
        enabled = false;
        return;
      }
      throw new Error(formatLiveError(error, 'outbox-beforeAll'), { cause: error });
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('rollback removes business row and outbox event written in the same transaction', async ({
    skip,
  }) => {
    if (!enabled || !prisma) skip();
    const fixture = await bootstrapOutboxFixture(prisma!);
    const runId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    let businessEventId = '';
    let gucs: { role: string; tenant: string; bypass: string } | undefined;

    try {
      await prisma!.$transaction(async (tx) => {
        await setRlsContext(tx, {
          tenantId: fixture.tenantId,
          userId: fixture.userId,
          bypass: false,
        });
        gucs = await readSessionGucs(tx);
        const business = await tx.ingestionEvent.create({
          data: {
            tenantId: fixture.tenantId,
            projectId: fixture.projectId,
            eventType: 'outbox.rollback_probe',
            correlationId,
            metadata: { stage: 'pre-outbox' },
          },
        });
        businessEventId = business.id;
        await writeProcessDocumentOutbox(tx, {
          tenantId: fixture.tenantId,
          projectId: fixture.projectId,
          processingRunId: runId,
          documentVersionId: crypto.randomUUID(),
          correlationId,
        });
        throw new Error('FORCE_ROLLBACK');
      });
      throw new Error('expected FORCE_ROLLBACK');
    } catch (error) {
      if (!(error instanceof Error) || !/FORCE_ROLLBACK/.test(error.message)) {
        failWithDiagnostics('outbox-rollback-write', error, fixture, gucs);
      }
    }

    const counts = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const outbox = await tx.outboxEvent.count({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
      const business = await tx.ingestionEvent.count({
        where: { id: businessEventId || '00000000-0000-4000-8000-000000000000' },
      });
      return { outbox, business };
    });
    expect(counts.outbox).toBe(0);
    expect(counts.business).toBe(0);
  });

  it('committed mutation creates a pending outbox event with id-only payload', async ({ skip }) => {
    if (!enabled || !prisma) skip();
    const fixture = await bootstrapOutboxFixture(prisma!);
    const runId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    let businessEventId = '';
    let gucs: { role: string; tenant: string; bypass: string } | undefined;

    try {
      await prisma!.$transaction(async (tx) => {
        await setRlsContext(tx, {
          tenantId: fixture.tenantId,
          userId: fixture.userId,
          bypass: false,
        });
        gucs = await readSessionGucs(tx);
        const business = await tx.ingestionEvent.create({
          data: {
            tenantId: fixture.tenantId,
            projectId: fixture.projectId,
            eventType: 'outbox.commit_probe',
            correlationId,
            metadata: { stage: 'with-outbox' },
          },
        });
        businessEventId = business.id;
        await writeProcessDocumentOutbox(tx, {
          tenantId: fixture.tenantId,
          projectId: fixture.projectId,
          processingRunId: runId,
          documentVersionId: versionId,
          correlationId,
        });
      });
    } catch (error) {
      failWithDiagnostics('outbox-commit-write', error, fixture, gucs);
    }

    const result = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const event = await tx.outboxEvent.findUnique({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
      const business = await tx.ingestionEvent.findUnique({ where: { id: businessEventId } });
      const duplicates = await tx.outboxEvent.count({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
      return { event, business, duplicates };
    });

    expect(result.business?.id).toBe(businessEventId);
    expect(result.duplicates).toBe(1);
    expect(result.event?.status).toBe('PENDING');
    expect(result.event?.tenantId).toBe(fixture.tenantId);
    expect(result.event?.projectId).toBe(fixture.projectId);
    expect(result.event?.payload).toMatchObject({
      processingRunId: runId,
      documentVersionId: versionId,
      correlationId,
    });
    expect(JSON.stringify(result.event?.payload)).not.toMatch(/password|minioadmin|Bearer|secret/i);
  });
});
