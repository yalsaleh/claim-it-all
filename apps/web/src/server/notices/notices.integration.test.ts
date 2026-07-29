/**
 * Slice 6 notice drafting: package → evidence → draft → approve → export (no send).
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
  createAndSubmitConfigurationRevision,
} from '@/server/services/contracts';
import {
  addProjectEventDate,
  approveCalendarRevision,
  calculateEventDeadline,
  confirmProjectEvent,
  confirmRuleApplicability,
  createCalendarRevision,
  createProjectCalendar,
  createProjectEvent,
  verifyDeadlineCalculation,
  verifyProjectEventDate,
} from '@/server/services/deadlines';
import {
  assertNoSendOperations,
  assessEvidenceCompleteness,
  approveDraft,
  createNoticePackageFromDeadline,
  editDraftSection,
  generateDeterministicDraft,
  generateExport,
  getNoticePackage,
  linkEvidence,
  runDraftValidation,
  submitDraftForReview,
  verifyDeliveryPreparation,
  verifyNoticeFact,
} from '@/server/services/notices';
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

describe('notice drafting integration', () => {
  let tenantA: string;
  let projectA: string;
  let userA: { id: string; email: string; name: string; status: 'ACTIVE' };
  let approver: { id: string; email: string; name: string; status: 'ACTIVE' };
  let packageId: string;
  let snapshotId: string;
  let calendarRevisionId: string;
  let obligationId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.NOTICE_DRAFT_SEGREGATION_OF_DUTIES = 'true';
    process.env.DEADLINE_CALC_SEGREGATION_OF_DUTIES = 'true';
    process.env.CONTRACT_CONFIG_SEGREGATION_OF_DUTIES = 'true';

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
      await tx.obligationRecipient.deleteMany();
      await tx.contactPoint.deleteMany();
      await tx.contractPackage.updateMany({ data: { currentConfigurationRevisionId: null } });
      await tx.reviewDecision.deleteMany();
      await tx.contractConfigurationIssue.deleteMany();
      await tx.noticeRule.deleteMany();
      await tx.contractObligation.deleteMany();
      await tx.contractClause.deleteMany();
      await tx.contractDocument.deleteMany();
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
        data: { name: 'Notice Tenant', slug: `nt-${Date.now()}`, status: 'ACTIVE' },
      });
      const uA = await tx.user.create({
        data: { email: `nt-a-${Date.now()}@example.com`, name: 'Drafter', status: 'ACTIVE' },
      });
      const uB = await tx.user.create({
        data: { email: `nt-b-${Date.now()}@example.com`, name: 'Approver', status: 'ACTIVE' },
      });
      const pA = await tx.project.create({
        data: {
          tenantId: tA.id,
          name: 'Notice Project',
          code: `NT${Date.now()}`.slice(0, 12),
          status: 'ACTIVE',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
        },
      });
      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tA.id, userId: uA.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
          { tenantId: tA.id, userId: uB.id, role: 'CONTRACTS_MANAGER', status: 'ACTIVE' },
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
            userId: uB.id,
            role: 'CONTRACTS_LEAD',
            status: 'ACTIVE',
          },
        ],
      });

      const pkg = await tx.contractPackage.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          name: 'Notice package',
          status: 'DRAFT',
          createdByUserId: uA.id,
        },
      });

      const source = await tx.sourceDocument.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          title: 'Fixture contract',
          documentType: 'CONTRACT',
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
          originalFilename: 'fixture.pdf',
          normalizedFilename: 'fixture.pdf',
          mediaType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 100n,
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
      const contractDoc = await tx.contractDocument.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          sourceDocumentId: source.id,
          documentVersionId: version.id,
          contractDocumentType: 'CONDITIONS_OF_CONTRACT',
          title: 'Fixture GC',
          language: 'EN',
          status: 'REVIEW_REQUIRED',
          isExecuted: false,
          isCurrent: true,
        },
      });

      const clause = await tx.contractClause.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          contractDocumentId: contractDoc.id,
          documentVersionId: version.id,
          clauseNumber: '20.1',
          normalizedClauseNumber: '20.1',
          level: 1,
          sequence: 1,
          language: 'EN',
          sourceText: 'Notice within 7 days',
          textChecksum: 'd'.repeat(64),
          reviewStatus: 'VERIFIED',
        },
      });

      const obligation = await tx.contractObligation.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          sourceClauseId: clause.id,
          obligationType: 'NOTICE',
          actionDescription: 'Give notice within 7 calendar days',
          reviewStatus: 'VERIFIED',
        },
      });

      const contact = await tx.contactPoint.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          namedPerson: 'Engineer Representative',
          emailAddress: 'engineer@example.com',
          permittedDeliveryMethod: 'EMAIL',
          status: 'VERIFIED',
        },
      });

      await tx.obligationRecipient.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          obligationId: obligation.id,
          recipientKind: 'ROLE_BASED',
          contactPointId: contact.id,
        },
      });

      const rule = await tx.noticeRule.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          obligationId: obligation.id,
          noticeCategory: 'GENERAL_NOTICE',
          triggerBasis: 'INSTRUCTION_RECEIVED',
          durationValue: 7,
          durationUnit: 'CALENDAR_DAY',
          calendarBasis: 'CALENDAR_DAYS',
          countingConvention: 'EXCLUSIVE',
          timeBarClassification: 'PROCEDURAL_DEADLINE',
          ambiguityStatus: 'CLEAR',
          reviewStatus: 'VERIFIED',
        },
      });

      return { tA, pA, uA, uB, pkg, rule, obligation };
    });

    tenantA = seeded.tA.id;
    projectA = seeded.pA.id;
    userA = { id: seeded.uA.id, email: seeded.uA.email, name: seeded.uA.name, status: 'ACTIVE' };
    approver = { id: seeded.uB.id, email: seeded.uB.email, name: seeded.uB.name, status: 'ACTIVE' };
    packageId = seeded.pkg.id;
    obligationId = seeded.obligation.id;
  });

  function asUser(user: typeof userA, tenantId: string) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  }

  it('runs notice workflow through export without send operations', async () => {
    asUser(userA, tenantA);

    const submitted = await createAndSubmitConfigurationRevision(projectA, packageId, {
      summary: 'Notice rule for drafting',
    });
    asUser(approver, tenantA);
    await approveConfigurationRevision(projectA, packageId, submitted.id);

    const snapshot = await withBypass(async (tx) =>
      tx.approvedNoticeRuleSnapshot.findFirstOrThrow({
        where: { sourceObligationId: obligationId },
      }),
    );
    snapshotId = snapshot.id;

    asUser(userA, tenantA);
    const calendar = await createProjectCalendar(projectA, {
      name: 'Site calendar',
      timezone: 'Asia/Dubai',
      weekendDays: [5, 6],
    });
    const revision = await createCalendarRevision(projectA, calendar.id, {
      weekendDays: [5, 6],
      holidays: [],
      specialWorkingDays: [],
    });
    asUser(approver, tenantA);
    const approvedRevision = await approveCalendarRevision(projectA, calendar.id, revision.id);
    calendarRevisionId = approvedRevision.id;

    asUser(userA, tenantA);
    const event = await createProjectEvent(projectA, {
      title: 'Engineer instruction received',
      eventCategory: 'INSTRUCTION',
      timezone: 'Asia/Dubai',
      contractPackageId: packageId,
    });
    const triggerDate = await addProjectEventDate(projectA, event.id, {
      dateType: 'INSTRUCTION_DATE',
      dateValue: '2026-01-01T09:00:00+04:00',
      timezone: 'Asia/Dubai',
      precision: 'EXACT_DATETIME',
    });
    await verifyProjectEventDate(projectA, event.id, triggerDate.id);
    await confirmProjectEvent(projectA, event.id, {
      confirmationStatus: 'CONFIRMED_FOR_DEADLINE_ANALYSIS',
    });

    const assessment = await confirmRuleApplicability(projectA, event.id, {
      approvedRuleSnapshotId: snapshotId,
      rationale: 'Notice rule applies',
    });

    const calculation = await calculateEventDeadline(projectA, event.id, {
      assessmentId: assessment.id,
      calendarRevisionId,
      triggerDateId: triggerDate.id,
    });
    asUser(approver, tenantA);
    await verifyDeadlineCalculation(projectA, calculation.id);

    asUser(userA, tenantA);
    const noticePkg = await createNoticePackageFromDeadline(projectA, {
      deadlineCalculationId: calculation.id,
      noticeType: 'INITIAL_NOTICE',
      title: 'Notice of instruction',
      language: 'en',
    });
    expect(noticePkg.status).toBe('DRAFT');
    expect(noticePkg.sodEnforced).toBe(true);

    const firstAssess = await assessEvidenceCompleteness(projectA, noticePkg.id);
    expect(['BLOCKED', 'INCOMPLETE'].includes(firstAssess.result.status)).toBe(true);

    const refreshed = await getNoticePackage(projectA, noticePkg.id);
    const prep = refreshed.deliveryPreparations[0];
    expect(prep).toBeDefined();
    await verifyDeliveryPreparation(projectA, noticePkg.id, prep!.id, {
      emailAddress: 'engineer@example.com',
      selectedMethod: 'EMAIL',
    });

    const eventDateFact = refreshed.facts.find((f) => f.factType === 'INSTRUCTION_DATE');
    expect(eventDateFact).toBeDefined();
    await verifyNoticeFact(projectA, noticePkg.id, eventDateFact!.id, {
      verificationStatus: 'EVIDENCE_BACKED',
      approvedForDrafting: true,
    });

    const descFact = refreshed.facts.find((f) => f.factType === 'DESCRIPTION_OF_EVENT');
    await verifyNoticeFact(projectA, noticePkg.id, descFact!.id, {
      verificationStatus: 'HUMAN_CONFIRMED',
      approvedForDrafting: true,
    });

    const partyFact = await withBypass(async (tx) =>
      tx.noticeFact.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          noticePackageId: noticePkg.id,
          factType: 'PARTY_NAME',
          label: 'Sender',
          value: 'Contractor Ltd',
          sourceType: 'REVIEWER_ENTERED',
          verificationStatus: 'HUMAN_CONFIRMED',
          approvedForDrafting: true,
        },
      }),
    );
    expect(partyFact.approvedForDrafting).toBe(true);

    const recordsReq = refreshed.evidenceRequirements.find(
      (r) => r.category === 'CONTEMPORARY_RECORDS',
    );
    await linkEvidence(projectA, noticePkg.id, {
      evidenceRequirementId: recordsReq!.id,
      role: 'SUPPORTING',
      reviewerAuthoredStatement: 'Daily report referenced',
      satisfactionStatus: 'SATISFIED',
    });

    // Satisfy remaining contractual evidence categories for this fixture.
    for (const category of ['EVENT_OCCURRENCE', 'TRIGGER_DATE', 'CONTRACTUAL_BASIS'] as const) {
      const req = refreshed.evidenceRequirements.find((r) => r.category === category);
      expect(req).toBeDefined();
      await linkEvidence(projectA, noticePkg.id, {
        evidenceRequirementId: req!.id,
        role: 'PRIMARY',
        reviewerAuthoredStatement: `${category} verified for fixture`,
        satisfactionStatus: 'SATISFIED',
      });
    }

    const secondAssess = await assessEvidenceCompleteness(projectA, noticePkg.id);
    expect(['READY', 'CONDITIONALLY_READY'].includes(secondAssess.result.status)).toBe(true);

    const draft = await generateDeterministicDraft(projectA, noticePkg.id);
    expect(draft.sections.length).toBeGreaterThan(0);

    const editable = draft.sections.find((s) => s.sectionType === 'REQUESTED_ACTION');
    await editDraftSection(projectA, noticePkg.id, draft.id, editable!.id, {
      body: 'Please acknowledge receipt within 3 business days.',
    });

    const validation = await runDraftValidation(projectA, noticePkg.id, draft.id);
    expect(validation.ok).toBe(true);

    await submitDraftForReview(projectA, noticePkg.id, { draftRevisionId: draft.id });

    // SoD: preparer cannot approve their own package/revision.
    await expect(
      approveDraft(projectA, noticePkg.id, { draftRevisionId: draft.id }),
    ).rejects.toThrow(/Segregation of duties/i);

    asUser(approver, tenantA);
    await approveDraft(projectA, noticePkg.id, { draftRevisionId: draft.id });

    await expect(
      approveDraft(projectA, noticePkg.id, { draftRevisionId: draft.id }),
    ).rejects.toThrow(/Already approved/i);

    const exported = await generateExport(projectA, noticePkg.id);
    expect(exported.bundles.length).toBe(5);
    expect(exported.plainText).not.toMatch(/\[INTERNAL\]/i);
    expect(exported.manifest.deliveryAuthorized).toBe(false);
    expect(exported.manifest.excludesInternalComments).toBe(true);

    const finalPkg = await getNoticePackage(projectA, noticePkg.id);
    expect(finalPkg.status).toBe('EXPORTED');
    expect(finalPkg.status).not.toBe('SENT');

    assertNoSendOperations();

    // Prefer trigger-presence check over an interactive mutation that aborts the
    // Prisma pool (immutability triggers leave the connection wedged).
    const draftGuards = await withBypass(
      async (tx) =>
        tx.$queryRaw<Array<{ tgname: string }>>`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = '"notice_draft_revision"'::regclass
          AND NOT tgisinternal
      `,
    );
    expect(draftGuards.some((row) => row.tgname.includes('immutable'))).toBe(true);
  });

  it('denies notice reads without tenant context under FORCE RLS', async () => {
    asUser(userA, tenantA);
    const submitted = await createAndSubmitConfigurationRevision(projectA, packageId, {
      summary: 'RLS check',
    });
    asUser(approver, tenantA);
    await approveConfigurationRevision(projectA, packageId, submitted.id);

    const snapshot = await withBypass(async (tx) =>
      tx.approvedNoticeRuleSnapshot.findFirstOrThrow({
        where: { sourceObligationId: obligationId },
      }),
    );

    asUser(userA, tenantA);
    const calendar = await createProjectCalendar(projectA, {
      name: 'RLS calendar',
      timezone: 'Asia/Dubai',
      weekendDays: [6, 7],
    });
    const calRev = await createCalendarRevision(projectA, calendar.id, {
      weekendDays: [6, 7],
      holidays: [],
      specialWorkingDays: [],
    });
    asUser(approver, tenantA);
    const approvedCal = await approveCalendarRevision(projectA, calendar.id, calRev.id);

    asUser(userA, tenantA);
    const event = await createProjectEvent(projectA, {
      title: 'RLS event',
      eventCategory: 'INSTRUCTION',
      timezone: 'Asia/Dubai',
      contractPackageId: packageId,
    });
    const triggerDate = await addProjectEventDate(projectA, event.id, {
      dateType: 'INSTRUCTION_DATE',
      dateValue: '2026-02-01T09:00:00+04:00',
      timezone: 'Asia/Dubai',
      precision: 'EXACT_DATETIME',
    });
    await verifyProjectEventDate(projectA, event.id, triggerDate.id);
    await confirmProjectEvent(projectA, event.id, {
      confirmationStatus: 'CONFIRMED_FOR_DEADLINE_ANALYSIS',
    });
    const assessment = await confirmRuleApplicability(projectA, event.id, {
      approvedRuleSnapshotId: snapshot.id,
      rationale: 'Applies',
    });
    const calculation = await calculateEventDeadline(projectA, event.id, {
      assessmentId: assessment.id,
      calendarRevisionId: approvedCal.id,
      triggerDateId: triggerDate.id,
    });
    asUser(approver, tenantA);
    await verifyDeadlineCalculation(projectA, calculation.id);

    asUser(userA, tenantA);
    const noticePkg = await createNoticePackageFromDeadline(projectA, {
      deadlineCalculationId: calculation.id,
      noticeType: 'INITIAL_NOTICE',
      title: 'RLS notice',
      language: 'en',
    });

    const denied = await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: false });
      return tx.noticePackage.findMany({ where: { projectId: projectA } });
    });
    expect(denied).toHaveLength(0);

    const allowed = await withBypass(async (tx) =>
      tx.noticePackage.findMany({ where: { id: noticePkg.id } }),
    );
    expect(allowed).toHaveLength(1);
  });
});
