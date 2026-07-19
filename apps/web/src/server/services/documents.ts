import { createHash, randomUUID } from 'node:crypto';
import { hasCapability } from '@contractradar/authz';
import { requireProjectCapability } from '@/server/authz/context';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction } from '@/server/db/tenant-context';
import {
  AppError,
  conflict,
  forbidden,
  notFound,
  tooManyRequests,
  validationError,
} from '@/server/errors';
import {
  consumeDownloadRateLimit,
  consumeProcessingRetryRateLimit,
  consumeUploadCompleteRateLimit,
  consumeUploadInitiateRateLimit,
} from '@/server/auth/rate-limit';
import { assertMagicMatchesPolicy, validateDeclaredUpload } from '@/server/documents/file-policy';
import { writeIngestionEvent } from '@/server/documents/ingestion-events';
import { buildQuarantineObjectKey } from '@/server/documents/storage-keys';
import {
  assertSourceDocumentTransition,
  assertUploadSessionTransition,
} from '@/server/documents/status-transitions';
import { getServerEnv } from '@/lib/env';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';
import {
  createDownloadAuthorization,
  createUploadAuthorization,
  deleteTemporaryObject,
  getDefaultBucket,
  getObjectBytes,
  headObject,
} from '@/server/storage/object-storage';
import {
  CancelUploadSchema,
  CompleteUploadSchema,
  InitiateUploadSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentMetadataSchema,
} from '@/server/validation/documents';
import { parseEvidenceReference } from '@contractradar/shared';

const ACTIVE_UPLOAD_STATUSES = [
  'INITIATED',
  'UPLOAD_AUTHORIZED',
  'UPLOADED',
  'VALIDATING',
] as const;

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function listProjectDocuments(projectId: string, rawQuery: unknown) {
  const query = ListDocumentsQuerySchema.safeParse(rawQuery);
  if (!query.success) {
    throw validationError('Invalid list query', query.error.flatten());
  }
  const ctx = await requireProjectCapability(projectId, 'document.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const rows = await tx.sourceDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        ...(query.data.cursor ? { id: { lt: query.data.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.data.limit,
      include: {
        currentVersion: {
          select: {
            id: true,
            versionNumber: true,
            originalFilename: true,
            mediaType: true,
            sizeBytes: true,
            sha256: true,
            uploadStatus: true,
            malwareScanStatus: true,
            processingStatus: true,
            uploadedAt: true,
            uploadedByUserId: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        ...row,
        currentVersion: row.currentVersion
          ? {
              ...row.currentVersion,
              sizeBytes: row.currentVersion.sizeBytes.toString(),
            }
          : null,
      })),
      nextCursor: rows.length === query.data.limit ? rows[rows.length - 1]?.id : null,
    };
  });
}

export async function getProjectDocument(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            originalFilename: true,
            normalizedFilename: true,
            mediaType: true,
            extension: true,
            sizeBytes: true,
            sha256: true,
            uploadStatus: true,
            malwareScanStatus: true,
            processingStatus: true,
            uploadedAt: true,
            acceptedAt: true,
            uploadedByUserId: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!doc) throw notFound();

    const canViewQuarantine = hasCapability(ctx.capabilities, 'document.quarantine.view');
    if (
      (doc.status === 'QUARANTINED' || doc.status === 'UPLOADING') &&
      !canViewQuarantine &&
      doc.createdByUserId !== ctx.user.id
    ) {
      // Contributors can see their own uploading docs; others need quarantine view or ready states
      if (
        !['READY', 'PARTIALLY_PROCESSED', 'FAILED', 'ARCHIVED', 'SUPERSEDED'].includes(doc.status)
      ) {
        throw notFound();
      }
    }

    return {
      ...doc,
      versions: doc.versions.map((v) => ({ ...v, sizeBytes: v.sizeBytes.toString() })),
    };
  });
}

export async function initiateDocumentUpload(rawInput: unknown) {
  const parsed = InitiateUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid upload initiation', parsed.error.flatten());
  }
  const input = parsed.data;
  const ctx = await requireProjectCapability(input.projectId, 'document.create');
  if (ctx.project.status === 'ARCHIVED') {
    throw forbidden('Archived projects are read-only');
  }

  const rate = await consumeUploadInitiateRateLimit({
    userId: ctx.user.id,
    projectId: ctx.project.id,
  });
  if (!rate.allowed) throw tooManyRequests('Upload rate limit exceeded');

  const env = getServerEnv();
  const policy = validateDeclaredUpload({
    filename: input.filename,
    declaredMediaType: input.declaredMediaType,
    declaredSizeBytes: input.declaredSizeBytes,
    maxBytes: env.UPLOAD_MAX_BYTES,
  });
  if (!policy.ok) {
    throw validationError(policy.message, { code: policy.code });
  }

  const correlationId = randomUUID();
  const bucket = getDefaultBucket();

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const activeUserUploads = await tx.uploadSession.count({
      where: {
        tenantId: ctx.tenantId,
        initiatedByUserId: ctx.user.id,
        status: { in: [...ACTIVE_UPLOAD_STATUSES] },
      },
    });
    if (activeUserUploads >= env.MAX_ACTIVE_UPLOADS_PER_USER) {
      throw tooManyRequests('Too many active uploads for this user');
    }

    const activeProjectUploads = await tx.uploadSession.count({
      where: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        status: { in: [...ACTIVE_UPLOAD_STATUSES] },
      },
    });
    if (activeProjectUploads >= env.MAX_ACTIVE_UPLOADS_PER_PROJECT) {
      throw tooManyRequests('Too many active uploads for this project');
    }

    if (input.idempotencyKey) {
      const existing = await tx.uploadSession.findFirst({
        where: {
          tenantId: ctx.tenantId,
          initiatedByUserId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing && existing.status === 'UPLOAD_AUTHORIZED' && existing.expiresAt > new Date()) {
        const auth = await createUploadAuthorization({
          bucket: existing.storageBucket,
          key: existing.storageKey,
          contentType: existing.declaredMediaType,
          contentLength: Number(existing.declaredSizeBytes),
          expiresInSeconds: Math.max(
            30,
            Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000),
          ),
        });
        return {
          uploadSessionId: existing.id,
          sourceDocumentId: existing.sourceDocumentId,
          uploadUrl: auth.uploadUrl,
          uploadHeaders: auth.headers,
          expiresAt: existing.expiresAt.toISOString(),
          correlationId: existing.correlationId,
          replayed: true,
        };
      }
    }

    const sourceDocument = await tx.sourceDocument.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        title: input.title,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        description: input.description,
        origin: 'MANUAL_UPLOAD',
        correspondenceDate: input.correspondenceDate
          ? new Date(input.correspondenceDate)
          : undefined,
        language: input.language,
        confidentiality: input.confidentiality,
        status: 'UPLOADING',
        createdByUserId: ctx.user.id,
      },
    });

    const sessionId = randomUUID();
    const storageKey = buildQuarantineObjectKey({
      tenantId: ctx.tenantId,
      projectId: ctx.project.id,
      uploadSessionId: sessionId,
    });
    const expiresAt = new Date(Date.now() + env.UPLOAD_SESSION_TTL_SECONDS * 1000);

    const session = await tx.uploadSession.create({
      data: {
        id: sessionId,
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        initiatedByUserId: ctx.user.id,
        sourceDocumentId: sourceDocument.id,
        intendedFilename: policy.normalizedFilename,
        declaredMediaType: policy.mediaType,
        declaredSizeBytes: BigInt(input.declaredSizeBytes),
        expectedSha256: input.expectedSha256?.toLowerCase(),
        storageKey,
        storageBucket: bucket,
        status: 'UPLOAD_AUTHORIZED',
        expiresAt,
        idempotencyKey: input.idempotencyKey,
        correlationId,
      },
    });

    await writeIngestionEvent(tx, {
      tenantId: ctx.tenantId,
      projectId: ctx.project.id,
      sourceDocumentId: sourceDocument.id,
      uploadSessionId: session.id,
      eventType: 'upload.initiated',
      correlationId,
      metadata: {
        mediaType: policy.mediaType,
        declaredSizeBytes: input.declaredSizeBytes,
        extension: policy.extension,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        actorUserId: ctx.user.id,
        action: 'document.upload.initiated',
        entityType: 'upload_session',
        entityId: session.id,
        correlationId,
        metadata: { sourceDocumentId: sourceDocument.id },
      },
      tx,
    );

    const auth = await createUploadAuthorization({
      bucket,
      key: storageKey,
      contentType: policy.mediaType,
      contentLength: input.declaredSizeBytes,
      expiresInSeconds: env.UPLOAD_SESSION_TTL_SECONDS,
    });

    return {
      uploadSessionId: session.id,
      sourceDocumentId: sourceDocument.id,
      uploadUrl: auth.uploadUrl,
      uploadHeaders: auth.headers,
      expiresAt: expiresAt.toISOString(),
      correlationId,
      maxBytes: env.UPLOAD_MAX_BYTES,
      replayed: false,
    };
  });
}

export async function completeDocumentUpload(rawInput: unknown) {
  const parsed = CompleteUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid upload completion', parsed.error.flatten());
  }

  // upload_session is FORCE RLS tenant-scoped. User-only GUC is insufficient —
  // resolve via active tenant membership in the same transaction as the lookup.
  const { requireTenantMembership } = await import('@/server/authz/context');
  const tenantCtx = await requireTenantMembership();
  const sessionMeta = await withTenantTransaction(
    { tenantId: tenantCtx.tenantId, userId: tenantCtx.user.id },
    async (tx) =>
      tx.uploadSession.findFirst({
        where: {
          id: parsed.data.uploadSessionId,
          tenantId: tenantCtx.tenantId,
          initiatedByUserId: tenantCtx.user.id,
        },
        select: { projectId: true },
      }),
  );
  if (!sessionMeta) throw notFound();

  const bootstrap = await requireProjectCapability(sessionMeta.projectId, 'document.create');
  const completeRate = await consumeUploadCompleteRateLimit({ userId: bootstrap.user.id });
  if (!completeRate.allowed) throw tooManyRequests('Upload completion rate limit exceeded');

  const env = getServerEnv();

  // Rejection updates must commit before throwing — a thrown AppError aborts the
  // interactive transaction and would otherwise roll back REJECTED/FAILED status.
  type CompleteTxResult =
    | { ok: true; value: Record<string, unknown> }
    | { ok: false; error: AppError };

  const outcome = await withTenantTransaction(
    { tenantId: bootstrap.tenantId, userId: bootstrap.user.id },
    async (tx): Promise<CompleteTxResult> => {
      const session = await tx.uploadSession.findFirst({
        where: {
          id: parsed.data.uploadSessionId,
          tenantId: bootstrap.tenantId,
          projectId: bootstrap.project.id,
        },
      });
      if (!session) throw notFound();

      // Idempotent replay after session accepted (version may still be awaiting malware)
      if (session.status === 'ACCEPTED' && session.documentVersionId) {
        return {
          ok: true,
          value: {
            uploadSessionId: session.id,
            sourceDocumentId: session.sourceDocumentId,
            documentVersionId: session.documentVersionId,
            status: 'ACCEPTED' as const,
            duplicate: false,
            replayed: true,
          },
        };
      }

      if (session.expiresAt.getTime() < Date.now()) {
        assertUploadSessionTransition(session.status, 'EXPIRED');
        await tx.uploadSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED', failureCode: 'EXPIRED' },
        });
        return {
          ok: false,
          error: validationError('Upload session has expired'),
        };
      }

      if (session.status !== 'UPLOAD_AUTHORIZED' && session.status !== 'UPLOADED') {
        throw conflict(`Upload session cannot be completed from status ${session.status}`);
      }

      assertUploadSessionTransition(session.status, 'UPLOADED');
      await tx.uploadSession.update({
        where: { id: session.id },
        data: { status: 'UPLOADED' },
      });
      assertUploadSessionTransition('UPLOADED', 'VALIDATING');
      await tx.uploadSession.update({
        where: { id: session.id },
        data: { status: 'VALIDATING' },
      });

      let head;
      try {
        head = await headObject({ bucket: session.storageBucket, key: session.storageKey });
      } catch {
        await tx.uploadSession.update({
          where: { id: session.id },
          data: {
            status: 'FAILED',
            failureCode: 'OBJECT_MISSING',
            failureDetailSafe: 'Uploaded object was not found in storage.',
          },
        });
        return {
          ok: false,
          error: validationError(
            'Uploaded object was not found. Complete only after a successful PUT.',
          ),
        };
      }

      if (head.contentLength !== Number(session.declaredSizeBytes)) {
        await tx.uploadSession.update({
          where: { id: session.id },
          data: {
            status: 'REJECTED',
            failureCode: 'SIZE_MISMATCH',
            failureDetailSafe: 'Stored object size does not match the declared size.',
          },
        });
        return {
          ok: false,
          error: validationError('Stored object size does not match the declared size.'),
        };
      }

      if (head.contentLength === 0) {
        return { ok: false, error: validationError('Zero-byte uploads are rejected.') };
      }

      const bytes = await getObjectBytes({
        bucket: session.storageBucket,
        key: session.storageKey,
        maxBytes: env.UPLOAD_MAX_BYTES,
      });
      const digest = sha256Hex(bytes);
      if (session.expectedSha256 && session.expectedSha256 !== digest) {
        await tx.uploadSession.update({
          where: { id: session.id },
          data: {
            status: 'REJECTED',
            failureCode: 'CHECKSUM_MISMATCH',
            failureDetailSafe: 'Checksum verification failed.',
          },
        });
        return { ok: false, error: validationError('Checksum verification failed.') };
      }
      if (parsed.data.clientSha256 && parsed.data.clientSha256.toLowerCase() !== digest) {
        return {
          ok: false,
          error: validationError('Client checksum does not match server-computed checksum.'),
        };
      }

      const extension =
        session.intendedFilename.includes('.') && session.intendedFilename.lastIndexOf('.') > 0
          ? session.intendedFilename
              .slice(session.intendedFilename.lastIndexOf('.') + 1)
              .toLowerCase()
          : '';
      const magic = assertMagicMatchesPolicy({
        bytes,
        extension,
        expectedMediaType: session.declaredMediaType,
      });
      if (!magic.ok) {
        assertUploadSessionTransition('VALIDATING', 'REJECTED');
        await tx.uploadSession.update({
          where: { id: session.id },
          data: {
            status: 'REJECTED',
            failureCode: magic.code,
            failureDetailSafe: magic.message,
          },
        });
        try {
          await deleteTemporaryObject({
            bucket: session.storageBucket,
            key: session.storageKey,
          });
        } catch {
          // best-effort cleanup of rejected spoof object
        }
        return {
          ok: false,
          error: validationError(magic.message, { code: magic.code }),
        };
      }

      await writeIngestionEvent(tx, {
        tenantId: bootstrap.tenantId,
        projectId: bootstrap.project.id,
        sourceDocumentId: session.sourceDocumentId,
        uploadSessionId: session.id,
        eventType: 'upload.checksum_verified',
        correlationId: session.correlationId,
        metadata: { sha256: digest, sizeBytes: head.contentLength },
      });

      const duplicate = await tx.documentVersion.findFirst({
        where: {
          tenantId: bootstrap.tenantId,
          projectId: bootstrap.project.id,
          sha256: digest,
          uploadStatus: 'ACCEPTED',
        },
        select: {
          id: true,
          sourceDocumentId: true,
          versionNumber: true,
          originalFilename: true,
        },
      });

      if (duplicate && parsed.data.duplicateDecision !== 'new_occurrence') {
        if (parsed.data.duplicateDecision === 'cancel') {
          assertUploadSessionTransition('VALIDATING', 'CANCELLED');
          await tx.uploadSession.update({
            where: { id: session.id },
            data: { status: 'CANCELLED', completedAt: new Date() },
          });
          try {
            await deleteTemporaryObject({
              bucket: session.storageBucket,
              key: session.storageKey,
            });
          } catch {
            // best-effort cleanup
          }
          return {
            ok: true,
            value: {
              uploadSessionId: session.id,
              status: 'CANCELLED' as const,
              duplicate: true,
              existingVersion: duplicate,
            },
          };
        }
        // Default: surface duplicate for client decision (do not accept yet)
        if (!parsed.data.duplicateDecision) {
          return {
            ok: true,
            value: {
              uploadSessionId: session.id,
              sourceDocumentId: session.sourceDocumentId,
              status: 'DUPLICATE_CONTENT' as const,
              duplicate: true,
              sha256: digest,
              existingVersion: duplicate,
            },
          };
        }
      }

      if (!session.sourceDocumentId) throw notFound();

      const versionId = randomUUID();
      // Remain on quarantine key until malware scan passes; worker promotes to originals/.
      const quarantineKey = session.storageKey;

      const maxVersion = await tx.documentVersion.aggregate({
        where: { sourceDocumentId: session.sourceDocumentId },
        _max: { versionNumber: true },
      });
      const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

      const version = await tx.documentVersion.create({
        data: {
          id: versionId,
          tenantId: bootstrap.tenantId,
          projectId: bootstrap.project.id,
          sourceDocumentId: session.sourceDocumentId,
          versionNumber,
          originalFilename: session.intendedFilename,
          normalizedFilename: session.intendedFilename,
          mediaType: magic.mediaType,
          extension,
          sizeBytes: BigInt(head.contentLength),
          sha256: digest,
          storageBucket: session.storageBucket,
          storageKey: quarantineKey,
          storageEtag: head.etag,
          uploadStatus: 'VALIDATING',
          malwareScanStatus: 'QUEUED',
          processingStatus: 'QUEUED',
          uploadedByUserId: bootstrap.user.id,
        },
      });

      const sourceDoc = await tx.sourceDocument.findFirst({
        where: { id: session.sourceDocumentId },
      });
      if (!sourceDoc) throw notFound();
      assertSourceDocumentTransition(sourceDoc.status, 'QUARANTINED');
      await tx.sourceDocument.update({
        where: { id: sourceDoc.id },
        data: {
          status: 'QUARANTINED',
          currentVersionId: version.id,
        },
      });

      if (duplicate && parsed.data.duplicateDecision === 'new_occurrence') {
        await tx.documentRelationship.create({
          data: {
            tenantId: bootstrap.tenantId,
            projectId: bootstrap.project.id,
            fromSourceDocumentId: sourceDoc.id,
            toSourceDocumentId: duplicate.sourceDocumentId,
            relationshipType: 'DUPLICATE_CONTENT_OF',
            createdByUserId: bootstrap.user.id,
            metadata: { sha256: digest, existingVersionId: duplicate.id },
          },
        });
      }

      const run = await tx.documentProcessingRun.create({
        data: {
          tenantId: bootstrap.tenantId,
          projectId: bootstrap.project.id,
          documentVersionId: version.id,
          processingProfile: 'basic_v1',
          processorName: 'document-intelligence',
          processorVersion: '0.2.0',
          status: 'QUEUED',
          attemptNumber: 1,
          correlationId: session.correlationId ?? randomUUID(),
        },
      });

      assertUploadSessionTransition('VALIDATING', 'ACCEPTED');
      await tx.uploadSession.update({
        where: { id: session.id },
        data: {
          status: 'ACCEPTED',
          completedAt: new Date(),
          documentVersionId: version.id,
        },
      });

      await writeIngestionEvent(tx, {
        tenantId: bootstrap.tenantId,
        projectId: bootstrap.project.id,
        sourceDocumentId: sourceDoc.id,
        documentVersionId: version.id,
        uploadSessionId: session.id,
        processingRunId: run.id,
        eventType: 'upload.accepted',
        correlationId: run.correlationId,
        metadata: { malwareScanStatus: 'QUEUED' },
      });

      await writeAuditLog(
        {
          tenantId: bootstrap.tenantId,
          projectId: bootstrap.project.id,
          actorUserId: bootstrap.user.id,
          action: 'document.upload.accepted',
          entityType: 'document_version',
          entityId: version.id,
          correlationId: run.correlationId,
          metadata: { sourceDocumentId: sourceDoc.id, sha256: digest },
        },
        tx,
      );

      // Durable at-least-once delivery via transactional outbox (ADR-025).
      await writeProcessDocumentOutbox(tx, {
        tenantId: bootstrap.tenantId,
        projectId: bootstrap.project.id,
        processingRunId: run.id,
        documentVersionId: version.id,
        correlationId: run.correlationId,
      });

      return {
        ok: true,
        value: {
          uploadSessionId: session.id,
          sourceDocumentId: sourceDoc.id,
          documentVersionId: version.id,
          processingRunId: run.id,
          status: 'ACCEPTED' as const,
          sha256: digest,
          malwareScanStatus: 'QUEUED',
          processingStatus: 'QUEUED',
          duplicate: Boolean(duplicate),
          replayed: false,
        },
      };
    },
  );

  if (!outcome.ok) {
    throw outcome.error;
  }
  return outcome.value;
}

export async function cancelDocumentUpload(rawInput: unknown) {
  const parsed = CancelUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid cancel request', parsed.error.flatten());
  }
  const { requireTenantMembership } = await import('@/server/authz/context');
  const tenantCtx = await requireTenantMembership();
  const sessionMeta = await withTenantTransaction(
    { tenantId: tenantCtx.tenantId, userId: tenantCtx.user.id },
    async (tx) =>
      tx.uploadSession.findFirst({
        where: {
          id: parsed.data.uploadSessionId,
          tenantId: tenantCtx.tenantId,
          initiatedByUserId: tenantCtx.user.id,
        },
        select: { projectId: true },
      }),
  );
  if (!sessionMeta) throw notFound();
  const ctx = await requireProjectCapability(sessionMeta.projectId, 'document.create');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const session = await tx.uploadSession.findFirst({
      where: { id: parsed.data.uploadSessionId, tenantId: ctx.tenantId },
    });
    if (!session) throw notFound();
    if (['ACCEPTED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(session.status)) {
      return { uploadSessionId: session.id, status: session.status };
    }
    assertUploadSessionTransition(session.status, 'CANCELLED');
    await tx.uploadSession.update({
      where: { id: session.id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    try {
      await deleteTemporaryObject({ bucket: session.storageBucket, key: session.storageKey });
    } catch {
      // ignore
    }
    return { uploadSessionId: session.id, status: 'CANCELLED' as const };
  });
}

export async function updateDocumentMetadata(
  projectId: string,
  documentId: string,
  rawInput: unknown,
) {
  const parsed = UpdateDocumentMetadataSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid metadata update', parsed.error.flatten());
  }
  const ctx = await requireProjectCapability(projectId, 'document.update_metadata');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
    });
    if (!doc) throw notFound();
    if (doc.status === 'ARCHIVED') throw forbidden('Archived documents cannot be edited');

    const updated = await tx.sourceDocument.update({
      where: { id: doc.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.documentNumber !== undefined
          ? { documentNumber: parsed.data.documentNumber }
          : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
        ...(parsed.data.confidentiality !== undefined
          ? { confidentiality: parsed.data.confidentiality }
          : {}),
        ...(parsed.data.documentType !== undefined
          ? { documentType: parsed.data.documentType }
          : {}),
        ...(parsed.data.correspondenceDate !== undefined
          ? {
              correspondenceDate: parsed.data.correspondenceDate
                ? new Date(parsed.data.correspondenceDate)
                : null,
            }
          : {}),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        actorUserId: ctx.user.id,
        action: 'document.metadata.updated',
        entityType: 'source_document',
        entityId: doc.id,
        metadata: { fields: Object.keys(parsed.data) },
      },
      tx,
    );
    return updated;
  });
}

export async function archiveDocument(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.archive');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
    });
    if (!doc) throw notFound();
    if (doc.status !== 'ARCHIVED') {
      assertSourceDocumentTransition(doc.status, 'ARCHIVED');
      await tx.sourceDocument.update({
        where: { id: doc.id },
        data: { status: 'ARCHIVED' },
      });
    }
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        actorUserId: ctx.user.id,
        action: 'document.archived',
        entityType: 'source_document',
        entityId: doc.id,
      },
      tx,
    );
    return { id: doc.id, status: 'ARCHIVED' as const };
  });
}

export async function listDocumentVersions(projectId: string, documentId: string) {
  const doc = await getProjectDocument(projectId, documentId);
  return doc.versions;
}

export async function getDocumentProcessing(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.processing.view');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
      select: { id: true, currentVersionId: true, status: true },
    });
    if (!doc) throw notFound();
    const runs = await tx.documentProcessingRun.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        documentVersion: { sourceDocumentId: doc.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { documentStatus: doc.status, runs };
  });
}

export async function retryDocumentProcessing(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.processing.retry');
  const rate = await consumeProcessingRetryRateLimit({ userId: ctx.user.id });
  if (!rate.allowed) throw tooManyRequests();

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
      include: { currentVersion: true },
    });
    if (!doc?.currentVersion) throw notFound();
    if (doc.currentVersion.malwareScanStatus === 'INFECTED') {
      throw forbidden('Infected files cannot be reprocessed by ordinary retry');
    }
    if (!['FAILED', 'PARTIALLY_SUCCEEDED'].includes(doc.currentVersion.processingStatus)) {
      throw conflict('Only failed or partial processing runs can be retried');
    }

    const prior = await tx.documentProcessingRun.count({
      where: { documentVersionId: doc.currentVersion.id },
    });
    const correlationId = randomUUID();
    const run = await tx.documentProcessingRun.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        documentVersionId: doc.currentVersion.id,
        processingProfile: 'basic_v1',
        processorName: 'document-intelligence',
        processorVersion: '0.2.0',
        status: 'QUEUED',
        attemptNumber: prior + 1,
        correlationId,
      },
    });
    await tx.documentVersion.update({
      where: { id: doc.currentVersion.id },
      data: { processingStatus: 'QUEUED' },
    });
    assertSourceDocumentTransition(doc.status === 'FAILED' ? 'FAILED' : doc.status, 'PROCESSING');
    await tx.sourceDocument.update({
      where: { id: doc.id },
      data: { status: 'PROCESSING' },
    });
    await writeIngestionEvent(tx, {
      tenantId: ctx.tenantId,
      projectId: ctx.project.id,
      sourceDocumentId: doc.id,
      documentVersionId: doc.currentVersion.id,
      processingRunId: run.id,
      eventType: 'processing.retry_queued',
      correlationId,
    });
    await writeProcessDocumentOutbox(tx, {
      tenantId: ctx.tenantId,
      projectId: ctx.project.id,
      processingRunId: run.id,
      documentVersionId: doc.currentVersion.id,
      correlationId,
    });
    return { processingRunId: run.id, attemptNumber: run.attemptNumber };
  });
}

export async function createAuthorizedDownload(projectId: string, versionId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.download');
  const rate = await consumeDownloadRateLimit({ userId: ctx.user.id });
  if (!rate.allowed) throw tooManyRequests();
  const env = getServerEnv();

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const version = await tx.documentVersion.findFirst({
      where: {
        id: versionId,
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
      },
    });
    if (!version) throw notFound();
    if (version.uploadStatus !== 'ACCEPTED' || version.malwareScanStatus !== 'CLEAN') {
      throw forbidden(
        'File is not available for download until malware scanning completes cleanly',
      );
    }

    const url = await createDownloadAuthorization({
      bucket: version.storageBucket,
      key: version.storageKey,
      expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS,
      responseContentDisposition: `attachment; filename="${version.normalizedFilename.replace(/"/g, '')}"`,
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        actorUserId: ctx.user.id,
        action: 'document.download.authorized',
        entityType: 'document_version',
        entityId: version.id,
        metadata: { expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS },
      },
      tx,
    );

    return {
      documentVersionId: version.id,
      expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS,
      downloadUrl: url,
    };
  });
}

export async function listEvidenceSegments(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.processing.view');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
      select: { currentVersionId: true },
    });
    if (!doc?.currentVersionId) throw notFound();
    const version = await tx.documentVersion.findFirst({
      where: { id: doc.currentVersionId },
    });
    if (!version) throw notFound();
    if (version.malwareScanStatus !== 'CLEAN') {
      throw forbidden('Evidence is not available until the file is scanned clean');
    }
    const segments = await tx.evidenceSegment.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        documentVersionId: version.id,
      },
      orderBy: [{ kind: 'asc' }, { ordinal: 'asc' }],
      take: 500,
    });
    return segments;
  });
}

export async function listIngestionTimeline(projectId: string, documentId: string) {
  const ctx = await requireProjectCapability(projectId, 'document.processing.view');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const doc = await tx.sourceDocument.findFirst({
      where: { id: documentId, tenantId: ctx.tenantId, projectId: ctx.project.id },
      select: { id: true },
    });
    if (!doc) throw notFound();
    return tx.ingestionEvent.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        sourceDocumentId: doc.id,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  });
}

export async function resolveEvidenceReferenceForUser(rawRef: unknown) {
  const ref = parseEvidenceReference(rawRef);
  const ctx = await requireProjectCapability(ref.projectId, 'document.read');
  if (ctx.tenantId !== ref.tenantId) throw notFound();

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const segment = ref.evidenceSegmentId
      ? await tx.evidenceSegment.findFirst({
          where: {
            id: ref.evidenceSegmentId,
            tenantId: ctx.tenantId,
            projectId: ctx.project.id,
            documentVersionId: ref.documentVersionId,
            processingRunId: ref.processingRunId,
          },
        })
      : null;

    const version = await tx.documentVersion.findFirst({
      where: {
        id: ref.documentVersionId,
        tenantId: ctx.tenantId,
        projectId: ctx.project.id,
        sourceDocumentId: ref.sourceDocumentId,
      },
      select: {
        id: true,
        sourceDocumentId: true,
        versionNumber: true,
        sha256: true,
        mediaType: true,
        malwareScanStatus: true,
      },
    });
    if (!version) throw notFound();
    if (version.malwareScanStatus !== 'CLEAN') throw forbidden('Source not available');

    return {
      reference: ref,
      version,
      segment,
    };
  });
}
