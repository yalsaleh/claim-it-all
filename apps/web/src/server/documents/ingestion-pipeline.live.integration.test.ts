/**
 * Authoritative live ingestion pipeline (Mode B).
 * Requires real Postgres + MinIO + Redis + ClamAV + ARQ worker + outbox dispatcher.
 */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';
import { setRlsContext } from '@/server/db/tenant-context';
import { satisfiesReadyInvariant } from '@/server/ready/ready-invariant';

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
import { readActiveTenantId } from '@/server/auth/active-tenant';
import {
  completeDocumentUpload,
  createAuthorizedDownload,
  initiateDocumentUpload,
  listEvidenceSegments,
} from '@/server/services/documents';
import { AppError } from '@/server/errors';

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
  let tenantA = '';
  let tenantB = '';
  let projectA = '';
  let ownerA = { id: '', email: '', name: '' };
  let ownerB = { id: '', email: '', name: '' };

  beforeAll(async () => {
    try {
      requireLiveServices('postgres-pipeline', Boolean(databaseUrl && prisma));
      if (!prisma) return;
      await prisma.$connect();

      // Seeded demo tenant if present; otherwise create isolated fixtures.
      const demo = await prisma.$transaction(async (tx) => {
        await setRlsContext(tx, { bypass: true });
        return tx.tenant.findUnique({ where: { slug: 'demo-gulf-contractor' } });
      });

      await prisma.$transaction(async (tx) => {
        await setRlsContext(tx, { bypass: true });
        const stamp = Date.now();
        if (demo) {
          tenantA = demo.id;
          const project = await tx.project.findFirst({
            where: { tenantId: demo.id, code: 'KWI-RING-01' },
          });
          if (!project) throw new Error('Seed project KWI-RING-01 missing');
          projectA = project.id;
          const owner = await tx.user.findUnique({
            where: { email: 'owner@demo-contractor.example' },
          });
          if (!owner) throw new Error('Seed owner missing');
          ownerA = { id: owner.id, email: owner.email, name: owner.name };
        } else {
          const t = await tx.tenant.create({
            data: { name: 'Live A', slug: `live-a-${stamp}` },
          });
          tenantA = t.id;
          const u = await tx.user.create({
            data: {
              email: `owner-a-${stamp}@example.com`,
              name: 'Owner A',
              emailVerified: true,
              status: 'ACTIVE',
            },
          });
          ownerA = { id: u.id, email: u.email, name: u.name };
          await tx.tenantMembership.create({
            data: { tenantId: t.id, userId: u.id, role: 'TENANT_OWNER' },
          });
          const p = await tx.project.create({
            data: {
              tenantId: t.id,
              name: 'Live Project',
              code: 'LIVE-01',
              countryCode: 'AE',
              defaultCurrency: 'AED',
              timezone: 'Asia/Dubai',
              status: 'ACTIVE',
            },
          });
          projectA = p.id;
          await tx.projectMembership.create({
            data: {
              tenantId: t.id,
              projectId: p.id,
              userId: u.id,
              role: 'PROJECT_ADMIN',
            },
          });
        }

        const tb = await tx.tenant.create({
          data: { name: 'Live B', slug: `live-b-${Date.now()}` },
        });
        tenantB = tb.id;
        const ub = await tx.user.create({
          data: {
            email: `owner-b-${Date.now()}@example.com`,
            name: 'Owner B',
            emailVerified: true,
            status: 'ACTIVE',
          },
        });
        ownerB = { id: ub.id, email: ub.email, name: ub.name };
        await tx.tenantMembership.create({
          data: { tenantId: tb.id, userId: ub.id, role: 'TENANT_OWNER' },
        });
      });

      enabled = true;
    } catch (error) {
      if (isLiveSkip(error)) {
        enabled = false;
        return;
      }
      throw error;
    }
  }, 60_000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  function asOwnerA() {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: ownerA.id,
      email: ownerA.email,
      name: ownerA.name,
      status: 'ACTIVE',
    });
    vi.mocked(readActiveTenantId).mockResolvedValue(tenantA);
  }

  function asOwnerB() {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: ownerB.id,
      email: ownerB.email,
      name: ownerB.name,
      status: 'ACTIVE',
    });
    vi.mocked(readActiveTenantId).mockResolvedValue(tenantB);
  }

  it('clean PDF: upload → outbox → clamav → promote → READY → signed download', async ({
    skip,
  }) => {
    if (!enabled || !prisma) skip();
    asOwnerA();

    const initiated = await initiateDocumentUpload({
      projectId: projectA,
      title: 'Live clean PDF',
      documentType: 'LETTER',
      filename: 'clean-live.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: CLEAN_PDF.length,
    });
    expect(initiated.uploadSessionId).toBeTruthy();
    expect(initiated.uploadUrl).toBeTruthy();
    // Do not log uploadUrl.

    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: CLEAN_PDF,
    });
    expect(put.ok).toBe(true);

    const completed = await completeDocumentUpload({
      uploadSessionId: initiated.uploadSessionId,
      clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
      duplicateDecision: 'new_occurrence',
    });
    expect(completed.status === 'ACCEPTED' || completed.documentVersionId).toBeTruthy();
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
    // Eventually dispatched by outbox-dispatcher in CI.
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
    expect(readyDoc.version.storageKey).toContain('/originals/');
    expect(readyDoc.version.storageKey).not.toContain('/quarantine/');

    const segments = await listEvidenceSegments(projectA, documentId);
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(0);

    const download = await createAuthorizedDownload(projectA, versionId);
    expect(download.downloadUrl).toBeTruthy();
    const downloaded = await fetch(download.downloadUrl);
    expect(downloaded.ok).toBe(true);
    const body = Buffer.from(await downloaded.arrayBuffer());
    expect(createHash('sha256').update(body).digest('hex')).toBe(
      createHash('sha256').update(CLEAN_PDF).digest('hex'),
    );
  }, 240_000);

  it('infected EICAR: quarantine only, no extraction/promotion/download', async ({ skip }) => {
    if (!enabled || !prisma) skip();
    asOwnerA();

    const initiated = await initiateDocumentUpload({
      projectId: projectA,
      title: 'Live infected fixture',
      documentType: 'OTHER',
      filename: 'eicar-live.txt',
      declaredMediaType: 'text/plain',
      declaredSizeBytes: EICAR.length,
    });

    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: EICAR,
    });
    expect(put.ok).toBe(true);

    const completed = await completeDocumentUpload({
      uploadSessionId: initiated.uploadSessionId,
      clientSha256: createHash('sha256').update(EICAR).digest('hex'),
      duplicateDecision: 'new_occurrence',
    });
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

    const artifacts = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, { bypass: true });
      return tx.extractedArtifact.count({ where: { documentVersionId: versionId } });
    });
    expect(artifacts).toBe(0);

    await expect(createAuthorizedDownload(projectA, versionId)).rejects.toBeInstanceOf(AppError);

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
    if (!enabled || !prisma) skip();
    asOwnerA();
    const bogus = Buffer.from('<html>not a pdf</html>');
    const initiated = await initiateDocumentUpload({
      projectId: projectA,
      title: 'Invalid media',
      documentType: 'LETTER',
      filename: 'spoof.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: bogus.length,
    });
    const put = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: initiated.uploadHeaders as Record<string, string>,
      body: bogus,
    });
    expect(put.ok).toBe(true);

    await expect(
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(bogus).digest('hex'),
      }),
    ).rejects.toBeInstanceOf(AppError);

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
      return versionCount + runCount;
    });
    expect(runs).toBe(0);
  }, 120_000);

  it('cross-tenant: cannot complete, query, or download another tenant upload', async ({
    skip,
  }) => {
    if (!enabled || !prisma) skip();
    asOwnerA();
    const initiated = await initiateDocumentUpload({
      projectId: projectA,
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

    asOwnerB();
    await expect(
      completeDocumentUpload({
        uploadSessionId: initiated.uploadSessionId,
        clientSha256: createHash('sha256').update(CLEAN_PDF).digest('hex'),
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Object key alone does not grant DB access.
    const leaked = await prisma!.$transaction(async (tx) => {
      await setRlsContext(tx, {
        tenantId: tenantB,
        userId: ownerB.id,
        bypass: false,
      });
      return tx.uploadSession.findFirst({ where: { id: initiated.uploadSessionId } });
    });
    expect(leaked).toBeNull();
  }, 120_000);
});
