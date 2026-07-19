/**
 * Outbox durability tests against real Postgres (+ optional Redis dispatch check).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { setRlsContext } from '@/server/db/tenant-context';
import { formatLiveError } from '@/server/live/live-diagnostics';
import { wipeLiveDocumentGraph } from '@/server/live/live-fixtures';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';

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
  let userId = '';

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

  beforeEach(async ({ skip }) => {
    if (!enabled || !prisma) skip();
    try {
      // FK-safe wipe: ingestion live tests leave document graph rows that block project/tenant deletes.
      await wipeLiveDocumentGraph(prisma!);
      const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await prisma!.$transaction(async (tx) => {
        await setRlsContext(tx, { bypass: true });
        const user = await tx.user.create({
          data: {
            email: `outbox-${stamp}@live-test.example`,
            name: 'Outbox Live',
            emailVerified: true,
            status: 'ACTIVE',
          },
        });
        userId = user.id;
        const tenant = await tx.tenant.create({
          data: { name: `Outbox ${stamp}`, slug: `outbox-${stamp}`.slice(0, 64) },
        });
        tenantId = tenant.id;
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
        projectId = project.id;
      });
    } catch (error) {
      throw new Error(formatLiveError(error, 'outbox-beforeEach-fixture'), { cause: error });
    }
  });

  it('rollback removes business row and outbox event written in the same transaction', async ({
    skip,
  }) => {
    if (!enabled || !prisma) skip();
    const runId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    let businessEventId = '';

    try {
      await expect(
        prisma!.$transaction(async (tx) => {
          // Runtime app path: tenant context in the same transaction as RLS-protected writes.
          await setRlsContext(tx, {
            tenantId,
            userId,
            bypass: false,
          });
          const business = await tx.ingestionEvent.create({
            data: {
              tenantId,
              projectId,
              eventType: 'outbox.rollback_probe',
              correlationId,
              metadata: { stage: 'pre-outbox' },
            },
          });
          businessEventId = business.id;
          await writeProcessDocumentOutbox(tx, {
            tenantId,
            projectId,
            processingRunId: runId,
            documentVersionId: crypto.randomUUID(),
            correlationId,
          });
          throw new Error('FORCE_ROLLBACK');
        }),
      ).rejects.toThrow(/FORCE_ROLLBACK/);
    } catch (error) {
      if (error instanceof Error && /FORCE_ROLLBACK/.test(error.message)) {
        throw error;
      }
      throw new Error(formatLiveError(error, 'outbox-rollback-write'), { cause: error });
    }

    // Privileged inspection: prove absence is rollback, not RLS hiding.
    const counts = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const outbox = await tx.outboxEvent.count({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
      const business = businessEventId
        ? await tx.ingestionEvent.count({ where: { id: businessEventId } })
        : await tx.ingestionEvent.count({
            where: { correlationId, eventType: 'outbox.rollback_probe' },
          });
      return { outbox, business };
    });
    expect(counts.outbox).toBe(0);
    expect(counts.business).toBe(0);
  });

  it('committed mutation creates a pending outbox event with id-only payload', async ({ skip }) => {
    if (!enabled || !prisma) skip();
    const runId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    let businessEventId = '';

    try {
      await prisma!.$transaction(async (tx) => {
        await setRlsContext(tx, {
          tenantId,
          userId,
          bypass: false,
        });
        const business = await tx.ingestionEvent.create({
          data: {
            tenantId,
            projectId,
            eventType: 'outbox.commit_probe',
            correlationId,
            metadata: { stage: 'with-outbox' },
          },
        });
        businessEventId = business.id;
        await writeProcessDocumentOutbox(tx, {
          tenantId,
          projectId,
          processingRunId: runId,
          documentVersionId: versionId,
          correlationId,
        });
      });
    } catch (error) {
      throw new Error(formatLiveError(error, 'outbox-commit-write'), { cause: error });
    }

    const result = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const event = await tx.outboxEvent.findUnique({
        where: { idempotencyKey: `process_document_version:${runId}` },
      });
      const business = await tx.ingestionEvent.findUnique({ where: { id: businessEventId } });
      return { event, business };
    });

    expect(result.business?.id).toBe(businessEventId);
    expect(result.event?.status).toBe('PENDING');
    expect(result.event?.tenantId).toBe(tenantId);
    expect(result.event?.projectId).toBe(projectId);
    expect(result.event?.payload).toMatchObject({
      processingRunId: runId,
      documentVersionId: versionId,
      correlationId,
    });
    expect(JSON.stringify(result.event?.payload)).not.toMatch(/password|minioadmin|Bearer|secret/i);
  });
});
