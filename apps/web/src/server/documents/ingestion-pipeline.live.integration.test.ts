/**
 * Authoritative live ingestion pipeline (Mode B).
 * Requires real Postgres + MinIO + Redis + ClamAV + ARQ worker + outbox dispatcher.
 */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { getServerEnv } from '@/lib/env';
import { verifySignedTenantValue } from '@/server/auth/active-tenant-crypto';
import { getAuthorizedProject, requireProjectCapability } from '@/server/authz/context';
import { setRlsContext } from '@/server/db/tenant-context';
import { AppError } from '@/server/errors';
import {
  getLiveSignedActiveTenant,
  setLiveSignedActiveTenant,
} from '@/server/live/live-active-tenant-state';
import { formatLiveError, LiveStageTracker } from '@/server/live/live-diagnostics';
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

const CLEAN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nContractRadar clean fixture\n',
);

// Isolated EICAR bytes — test fixture only (never logged).
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

const databaseUrl = (() => {
  try {
    return requireTestDatabaseUrl();
  } catch {
    return null;
  }
})();

async function poll<T>(
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; intervalMs?: number; label: string },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 1_500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for ${opts.label}`);
}

describe('live ingestion pipeline (authoritative)', () => {
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : null;

  let enabled = false;
  let fixtureA: LiveTenantFixture | null = null;
  let fixtureB: LiveTenantFixture | null = null;

  beforeAll(async () => {
    try {
      requireLiveServices('postgres-pipeline', Boolean(databaseUrl && prisma));
      if (!prisma) return;
      await prisma.$connect();
      fixtureA = await bootstrapLiveTenant(prisma, { label: 'tenA' });
      fixtureB = await bootstrapLiveTenant(prisma, { label: 'tenB' });
      enabled = true;
    } catch (error) {
      if (isLiveSkip(error)) {
        enabled = false;
        return;
      }
      throw new Error(formatLiveError(error, 'fixture-bootstrap'), { cause: error });
    }
  }, 60_000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
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

  async function withStage<T>(
    stages: LiveStageTracker,
    stageLabel: string,
    fixture: LiveTenantFixture,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const visibility = prisma
        ? await inspectFixtureVisibility(prisma, {
            tenantId: fixture.tenantId,
            userId: fixture.owner.id,
            projectId: fixture.projectId,
          })
        : null;
      console.error(
        JSON.stringify({
          liveFailure: {
            stageAttempted: stageLabel,
            lastSuccessfulStage: stages.lastSuccessful,
            tenantId: fixture.tenantId,
            projectId: fixture.projectId,
            userId: fixture.owner.id,
            activeTenant: await readActiveTenantId(),
            signedCookiePresent: Boolean(getLiveSignedActiveTenant()),
            visibility,
            error: formatLiveError(error, stageLabel),
          },
        }),
      );
      throw error;
    }
  }

  it('fixture: tenant, project, active tenant selection, and document.create capability', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const stages = new LiveStageTracker();
    stages.mark('fixture-created');

    const visibility = await inspectFixtureVisibility(prisma!, {
      tenantId: f.tenantId,
      userId: f.owner.id,
      projectId: f.projectId,
    });
    expect(visibility.membershipVisible).toBe(true);
    expect(visibility.projectVisible).toBe(true);

    // Clear then select through production tenant-selection (signs cookie via writeActiveTenantId mock).
    setLiveSignedActiveTenant(null);
    const selected = await selectActiveTenant({ tenantId: f.tenantId });
    expect(selected.tenantId).toBe(f.tenantId);
    const active = await readActiveTenantId();
    expect(active).toBe(f.tenantId);

    const project = await getAuthorizedProject(f.projectId);
    expect(project.project.id).toBe(f.projectId);
    stages.mark('authorized-project-resolved');

    const capable = await requireProjectCapability(f.projectId, 'document.create');
    expect(capable.project.id).toBe(f.projectId);

    const initiated = await initiateDocumentUpload({
      projectId: f.projectId,
      title: 'Fixture probe',
      documentType: 'LETTER',
      filename: 'probe.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: CLEAN_PDF.length,
    });
    expect(initiated.uploadSessionId).toBeTruthy();
    stages.mark('upload-session-created');
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

    // Prior transaction context must not leak.
    const after = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: false });
      return tx.project.findFirst({ where: { id: f.projectId } });
    });
    expect(after).toBeNull();
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

  it('clean PDF: upload → outbox → clamav → promote → READY → signed download', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const stages = new LiveStageTracker();
    stages.mark('fixture-created');

    const initiated = await withStage(stages, 'upload-session-created', f, async () => {
      const project = await getAuthorizedProject(f.projectId);
      expect(project.project.id).toBe(f.projectId);
      stages.mark('authorized-project-resolved');
      return initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Live clean PDF',
        documentType: 'LETTER',
        filename: 'clean-live.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: CLEAN_PDF.length,
      });
    });
    expect(initiated.uploadSessionId).toBeTruthy();
    expect(initiated.uploadUrl).toBeTruthy();
    stages.mark('upload-session-created');

    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: CLEAN_PDF,
    });
    expect(put.ok).toBe(true);
    stages.mark('object-uploaded');

    const completed = await withStage(stages, 'completion-verified', f, () =>
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
        duplicateDecision: 'new_occurrence',
      }),
    );
    expect(completed.status === 'ACCEPTED' || completed.documentVersionId).toBeTruthy();
    stages.mark('completion-verified');
    const documentId = completed.sourceDocumentId!;
    const versionId = completed.documentVersionId!;

    const outbox = await poll(
      async () => {
        return prisma!.$transaction(async (tx) => {
          await setRlsContext(tx, { bypass: true });
          const run = await tx.documentProcessingRun.findFirst({
            where: { documentVersionId: versionId },
            select: { id: true },
          });
          if (!run) return null;
          return tx.outboxEvent.findFirst({
            where: { aggregateId: run.id, eventType: 'process_document_version' },
          });
        });
      },
      { label: 'outbox event', timeoutMs: 30_000 },
    );
    expect(outbox).toBeTruthy();
    stages.mark('outbox-created');

    await poll(
      async () => {
        return prisma!.$transaction(async (tx) => {
          await setRlsContext(tx, { bypass: true });
          const event = await tx.outboxEvent.findUnique({ where: { id: outbox!.id } });
          return event?.status === 'DISPATCHED' ? event : null;
        });
      },
      { label: 'outbox DISPATCHED', timeoutMs: 60_000 },
    );
    stages.mark('job-dispatched');

    const readyDoc = await poll(
      async () => {
        return prisma!.$transaction(async (tx) => {
          await setRlsContext(tx, { bypass: true });
          const doc = await tx.sourceDocument.findUnique({ where: { id: documentId } });
          const version = await tx.documentVersion.findUnique({ where: { id: versionId } });
          const run = await tx.documentProcessingRun.findFirst({
            where: { documentVersionId: versionId },
            orderBy: { createdAt: 'desc' },
          });
          const artifact = await tx.extractedArtifact.findFirst({
            where: { documentVersionId: versionId },
          });
          if (
            doc &&
            version &&
            run &&
            satisfiesReadyInvariant({
              documentStatus: doc.status,
              uploadStatus: version.uploadStatus,
              malwareScanStatus: version.malwareScanStatus,
              storageKey: version.storageKey,
              processingRunStatus: run.status,
              hasDerivedArtifact: Boolean(artifact),
            })
          ) {
            return { doc, version, run, artifact };
          }
          return null;
        });
      },
      { label: 'READY invariant', timeoutMs: 180_000 },
    );

    expect(readyDoc.version.malwareScanStatus).toBe('CLEAN');
    stages.mark('malware-clean-or-infected');
    expect(readyDoc.version.storageKey).toContain('/originals/');
    expect(readyDoc.version.storageKey).not.toContain('/quarantine/');
    stages.mark('object-promoted-or-quarantined');
    stages.mark('extraction-finished');

    const segments = await listEvidenceSegments(f.projectId, documentId);
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(0);
    stages.mark('evidence-created');

    const download = await createAuthorizedDownload(f.projectId, versionId);
    expect(download.downloadUrl).toBeTruthy();
    const downloaded = await fetch(download.downloadUrl);
    expect(downloaded.ok).toBe(true);
    const body = Buffer.from(await downloaded.arrayBuffer());
    expect(createHash('sha256').update(body).digest('hex')).toBe(
      createHash('sha256').update(CLEAN_PDF).digest('hex'),
    );
    stages.mark('download-authorized');
  }, 240_000);

  it('infected EICAR: quarantine only, no extraction/promotion/download', async ({ skip }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const stages = new LiveStageTracker();
    stages.mark('fixture-created');

    const initiated = await withStage(stages, 'upload-session-created', f, () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Live infected fixture',
        documentType: 'OTHER',
        filename: 'eicar-live.txt',
        declaredMediaType: 'text/plain',
        declaredSizeBytes: EICAR.length,
      }),
    );
    stages.mark('upload-session-created');

    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: EICAR,
    });
    expect(put.ok).toBe(true);
    stages.mark('object-uploaded');

    const completed = await completeDocumentUpload({
      uploadSessionId: initiated.uploadSessionId,
      clientSha256: createHash('sha256').update(EICAR).digest('hex'),
      duplicateDecision: 'new_occurrence',
    });
    stages.mark('completion-verified');
    const versionId = completed.documentVersionId!;
    const documentId = completed.sourceDocumentId!;

    const infected = await poll(
      async () => {
        return prisma!.$transaction(async (tx) => {
          await setRlsContext(tx, { bypass: true });
          const version = await tx.documentVersion.findUnique({ where: { id: versionId } });
          if (version?.malwareScanStatus === 'INFECTED') return version;
          return null;
        });
      },
      { label: 'INFECTED status', timeoutMs: 180_000 },
    );

    expect(infected.storageKey).toContain('/quarantine/');
    expect(infected.uploadStatus).not.toBe('ACCEPTED');
    stages.mark('malware-clean-or-infected');
    stages.mark('object-promoted-or-quarantined');

    const artifacts = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.extractedArtifact.count({ where: { documentVersionId: versionId } });
    });
    expect(artifacts).toBe(0);

    await expect(createAuthorizedDownload(f.projectId, versionId)).rejects.toBeInstanceOf(AppError);

    const events = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.ingestionEvent.findMany({
        where: { sourceDocumentId: documentId },
        select: { eventType: true },
      });
    });
    expect(
      events.some((e) => e.eventType.includes('malware') || e.eventType.includes('scan')),
    ).toBe(true);
  }, 240_000);

  it('invalid media signature: rejects completion and creates no processing job', async ({
    skip,
  }) => {
    if (!enabled || !prisma || !fixtureA) skip();
    const f = fixtureA!;
    asFixture(f);
    const stages = new LiveStageTracker();
    stages.mark('fixture-created');
    const bogus = Buffer.from('<html>not a pdf</html>');
    const initiated = await withStage(stages, 'upload-session-created', f, () =>
      initiateDocumentUpload({
        projectId: f.projectId,
        title: 'Invalid media',
        documentType: 'LETTER',
        filename: 'spoof.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: bogus.length,
      }),
    );
    stages.mark('upload-session-created');
    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: bogus,
    });
    expect(put.ok).toBe(true);
    stages.mark('object-uploaded');

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

    const runs = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      const session = await tx.uploadSession.findUnique({
        where: { id: initiated.uploadSessionId },
      });
      expect(session?.status).toBe('REJECTED');
      if (!session?.sourceDocumentId) return 0;
      const versionCount = await tx.documentVersion.count({
        where: {
          sourceDocumentId: session.sourceDocumentId,
          uploadStatus: 'ACCEPTED',
        },
      });
      const runCount = await tx.documentProcessingRun.count({
        where: { documentVersionId: session.documentVersionId ?? 'missing' },
      });
      const outboxCount = await tx.outboxEvent.count({
        where: {
          projectId: f.projectId,
          eventType: 'process_document_version',
          aggregateId: session.documentVersionId ?? 'missing',
        },
      });
      return versionCount + runCount + outboxCount;
    });
    expect(runs).toBe(0);
  }, 120_000);

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
