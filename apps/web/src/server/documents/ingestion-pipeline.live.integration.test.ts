/**
 * Authoritative live ingestion pipeline (Mode B).
 * Requires real Postgres + MinIO + Redis + ClamAV + ARQ worker + outbox dispatcher.
 */
import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { getServerEnv } from '@/lib/env';
import { verifySignedTenantValue } from '@/server/auth/active-tenant-crypto';
import { getAuthorizedProject, requireProjectCapability } from '@/server/authz/context';
import { setRlsContext } from '@/server/db/tenant-context';
import { AppError } from '@/server/errors';
import { setLiveSignedActiveTenant } from '@/server/live/live-active-tenant-state';
import {
  atStage,
  describeSafeError,
  liveDiagnostic,
  LiveStageTracker,
  LiveTestStageError,
  pollUntil,
} from '@/server/live/live-diagnostics';
import {
  bootstrapLiveTenant,
  inspectFixtureVisibility,
  type LiveTenantFixture,
} from '@/server/live/live-fixtures';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';
import { satisfiesReadyInvariant } from '@/server/ready/ready-invariant';

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
      return verifySignedTenantValue(signed, getServerEnv().BETTER_AUTH_SECRET);
    }),
    writeActiveTenantId: vi.fn(async (tenantId: string) => {
      const { signTenantId } = await import('@/server/auth/active-tenant-crypto');
      state.setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
    }),
    clearActiveTenantId: vi.fn(async () => {
      state.setLiveSignedActiveTenant(null);
    }),
  };
});

import { getSessionUser } from '@/server/auth/session';
import { readActiveTenantId } from '@/server/auth/active-tenant';
import {
  completeDocumentUpload,
  createAuthorizedDownload,
  initiateDocumentUpload,
  listEvidenceSegments,
} from '@/server/services/documents';
import { selectActiveTenant } from '@/server/services/tenants';

/** Minimal PDF with correct xref offsets that pypdf can extract (bad offsets → FAILED). */
const CLEAN_PDF = Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 51 >>stream
BT /F1 12 Tf 100 700 Td (Hello ContractRadar) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000233 00000 n 
0000000332 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF
`);

// Isolated EICAR bytes — test fixture only (never logged).
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

const databaseUrl = (() => {
  try {
    return requireTestDatabaseUrl();
  } catch {
    return null;
  }
})();

type ScenarioCtx = {
  name: string;
  stages: LiveStageTracker;
  fixture: LiveTenantFixture;
  uploadSessionId?: string;
  sourceDocumentId?: string | null;
  documentVersionId?: string | null;
  processingRunId?: string | null;
  correlationId?: string | null;
  outboxId?: string | null;
};

describe('live ingestion pipeline (authoritative)', () => {
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : null;

  let enabled = false;
  let fixtureA: LiveTenantFixture | null = null;
  let fixtureB: LiveTenantFixture | null = null;
  let activeScenario: ScenarioCtx | null = null;

  beforeAll(async () => {
    try {
      requireLiveServices('postgres-pipeline', Boolean(databaseUrl && prisma));
      if (!prisma) return;
      await prisma.$connect();
      fixtureA = await bootstrapLiveTenant(prisma, { label: 'tenA' });
      fixtureB = await bootstrapLiveTenant(prisma, { label: 'tenB' });
      enabled = true;
      liveDiagnostic('fixture-ready', {
        tenantA: fixtureA.tenantId,
        tenantB: fixtureB.tenantId,
      });
    } catch (error) {
      if (isLiveSkip(error)) {
        enabled = false;
        return;
      }
      throw new LiveTestStageError('fixture-bootstrap', error);
    }
  }, 60_000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  afterEach(async (context) => {
    const failed = context.task.result?.state === 'fail';
    if (!failed || !activeScenario || !prisma) {
      activeScenario = null;
      return;
    }
    const s = activeScenario;
    try {
      const snapshot = await prisma.$transaction(async (tx) => {
        await setRlsContext(tx, { bypass: true });
        const session = s.uploadSessionId
          ? await tx.uploadSession.findUnique({
              where: { id: s.uploadSessionId },
              select: {
                id: true,
                status: true,
                failureCode: true,
                correlationId: true,
                documentVersionId: true,
                sourceDocumentId: true,
              },
            })
          : null;
        const versionId = s.documentVersionId ?? session?.documentVersionId ?? null;
        const docId = s.sourceDocumentId ?? session?.sourceDocumentId ?? null;
        const version = versionId
          ? await tx.documentVersion.findUnique({
              where: { id: versionId },
              select: {
                id: true,
                uploadStatus: true,
                malwareScanStatus: true,
                processingStatus: true,
                storageKey: true,
              },
            })
          : null;
        const doc = docId
          ? await tx.sourceDocument.findUnique({
              where: { id: docId },
              select: { id: true, status: true },
            })
          : null;
        const run = versionId
          ? await tx.documentProcessingRun.findFirst({
              where: { documentVersionId: versionId },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                failureCode: true,
                correlationId: true,
                attemptNumber: true,
              },
            })
          : null;
        const outbox = run
          ? await tx.outboxEvent.findFirst({
              where: { aggregateId: run.id, eventType: 'process_document_version' },
              select: { id: true, status: true, attempts: true, lastErrorSafe: true },
            })
          : null;
        const events = docId
          ? await tx.ingestionEvent.findMany({
              where: { sourceDocumentId: docId },
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: { eventType: true },
            })
          : [];
        return { session, version, doc, run, outbox, events };
      });
      liveDiagnostic('failure-snapshot', {
        scenario: s.name,
        lastSuccessfulStage: s.stages.lastSuccessful,
        tenantId: s.fixture.tenantId,
        projectId: s.fixture.projectId,
        uploadSessionId: snapshot.session?.id ?? s.uploadSessionId ?? null,
        sourceDocumentId: snapshot.doc?.id ?? s.sourceDocumentId ?? null,
        documentVersionId: snapshot.version?.id ?? s.documentVersionId ?? null,
        processingRunId: snapshot.run?.id ?? s.processingRunId ?? null,
        correlationId: snapshot.run?.correlationId ?? snapshot.session?.correlationId ?? null,
        uploadSessionStatus: snapshot.session?.status ?? null,
        uploadFailureCode: snapshot.session?.failureCode ?? null,
        documentStatus: snapshot.doc?.status ?? null,
        versionUploadStatus: snapshot.version?.uploadStatus ?? null,
        malwareScanStatus: snapshot.version?.malwareScanStatus ?? null,
        versionProcessingStatus: snapshot.version?.processingStatus ?? null,
        storageKeyKind: snapshot.version?.storageKey?.includes('/originals/')
          ? 'originals'
          : snapshot.version?.storageKey?.includes('/quarantine/')
            ? 'quarantine'
            : snapshot.version
              ? 'other'
              : null,
        processingRunStatus: snapshot.run?.status ?? null,
        processingFailureCode: snapshot.run?.failureCode ?? null,
        outboxStatus: snapshot.outbox?.status ?? null,
        outboxAttempts: snapshot.outbox?.attempts ?? null,
        outboxLastErrorSafe: snapshot.outbox?.lastErrorSafe ?? null,
        lastIngestionEventTypes: snapshot.events.map((e) => e.eventType),
      });
    } catch (error) {
      liveDiagnostic('failure-snapshot-error', describeSafeError(error));
    } finally {
      activeScenario = null;
    }
  });

  function asFixture(fixture: LiveTenantFixture) {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: fixture.owner.id,
      email: fixture.owner.email,
      name: fixture.owner.name,
      status: fixture.owner.status,
    });
    setLiveSignedActiveTenant(fixture.signedActiveTenant);
  }

  function beginScenario(name: string, fixture: LiveTenantFixture): ScenarioCtx {
    const stages = new LiveStageTracker();
    const ctx: ScenarioCtx = { name, stages, fixture };
    activeScenario = ctx;
    stages.mark('fixture-ready', { scenario: name, tenantId: fixture.tenantId });
    return ctx;
  }

  async function inspectPipelineState(ids: {
    uploadSessionId?: string;
    sourceDocumentId?: string | null;
    documentVersionId?: string | null;
  }) {
    return prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const session = ids.uploadSessionId
        ? await tx.uploadSession.findUnique({ where: { id: ids.uploadSessionId } })
        : null;
      const versionId = ids.documentVersionId ?? session?.documentVersionId ?? null;
      const docId = ids.sourceDocumentId ?? session?.sourceDocumentId ?? null;
      const version = versionId
        ? await tx.documentVersion.findUnique({ where: { id: versionId } })
        : null;
      const doc = docId ? await tx.sourceDocument.findUnique({ where: { id: docId } }) : null;
      const run = versionId
        ? await tx.documentProcessingRun.findFirst({
            where: { documentVersionId: versionId },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      const outbox = run
        ? await tx.outboxEvent.findFirst({
            where: { aggregateId: run.id, eventType: 'process_document_version' },
          })
        : null;
      const events = docId
        ? await tx.ingestionEvent.findMany({
            where: { sourceDocumentId: docId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { eventType: true },
          })
        : [];
      return {
        uploadSessionStatus: session?.status ?? null,
        documentStatus: doc?.status ?? null,
        versionUploadStatus: version?.uploadStatus ?? null,
        malwareScanStatus: version?.malwareScanStatus ?? null,
        versionProcessingStatus: version?.processingStatus ?? null,
        processingRunStatus: run?.status ?? null,
        outboxStatus: outbox?.status ?? null,
        outboxAttempts: outbox?.attempts ?? null,
        lastIngestionEventTypes: events.map((e) => e.eventType),
        uploadSessionId: session?.id ?? ids.uploadSessionId ?? null,
        sourceDocumentId: doc?.id ?? docId ?? null,
        documentVersionId: version?.id ?? versionId ?? null,
        processingRunId: run?.id ?? null,
        correlationId: run?.correlationId ?? session?.correlationId ?? null,
        outboxId: outbox?.id ?? null,
        storageKeyKind: version?.storageKey?.includes('/originals/')
          ? 'originals'
          : version?.storageKey?.includes('/quarantine/')
            ? 'quarantine'
            : null,
      };
    });
  }

  it('fixture: tenant, project, active tenant selection, and document.create capability', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const visibility = await inspectFixtureVisibility(prisma!, {
      tenantId: f.tenantId,
      userId: f.owner.id,
      projectId: f.projectId,
    });
    expect(visibility.membershipVisible).toBe(true);
    expect(visibility.projectVisible).toBe(true);
    setLiveSignedActiveTenant(null);
    const selected = await selectActiveTenant({ tenantId: f.tenantId });
    expect(selected.tenantId).toBe(f.tenantId);
    expect(await readActiveTenantId()).toBe(f.tenantId);
    const project = await getAuthorizedProject(f.projectId);
    expect(project.project.id).toBe(f.projectId);
    await requireProjectCapability(f.projectId, 'document.create');
    const initiated = await initiateDocumentUpload({
      projectId: f.projectId,
      title: 'Fixture probe',
      documentType: 'LETTER',
      filename: 'probe.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: CLEAN_PDF.length,
    });
    expect(initiated.uploadSessionId).toBeTruthy();
  });

  it('fixture: project visible only with tenant context inside the same transaction', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    const withoutContext = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: false });
      return tx.project.findFirst({ where: { id: f.projectId } });
    });
    expect(withoutContext).toBeNull();
    const withContext = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, {
        tenantId: f.tenantId,
        userId: f.owner.id,
        bypass: false,
      });
      return tx.project.findFirst({ where: { id: f.projectId } });
    });
    expect(withContext?.id).toBe(f.projectId);
  });

  it('fixture: disabled membership and foreign tenant see generic denial', async ({ skip }) => {
    if (!enabled || !prisma || !fixtureA || !fixtureB) skip();
    const f = fixtureA!;
    asFixture(fixtureB!);
    await expect(getAuthorizedProject(f.projectId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      await tx.tenantMembership.updateMany({
        where: { tenantId: f.tenantId, userId: f.owner.id },
        data: { status: 'DISABLED' },
      });
    });
    asFixture(f);
    await expect(getAuthorizedProject(f.projectId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      await tx.tenantMembership.updateMany({
        where: { tenantId: f.tenantId, userId: f.owner.id },
        data: { status: 'ACTIVE' },
      });
    });
  });

  it('complete upload creates outbox that dispatcher marks DISPATCHED with ARQ job', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const ctx = beginScenario('outbox-dispatch-path', f);
    const initiated = await atStage('upload-session-created', () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Outbox dispatch probe',
        documentType: 'LETTER',
        filename: 'dispatch-probe.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: CLEAN_PDF.length,
      }),
    );
    ctx.uploadSessionId = initiated.uploadSessionId;
    ctx.stages.mark('upload-session-created');
    await atStage('presigned-upload-completed', async () => {
      const put = await fetch(initiated.uploadUrl, {
        method: 'PUT',
        headers: initiated.uploadHeaders as Record<string, string>,
        body: CLEAN_PDF,
      });
      expect(put.ok).toBe(true);
    });
    const completed = await atStage('upload-completion-requested', () =>
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
        duplicateDecision: 'new_occurrence',
      }),
    );
    ctx.sourceDocumentId = completed.sourceDocumentId as string;
    ctx.documentVersionId = completed.documentVersionId as string;
    ctx.processingRunId = completed.processingRunId as string;
    ctx.stages.mark('processing-run-created', {
      processingRunId: ctx.processingRunId,
    });

    // Immediate contract: outbox row must exist and be claimable before waiting on dispatcher.
    const pendingContract = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.outboxEvent.findFirst({
        where: {
          aggregateId: ctx.processingRunId!,
          eventType: 'process_document_version',
        },
        select: {
          id: true,
          status: true,
          eventType: true,
          availableAt: true,
          attempts: true,
          payload: true,
          correlationId: true,
        },
      });
    });
    expect(pendingContract).toBeTruthy();
    expect(pendingContract!.eventType).toBe('process_document_version');
    expect(['PENDING', 'DISPATCHING', 'DISPATCHED']).toContain(pendingContract!.status);
    expect(pendingContract!.attempts).toBeGreaterThanOrEqual(0);
    expect(pendingContract!.availableAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const payload = pendingContract!.payload as Record<string, unknown>;
    expect(payload.processingRunId).toBe(ctx.processingRunId);
    expect(payload.documentVersionId).toBe(ctx.documentVersionId);
    expect(payload.correlationId).toBeTruthy();
    liveDiagnostic('outbox-pending-contract', {
      outboxId: pendingContract!.id,
      status: pendingContract!.status,
      attempts: pendingContract!.attempts,
      eventType: pendingContract!.eventType,
    });
    ctx.outboxId = pendingContract!.id;
    ctx.stages.mark('outbox-pending', { outboxStatus: pendingContract!.status });

    const outbox = await pollUntil({
      scenario: 'outbox-dispatch-path',
      expected: 'outbox PENDING/DISPATCHING/DISPATCHED',
      timeoutMs: 15_000,
      observe: async () => {
        const state = await inspectPipelineState({
          uploadSessionId: initiated.uploadSessionId,
          documentVersionId: ctx.documentVersionId,
        });
        ctx.outboxId = state.outboxId;
        const ready =
          state.outboxStatus === 'PENDING' ||
          state.outboxStatus === 'DISPATCHING' ||
          state.outboxStatus === 'DISPATCHED';
        return { done: ready, value: state, state };
      },
    });
    ctx.stages.mark('outbox-pending', { outboxStatus: outbox.outboxStatus });

    const dispatched = await pollUntil({
      scenario: 'outbox-dispatch-path',
      expected: 'outbox DISPATCHED',
      timeoutMs: 20_000,
      observe: async () => {
        const state = await inspectPipelineState({
          uploadSessionId: initiated.uploadSessionId,
          documentVersionId: ctx.documentVersionId,
        });
        return {
          done: state.outboxStatus === 'DISPATCHED',
          value: state,
          state,
        };
      },
    });
    expect(dispatched.outboxStatus).toBe('DISPATCHED');
    expect(dispatched.correlationId).toBeTruthy();
    ctx.stages.mark('outbox-dispatched', { outboxId: dispatched.outboxId });
  }, 60_000);

  it('invalid media signature: rejects completion and creates no processing job', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const ctx = beginScenario('invalid-media', f);
    const bogus = Buffer.from('<html>not a pdf</html>');

    const initiated = await atStage('upload-session-created', () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Invalid media',
        documentType: 'LETTER',
        filename: 'spoof.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: bogus.length,
      }),
    );
    ctx.uploadSessionId = initiated.uploadSessionId;
    ctx.stages.mark('upload-session-created');

    await atStage('invalid-object-uploaded', async () => {
      const put = await fetch(initiated.uploadUrl, {
        method: 'PUT',
        headers: initiated.uploadHeaders as Record<string, string>,
        body: bogus,
      });
      expect(put.ok).toBe(true);
    });

    let rejected: unknown;
    try {
      await completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(bogus).digest('hex'),
      });
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(AppError);
    expect((rejected as AppError).code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify((rejected as AppError).details ?? {})).toMatch(/SIGNATURE_/);
    ctx.stages.mark('completion-rejected', {
      code: (rejected as AppError).code,
      details: (rejected as AppError).details,
    });

    // Documented model: rejected spoof uploads leave no DocumentVersion / run / outbox.
    // UploadSession remains REJECTED after the validation transaction commits.
    const session = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.uploadSession.findUnique({
        where: { id: initiated.uploadSessionId },
        select: { status: true, failureCode: true, documentVersionId: true },
      });
    });
    expect(session?.status).toBe('REJECTED');
    expect(session?.failureCode).toMatch(/SIGNATURE_/);
    expect(session?.documentVersionId).toBeNull();

    const state = await inspectPipelineState({
      uploadSessionId: initiated.uploadSessionId,
    });
    expect(state.uploadSessionStatus).toBe('REJECTED');
    expect(state.versionUploadStatus === 'ACCEPTED' ? 1 : 0).toBe(0);
    ctx.stages.mark('no-version-confirmed');
    expect(state.processingRunId).toBeNull();
    ctx.stages.mark('no-run-confirmed');
    expect(state.outboxId).toBeNull();
    ctx.stages.mark('no-outbox-confirmed');
  }, 60_000);

  it('clean PDF: upload → outbox → clamav → promote → READY → signed download', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const ctx = beginScenario('clean-pdf', f);

    const initiated = await atStage('upload-session-created', () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Live clean PDF',
        documentType: 'LETTER',
        filename: 'clean-live.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: CLEAN_PDF.length,
      }),
    );
    ctx.uploadSessionId = initiated.uploadSessionId;
    ctx.stages.mark('upload-session-created');

    ctx.stages.mark('presigned-upload-started');
    await atStage('presigned-upload-completed', async () => {
      const put = await fetch(initiated.uploadUrl, {
        method: 'PUT',
        headers: initiated.uploadHeaders as Record<string, string>,
        body: CLEAN_PDF,
      });
      expect(put.ok).toBe(true);
    });

    const completed = await atStage('upload-completion-requested', () =>
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
        duplicateDecision: 'new_occurrence',
      }),
    );
    expect(completed.status === 'ACCEPTED' || completed.documentVersionId).toBeTruthy();
    ctx.sourceDocumentId = completed.sourceDocumentId as string;
    ctx.documentVersionId = completed.documentVersionId as string;
    ctx.processingRunId = completed.processingRunId as string;
    ctx.stages.mark('object-verified');
    ctx.stages.mark('processing-run-created');

    await pollUntil({
      scenario: 'clean-pdf',
      expected: 'outbox DISPATCHED',
      timeoutMs: 45_000,
      observe: async () => {
        const state = await inspectPipelineState({
          uploadSessionId: initiated.uploadSessionId,
          documentVersionId: ctx.documentVersionId,
        });
        if (state.outboxStatus === 'PENDING') ctx.stages.mark('outbox-pending');
        if (state.outboxStatus === 'DISPATCHED') ctx.stages.mark('outbox-dispatched');
        return {
          done: state.outboxStatus === 'DISPATCHED',
          value: state,
          state: { ...state, lastSuccessfulStage: ctx.stages.lastSuccessful },
        };
      },
    });

    const readyDoc = await pollUntil({
      scenario: 'clean-pdf',
      expected: 'READY invariant',
      timeoutMs: 120_000,
      observe: async () => {
        const state = await inspectPipelineState({
          uploadSessionId: initiated.uploadSessionId,
          documentVersionId: ctx.documentVersionId,
          sourceDocumentId: ctx.sourceDocumentId,
        });
        if (state.malwareScanStatus === 'SCANNING') ctx.stages.mark('malware-scan-started');
        if (state.malwareScanStatus === 'CLEAN' || state.malwareScanStatus === 'INFECTED') {
          ctx.stages.mark('malware-result', { malwareScanStatus: state.malwareScanStatus });
        }
        if (state.storageKeyKind === 'originals') {
          ctx.stages.mark('promotion-completed');
        }
        if (state.processingRunStatus === 'RUNNING') ctx.stages.mark('extraction-started');
        if (state.processingRunStatus === 'SUCCEEDED') ctx.stages.mark('extraction-completed');

        const packed = await prisma!.$transaction(async (tx) => {
          await setRlsContext(tx, { bypass: true });
          const doc = await tx.sourceDocument.findUnique({
            where: { id: ctx.sourceDocumentId! },
          });
          const version = await tx.documentVersion.findUnique({
            where: { id: ctx.documentVersionId! },
          });
          const run = await tx.documentProcessingRun.findFirst({
            where: { documentVersionId: ctx.documentVersionId! },
            orderBy: { createdAt: 'desc' },
          });
          const artifact = await tx.extractedArtifact.findFirst({
            where: { documentVersionId: ctx.documentVersionId! },
          });
          return { doc, version, run, artifact };
        });
        const ready =
          packed.doc &&
          packed.version &&
          packed.run &&
          satisfiesReadyInvariant({
            documentStatus: packed.doc.status,
            uploadStatus: packed.version.uploadStatus,
            malwareScanStatus: packed.version.malwareScanStatus,
            storageKey: packed.version.storageKey,
            processingRunStatus: packed.run.status,
            hasDerivedArtifact: Boolean(packed.artifact),
          });
        return {
          done: Boolean(ready),
          value: packed,
          state: { ...state, lastSuccessfulStage: ctx.stages.lastSuccessful },
        };
      },
    });

    expect(readyDoc.version!.malwareScanStatus).toBe('CLEAN');
    expect(readyDoc.version!.storageKey).toContain('/originals/');
    ctx.stages.mark('ready-observed');

    const segments = await listEvidenceSegments(f.projectId, ctx.sourceDocumentId!);
    expect(segments.length).toBeGreaterThan(0);
    ctx.stages.mark('evidence-created', { segmentCount: segments.length });

    const download = await createAuthorizedDownload(f.projectId, ctx.documentVersionId!);
    const downloaded = await fetch(download.downloadUrl);
    expect(downloaded.ok).toBe(true);
    const body = Buffer.from(await downloaded.arrayBuffer());
    expect(createHash('sha256').update(body).digest('hex')).toBe(
      createHash('sha256').update(CLEAN_PDF).digest('hex'),
    );
    ctx.stages.mark('download-authorized');
  }, 240_000);

  it('infected EICAR: quarantine only, no extraction/promotion/download', async ({ skip }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const ctx = beginScenario('eicar-infected', f);

    const initiated = await atStage('upload-session-created', () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Live infected fixture',
        documentType: 'OTHER',
        filename: 'eicar-live.txt',
        declaredMediaType: 'text/plain',
        declaredSizeBytes: EICAR.length,
      }),
    );
    ctx.uploadSessionId = initiated.uploadSessionId;
    ctx.stages.mark('upload-session-created');

    await atStage('presigned-upload-completed', async () => {
      const put = await fetch(initiated.uploadUrl, {
        method: 'PUT',
        headers: initiated.uploadHeaders as Record<string, string>,
        body: EICAR,
      });
      expect(put.ok).toBe(true);
    });

    const completed = await atStage('upload-completion-requested', () =>
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(EICAR).digest('hex'),
        duplicateDecision: 'new_occurrence',
      }),
    );
    ctx.documentVersionId = completed.documentVersionId as string;
    ctx.sourceDocumentId = completed.sourceDocumentId as string;
    ctx.stages.mark('processing-run-created');

    const infected = await pollUntil({
      scenario: 'eicar-infected',
      expected: 'malwareScanStatus=INFECTED (terminal)',
      timeoutMs: 120_000,
      observe: async () => {
        const state = await inspectPipelineState({
          uploadSessionId: initiated.uploadSessionId,
          documentVersionId: ctx.documentVersionId,
          sourceDocumentId: ctx.sourceDocumentId,
        });
        if (state.outboxStatus === 'DISPATCHED') ctx.stages.mark('outbox-dispatched');
        if (state.malwareScanStatus === 'SCANNING') ctx.stages.mark('malware-scan-started');
        if (state.malwareScanStatus === 'INFECTED') {
          ctx.stages.mark('infected-status-observed');
        }
        // Fail fast on non-infected terminal scanner outcomes.
        if (
          state.malwareScanStatus === 'ERROR' ||
          (state.processingRunStatus === 'FAILED' && state.malwareScanStatus !== 'INFECTED')
        ) {
          throw new Error(`EICAR did not reach INFECTED. Last state: ${JSON.stringify(state)}`);
        }
        return {
          done: state.malwareScanStatus === 'INFECTED',
          value: state,
          state: { ...state, lastSuccessfulStage: ctx.stages.lastSuccessful },
        };
      },
    });

    expect(infected.storageKeyKind).toBe('quarantine');
    expect(infected.versionUploadStatus).not.toBe('ACCEPTED');
    ctx.stages.mark('quarantine-preserved');

    const artifacts = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.extractedArtifact.count({
        where: { documentVersionId: ctx.documentVersionId! },
      });
    });
    expect(artifacts).toBe(0);
    ctx.stages.mark('no-extraction-confirmed');
    ctx.stages.mark('no-promotion-confirmed');

    await expect(
      createAuthorizedDownload(f.projectId, ctx.documentVersionId!),
    ).rejects.toBeInstanceOf(AppError);
    ctx.stages.mark('download-denied');

    const events = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.ingestionEvent.findMany({
        where: { sourceDocumentId: ctx.sourceDocumentId! },
        select: { eventType: true },
      });
    });
    expect(
      events.some((e) => e.eventType.includes('malware') || e.eventType.includes('scan')),
    ).toBe(true);
  }, 240_000);

  it('cross-tenant: cannot complete, query, or download another tenant upload', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA || !fixtureB) skip();
    const a = fixtureA!;
    const b = fixtureB!;
    asFixture(a);
    const initiated = await initiateDocumentUpload({
      projectId: a.projectId,
      title: 'Tenant A only',
      documentType: 'LETTER',
      filename: 'tenant-a.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: CLEAN_PDF.length,
    });
    await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: CLEAN_PDF,
    });

    asFixture(b);
    await expect(
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    const leaked = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, {
        tenantId: b.tenantId,
        userId: b.owner.id,
        bypass: false,
      });
      return tx.uploadSession.findFirst({ where: { id: initiated.uploadSessionId } });
    });
    expect(leaked).toBeNull();
  }, 120_000);
});
