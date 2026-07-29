import {
  recordMatchesScope,
  type ConnectorCheckpoint,
  type ConnectorScopeRules,
  type ExternalRecordRef,
} from '@contractradar/connectors';
import type {
  ConnectorAccountStatus,
  ConnectorProjectScope,
  ConnectorSyncRunStatus,
  DocumentOrigin,
  DocumentType,
  ExternalRecordType,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import {
  requireProjectCapability,
  requireTenantCapability,
  type ProjectContext,
} from '@/server/authz/context';
import { requireConnectorProvider } from '@/server/connectors/provider';
import { withTenantTransaction, type DbClient } from '@/server/db/tenant-context';
import { writeIngestionEvent } from '@/server/documents/ingestion-events';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';
import { getServerEnv } from '@/lib/env';
import { writeProcessDocumentOutbox } from '@/server/queue/outbox';

const PROCESSOR_VERSION = 'connectors-slice8-v1';

const CreateConnectorAccountSchema = z.object({
  connectorType: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(200),
  provider: z.string().trim().min(1).max(50),
  secretReference: z.string().trim().min(1).max(500),
});

const CreateProjectScopeSchema = z.object({
  externalMailboxOrFolder: z.string().trim().min(1).max(500),
  externalProjectId: z.string().trim().max(200).optional(),
  includeRules: z
    .object({ patterns: z.array(z.string().trim().max(200)).max(50).default([]) })
    .default({ patterns: [] }),
  excludeRules: z
    .object({ patterns: z.array(z.string().trim().max(200)).max(50).default([]) })
    .default({ patterns: [] }),
  approvedDocumentTypes: z.array(z.string().trim().max(100)).max(50).default([]),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
  projectReferencePatterns: z.array(z.string().trim().max(100)).max(50).default([]),
  mimeAllowlist: z.array(z.string().trim().max(100)).max(50).default([]),
});

function connectorSodEnabled(): boolean {
  return process.env.CONNECTOR_SOD !== 'false';
}

function scopeRulesFromRecord(scope: ConnectorProjectScope): ConnectorScopeRules {
  const include = scope.includeRules as { patterns?: string[] };
  const exclude = scope.excludeRules as { patterns?: string[] };
  const approved = scope.approvedDocumentTypes as string[];
  const extra =
    (scope.lastCheckpoint as {
      projectReferencePatterns?: string[];
      mimeAllowlist?: string[];
    } | null) ?? {};
  return {
    includePatterns: include?.patterns ?? [],
    excludePatterns: exclude?.patterns ?? [],
    dateFrom: scope.dateRangeStart?.toISOString() ?? null,
    dateTo: scope.dateRangeEnd?.toISOString() ?? null,
    projectReferencePatterns: extra.projectReferencePatterns ?? approved ?? [],
    mimeAllowlist: extra.mimeAllowlist ?? [],
  };
}

function scopeRulesFromInput(
  parsed: z.infer<typeof CreateProjectScopeSchema>,
): ConnectorScopeRules {
  return {
    includePatterns: parsed.includeRules.patterns,
    excludePatterns: parsed.excludeRules.patterns,
    dateFrom: parsed.dateRangeStart ?? null,
    dateTo: parsed.dateRangeEnd ?? null,
    projectReferencePatterns: parsed.projectReferencePatterns,
    mimeAllowlist:
      parsed.mimeAllowlist.length > 0 ? parsed.mimeAllowlist : parsed.approvedDocumentTypes,
  };
}

function mapProviderRecordType(recordType: ExternalRecordRef['recordType']): ExternalRecordType {
  switch (recordType) {
    case 'EMAIL':
      return 'EMAIL';
    case 'ATTACHMENT':
      return 'EMAIL_ATTACHMENT';
    case 'DOCUMENT':
      return 'EDMS_DOCUMENT';
    default:
      return 'OTHER';
  }
}

function mapDocumentOrigin(recordType: ExternalRecordRef['recordType']): DocumentOrigin {
  if (recordType === 'EMAIL' || recordType === 'ATTACHMENT') {
    return 'EMAIL_IMPORT';
  }
  return 'SHAREPOINT_IMPORT';
}

function mapDocumentType(recordType: ExternalRecordRef['recordType']): DocumentType {
  switch (recordType) {
    case 'EMAIL':
      return 'EMAIL';
    case 'ATTACHMENT':
    case 'DOCUMENT':
      return 'LETTER';
    default:
      return 'OTHER';
  }
}

function extensionFromMime(mimeType: string | null | undefined, fallback: string): string {
  if (!mimeType) return fallback;
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('rfc822') || mimeType.includes('message')) return 'eml';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx';
  const part = mimeType.split('/')[1];
  return part?.split(';')[0]?.slice(0, 10) ?? fallback;
}

async function importRecordAsDocument(
  tx: DbClient,
  input: {
    tenantId: string;
    projectId: string;
    userId: string;
    ref: ExternalRecordRef;
    metadata: NonNullable<
      Awaited<
        ReturnType<import('@contractradar/connectors').ConnectorProvider['fetchRecordMetadata']>
      >
    >;
    content: NonNullable<
      Awaited<
        ReturnType<import('@contractradar/connectors').ConnectorProvider['fetchRecordContent']>
      >
    >;
    correlationId: string;
  },
): Promise<{ sourceDocumentId: string; documentVersionId: string; processingRunId: string }> {
  const env = getServerEnv();
  const sourceDocumentId = randomUUID();
  const versionId = randomUUID();
  const filename = `${input.ref.externalId}.${extensionFromMime(input.metadata.mimeType, 'bin')}`;
  const storageKey = `tenants/${input.tenantId}/projects/${input.projectId}/imports/${sourceDocumentId}/${versionId}/${filename}`;

  await tx.sourceDocument.create({
    data: {
      id: sourceDocumentId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.metadata.title ?? input.ref.externalId,
      documentType: mapDocumentType(input.ref.recordType),
      origin: mapDocumentOrigin(input.ref.recordType),
      sourceSystem: 'connector',
      sourceReference: input.ref.externalId,
      correspondenceDate: input.metadata.modifiedAt ? new Date(input.metadata.modifiedAt) : null,
      receivedAt: new Date(),
      senderName: input.metadata.sender,
      recipientSummary: input.metadata.recipients.join(', ') || null,
      status: 'QUARANTINED',
      createdByUserId: input.userId,
    },
  });

  const version = await tx.documentVersion.create({
    data: {
      id: versionId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      sourceDocumentId,
      versionNumber: 1,
      originalFilename: filename,
      normalizedFilename: filename,
      mediaType: input.content.contentType,
      extension: extensionFromMime(input.content.contentType, 'bin'),
      sizeBytes: BigInt(input.content.sizeBytes),
      sha256: input.content.checksumSha256,
      storageBucket: env.S3_BUCKET,
      storageKey,
      uploadStatus: 'VALIDATING',
      malwareScanStatus: 'QUEUED',
      processingStatus: 'QUEUED',
      uploadedByUserId: input.userId,
    },
  });

  await tx.sourceDocument.update({
    where: { id: sourceDocumentId },
    data: { currentVersionId: version.id },
  });

  const run = await tx.documentProcessingRun.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      documentVersionId: version.id,
      processingProfile: 'basic_v1',
      processorName: 'document-intelligence',
      processorVersion: '0.2.0',
      status: 'QUEUED',
      attemptNumber: 1,
      correlationId: input.correlationId,
    },
  });

  await writeIngestionEvent(tx, {
    tenantId: input.tenantId,
    projectId: input.projectId,
    sourceDocumentId,
    documentVersionId: version.id,
    eventType: 'connector.import.queued',
    correlationId: input.correlationId,
    metadata: { externalId: input.ref.externalId, previewOnly: true },
  });

  await writeProcessDocumentOutbox(tx, {
    tenantId: input.tenantId,
    projectId: input.projectId,
    processingRunId: run.id,
    documentVersionId: version.id,
    correlationId: input.correlationId,
  });

  return { sourceDocumentId, documentVersionId: version.id, processingRunId: run.id };
}

async function executeSyncRun(
  tx: DbClient,
  input: {
    syncRunId: string;
    scope: ConnectorProjectScope & { connectorAccount: { provider: string; id: string } };
    userId: string;
    tenantId: string;
  },
): Promise<void> {
  const provider = requireConnectorProvider();
  const scopeRules = scopeRulesFromRecord(input.scope);
  const checkpointBefore = (input.scope.lastCheckpoint as ConnectorCheckpoint | null) ?? null;
  const correlationId = randomUUID();

  await tx.connectorSyncRun.update({
    where: { id: input.syncRunId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      checkpointBefore: checkpointBefore as Prisma.InputJsonValue,
    },
  });

  let recordsDiscovered = 0;
  let recordsImported = 0;
  let recordsSkipped = 0;
  let duplicatesDetected = 0;
  let recordsFailed = 0;
  let checkpointAfter: ConnectorCheckpoint | null = checkpointBefore;
  let hasMore = true;
  const warnings: string[] = [];

  try {
    while (hasMore) {
      const page = await provider.listChangedRecords(checkpointAfter);
      for (const ref of page.records) {
        recordsDiscovered += 1;
        const metadata = await provider.fetchRecordMetadata(ref.externalId);
        if (!metadata) {
          recordsSkipped += 1;
          continue;
        }

        const match = recordMatchesScope(scopeRules, {
          subjectOrTitle: metadata.title ?? ref.externalId,
          bodyPreview: metadata.safeMetadata?.preview as string | undefined,
          modifiedAt: metadata.modifiedAt,
          mimeType: metadata.mimeType,
          projectReferences: metadata.projectReferences,
        });
        if (!match.ok) {
          recordsSkipped += 1;
          continue;
        }

        const existing = await tx.externalRecord.findFirst({
          where: {
            connectorAccountId: input.scope.connectorAccountId,
            connectorProjectScopeId: input.scope.id,
            externalRecordId: ref.externalId,
            externalVersionId: ref.checksumHint ?? '',
          },
        });
        if (existing?.importStatus === 'IMPORTED') {
          duplicatesDetected += 1;
          await tx.externalRecord.update({
            where: { id: existing.id },
            data: { lastSeenAt: new Date() },
          });
          continue;
        }

        try {
          const content = await provider.fetchRecordContent(ref.externalId);
          if (!content) {
            recordsFailed += 1;
            continue;
          }

          const doc = await importRecordAsDocument(tx, {
            tenantId: input.tenantId,
            projectId: input.scope.projectId,
            userId: input.userId,
            ref,
            metadata,
            content,
            correlationId,
          });

          const now = new Date();
          await tx.externalRecord.upsert({
            where: {
              connectorAccountId_connectorProjectScopeId_externalRecordId_externalVersionId: {
                connectorAccountId: input.scope.connectorAccountId,
                connectorProjectScopeId: input.scope.id,
                externalRecordId: ref.externalId,
                externalVersionId: ref.checksumHint ?? '',
              },
            },
            create: {
              tenantId: input.tenantId,
              projectId: input.scope.projectId,
              connectorAccountId: input.scope.connectorAccountId,
              connectorProjectScopeId: input.scope.id,
              syncRunId: input.syncRunId,
              externalSystem: provider.kind,
              externalRecordId: ref.externalId,
              recordType: mapProviderRecordType(ref.recordType),
              subjectOrTitle: metadata.title,
              sourceTimestamp: metadata.modifiedAt ? new Date(metadata.modifiedAt) : null,
              senderAuthorSnapshot: metadata.sender
                ? ({ sender: metadata.sender } as Prisma.InputJsonValue)
                : undefined,
              recipientSnapshot: metadata.recipients as Prisma.InputJsonValue,
              externalVersionId: ref.checksumHint ?? '',
              externalChecksum: metadata.checksumSha256,
              importedChecksum: content.checksumSha256,
              sourceMetadata: metadata.safeMetadata as Prisma.InputJsonValue,
              importStatus: 'IMPORTED',
              sourceDocumentId: doc.sourceDocumentId,
              documentVersionId: doc.documentVersionId,
              firstSeenAt: now,
              lastSeenAt: now,
              importedAt: now,
            },
            update: {
              syncRunId: input.syncRunId,
              importStatus: 'IMPORTED',
              sourceDocumentId: doc.sourceDocumentId,
              documentVersionId: doc.documentVersionId,
              lastSeenAt: now,
              importedAt: now,
            },
          });
          recordsImported += 1;
        } catch {
          recordsFailed += 1;
          warnings.push(`Failed to import ${ref.externalId}`);
        }
      }
      checkpointAfter = page.nextCheckpoint;
      hasMore = page.hasMore;
    }

    const finalStatus: ConnectorSyncRunStatus =
      recordsFailed > 0 && recordsImported > 0
        ? 'PARTIALLY_SUCCEEDED'
        : recordsFailed > 0
          ? 'FAILED'
          : 'SUCCEEDED';

    await tx.connectorProjectScope.update({
      where: { id: input.scope.id },
      data: { lastCheckpoint: checkpointAfter as Prisma.InputJsonValue },
    });

    await tx.connectorSyncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        checkpointAfter: checkpointAfter as Prisma.InputJsonValue,
        recordsDiscovered,
        recordsImported,
        recordsSkipped,
        duplicatesDetected,
        recordsFailed,
        warnings: warnings.length > 0 ? (warnings as Prisma.InputJsonValue) : undefined,
      },
    });

    await tx.projectTimelineEvent.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.scope.projectId,
        eventType: 'connector.sync.completed',
        summary: `Connector sync ${finalStatus}: ${recordsImported} imported, ${recordsSkipped} skipped`,
        entityType: 'connector_sync_run',
        entityId: input.syncRunId,
        actorUserId: input.userId,
        occurredAt: new Date(),
      },
    });
  } catch (error) {
    await tx.connectorSyncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        recordsDiscovered,
        recordsImported,
        recordsSkipped,
        duplicatesDetected,
        recordsFailed,
        failureCode: 'SYNC_ERROR',
        failureMessageSafe: error instanceof Error ? error.message.slice(0, 500) : 'Sync failed',
      },
    });
    throw error;
  }
}

/** Test helper — connectors must never auto-mutate legal state. */
export async function assertNoAutonomousLegalMutation(
  tx: DbClient,
  projectId: string,
  baseline: { eventCount: number; confirmedEventCount: number; dispatchCount: number },
): Promise<void> {
  const [events, confirmed, dispatches] = await Promise.all([
    tx.projectEvent.count({ where: { projectId } }),
    tx.projectEvent.count({ where: { projectId, confirmationStatus: 'CONFIRMED_FACT' } }),
    tx.noticeDispatchAttempt.count({ where: { projectId } }),
  ]);
  if (events > baseline.eventCount) {
    throw new Error('Connector sync created project events autonomously');
  }
  if (confirmed > baseline.confirmedEventCount) {
    throw new Error('Connector sync confirmed events autonomously');
  }
  if (dispatches > baseline.dispatchCount) {
    throw new Error('Connector sync triggered notice dispatch autonomously');
  }
}

export async function createConnectorAccount(rawInput: unknown) {
  const ctx = await requireTenantCapability('connector_account.create');
  const parsed = CreateConnectorAccountSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid connector account', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.create({
      data: {
        tenantId: ctx.tenantId,
        connectorType: parsed.data.connectorType,
        displayName: parsed.data.displayName,
        provider: parsed.data.provider,
        status: 'DRAFT',
        secretReference: parsed.data.secretReference,
        configuredByUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'connector_account.created',
        entityType: 'connector_account',
        entityId: account.id,
      },
      tx,
    );

    return account;
  });
}

export async function listConnectorAccounts() {
  const ctx = await requireTenantCapability('connector_account.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.connectorAccount.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export async function getConnectorAccount(id: string) {
  const ctx = await requireTenantCapability('connector_account.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { scopes: true },
    });
    if (!account) throw notFound();
    return account;
  });
}

export async function validateConnectorAccount(id: string) {
  const ctx = await requireTenantCapability('connector_account.validate');
  const provider = requireConnectorProvider();
  const validation = await provider.validateConfiguration();
  if (!validation.ok) {
    throw validationError(validation.reason ?? 'Connector validation failed');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!account) throw notFound();

    const updated = await tx.connectorAccount.update({
      where: { id },
      data: {
        status: 'VALIDATED' satisfies ConnectorAccountStatus,
        lastValidatedAt: new Date(),
        lastValidationStatus: 'OK',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'connector_account.validated',
        entityType: 'connector_account',
        entityId: id,
      },
      tx,
    );

    return updated;
  });
}

export async function approveConnectorAccount(id: string) {
  const ctx = await requireTenantCapability('connector_account.approve');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!account) throw notFound();
    if (account.status !== 'VALIDATED' && account.status !== 'APPROVED') {
      throw conflict('Connector account must be validated before approval');
    }
    if (
      connectorSodEnabled() &&
      account.configuredByUserId === ctx.user.id &&
      account.status !== 'APPROVED'
    ) {
      throw forbidden('Segregation of duties: approver cannot be the configurer');
    }

    const updated = await tx.connectorAccount.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'connector_account.approved',
        entityType: 'connector_account',
        entityId: id,
      },
      tx,
    );

    return updated;
  });
}

export async function disableConnectorAccount(id: string) {
  const ctx = await requireTenantCapability('connector_account.disable');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!account) throw notFound();

    const updated = await tx.connectorAccount.update({
      where: { id },
      data: { status: 'DISABLED' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'connector_account.disabled',
        entityType: 'connector_account',
        entityId: id,
      },
      tx,
    );

    return updated;
  });
}

export async function createProjectScope(accountId: string, projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'connector_scope.create');
  const parsed = CreateProjectScopeSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid project scope', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const account = await tx.connectorAccount.findFirst({
      where: { id: accountId, tenantId: ctx.tenantId, status: 'APPROVED' },
    });
    if (!account) throw notFound('Approved connector account not found');

    const scopeRules = scopeRulesFromInput(parsed.data);
    const scope = await tx.connectorProjectScope.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        connectorAccountId: accountId,
        externalMailboxOrFolder: parsed.data.externalMailboxOrFolder,
        externalProjectId: parsed.data.externalProjectId,
        includeRules: parsed.data.includeRules as Prisma.InputJsonValue,
        excludeRules: parsed.data.excludeRules as Prisma.InputJsonValue,
        approvedDocumentTypes: parsed.data.approvedDocumentTypes as Prisma.InputJsonValue,
        dateRangeStart: parsed.data.dateRangeStart ? new Date(parsed.data.dateRangeStart) : null,
        dateRangeEnd: parsed.data.dateRangeEnd ? new Date(parsed.data.dateRangeEnd) : null,
        direction: 'IMPORT_ONLY',
        status: 'DRAFT',
        configuredByUserId: ctx.user.id,
        lastCheckpoint: {
          projectReferencePatterns: scopeRules.projectReferencePatterns,
          mimeAllowlist: scopeRules.mimeAllowlist,
        } as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'connector_scope.created',
        entityType: 'connector_project_scope',
        entityId: scope.id,
      },
      tx,
    );

    return scope;
  });
}

export async function approveProjectScope(scopeId: string) {
  const ctx = await requireTenantCapability('connector_scope.approve');
  const loaded = await withTenantTransaction(
    { tenantId: ctx.tenantId, userId: ctx.user.id },
    async (tx) =>
      tx.connectorProjectScope.findFirst({
        where: { id: scopeId, tenantId: ctx.tenantId },
      }),
  );
  if (!loaded) throw notFound();
  const projectCtx = await requireProjectCapability(loaded.projectId, 'connector_scope.approve');

  return withTenantTransaction(
    { tenantId: projectCtx.tenantId, userId: projectCtx.user.id },
    async (tx) => {
      const existing = await tx.connectorProjectScope.findFirst({
        where: { id: scopeId, tenantId: projectCtx.tenantId },
      });
      if (!existing) throw notFound();
      if (existing.status !== 'DRAFT' && existing.status !== 'IN_REVIEW') {
        throw conflict('Scope is not pending approval');
      }
      if (connectorSodEnabled() && existing.configuredByUserId === projectCtx.user.id) {
        throw forbidden('Segregation of duties: approver cannot be the scope configurer');
      }

      const updated = await tx.connectorProjectScope.update({
        where: { id: scopeId },
        data: {
          status: 'ACTIVE',
          approvedByUserId: projectCtx.user.id,
        },
      });

      await tx.connectorScopeApproval.create({
        data: {
          tenantId: projectCtx.tenantId,
          projectId: existing.projectId,
          connectorProjectScopeId: scopeId,
          decision: 'APPROVED',
          actorUserId: projectCtx.user.id,
          decidedAt: new Date(),
          scopeSnapshot: existing as unknown as Prisma.InputJsonValue,
        },
      });

      await writeAuditLog(
        {
          tenantId: projectCtx.tenantId,
          projectId: existing.projectId,
          actorUserId: projectCtx.user.id,
          action: 'connector_scope.approved',
          entityType: 'connector_project_scope',
          entityId: scopeId,
        },
        tx,
      );

      return updated;
    },
  );
}

export async function previewScope(scopeId: string) {
  const ctx = await requireTenantCapability('connector_sync.read');
  const provider = requireConnectorProvider();

  const scope = await withTenantTransaction(
    { tenantId: ctx.tenantId, userId: ctx.user.id },
    async (tx) =>
      tx.connectorProjectScope.findFirst({
        where: { id: scopeId, tenantId: ctx.tenantId },
      }),
  );
  if (!scope) throw notFound();

  const scopeRules = scopeRulesFromRecord(scope);
  const access = await provider.testScopeAccess(scopeRules);
  const checkpoint = (scope.lastCheckpoint as ConnectorCheckpoint | null) ?? null;
  const page = await provider.listChangedRecords(checkpoint);
  let estimated = 0;
  for (const ref of page.records) {
    const metadata = await provider.fetchRecordMetadata(ref.externalId);
    if (!metadata) continue;
    const match = recordMatchesScope(scopeRules, {
      subjectOrTitle: metadata.title ?? ref.externalId,
      modifiedAt: metadata.modifiedAt,
      mimeType: metadata.mimeType,
      projectReferences: metadata.projectReferences,
    });
    if (match.ok) estimated += 1;
  }

  return {
    accessibleCount: access.accessibleCount ?? estimated,
    estimatedChangedRecords: estimated,
    hasMore: page.hasMore,
  };
}

export async function startManualSync(scopeId: string) {
  const tenantCtx = await requireTenantCapability('connector_sync.run');
  const row = await withTenantTransaction(
    { tenantId: tenantCtx.tenantId, userId: tenantCtx.user.id },
    async (tx) =>
      tx.connectorProjectScope.findFirst({
        where: { id: scopeId, tenantId: tenantCtx.tenantId },
        include: { connectorAccount: true },
      }),
  );
  if (!row) throw notFound();
  const ctx = await requireProjectCapability(row.projectId, 'connector_sync.run');
  return runSyncForScope(row, ctx);
}

async function runSyncForScope(
  scope: ConnectorProjectScope & { connectorAccount: { provider: string; id: string } },
  ctx: ProjectContext,
) {
  if (scope.status !== 'ACTIVE') {
    throw conflict('Connector scope must be active before sync');
  }
  if (scope.direction !== 'IMPORT_ONLY') {
    throw conflict('Only IMPORT_ONLY scopes are supported');
  }

  const correlationId = randomUUID();

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const syncRun = await tx.connectorSyncRun.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: scope.projectId,
        connectorAccountId: scope.connectorAccountId,
        connectorProjectScopeId: scope.id,
        scopeSnapshot: scope as unknown as Prisma.InputJsonValue,
        runType: 'MANUAL',
        status: 'QUEUED',
        requestedByUserId: ctx.user.id,
        processorVersion: PROCESSOR_VERSION,
        correlationId,
      },
    });

    await executeSyncRun(tx, {
      syncRunId: syncRun.id,
      scope,
      userId: ctx.user.id,
      tenantId: ctx.tenantId,
    });

    return tx.connectorSyncRun.findFirst({ where: { id: syncRun.id } });
  });
}

export async function listSyncRuns(projectId: string, scopeId?: string) {
  const ctx = await requireProjectCapability(projectId, 'connector_sync.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.connectorSyncRun.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        ...(scopeId ? { connectorProjectScopeId: scopeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  );
}

export async function getExternalRecords(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'connector_sync.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.externalRecord.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
      include: {
        sourceDocument: { select: { id: true, title: true, status: true } },
        documentVersion: { select: { id: true, processingStatus: true, sha256: true } },
      },
    }),
  );
}

export async function listProjectConnectorScopes(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'connector_account.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.connectorProjectScope.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      include: {
        connectorAccount: { select: { id: true, displayName: true, provider: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export async function processConnectorWebhook(
  providerName: string,
  headers: Record<string, string>,
  rawBody: Buffer,
) {
  const provider = requireConnectorProvider();
  if (provider.kind !== providerName && providerName !== 'fake') {
    throw validationError('Webhook provider mismatch');
  }
  if (!provider.validateWebhook || !provider.parseWebhook) {
    throw validationError('Provider does not support webhooks');
  }

  const validation = await provider.validateWebhook(headers, rawBody);
  if (!validation.ok) {
    throw validationError(validation.reason ?? 'Invalid webhook');
  }

  const parsed = await provider.parseWebhook(rawBody);
  const payloadChecksum = createHash('sha256').update(rawBody).digest('hex');

  const ctx = await requireTenantCapability('connector_sync.run');
  const account = await withTenantTransaction(
    { tenantId: ctx.tenantId, userId: ctx.user.id },
    async (tx) =>
      tx.connectorAccount.findFirst({
        where: { tenantId: ctx.tenantId, provider: providerName, status: 'APPROVED' },
      }),
  );
  if (!account) throw notFound('Connector account for webhook');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const event = await tx.connectorProviderEvent.create({
      data: {
        tenantId: ctx.tenantId,
        connectorAccountId: account.id,
        provider: providerName,
        providerEventId: parsed.providerEventId,
        eventType: parsed.eventType,
        occurredAt: new Date(parsed.occurredAt),
        signatureStatus: 'VALID',
        payloadChecksum,
        redactedPayload: parsed.redactedPayload as Prisma.InputJsonValue,
        processingStatus: 'RECEIVED',
      },
    });

    const scope = await tx.connectorProjectScope.findFirst({
      where: { tenantId: ctx.tenantId, connectorAccountId: account.id, status: 'ACTIVE' },
      include: { connectorAccount: true },
    });
    if (!scope) {
      return { event, syncRun: null };
    }

    const syncRun = await tx.connectorSyncRun.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: scope.projectId,
        connectorAccountId: account.id,
        connectorProjectScopeId: scope.id,
        scopeSnapshot: scope as unknown as Prisma.InputJsonValue,
        runType: 'INCREMENTAL',
        status: 'QUEUED',
        processorVersion: PROCESSOR_VERSION,
        correlationId: randomUUID(),
      },
    });

    await tx.connectorProviderEvent.update({
      where: { id: event.id },
      data: { linkedSyncRunId: syncRun.id, processingStatus: 'SYNC_QUEUED' },
    });

    if (process.env.CONNECTOR_WEBHOOK_INLINE !== 'false') {
      await executeSyncRun(tx, {
        syncRunId: syncRun.id,
        scope,
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
      });
    }

    const completed = await tx.connectorSyncRun.findFirst({ where: { id: syncRun.id } });
    return { event, syncRun: completed };
  });
}

export async function listConnectorScopes(accountId: string) {
  const ctx = await requireTenantCapability('connector_account.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.connectorProjectScope.findMany({
      where: { tenantId: ctx.tenantId, connectorAccountId: accountId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}
