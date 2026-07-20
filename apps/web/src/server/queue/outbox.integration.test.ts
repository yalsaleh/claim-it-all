/**
 * Outbox durability against embedded/CI Postgres (not live Redis/ARQ).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { setRlsContext } from '@/server/db/tenant-context';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';

const databaseUrl = requireTestDatabaseUrl();
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function withBypass<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

describe('outbox transactional write (embedded/CI Postgres)', () => {
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await withBypass(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_contract_revision_purge', 'on', true)`;
      await tx.contractPackage.updateMany({ data: { currentConfigurationRevisionId: null } });
      await tx.reviewDecision.deleteMany();
      await tx.contractExtractionSuggestion.deleteMany();
      await tx.contractAnalysisRun.deleteMany();
      await tx.contractConfigurationIssue.deleteMany();
      await tx.noticeRule.deleteMany();
      await tx.obligationEvidenceRequirement.deleteMany();
      await tx.obligationRecipient.deleteMany();
      await tx.obligationTrigger.deleteMany();
      await tx.contractObligation.deleteMany();
      await tx.contactPoint.deleteMany();
      await tx.contractRole.deleteMany();
      await tx.contractParty.deleteMany();
      await tx.crossReference.deleteMany();
      await tx.clauseTermReference.deleteMany();
      await tx.definedTerm.deleteMany();
      await tx.clauseRelationship.deleteMany();
      await tx.clauseTextRevision.deleteMany();
      await tx.contractClause.deleteMany();
      await tx.contractPrecedenceRule.deleteMany();
      await tx.contractDocumentRelationship.deleteMany();
      await tx.contractDocument.deleteMany();
      await tx.calendarRule.deleteMany();
      await tx.contractConfigurationRevision.deleteMany();
      await tx.contractPackage.deleteMany();
      await tx.outboxEvent.deleteMany();
      await tx.ingestionEvent.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();

      const stamp = Date.now();
      const tenant = await tx.tenant.create({ data: { name: 'Outbox', slug: `ob-${stamp}` } });
      tenantId = tenant.id;
      const project = await tx.project.create({
        data: {
          tenantId: tenant.id,
          name: 'P',
          code: 'OB',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      projectId = project.id;
    });
  });

  it('rollback removes outbox event written in the same transaction', async () => {
    const runId = crypto.randomUUID();
    await expect(
      withBypass(async (tx) => {
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

    const count = await withBypass(async (tx) =>
      tx.outboxEvent.count({
        where: { idempotencyKey: `process_document_version:${runId}` },
      }),
    );
    expect(count).toBe(0);
  });

  it('committed mutation creates pending id-only outbox event', async () => {
    const runId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    await withBypass(async (tx) => {
      await writeProcessDocumentOutbox(tx, {
        tenantId,
        projectId,
        processingRunId: runId,
        documentVersionId: versionId,
        correlationId,
      });
    });

    const event = await withBypass(async (tx) =>
      tx.outboxEvent.findUnique({
        where: { idempotencyKey: `process_document_version:${runId}` },
      }),
    );
    expect(event?.status).toBe('PENDING');
    expect(event?.payload).toMatchObject({
      processingRunId: runId,
      documentVersionId: versionId,
      correlationId,
    });
    expect(JSON.stringify(event?.payload)).not.toMatch(/password|minioadmin|Bearer/i);
  });

  it('RLS hides outbox events without tenant context', async () => {
    const runId = crypto.randomUUID();
    await withBypass(async (tx) => {
      await writeProcessDocumentOutbox(tx, {
        tenantId,
        projectId,
        processingRunId: runId,
        documentVersionId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      });
    });

    await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: false });
      const rows = await tx.outboxEvent.findMany();
      expect(rows).toHaveLength(0);
    });
  });
});
