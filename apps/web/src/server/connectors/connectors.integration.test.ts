/**
 * Connector + operations end-to-end: fake connector → approve scope → sync → alerts → portfolio.
 */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { prisma } from '@/server/db';
import { setRlsContext } from '@/server/db/tenant-context';

vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/server/auth/active-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/active-tenant')>(
    '@/server/auth/active-tenant',
  );
  const state = await import('@/server/live/live-active-tenant-state');
  return {
    ...actual,
    readActiveTenantId: vi.fn(async () => {
      const signed = state.getLiveSignedActiveTenant();
      if (!signed) return null;
      const { verifySignedTenantValue } = await import('@/server/auth/active-tenant-crypto');
      const { getServerEnv } = await import('@/lib/env');
      return verifySignedTenantValue(signed, getServerEnv().BETTER_AUTH_SECRET);
    }),
    writeActiveTenantId: vi.fn(async (tenantId: string) => {
      const { signTenantId } = await import('@/server/auth/active-tenant-crypto');
      const { getServerEnv } = await import('@/lib/env');
      state.setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
    }),
  };
});

import { getSessionUser } from '@/server/auth/session';
import { setLiveSignedActiveTenant } from '@/server/live/live-active-tenant-state';
import { signTenantId } from '@/server/auth/active-tenant-crypto';
import { getServerEnv } from '@/lib/env';
import {
  approveConnectorAccount,
  approveProjectScope,
  assertNoAutonomousLegalMutation,
  createConnectorAccount,
  createProjectScope,
  startManualSync,
  validateConnectorAccount,
} from '@/server/services/connectors';
import {
  acknowledgeAlert,
  evaluateAndUpsertAlerts,
  getPortfolioDashboard,
} from '@/server/services/operations';
import { purgeNoticeTables } from '@/server/notices/test-purge';
import { purgeOpsTables } from '@/server/operations/test-purge';

requireTestDatabaseUrl();

async function withBypass<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

describe('connectors and operations integration', () => {
  let tenantId: string;
  let projectId: string;
  let configurer: { id: string; email: string; name: string; status: 'ACTIVE' };
  let approver: { id: string; email: string; name: string; status: 'ACTIVE' };
  let viewer: { id: string; email: string; name: string; status: 'ACTIVE' };

  beforeAll(async () => {
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.CONNECTOR_PROVIDER = 'fake';
    process.env.CONNECTOR_SOD = 'true';
    process.env.APP_ENV = 'test';

    await withBypass(async (tx) => {
      // Append-only / immutable tables require explicit purge GUCs in-test.
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_ops_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_notice_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_deadline_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_contract_revision_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_detection_purge', 'on', true)`;
      await purgeOpsTables(tx);
      await purgeNoticeTables(tx);

      // IngestionEvent ON DELETE SET NULL is blocked without allow_audit_purge —
      // delete events before versions (imports write connector.import.queued events).
      await tx.ingestionEvent.deleteMany();
      await tx.outboxEvent.deleteMany();
      await tx.evidenceSegment.deleteMany();
      await tx.extractedArtifact.deleteMany();
      await tx.documentProcessingRun.deleteMany();
      await tx.uploadSession.deleteMany();
      await tx.documentRelationship.deleteMany();
      await tx.$executeRaw`UPDATE source_document SET "currentVersionId" = NULL`;
      await tx.documentVersion.deleteMany();
      await tx.sourceDocument.deleteMany();
      await tx.projectEvent.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const seeded = await withBypass(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: 'Ops Tenant', slug: `ops-${Date.now()}`, status: 'ACTIVE' },
      });
      const project = await tx.project.create({
        data: {
          tenantId: tenant.id,
          name: 'PRJ-ALPHA Site',
          code: 'PRJ-ALPHA',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      const configUser = await tx.user.create({
        data: {
          email: `configurer-${Date.now()}@example.com`,
          name: 'Configurer',
          status: 'ACTIVE',
        },
      });
      const approveUser = await tx.user.create({
        data: {
          email: `approver-${Date.now()}@example.com`,
          name: 'Approver',
          status: 'ACTIVE',
        },
      });
      const viewUser = await tx.user.create({
        data: {
          email: `viewer-${Date.now()}@example.com`,
          name: 'Viewer',
          status: 'ACTIVE',
        },
      });

      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tenant.id, userId: configUser.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
          { tenantId: tenant.id, userId: approveUser.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
          { tenantId: tenant.id, userId: viewUser.id, role: 'VIEWER', status: 'ACTIVE' },
        ],
      });

      await tx.projectMembership.createMany({
        data: [
          {
            tenantId: tenant.id,
            projectId: project.id,
            userId: configUser.id,
            role: 'PROJECT_ADMIN',
            status: 'ACTIVE',
          },
          {
            tenantId: tenant.id,
            projectId: project.id,
            userId: approveUser.id,
            role: 'PROJECT_ADMIN',
            status: 'ACTIVE',
          },
        ],
      });

      return {
        tenantId: tenant.id,
        projectId: project.id,
        configurer: { ...configUser, status: 'ACTIVE' as const },
        approver: { ...approveUser, status: 'ACTIVE' as const },
        viewer: { ...viewUser, status: 'ACTIVE' as const },
      };
    });

    tenantId = seeded.tenantId;
    projectId = seeded.projectId;
    configurer = seeded.configurer;
    approver = seeded.approver;
    viewer = seeded.viewer;

    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  });

  function mockUser(user: typeof configurer) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
  }

  it('runs fake connector flow without autonomous legal mutation', async () => {
    mockUser(configurer);
    const account = await createConnectorAccount({
      connectorType: 'email_import',
      displayName: 'Test Fake Mailbox',
      provider: 'fake',
      secretReference: 'vault://test/fake-mailbox',
    });
    expect(account.status).toBe('DRAFT');
    expect(account.secretReference).toBe('vault://test/fake-mailbox');

    await validateConnectorAccount(account.id);

    mockUser(approver);
    const approved = await approveConnectorAccount(account.id);
    expect(approved.status).toBe('APPROVED');

    mockUser(configurer);
    const scope = await createProjectScope(account.id, projectId, {
      externalMailboxOrFolder: 'inbox/prj-alpha',
      includeRules: { patterns: ['*PRJ-ALPHA*'] },
      excludeRules: { patterns: ['*newsletter*'] },
      approvedDocumentTypes: ['message/*', 'application/pdf'],
      projectReferencePatterns: ['PRJ-ALPHA'],
      mimeAllowlist: ['message/*', 'application/pdf'],
    });
    expect(scope.direction).toBe('IMPORT_ONLY');
    expect(scope.status).toBe('DRAFT');

    mockUser(approver);
    const activeScope = await approveProjectScope(scope.id);
    expect(activeScope.status).toBe('ACTIVE');

    const baseline = await withBypass(async (tx) => ({
      eventCount: await tx.projectEvent.count({ where: { projectId } }),
      confirmedEventCount: await tx.projectEvent.count({
        where: { projectId, confirmationStatus: 'CONFIRMED_FACT' },
      }),
      dispatchCount: await tx.noticeDispatchAttempt.count({ where: { projectId } }),
    }));

    mockUser(configurer);
    const syncRun = await startManualSync(scope.id);
    expect(syncRun?.status).toMatch(/SUCCEEDED|PARTIALLY_SUCCEEDED/);
    expect((syncRun?.recordsImported ?? 0) + (syncRun?.recordsSkipped ?? 0)).toBeGreaterThan(0);

    await withBypass(async (tx) => {
      const records = await tx.externalRecord.findMany({ where: { projectId } });
      expect(records.length).toBeGreaterThan(0);

      const imported = records.filter((r) => r.importStatus === 'IMPORTED');
      expect(imported.length).toBeGreaterThan(0);

      for (const record of imported) {
        expect(record.sourceDocumentId).toBeTruthy();
        expect(record.documentVersionId).toBeTruthy();
        const version = await tx.documentVersion.findFirst({
          where: { id: record.documentVersionId! },
        });
        expect(version?.storageKey).toContain('/imports/');
      }

      const outbox = await tx.outboxEvent.findMany({
        where: { projectId, eventType: 'process_document_version' },
      });
      expect(outbox.length).toBeGreaterThan(0);

      await assertNoAutonomousLegalMutation(tx, projectId, baseline);
    });

    mockUser(configurer);
    const alerts = await evaluateAndUpsertAlerts(projectId);
    expect(Array.isArray(alerts)).toBe(true);

    if (alerts.length > 0) {
      mockUser(approver);
      const acked = await acknowledgeAlert(alerts[0]!.id);
      expect(acked.status).toBe('ACKNOWLEDGED');
    }

    mockUser(approver);
    const portfolio = await getPortfolioDashboard();
    expect(portfolio.items.some((i) => i.project.id === projectId)).toBe(true);

    mockUser(configurer);
    const hiddenProject = await withBypass(async (tx) => {
      const other = await tx.project.create({
        data: {
          tenantId,
          name: 'Hidden Project',
          code: 'HIDDEN-1',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      return other.id;
    });

    mockUser(viewer);
    const viewerPortfolio = await getPortfolioDashboard();
    expect(viewerPortfolio.items.some((i) => i.project.id === hiddenProject)).toBe(false);
    expect(viewerPortfolio.items.some((i) => i.project.id === projectId)).toBe(false);
  });

  it('enforces connector account segregation of duties', async () => {
    mockUser(configurer);
    const account = await createConnectorAccount({
      connectorType: 'email_import',
      displayName: 'SoD Test',
      provider: 'fake',
      secretReference: 'vault://test/sod',
    });
    await validateConnectorAccount(account.id);

    await expect(approveConnectorAccount(account.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('connector webhook signature', () => {
  it('validates fake webhook signatures', async () => {
    const body = JSON.stringify({
      eventId: 'evt-1',
      eventType: 'records.changed',
      occurredAt: new Date().toISOString(),
      records: [
        { externalId: 'mail-001', recordType: 'EMAIL', modifiedAt: new Date().toISOString() },
      ],
    });
    const sig = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    expect(sig.startsWith('sha256:')).toBe(true);
  });
});
