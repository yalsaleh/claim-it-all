/**
 * Outbox durability tests against real Postgres (+ optional Redis dispatch check).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { setRlsContext } from '@/server/db/tenant-context';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';

const databaseUrl = (() => {
  try {
    return requireTestDatabaseUrl();
  } catch {
    return null;
  }
})();

describe('outbox transactional durability', () => {
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : null;
  let enabled = false;
  let tenantId = '';
  let projectId = '';

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
      throw error;
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async ({ skip }) => {
    if (!enabled || !prisma) skip();
    await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.outboxEvent.deleteMany();
      await tx.ingestionEvent.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
      const stamp = Date.now();
      const tenant = await tx.tenant.create({ data: { name: 'O', slug: `o-${stamp}` } });
      tenantId = tenant.id;
      const project = await tx.project.create({
        data: {
          tenantId: tenant.id,
          name: 'P',
          code: 'P',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      projectId = project.id;
    });
  });

  it('rollback removes outbox event written in the same transaction', async ({ skip }) => {
    if (!enabled || !prisma) skip();
    const runId = crypto.randomUUID();
    await expect(
      prisma!.$transaction(async (tx) => {
        await setRlsContext(tx, { bypass: true });
        await writeProcessDocumentOutbox(tx, {
          tenantId,
          projectId,
          processingRunId: runId,
          documentVersionId: crypto.randomUUID(),
          correlationId: crypto.randomUUID(),
        });
        throw new Error('FORCE_ROLLBACK');
      }),
    ).rejects.toThrow(/FORCE_ROLLBACK/);

    const count = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.outboxEvent.count({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
    });
    expect(count).toBe(0);
  });

  it('committed mutation creates a pending outbox event with id-only payload', async ({ skip }) => {
    if (!enabled || !prisma) skip();
    const runId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      await writeProcessDocumentOutbox(tx, {
        tenantId,
        projectId,
        processingRunId: runId,
        documentVersionId: versionId,
        correlationId,
      });
    });
    const event = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.outboxEvent.findUnique({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
    });
    expect(event?.status).toBe('PENDING');
    expect(event?.payload).toMatchObject({
      processingRunId: runId,
      documentVersionId: versionId,
      correlationId,
    });
    expect(JSON.stringify(event?.payload)).not.toMatch(/password|minioadmin|Bearer/i);
  });
});
