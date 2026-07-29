/**
 * Contract package tenant isolation + approved revision immutability (Slice 3).
 */
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
  approveConfigurationRevision,
  attachContractDocument,
  createAndSubmitConfigurationRevision,
  createContractPackage,
  getApprovedConfiguration,
  resolveConfigurationIssue,
  reviewClause,
  reviewNoticeRule,
  reviewObligation,
  startDeterministicStructureAnalysis,
} from '@/server/services/contracts';
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

describe('contract package integration', () => {
  let tenantA: string;
  let tenantB: string;
  let projectA: string;
  let userA: { id: string; email: string; name: string; status: 'ACTIVE' };
  let userB: { id: string; email: string; name: string; status: 'ACTIVE' };
  let approver: { id: string; email: string; name: string; status: 'ACTIVE' };

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
      await tx.outboxEvent.deleteMany();
      await tx.ingestionEvent.deleteMany();
      await tx.evidenceSegment.deleteMany();
      await tx.extractedArtifact.deleteMany();
      await tx.documentProcessingRun.deleteMany();
      await tx.uploadSession.deleteMany();
      await tx.documentRelationship.deleteMany();
      await tx.documentVersion.deleteMany();
      await tx.sourceDocument.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const seeded = await withBypass(async (tx) => {
      const tA = await tx.tenant.create({
        data: { name: 'Tenant A', slug: `ta-${Date.now()}`, status: 'ACTIVE' },
      });
      const tB = await tx.tenant.create({
        data: { name: 'Tenant B', slug: `tb-${Date.now()}`, status: 'ACTIVE' },
      });
      const uA = await tx.user.create({
        data: {
          email: `a-${Date.now()}@example.com`,
          name: 'User A',
          status: 'ACTIVE',
        },
      });
      const uB = await tx.user.create({
        data: {
          email: `b-${Date.now()}@example.com`,
          name: 'User B',
          status: 'ACTIVE',
        },
      });
      const uAppr = await tx.user.create({
        data: {
          email: `appr-${Date.now()}@example.com`,
          name: 'Approver',
          status: 'ACTIVE',
        },
      });
      const pA = await tx.project.create({
        data: {
          tenantId: tA.id,
          name: 'Project A',
          code: `PA${Date.now()}`.slice(0, 12),
          status: 'ACTIVE',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });
      const pB = await tx.project.create({
        data: {
          tenantId: tB.id,
          name: 'Project B',
          code: `PB${Date.now()}`.slice(0, 12),
          status: 'ACTIVE',
          countryCode: 'SA',
          defaultCurrency: 'SAR',
          timezone: 'Asia/Riyadh',
        },
      });
      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tA.id, userId: uA.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
          { tenantId: tA.id, userId: uAppr.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
          { tenantId: tB.id, userId: uB.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
        ],
      });
      await tx.projectMembership.createMany({
        data: [
          {
            tenantId: tA.id,
            projectId: pA.id,
            userId: uA.id,
            role: 'CONTRACTS_LEAD',
            status: 'ACTIVE',
          },
          {
            tenantId: tA.id,
            projectId: pA.id,
            userId: uAppr.id,
            role: 'CONTRACTS_LEAD',
            status: 'ACTIVE',
          },
          {
            tenantId: tB.id,
            projectId: pB.id,
            userId: uB.id,
            role: 'CONTRACTS_LEAD',
            status: 'ACTIVE',
          },
        ],
      });
      return { tA, tB, pA, pB, uA, uB, uAppr };
    });

    tenantA = seeded.tA.id;
    tenantB = seeded.tB.id;
    projectA = seeded.pA.id;
    userA = { id: seeded.uA.id, email: seeded.uA.email, name: seeded.uA.name, status: 'ACTIVE' };
    userB = { id: seeded.uB.id, email: seeded.uB.email, name: seeded.uB.name, status: 'ACTIVE' };
    approver = {
      id: seeded.uAppr.id,
      email: seeded.uAppr.email,
      name: seeded.uAppr.name,
      status: 'ACTIVE',
    };
  });

  function asUser(user: typeof userA, tenantId: string) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  }

  it('isolates contract packages across tenants', async () => {
    asUser(userA, tenantA);
    const pkg = await createContractPackage(projectA, { name: 'Main Works' });
    asUser(userB, tenantB);
    await expect(createContractPackage(projectA, { name: 'Leak' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const hidden = await withBypass(async (tx) => {
      await setRlsContext(tx, { tenantId: tenantB, userId: userB.id, bypass: false });
      return tx.contractPackage.findFirst({ where: { id: pkg.id } });
    });
    expect(hidden).toBeNull();
  });

  it('approves revision with segregation of duties and keeps it immutable', async () => {
    process.env.CONTRACT_CONFIG_SEGREGATION_OF_DUTIES = 'true';
    asUser(userA, tenantA);
    const pkg = await createContractPackage(projectA, { name: 'FIDIC-like package' });
    const submitted = await createAndSubmitConfigurationRevision(projectA, pkg.id, {
      summary: 'First configuration',
    });
    await expect(
      approveConfigurationRevision(projectA, pkg.id, submitted.id),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    asUser(approver, tenantA);
    const approved = await approveConfigurationRevision(projectA, pkg.id, submitted.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.isActiveApproved).toBe(true);

    await expect(
      withBypass(async (tx) =>
        tx.contractConfigurationRevision.update({
          where: { id: approved.id },
          data: { summary: 'tamper' },
        }),
      ),
    ).rejects.toThrow(/immutable/i);
    await prisma.$disconnect();
    await prisma.$connect();
  });

  it('runs structure analysis → review → issue resolve → approve → immutable snapshot', async () => {
    process.env.CONTRACT_CONFIG_SEGREGATION_OF_DUTIES = 'true';
    process.env.CONTRACT_AI_PROVIDER = 'deterministic';

    const seededDoc = await withBypass(async (tx) => {
      const source = await tx.sourceDocument.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          title: 'Synthetic conditions',
          documentType: 'CONTRACT',
          language: 'EN',
          status: 'READY',
          createdByUserId: userA.id,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          sourceDocumentId: source.id,
          versionNumber: 1,
          originalFilename: 'synthetic.pdf',
          normalizedFilename: 'synthetic.pdf',
          mediaType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 100n,
          sha256: 'a'.repeat(64),
          storageBucket: 'bucket',
          storageKey: `tenants/${tenantA}/projects/${projectA}/originals/${source.id}/v1`,
          uploadStatus: 'ACCEPTED',
          malwareScanStatus: 'CLEAN',
          processingStatus: 'SUCCEEDED',
          uploadedByUserId: userA.id,
          acceptedAt: new Date(),
        },
      });
      await tx.sourceDocument.update({
        where: { id: source.id },
        data: { currentVersionId: version.id },
      });
      const run = await tx.documentProcessingRun.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          documentVersionId: version.id,
          processorName: 'test-fixture',
          processorVersion: '0.0.1',
          status: 'SUCCEEDED',
          correlationId: `corr-${Date.now()}`,
          completedAt: new Date(),
        },
      });
      const segment = await tx.evidenceSegment.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          documentVersionId: version.id,
          processingRunId: run.id,
          ordinal: 1,
          kind: 'PAGE',
          textContent: [
            '20.1 Claims',
            'The Contractor shall give notice to the Engineer within 28 days.',
            'Sub-Clause 20.2 applies.',
            '"Site" means the place of the Works.',
          ].join('\n'),
          locator: { page: 1 },
          textSha256: 'b'.repeat(64),
        },
      });
      return { source, version, segment };
    });

    asUser(userA, tenantA);
    const pkg = await createContractPackage(projectA, { name: 'Workflow package' });
    await attachContractDocument(projectA, pkg.id, {
      sourceDocumentId: seededDoc.source.id,
      documentVersionId: seededDoc.version.id,
      contractDocumentType: 'CONDITIONS_OF_CONTRACT',
      title: 'Synthetic GC',
    });

    const analysis = await startDeterministicStructureAnalysis(projectA, pkg.id);
    expect(analysis.clauseCount).toBeGreaterThan(0);

    const clauses = await withBypass(async (tx) =>
      tx.contractClause.findMany({ where: { contractPackageId: pkg.id } }),
    );
    expect(clauses.length).toBeGreaterThan(0);
    await reviewClause(projectA, pkg.id, clauses[0]!.id, {
      decision: 'VERIFIED',
      rationale: 'Matches source',
    });

    const obligations = await withBypass(async (tx) =>
      tx.contractObligation.findMany({ where: { contractPackageId: pkg.id } }),
    );
    if (obligations[0]) {
      await reviewObligation(projectA, pkg.id, obligations[0].id, {
        decision: 'VERIFIED',
        rationale: 'Notice duty confirmed',
      });
    }

    const noticeRules = await withBypass(async (tx) =>
      tx.noticeRule.findMany({ where: { contractPackageId: pkg.id } }),
    );
    if (noticeRules[0]) {
      await reviewNoticeRule(projectA, pkg.id, noticeRules[0].id, {
        decision: 'VERIFIED',
        timeBarClassification: 'PROCEDURAL_DEADLINE',
      });
    }

    const issues = await withBypass(async (tx) =>
      tx.contractConfigurationIssue.findMany({
        where: { contractPackageId: pkg.id, status: 'OPEN' },
      }),
    );
    if (issues[0]) {
      await resolveConfigurationIssue(projectA, pkg.id, issues[0].id, {
        resolution: 'Reviewed; retained as procedural deadline',
        status: 'RESOLVED',
      });
    }

    const submitted = await createAndSubmitConfigurationRevision(projectA, pkg.id, {
      summary: 'Workflow revision',
    });
    asUser(approver, tenantA);
    const approved = await approveConfigurationRevision(projectA, pkg.id, submitted.id);
    expect(approved.isActiveApproved).toBe(true);

    const snapshot = await getApprovedConfiguration(projectA, pkg.id);
    expect(snapshot.revision.id).toBe(approved.id);
    expect(snapshot.clauses.some((c) => c.reviewStatus === 'VERIFIED')).toBe(true);
  });
});
