/**
 * Slice 7 controlled delivery: snapshot → authorize → send → webhook → receipt.
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
  approveDraft,
  assessEvidenceCompleteness,
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
import {
  assertNoAutonomousResend,
  authorizeDispatch,
  confirmContractualService,
  createDispatchPackageSnapshot,
  processDeliveryWebhook,
  recordAcknowledgment,
  requestDispatchAuthorization,
  sendApprovedNoticeEmail,
  assessReceipt,
} from '@/server/services/notice-delivery';
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

describe('notice delivery integration', () => {
  let tenantA: string;
  let projectA: string;
  let userA: { id: string; email: string; name: string; status: 'ACTIVE' };
  let approver: { id: string; email: string; name: string; status: 'ACTIVE' };
  let packageId: string;
  let obligationId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.NOTICE_DRAFT_SEGREGATION_OF_DUTIES = 'true';
    process.env.NOTICE_DISPATCH_SEGREGATION_OF_DUTIES = 'true';
    process.env.NOTICE_DELIVERY_PROVIDER = 'fake';
    process.env.APP_ENV = 'test';

    await withBypass(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_deadline_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_contract_revision_purge', 'on', true)`;
      await purgeNoticeTables(tx);
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
        data: { name: 'Delivery Tenant', slug: `dt-${Date.now()}`, status: 'ACTIVE' },
      });
      const uA = await tx.user.create({
        data: { email: `dt-a-${Date.now()}@example.com`, name: 'Preparer', status: 'ACTIVE' },
      });
      const uB = await tx.user.create({
        data: { email: `dt-b-${Date.now()}@example.com`, name: 'Authorizer', status: 'ACTIVE' },
      });
      const pA = await tx.project.create({
        data: {
          tenantId: tA.id,
          name: 'Delivery Project',
          code: `DT${Date.now()}`.slice(0, 12),
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
          name: 'Delivery contract',
          status: 'DRAFT',
          createdByUserId: uA.id,
        },
      });

      const source = await tx.sourceDocument.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          title: 'Fixture',
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
          sha256: 'a'.repeat(64),
          storageBucket: 'bucket',
          storageKey: `key/${source.id}`,
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
          title: 'GC',
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
          textChecksum: 'b'.repeat(64),
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
          actionDescription: 'Give notice',
          reviewStatus: 'VERIFIED',
        },
      });
      const contact = await tx.contactPoint.create({
        data: {
          tenantId: tA.id,
          projectId: pA.id,
          contractPackageId: pkg.id,
          namedPerson: 'Engineer',
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
      await tx.noticeRule.create({
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

      return { tA, pA, uA, uB, pkg, obligation };
    });

    tenantA = seeded.tA.id;
    projectA = seeded.pA.id;
    packageId = seeded.pkg.id;
    obligationId = seeded.obligation.id;
    userA = { id: seeded.uA.id, email: seeded.uA.email, name: seeded.uA.name, status: 'ACTIVE' };
    approver = { id: seeded.uB.id, email: seeded.uB.email, name: seeded.uB.name, status: 'ACTIVE' };
  });

  function asUser(user: typeof userA, tenantId: string) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  }

  async function bootstrapExportedNotice(): Promise<{ noticePackageId: string; prepId: string }> {
    asUser(userA, tenantA);
    const submitted = await createAndSubmitConfigurationRevision(projectA, packageId, {
      summary: 'Delivery fixture',
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
      name: 'Cal',
      timezone: 'Asia/Dubai',
      weekendDays: [5, 6],
    });
    const rev = await createCalendarRevision(projectA, calendar.id, {
      weekendDays: [5, 6],
      holidays: [],
      specialWorkingDays: [],
    });
    asUser(approver, tenantA);
    const approvedCal = await approveCalendarRevision(projectA, calendar.id, rev.id);

    asUser(userA, tenantA);
    const event = await createProjectEvent(projectA, {
      title: 'Instruction',
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
      title: 'Notice for delivery',
      language: 'en',
    });

    const refreshed = await getNoticePackage(projectA, noticePkg.id);
    const prep = refreshed.deliveryPreparations[0]!;
    await verifyDeliveryPreparation(projectA, noticePkg.id, prep.id, {
      emailAddress: 'engineer@example.com',
      selectedMethod: 'EMAIL',
    });

    for (const fact of refreshed.facts) {
      await verifyNoticeFact(projectA, noticePkg.id, fact.id, {
        verificationStatus: 'HUMAN_CONFIRMED',
        approvedForDrafting: true,
      });
    }

    for (const req of refreshed.evidenceRequirements) {
      await linkEvidence(projectA, noticePkg.id, {
        evidenceRequirementId: req.id,
        role: 'PRIMARY',
        reviewerAuthoredStatement: 'Fixture satisfied',
        satisfactionStatus: 'SATISFIED',
      });
    }

    await assessEvidenceCompleteness(projectA, noticePkg.id);
    const draft = await generateDeterministicDraft(projectA, noticePkg.id);
    const editable = draft.sections.find((s) => s.sectionType === 'REQUESTED_ACTION');
    if (editable) {
      await editDraftSection(projectA, noticePkg.id, draft.id, editable.id, {
        body: 'Please acknowledge receipt.',
      });
    }
    await runDraftValidation(projectA, noticePkg.id, draft.id);
    await submitDraftForReview(projectA, noticePkg.id, { draftRevisionId: draft.id });
    asUser(approver, tenantA);
    await approveDraft(projectA, noticePkg.id, { draftRevisionId: draft.id });
    asUser(userA, tenantA);
    await generateExport(projectA, noticePkg.id);

    return { noticePackageId: noticePkg.id, prepId: prep.id };
  }

  it('runs controlled delivery with SoD multi-user flow', async () => {
    const { noticePackageId, prepId } = await bootstrapExportedNotice();

    const { snapshot } = await createDispatchPackageSnapshot(projectA, noticePackageId, {
      channel: 'CONTROLLED_EMAIL',
      subject: 'Formal notice',
      plainText: 'Please find the approved notice attached.',
    });

    const auth = await requestDispatchAuthorization(projectA, noticePackageId, snapshot.id, {
      rationale: 'Ready to send',
    });

    await expect(
      authorizeDispatch(projectA, noticePackageId, auth.id, {
        recipientsReviewed: true,
        methodReviewed: true,
        attachmentsReviewed: true,
        deadlineReviewed: true,
        scopeReviewed: true,
        deliveryRiskAcknowledged: true,
      }),
    ).rejects.toThrow(/Segregation of duties/i);

    asUser(approver, tenantA);
    const authorized = await authorizeDispatch(projectA, noticePackageId, auth.id, {
      recipientsReviewed: true,
      methodReviewed: true,
      attachmentsReviewed: true,
      deadlineReviewed: true,
      scopeReviewed: true,
      deliveryRiskAcknowledged: true,
    });
    expect(authorized.status).toBe('AUTHORIZED');

    asUser(userA, tenantA);
    const attempt = await sendApprovedNoticeEmail(projectA, noticePackageId, auth.id);
    expect(attempt.providerMessageId).toBeTruthy();
    expect(attempt.status).toBe('SENT');

    const rawBody = Buffer.from(
      JSON.stringify({
        eventId: `evt-${Date.now()}`,
        messageId: attempt.providerMessageId,
        eventType: 'delivered',
        occurredAt: new Date().toISOString(),
        recipients: [{ preparationId: prepId, status: 'DELIVERED' }],
      }),
    );
    const signature = `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    const webhook = await processDeliveryWebhook(
      'fake',
      { 'x-cr-fake-signature': signature },
      rawBody,
    );
    expect(webhook.duplicate).toBe(false);
    expect(webhook.attemptStatus).toBe('DELIVERED');

    asUser(userA, tenantA);
    await recordAcknowledgment(projectA, noticePackageId, {
      attemptId: attempt.id,
      recipientId: attempt.recipients[0]?.id,
      acknowledgmentType: 'EMAIL_REPLY',
      acknowledgedAt: new Date().toISOString(),
      summary: 'Acknowledged by engineer',
    });

    const receipt = await assessReceipt(projectA, noticePackageId, {
      attemptId: attempt.id,
      receiptStatus: 'DELIVERED',
      rationale: 'Provider webhook confirmed delivery',
    });

    asUser(approver, tenantA);
    const confirmed = await confirmContractualService(projectA, noticePackageId, {
      assessmentId: receipt.id,
      contractualServiceStatus: 'HUMAN_CONFIRMED',
      rationale: 'Contractual notice period satisfied',
    });
    expect(confirmed.contractualServiceStatus).toBe('HUMAN_CONFIRMED');

    assertNoAutonomousResend();
  });

  it('blocks send without authorization', async () => {
    const { noticePackageId } = await bootstrapExportedNotice();
    const fakeAuthId = '00000000-0000-4000-8000-000000000001';
    await expect(sendApprovedNoticeEmail(projectA, noticePackageId, fakeAuthId)).rejects.toThrow(
      /not found|Resource not found/i,
    );
  });

  it('blocks future channel snapshot', async () => {
    const { noticePackageId } = await bootstrapExportedNotice();
    await expect(
      createDispatchPackageSnapshot(projectA, noticePackageId, {
        channel: 'FUTURE_ACONEX',
        subject: 'Test',
        plainText: 'Body',
      }),
    ).rejects.toThrow(/Future channels|not operational/i);
  });

  it('blocks expired authorization send', async () => {
    const { noticePackageId } = await bootstrapExportedNotice();
    const { snapshot } = await createDispatchPackageSnapshot(projectA, noticePackageId, {
      channel: 'CONTROLLED_EMAIL',
      subject: 'Formal notice',
      plainText: 'Body text for notice.',
    });
    const auth = await requestDispatchAuthorization(projectA, noticePackageId, snapshot.id, {});
    asUser(approver, tenantA);
    await authorizeDispatch(projectA, noticePackageId, auth.id, {
      recipientsReviewed: true,
      methodReviewed: true,
      attachmentsReviewed: true,
      deadlineReviewed: true,
      scopeReviewed: true,
      deliveryRiskAcknowledged: true,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    asUser(userA, tenantA);
    await expect(sendApprovedNoticeEmail(projectA, noticePackageId, auth.id)).rejects.toThrow(
      /expired|not dispatchable/i,
    );
  });

  it('denies dispatch reads without tenant context under FORCE RLS', async () => {
    const { noticePackageId } = await bootstrapExportedNotice();
    await createDispatchPackageSnapshot(projectA, noticePackageId, {
      channel: 'CONTROLLED_EMAIL',
      subject: 'RLS test',
      plainText: 'Testing row level security.',
    });

    const denied = await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: false });
      return tx.noticeDispatchPackageSnapshot.count();
    });
    expect(denied).toBe(0);
  });
});
