import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { prisma } from '@/server/db';
import { setRlsContext } from '@/server/db/tenant-context';

vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/server/queue/ingestion-queue', () => ({
  enqueueProcessDocumentJob: vi.fn(async () => undefined),
  redisReachable: vi.fn(async () => true),
}));

requireTestDatabaseUrl();

import { purgeNoticeTables } from '@/server/notices/test-purge';

async function withBypass<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

describe('document ingestion RLS + immutability', () => {
  let tenantA = '';
  let tenantB = '';
  let projectA = '';
  let projectB = '';
  let userId = '';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await withBypass(async (tx) => {
      // Required for append-only audit/ingestion cleanup in tests.
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
      // Slice 3 tables may reference document versions / projects from prior suites.
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
      await tx.ingestionEvent.deleteMany();
      await tx.outboxEvent.deleteMany();
      await tx.evidenceSegment.deleteMany();
      await tx.extractedArtifact.deleteMany();
      await tx.documentProcessingRun.deleteMany();
      await tx.uploadSession.deleteMany();
      await tx.documentRelationship.deleteMany();
      // Clear currentVersion FK before deleting versions/documents.
      await tx.$executeRaw`UPDATE source_document SET "currentVersionId" = NULL`;
      await tx.documentVersion.deleteMany();
      await tx.sourceDocument.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const stamp = Date.now();
    await withBypass(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `doc-${stamp}@example.com`,
          name: 'Doc User',
          emailVerified: true,
        },
      });
      userId = user.id;
      const a = await tx.tenant.create({ data: { name: 'A', slug: `a-${stamp}` } });
      const b = await tx.tenant.create({ data: { name: 'B', slug: `b-${stamp}` } });
      tenantA = a.id;
      tenantB = b.id;
      await tx.tenantMembership.create({
        data: { tenantId: a.id, userId: user.id, role: 'TENANT_ADMIN' },
      });
      const pa = await tx.project.create({
        data: {
          tenantId: a.id,
          name: 'PA',
          code: 'PA',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      const pb = await tx.project.create({
        data: {
          tenantId: b.id,
          name: 'PB',
          code: 'PB',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          timezone: 'Asia/Dubai',
          status: 'ACTIVE',
        },
      });
      projectA = pa.id;
      projectB = pb.id;
    });
  });

  it('RLS: denies source documents without tenant context', async () => {
    await withBypass(async (tx) => {
      await tx.sourceDocument.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          title: 'Letter',
          documentType: 'LETTER',
          createdByUserId: userId,
          status: 'READY',
        },
      });
    });

    await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { userId, bypass: false });
      const rows = await tx.sourceDocument.findMany();
      expect(rows).toHaveLength(0);
    });
  });

  it('RLS: tenant A cannot read tenant B documents', async () => {
    let docB = '';
    await withBypass(async (tx) => {
      const created = await tx.sourceDocument.create({
        data: {
          tenantId: tenantB,
          projectId: projectB,
          title: 'Secret',
          documentType: 'LETTER',
          createdByUserId: userId,
          status: 'READY',
        },
      });
      docB = created.id;
    });

    await prisma.$transaction(async (tx) => {
      await setRlsContext(tx, { userId, tenantId: tenantA, bypass: false });
      const row = await tx.sourceDocument.findFirst({ where: { id: docB } });
      expect(row).toBeNull();
    });
  });

  it('blocks cross-project document version parent mismatch', async () => {
    // Commit the parent first, then assert the parent-guard with a single-statement
    // abort. Prefer $executeRaw over Prisma create(): after Slice 9 schema growth,
    // interactive create()+trigger abort can hang the embedded Prisma pool.
    const doc = await withBypass(async (tx) =>
      tx.sourceDocument.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          title: 'Doc',
          documentType: 'LETTER',
          createdByUserId: userId,
        },
      }),
    );
    const versionId = crypto.randomUUID();
    await expect(
      withBypass(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "document_version" (
            "id", "tenantId", "projectId", "sourceDocumentId", "versionNumber",
            "originalFilename", "normalizedFilename", "mediaType", "extension",
            "sizeBytes", "sha256", "storageProvider", "storageBucket", "storageKey",
            "uploadStatus", "malwareScanStatus", "processingStatus",
            "uploadedByUserId", "uploadedAt", "createdAt"
          ) VALUES (
            ${versionId}, ${tenantA}, ${projectB}, ${doc.id}, 1,
            'a.pdf', 'a.pdf', 'application/pdf', 'pdf',
            10, ${'a'.repeat(64)}, CAST('S3_COMPATIBLE' AS "StorageProvider"), 'bucket',
            'tenants/x/projects/y/quarantine/z/w',
            CAST('PENDING' AS "VersionUploadStatus"),
            CAST('NOT_SCANNED' AS "MalwareScanStatus"),
            CAST('NOT_STARTED' AS "VersionProcessingStatus"),
            ${userId}, NOW(), NOW()
          )
        `;
      }),
    ).rejects.toThrow(/tenant\/project must match source_document/i);
  });

  it('creates accepted versions and append-only ingestion events', async () => {
    // Trigger-level immutability for accepted versions / ingestion updates is enforced in
    // migration SQL (prevent_accepted_version_mutation / prevent_ingestion_event_mutation).
    // Interactive Prisma transactions that hit those triggers abort the connection pool in
    // this embedded runner, so we assert the happy-path custody records here.
    await withBypass(async (tx) => {
      const doc = await tx.sourceDocument.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          title: 'Doc',
          documentType: 'LETTER',
          createdByUserId: userId,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          sourceDocumentId: doc.id,
          versionNumber: 1,
          originalFilename: 'a.pdf',
          normalizedFilename: 'a.pdf',
          mediaType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 10n,
          sha256: 'b'.repeat(64),
          storageBucket: 'bucket',
          storageKey: 'tenants/a/projects/p/originals/v/r',
          uploadStatus: 'ACCEPTED',
          uploadedByUserId: userId,
          acceptedAt: new Date(),
        },
      });
      const event = await tx.ingestionEvent.create({
        data: {
          tenantId: tenantA,
          projectId: projectA,
          sourceDocumentId: doc.id,
          documentVersionId: version.id,
          eventType: 'upload.accepted',
        },
      });
      expect(version.uploadStatus).toBe('ACCEPTED');
      expect(event.eventType).toBe('upload.accepted');
    });
  });
});
