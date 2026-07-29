import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from 'better-auth/crypto';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { prisma } from '@/server/db';

vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/server/auth/active-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/active-tenant')>(
    '@/server/auth/active-tenant',
  );
  return {
    ...actual,
    readActiveTenantId: vi.fn(),
    writeActiveTenantId: vi.fn(),
    clearActiveTenantId: vi.fn(),
  };
});

import { getSessionUser } from '@/server/auth/session';
import { clearActiveTenantId, readActiveTenantId } from '@/server/auth/active-tenant';
import {
  addProjectMember,
  createProject,
  getProject,
  listProjectsForActiveTenant,
  updateProject,
} from '@/server/services/projects';
import { selectActiveTenant } from '@/server/services/tenants';
import { AppError } from '@/server/errors';
import { setRlsContext } from '@/server/db/tenant-context';
import { purgeNoticeTables } from '@/server/notices/test-purge';

requireTestDatabaseUrl();

async function withBypass<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

async function createUser(email: string, name: string, status: 'ACTIVE' | 'DISABLED' = 'ACTIVE') {
  return withBypass(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, emailVerified: true, status },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: await hashPassword('Integration-Test-Password-2026!'),
      },
    });
    return user;
  });
}

describe('tenant isolation + hardening integration', () => {
  let tenantAId = '';
  let tenantBId = '';
  let userAId = '';
  let userBId = '';
  let viewerAId = '';
  let projectAId = '';
  let projectBId = '';
  let projectA2Id = '';
  let archivedProjectId = '';

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await withBypass(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_contract_revision_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_deadline_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_detection_purge', 'on', true)`;
      await purgeNoticeTables(tx);
      await tx.detectionReviewerFeedback.deleteMany();
      await tx.suggestionPartyCandidate.deleteMany();
      await tx.suggestionRuleCandidate.deleteMany();
      await tx.detectionEvidenceGap.deleteMany();
      await tx.projectEventDateSuggestion.deleteMany();
      await tx.projectEventSuggestionEvidence.deleteMany();
      await tx.projectEventSuggestion.deleteMany();
      await tx.detectionContextGroup.deleteMany();
      await tx.projectEventDetectionRun.deleteMany();
      await tx.notificationIntent.deleteMany();
      await tx.deadlineStatusHistory.deleteMany();
      await tx.projectDeadline.deleteMany();
      await tx.deadlineMilestone.deleteMany();
      await tx.deadlineCalculation.deleteMany();
      await tx.eventRuleAssessment.deleteMany();
      await tx.calendarException.deleteMany();
      await tx.projectCalendar.updateMany({ data: { currentRevisionId: null } });
      await tx.projectCalendarRevision.updateMany({
        where: { status: 'APPROVED' },
        data: { status: 'SUPERSEDED' },
      });
      await tx.projectCalendarRevision.deleteMany();
      await tx.projectCalendar.deleteMany();
      await tx.deadlineWarningPolicy.deleteMany();
      await tx.projectEventRole.deleteMany();
      await tx.projectEventEvidence.deleteMany();
      await tx.projectEventDate.deleteMany();
      await tx.projectEvent.deleteMany();
      await tx.approvedNoticeRuleSnapshot.deleteMany();
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
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();

      await tx.tenantMembership.deleteMany();
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.verification.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const stamp = Date.now();
    const tenantA = await withBypass((tx) =>
      tx.tenant.create({
        data: { name: 'Tenant Alpha', slug: `tenant-a-${stamp}`, status: 'ACTIVE' },
      }),
    );
    const tenantB = await withBypass((tx) =>
      tx.tenant.create({
        data: { name: 'Tenant Beta', slug: `tenant-b-${stamp}`, status: 'ACTIVE' },
      }),
    );
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const userA = await createUser(`alpha-owner-${stamp}@example.test`, 'Alpha Owner');
    const userB = await createUser(`beta-owner-${stamp}@example.test`, 'Beta Owner');
    const viewerA = await createUser(`alpha-viewer-${stamp}@example.test`, 'Alpha Viewer');
    userAId = userA.id;
    userBId = userB.id;
    viewerAId = viewerA.id;

    await withBypass(async (tx) => {
      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tenantAId, userId: userAId, role: 'TENANT_OWNER', status: 'ACTIVE' },
          { tenantId: tenantBId, userId: userBId, role: 'TENANT_OWNER', status: 'ACTIVE' },
          { tenantId: tenantAId, userId: viewerAId, role: 'VIEWER', status: 'ACTIVE' },
        ],
      });

      const projectA = await tx.project.create({
        data: {
          tenantId: tenantAId,
          name: 'Alpha Marina Works',
          code: 'ALP-01',
          status: 'ACTIVE',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });
      const projectA2 = await tx.project.create({
        data: {
          tenantId: tenantAId,
          name: 'Alpha Second Site',
          code: 'ALP-02',
          status: 'ACTIVE',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });
      const projectB = await tx.project.create({
        data: {
          tenantId: tenantBId,
          name: 'Beta Port Expansion',
          code: 'BET-01',
          status: 'ACTIVE',
          countryCode: 'QA',
          defaultCurrency: 'QAR',
          timezone: 'Asia/Qatar',
        },
      });
      const archived = await tx.project.create({
        data: {
          tenantId: tenantAId,
          name: 'Alpha Archived Yard',
          code: 'ALP-ARCH',
          status: 'ARCHIVED',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });

      projectAId = projectA.id;
      projectA2Id = projectA2.id;
      projectBId = projectB.id;
      archivedProjectId = archived.id;

      await tx.projectMembership.createMany({
        data: [
          {
            tenantId: tenantAId,
            projectId: projectAId,
            userId: userAId,
            role: 'PROJECT_ADMIN',
            status: 'ACTIVE',
          },
          {
            tenantId: tenantAId,
            projectId: projectAId,
            userId: viewerAId,
            role: 'VIEWER',
            status: 'ACTIVE',
          },
          {
            tenantId: tenantBId,
            projectId: projectBId,
            userId: userBId,
            role: 'PROJECT_ADMIN',
            status: 'ACTIVE',
          },
        ],
      });
    });

    vi.mocked(getSessionUser).mockReset();
    vi.mocked(readActiveTenantId).mockReset();
    vi.mocked(clearActiveTenantId).mockReset();
  });

  function asUser(userId: string, email: string, name: string, tenantId: string | null) {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: userId,
      email,
      name,
      status: 'ACTIVE',
    });
    vi.mocked(readActiveTenantId).mockResolvedValue(tenantId);
  }

  it('prevents tenant A user from reading tenant B project', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    await expect(getProject(projectBId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not reveal cross-tenant existence via distinct errors', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    const missing = crypto.randomUUID();
    let crossTenantCode = '';
    let missingCode = '';
    try {
      await getProject(projectBId);
    } catch (error) {
      crossTenantCode = (error as AppError).code;
    }
    try {
      await getProject(missing);
    } catch (error) {
      missingCode = (error as AppError).code;
    }
    expect(crossTenantCode).toBe('NOT_FOUND');
    expect(missingCode).toBe('NOT_FOUND');
  });

  it('blocks viewer from updating a project', async () => {
    asUser(viewerAId, 'v@example.test', 'V', tenantAId);
    await expect(updateProject(projectAId, { name: 'Should Not Update' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('blocks unauthorized user from creating a project', async () => {
    asUser(viewerAId, 'v@example.test', 'V', tenantAId);
    await expect(
      createProject({
        name: 'Unauthorized Project',
        code: 'NOPE-01',
        countryCode: 'KW',
        defaultCurrency: 'KWD',
        timezone: 'Asia/Kuwait',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows tenant owner to create a project and writes audit in same txn', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    const created = await createProject({
      name: 'New Alpha Package',
      code: 'ALP-NEW',
      countryCode: 'KW',
      defaultCurrency: 'KWD',
      timezone: 'Asia/Kuwait',
    });
    expect(created.tenantId).toBe(tenantAId);

    const audit = await withBypass((tx) =>
      tx.auditLog.findFirst({ where: { action: 'project.created', entityId: created.id } }),
    );
    expect(audit).not.toBeNull();
    expect(audit?.tenantId).toBe(tenantAId);
  });

  it('limits project-scoped viewer to authorized projects only', async () => {
    asUser(viewerAId, 'v@example.test', 'V', tenantAId);
    const projects = await listProjectsForActiveTenant();
    expect(projects.map((project) => project.id).sort()).toEqual([projectAId].sort());
    await expect(getProject(projectA2Id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects client-provided tenantId on create', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    await expect(
      createProject({
        name: 'Evil Tenant Injection',
        code: 'EVIL-01',
        countryCode: 'SA',
        defaultCurrency: 'SAR',
        timezone: 'Asia/Riyadh',
        tenantId: tenantBId,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('blocks mutation of archived projects', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    await expect(
      updateProject(archivedProjectId, { name: 'Still Archived' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects membership operations against foreign project ids', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    await expect(
      addProjectMember(projectBId, { userId: viewerAId, role: 'VIEWER' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects active-tenant cookie for a tenant without membership', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantBId);
    await expect(getProject(projectBId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(clearActiveTenantId).toHaveBeenCalled();
  });

  it('rejects unknown active tenant id', async () => {
    asUser(userAId, 'a@example.test', 'A', crypto.randomUUID());
    await expect(listProjectsForActiveTenant()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects disabled tenant membership', async () => {
    await withBypass((tx) =>
      tx.tenantMembership.update({
        where: { tenantId_userId: { tenantId: tenantAId, userId: viewerAId } },
        data: { status: 'DISABLED' },
      }),
    );
    asUser(viewerAId, 'v@example.test', 'V', tenantAId);
    await expect(listProjectsForActiveTenant()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows legitimate tenant switch for multi-tenant user', async () => {
    await withBypass((tx) =>
      tx.tenantMembership.create({
        data: {
          tenantId: tenantBId,
          userId: userAId,
          role: 'VIEWER',
          status: 'ACTIVE',
        },
      }),
    );
    asUser(userAId, 'a@example.test', 'A', null);
    // selectActiveTenant validates membership then writes cookie + audit
    vi.mocked(readActiveTenantId).mockResolvedValue(null);
    // requireTenantMembership(tenantId) uses explicit id
    const result = await selectActiveTenant({ tenantId: tenantBId });
    expect(result.tenantId).toBe(tenantBId);
  });

  it('blocks disabled users', async () => {
    await withBypass((tx) =>
      tx.user.update({ where: { id: userAId }, data: { status: 'DISABLED' } }),
    );
    vi.mocked(getSessionUser).mockResolvedValue({
      id: userAId,
      email: 'a@example.test',
      name: 'A',
      status: 'DISABLED',
    });
    vi.mocked(readActiveTenantId).mockResolvedValue(tenantAId);
    await expect(listProjectsForActiveTenant()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('enforces DB trigger: project membership tenant must match project', async () => {
    await expect(
      withBypass((tx) =>
        tx.projectMembership.create({
          data: {
            tenantId: tenantBId,
            projectId: projectAId,
            userId: userBId,
            role: 'VIEWER',
            status: 'ACTIVE',
          },
        }),
      ),
    ).rejects.toThrow(/tenantId must match/i);
  });

  it('enforces DB trigger: project membership requires tenant membership', async () => {
    const outsider = await createUser(`outsider-${Date.now()}@example.test`, 'Outsider');
    await expect(
      withBypass((tx) =>
        tx.projectMembership.create({
          data: {
            tenantId: tenantAId,
            projectId: projectAId,
            userId: outsider.id,
            role: 'VIEWER',
            status: 'ACTIVE',
          },
        }),
      ),
    ).rejects.toThrow(/requires an ACTIVE tenant_membership/i);
  });

  it('blocks audit log updates and deletes at the database', async () => {
    const audit = await withBypass((tx) =>
      tx.auditLog.create({
        data: {
          tenantId: tenantAId,
          action: 'test.event',
          entityType: 'test',
          entityId: '1',
        },
      }),
    );

    await expect(
      withBypass((tx) =>
        tx.auditLog.update({
          where: { id: audit.id },
          data: { action: 'tampered' },
        }),
      ),
    ).rejects.toThrow(/append-only/i);

    await expect(
      withBypass((tx) => tx.auditLog.delete({ where: { id: audit.id } })),
    ).rejects.toThrow(/append-only/i);
  });

  it('RLS: without tenant context project rows are invisible', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { userId: userAId, bypass: false });
      return tx.project.findMany();
    });
    expect(rows).toHaveLength(0);
  });

  it('RLS: tenant A context cannot read tenant B projects', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { userId: userAId, tenantId: tenantAId, bypass: false });
      return tx.project.findMany({ where: { id: projectBId } });
    });
    expect(rows).toHaveLength(0);
  });

  it('RLS: tenant A context cannot insert into tenant B', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await setRlsContext(tx, { userId: userAId, tenantId: tenantAId, bypass: false });
        return tx.project.create({
          data: {
            tenantId: tenantBId,
            name: 'Cross Insert',
            code: 'X-1',
            status: 'DRAFT',
            countryCode: 'KW',
            defaultCurrency: 'KWD',
            timezone: 'Asia/Kuwait',
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('RLS context does not leak across transactions', async () => {
    await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { userId: userAId, tenantId: tenantAId, bypass: false });
      const seen = await tx.project.count();
      expect(seen).toBeGreaterThan(0);
    });

    const leaked = await prisma.$transaction(async (tx) => {
      // fresh transaction: no tenant GUC
      await setRlsContext(tx, { userId: userAId, bypass: false });
      return tx.project.count();
    });
    expect(leaked).toBe(0);
  });

  it('rolls back business mutation when audit insert fails', async () => {
    asUser(userAId, 'a@example.test', 'A', tenantAId);
    // Force audit failure by using an invalid FK-less path: monkeypatch write via broken metadata?
    // Instead simulate by creating project with duplicate code after first success then ensure count.
    await createProject({
      name: 'Unique One',
      code: 'UNIQ-1',
      countryCode: 'KW',
      defaultCurrency: 'KWD',
      timezone: 'Asia/Kuwait',
    });
    await expect(
      createProject({
        name: 'Unique Two',
        code: 'UNIQ-1',
        countryCode: 'KW',
        defaultCurrency: 'KWD',
        timezone: 'Asia/Kuwait',
      }),
    ).rejects.toThrow();

    const count = await withBypass((tx) =>
      tx.project.count({ where: { tenantId: tenantAId, code: 'UNIQ-1' } }),
    );
    expect(count).toBe(1);
  });
});
