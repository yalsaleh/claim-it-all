/**
 * Slice 5 detection: run detectors → suggestions → accept/reject (no deadlines).
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
  acceptSuggestion,
  listSuggestions,
  rejectSuggestion,
  startDetectionRun,
} from '@/server/services/detections';
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

describe('event detection integration', () => {
  let tenantA: string;
  let tenantB: string;
  let projectA: string;
  let projectB: string;
  let userA: { id: string; email: string; name: string; status: 'ACTIVE' };
  let userB: { id: string; email: string; name: string; status: 'ACTIVE' };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await withBypass(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_deadline_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_contract_revision_purge', 'on', true)`;
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
      await tx.evidenceSegment.deleteMany();
      await tx.documentProcessingRun.deleteMany();
      await tx.documentVersion.deleteMany();
      await tx.sourceDocument.deleteMany();
      await tx.contractConfigurationRevision.deleteMany();
      await tx.contractPackage.deleteMany();
      await tx.outboxEvent.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const seeded = await withBypass(async (tx) => {
      const tA = await tx.tenant.create({
        data: { name: 'Detection Tenant A', slug: `det-a-${Date.now()}`, status: 'ACTIVE' },
      });
      const tB = await tx.tenant.create({
        data: { name: 'Detection Tenant B', slug: `det-b-${Date.now()}`, status: 'ACTIVE' },
      });
      const uA = await tx.user.create({
        data: { email: `det-a-${Date.now()}@example.com`, name: 'Detector', status: 'ACTIVE' },
      });
      const uB = await tx.user.create({
        data: { email: `det-b-${Date.now()}@example.com`, name: 'Other', status: 'ACTIVE' },
      });
      const pA = await tx.project.create({
        data: {
          tenantId: tA.id,
          name: 'Detection Project A',
          code: `DA${Date.now()}`.slice(0, 12),
          status: 'ACTIVE',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });
      const pB = await tx.project.create({
        data: {
          tenantId: tB.id,
          name: 'Detection Project B',
          code: `DB${Date.now()}`.slice(0, 12),
          status: 'ACTIVE',
          countryCode: 'SA',
          defaultCurrency: 'SAR',
          timezone: 'Asia/Riyadh',
        },
      });
      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tA.id, userId: uA.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
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
            tenantId: tB.id,
            projectId: pB.id,
            userId: uB.id,
            role: 'CONTRACTS_LEAD',
            status: 'ACTIVE',
          },
        ],
      });

      const source = await tx.sourceDocument.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          title: 'Stop-work instruction letter',
          documentType: 'SITE_INSTRUCTION',
          language: 'EN',
          status: 'READY',
          createdByUserId: uA.id,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          sourceDocumentId: source.id,
          versionNumber: 1,
          originalFilename: 'stop-work.pdf',
          normalizedFilename: 'stop-work.pdf',
          mediaType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 120n,
          sha256: 'c'.repeat(64),
          storageBucket: 'bucket',
          storageKey: `tenants/${tA.id}/projects/${pA.id}/originals/${source.id}/v1`,
          uploadStatus: 'ACCEPTED',
          malwareScanStatus: 'CLEAN',
          processingStatus: 'SUCCEEDED',
          uploadedByUserId: uA.id,
          acceptedAt: new Date(),
        },
      });
      await tx.sourceDocument.update({
        where: { id: source.id },
        data: { currentVersionId: version.id },
      });
      const run = await tx.documentProcessingRun.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          documentVersionId: version.id,
          processorName: 'test-fixture',
          processorVersion: '0.0.1',
          status: 'SUCCEEDED',
          correlationId: `det-corr-${Date.now()}`,
          completedAt: new Date(),
        },
      });
      await tx.evidenceSegment.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          documentVersionId: version.id,
          processingRunId: run.id,
          ordinal: 1,
          kind: 'PAGE',
          textContent:
            'The Employer hereby issues a stop-work order effective immediately. Access to Zone B is restricted until further notice. Dated 2026-07-01.',
          locator: { page: 1 },
          textSha256: 'd'.repeat(64),
        },
      });

      return { tA, tB, pA, pB, uA, uB };
    });

    tenantA = seeded.tA.id;
    tenantB = seeded.tB.id;
    projectA = seeded.pA.id;
    projectB = seeded.pB.id;
    userA = {
      id: seeded.uA.id,
      email: seeded.uA.email,
      name: seeded.uA.name ?? 'Detector',
      status: 'ACTIVE',
    };
    userB = {
      id: seeded.uB.id,
      email: seeded.uB.email,
      name: seeded.uB.name ?? 'Other',
      status: 'ACTIVE',
    };
  });

  function asUser(user: typeof userA, tenantId: string) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  }

  it('starts a detection run, creates suggestions, accepts without deadlines, and rejects', async () => {
    asUser(userA, tenantA);

    const run = await startDetectionRun(projectA, {
      runType: 'MANUAL_HISTORICAL_SCAN',
      analysisProfile: 'DETERMINISTIC_ONLY',
    });
    expect(run.status).toBe('SUCCEEDED');
    expect(run.suggestionsCreated).toBeGreaterThan(0);

    const suggestions = await listSuggestions(projectA);
    expect(suggestions.length).toBeGreaterThan(0);
    const primary = suggestions[0]!;
    expect(primary.status).toBe('PENDING_REVIEW');
    expect(primary._count.evidenceLinks).toBeGreaterThan(0);

    const accepted = await acceptSuggestion(projectA, primary.id, {
      timezone: 'Asia/Dubai',
      rationale: 'Evidence reviewed — accept as UNCONFIRMED event only',
    });
    expect(accepted.idempotent).toBe(false);
    expect(accepted.projectEvent.source).toBe('DETECTION_ACCEPTED');
    expect(accepted.projectEvent.confirmationStatus).toBe('UNCONFIRMED');

    const calcCount = await withBypass(async (tx) =>
      tx.deadlineCalculation.count({
        where: { tenantId: tenantA, projectId: projectA, projectEventId: accepted.projectEvent.id },
      }),
    );
    expect(calcCount).toBe(0);

    const assessmentCount = await withBypass(async (tx) =>
      tx.eventRuleAssessment.count({
        where: { tenantId: tenantA, projectId: projectA, projectEventId: accepted.projectEvent.id },
      }),
    );
    expect(assessmentCount).toBe(0);

    const again = await acceptSuggestion(projectA, primary.id, { timezone: 'Asia/Dubai' });
    expect(again.idempotent).toBe(true);
    expect(again.projectEvent.id).toBe(accepted.projectEvent.id);

    // Second suggestion (if any) for reject path; otherwise re-run is not needed — seed another finding via fresh run on same docs may duplicate.
    const pending = (await listSuggestions(projectA, { status: 'PENDING_REVIEW' }))[0];
    if (pending) {
      const rejected = await rejectSuggestion(projectA, pending.id, {
        reason: 'False positive — internal planning language',
        falsePositiveReason: 'INTERNAL',
      });
      expect(rejected.status).toBe('REJECTED');
    } else {
      // Force a second suggestion by creating a second stop-work segment and re-scanning.
      await withBypass(async (tx) => {
        const version = await tx.documentVersion.findFirstOrThrow({
          where: { tenantId: tenantA, projectId: projectA },
        });
        const proc = await tx.documentProcessingRun.findFirstOrThrow({
          where: { documentVersionId: version.id },
        });
        await tx.evidenceSegment.create({
          data: {
            tenantId: tenantA,
            projectId: projectA,
            documentVersionId: version.id,
            processingRunId: proc.id,
            ordinal: 2,
            kind: 'PAGE',
            textContent: 'Please demobilize crews from Area C — stop work until drawings arrive.',
            locator: { page: 2 },
            textSha256: 'e'.repeat(64),
          },
        });
      });
      await startDetectionRun(projectA, { runType: 'DOCUMENT_RESCAN' });
      const toReject = (await listSuggestions(projectA, { status: 'PENDING_REVIEW' }))[0];
      expect(toReject).toBeTruthy();
      const rejected = await rejectSuggestion(projectA, toReject!.id, {
        reason: 'Duplicate of earlier accepted suggestion',
      });
      expect(rejected.status).toBe('REJECTED');
    }
  });

  it('blocks cross-tenant detection reads', async () => {
    asUser(userA, tenantA);
    await startDetectionRun(projectA, { runType: 'MANUAL_HISTORICAL_SCAN' });

    asUser(userB, tenantB);
    await expect(listSuggestions(projectA)).rejects.toThrow();
    await expect(
      startDetectionRun(projectB, { runType: 'MANUAL_HISTORICAL_SCAN' }),
    ).resolves.toMatchObject({
      status: 'SUCCEEDED',
      suggestionsCreated: 0,
    });
  });
});
