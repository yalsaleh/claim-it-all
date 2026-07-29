import {
  aggregateRecipientStatus,
  assertAuthorizationDispatchable,
  assessDeemedReceipt,
  buildDispatchSnapshotChecksum,
  buildIdempotencyKey,
  classifyRetry,
  computeDeliveryRisk,
  isFutureChannel,
  isOperationalChannel,
  NOTICE_DELIVERY_RULESET_VERSION,
  sha256Hex,
  validateAttachmentChecksums,
  validateCoverMessage,
  validateRecipientsForDispatch,
  type AttachmentSnapshot,
  type RecipientSnapshot,
} from '@contractradar/notice-delivery';
import { createCorrelationId } from '@contractradar/shared';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import { requireProjectCapability } from '@/server/authz/context';
import { withTenantTransaction, setRlsContext } from '@/server/db/tenant-context';
import { prisma } from '@/server/db';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';
import {
  getNoticeDeliveryProvider,
  requireAutomatedDeliveryProvider,
} from '@/server/notices/delivery-provider';

const DISPATCH_PREP_STATUSES = [
  'APPROVED',
  'EXPORTED',
  'AUTHORIZATION_PENDING',
  'AUTHORIZED_FOR_DISPATCH',
  'DISPATCHED',
  'DELIVERY_PENDING',
  'DELIVERY_PARTIAL',
  'DELIVERY_CONFIRMED',
  'RECEIPT_UNCONFIRMED',
  'RECEIPT_CONFIRMED',
  'DELIVERY_FAILED',
] as const;

const CreateSnapshotSchema = z.object({
  channel: z.string(),
  subject: z.string().trim().min(1).max(500),
  plainText: z.string().trim().min(1),
  htmlSafe: z.string().optional(),
});

const RequestAuthSchema = z.object({
  rationale: z.string().trim().max(5000).optional(),
});

const AuthorizeSchema = z.object({
  recipientsReviewed: z.boolean(),
  methodReviewed: z.boolean(),
  attachmentsReviewed: z.boolean(),
  deadlineReviewed: z.boolean(),
  scopeReviewed: z.boolean(),
  deliveryRiskAcknowledged: z.boolean(),
  rationale: z.string().trim().max(5000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const RejectAuthSchema = z.object({
  rationale: z.string().trim().min(1).max(5000),
});

const ManualDispatchSchema = z.object({
  method: z.string(),
  dispatchAt: z.string().datetime(),
  location: z.string().trim().max(500).optional(),
  courierOrProviderName: z.string().trim().max(300).optional(),
  trackingNumber: z.string().trim().max(200).optional(),
  handDeliveredToName: z.string().trim().max(300).optional(),
  externalSubmissionReference: z.string().trim().max(300).optional(),
  physicalReceiptReference: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(5000).optional(),
});

const UploadEvidenceSchema = z.object({
  attemptId: z.string().uuid(),
  recipientId: z.string().uuid().optional(),
  evidenceType: z.enum([
    'EMAIL_PROVIDER_ACCEPTANCE',
    'EMAIL_DELIVERY_CONFIRMATION',
    'EMAIL_BOUNCE',
    'READ_RECEIPT',
    'MANUAL_SENT_EMAIL_COPY',
    'COURIER_RECEIPT',
    'POSTAL_RECEIPT',
    'HAND_DELIVERY_RECEIPT',
    'EDMS_SUBMISSION_CONFIRMATION',
    'SCREENSHOT',
    'ACKNOWLEDGMENT_EMAIL',
    'SIGNED_RECEIPT',
    'TRACKING_RESULT',
    'OTHER',
  ]),
  filename: z.string().trim().max(300).optional(),
  checksumSha256: z.string().length(64),
  storageKey: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime().optional(),
});

const VerifyEvidenceSchema = z.object({
  evidenceId: z.string().uuid(),
  verificationStatus: z.enum(['VERIFIED', 'DISPUTED', 'REJECTED']).default('VERIFIED'),
});

const AcknowledgmentSchema = z.object({
  attemptId: z.string().uuid(),
  recipientId: z.string().uuid().optional(),
  acknowledgmentType: z.string().trim().min(1).max(100),
  acknowledgedAt: z.string().datetime(),
  summary: z.string().trim().max(5000).optional(),
  sourceEvidenceId: z.string().uuid().optional(),
});

const VerifyAcknowledgmentSchema = z.object({
  acknowledgmentId: z.string().uuid(),
});

const AssessReceiptSchema = z.object({
  attemptId: z.string().uuid(),
  recipientId: z.string().uuid().optional(),
  receiptStatus: z.enum([
    'UNKNOWN',
    'PROVIDER_ACCEPTED',
    'SENT',
    'DELIVERED',
    'ACKNOWLEDGED',
    'BOUNCED',
    'REFUSED',
    'DISPUTED',
    'MANUALLY_CONFIRMED',
  ]),
  receiptAt: z.string().datetime().optional(),
  source: z.string().trim().max(200).optional(),
  evidenceId: z.string().uuid().optional(),
  deemedReceiptRule: z
    .enum([
      'ACTUAL_DELIVERY',
      'ON_TRANSMISSION',
      'NEXT_WORKING_DAY',
      'POSTAL_PERIOD',
      'PLATFORM_SUBMISSION',
      'NONE',
    ])
    .optional(),
  rationale: z.string().trim().max(5000).optional(),
});

const ConfirmServiceSchema = z.object({
  assessmentId: z.string().uuid(),
  contractualServiceStatus: z.literal('HUMAN_CONFIRMED'),
  rationale: z.string().trim().max(5000).optional(),
});

function dispatchSodEnabled(): boolean {
  return process.env.NOTICE_DISPATCH_SEGREGATION_OF_DUTIES !== 'false';
}

function assertProjectMutable(status: string) {
  if (status === 'ARCHIVED') throw conflict('Archived projects are read-only');
}

function wrapDispatchError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message.startsWith('AUTHORIZATION_NOT_DISPATCHABLE')) {
      throw validationError(`Authorization not dispatchable: ${err.message.split(':')[1] ?? ''}`);
    }
    if (err.message === 'AUTHORIZATION_EXPIRED') {
      throw validationError('Authorization has expired');
    }
  }
  throw err;
}

async function loadPackage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  projectId: string,
  noticePackageId: string,
) {
  const pkg = await tx.noticePackage.findFirst({
    where: { id: noticePackageId, tenantId, projectId },
    include: {
      activeApprovedRevision: { include: { sections: { orderBy: { sequence: 'asc' } } } },
      deliveryPreparations: true,
      attachments: { where: { inclusionStatus: 'INCLUDED' } },
      exportBundles: { orderBy: { generatedAt: 'desc' } },
      project: { select: { status: true } },
    },
  });
  if (!pkg) throw notFound();
  return pkg;
}

function buildRecipientSnapshots(
  preparations: Array<{
    id: string;
    namedRecipient: string | null;
    recipientRole: string | null;
    emailAddress: string | null;
    physicalAddress: string | null;
    platformAddress: string | null;
    attentionLine: string | null;
    selectedMethod: string | null;
    permittedMethod: string | null;
    copiedRecipient: boolean;
    verificationStatus: string;
  }>,
): { required: RecipientSnapshot[]; copied: RecipientSnapshot[] } {
  const verified = preparations.filter((p) => p.verificationStatus === 'VERIFIED');
  const required: RecipientSnapshot[] = [];
  const copied: RecipientSnapshot[] = [];
  for (const prep of verified) {
    const snap: RecipientSnapshot = {
      preparationId: prep.id,
      displayName: prep.namedRecipient ?? prep.recipientRole ?? 'Recipient',
      emailAddress: prep.emailAddress,
      physicalAddress: prep.physicalAddress,
      platformAddress: prep.platformAddress,
      attentionLine: prep.attentionLine,
      method: prep.selectedMethod ?? prep.permittedMethod ?? '',
      copiedRecipient: prep.copiedRecipient,
      required: !prep.copiedRecipient,
    };
    if (prep.copiedRecipient) copied.push(snap);
    else required.push(snap);
  }
  return { required, copied };
}

function buildAttachmentSnapshots(
  attachments: Array<{
    id: string;
    externalFilename: string;
    checksumSha256: string | null;
    sequence: number;
  }>,
): AttachmentSnapshot[] {
  return attachments.map((a) => ({
    attachmentId: a.id,
    filename: a.externalFilename,
    checksumSha256: a.checksumSha256 ?? sha256Hex(a.externalFilename),
    sequence: a.sequence,
    mimeType: null,
  }));
}

function selectExportBundle(
  bundles: Array<{ id: string; format: string; artifactChecksum: string; draftRevisionId: string }>,
  revisionId: string,
) {
  const forRevision = bundles.filter((b) => b.draftRevisionId === revisionId);
  return (
    forRevision.find((b) => b.format === 'ATTACHMENT_ZIP') ??
    forRevision.find((b) => b.format === 'PDF') ??
    forRevision[0] ??
    null
  );
}

function revisionNoticeChecksum(revision: {
  id: string;
  sections: Array<{ body: string; sequence: number }>;
}): string {
  const text = [...revision.sections]
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => s.body)
    .join('\n');
  return sha256Hex(text || revision.id);
}

function mapProviderRecipientStatus(
  status: string,
): 'PENDING' | 'SUBMITTED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'REJECTED' | 'FAILED' | 'UNKNOWN' {
  const allowed = [
    'PENDING',
    'SUBMITTED',
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'REJECTED',
    'FAILED',
    'UNKNOWN',
  ] as const;
  if ((allowed as readonly string[]).includes(status)) {
    return status as (typeof allowed)[number];
  }
  return 'UNKNOWN';
}

function mapAttemptToPackageStatus(
  attemptStatus: string,
):
  | 'DISPATCHED'
  | 'DELIVERY_PARTIAL'
  | 'DELIVERY_FAILED'
  | 'DELIVERY_PENDING'
  | 'DELIVERY_CONFIRMED' {
  if (attemptStatus === 'DELIVERED') return 'DELIVERY_CONFIRMED';
  if (attemptStatus === 'PARTIALLY_DELIVERED') return 'DELIVERY_PARTIAL';
  if (attemptStatus === 'FAILED') return 'DELIVERY_FAILED';
  if (attemptStatus === 'UNCERTAIN_MANUAL_REVIEW') return 'DELIVERY_PENDING';
  if (attemptStatus === 'MANUAL_DISPATCH_RECORDED' || attemptStatus === 'AWAITING_EVIDENCE') {
    return 'DISPATCHED';
  }
  return 'DISPATCHED';
}

/** Documents that no autonomous resend function exists in this module. */
export function assertNoAutonomousResend(): void {
  const forbidden = ['resendNotice', 'autoRetryDispatch', 'retryDispatch'];
  for (const name of forbidden) {
    if (name in exports) {
      throw new Error(`Forbidden autonomous resend exported: ${name}`);
    }
  }
}

export async function createDispatchPackageSnapshot(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.prepare');
  const parsed = CreateSnapshotSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid snapshot input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable(pkg.project.status);
    if (!(DISPATCH_PREP_STATUSES as readonly string[]).includes(pkg.status)) {
      throw validationError(`Package status ${pkg.status} is not ready for dispatch preparation`);
    }
    if (!pkg.activeApprovedRevisionId || !pkg.activeApprovedRevision) {
      throw validationError('Active approved revision required');
    }
    if (pkg.activeApprovedRevision.status !== 'APPROVED') {
      throw validationError('Active revision must be approved');
    }

    const channel = parsed.data.channel;
    if (isFutureChannel(channel)) throw validationError('Future channels are not operational');
    if (!isOperationalChannel(channel)) throw validationError(`Unsupported channel: ${channel}`);

    const exportBundle = selectExportBundle(pkg.exportBundles, pkg.activeApprovedRevisionId);
    if (!exportBundle) {
      throw validationError('At least one export bundle is required for the approved revision');
    }

    const coverResult = validateCoverMessage(parsed.data);
    if (!coverResult.ok) throw validationError(`Cover message invalid: ${coverResult.reason}`);

    const { required, copied } = buildRecipientSnapshots(pkg.deliveryPreparations);
    const allRecipients = [...required, ...copied];
    const recipientCheck = validateRecipientsForDispatch(allRecipients);
    if (!recipientCheck.ok) throw validationError(`Recipients invalid: ${recipientCheck.reason}`);

    const attachmentSnapshots = buildAttachmentSnapshots(pkg.attachments);
    const attachmentManifestChecksum = sha256Hex(JSON.stringify(attachmentSnapshots));
    const recipientSnapshotJson = JSON.stringify(allRecipients);
    const deliveryMethodSnapshot = {
      channel,
      rulesetVersion: NOTICE_DELIVERY_RULESET_VERSION,
    };

    const noticeChecksum = revisionNoticeChecksum(pkg.activeApprovedRevision);

    const snapshotChecksum = buildDispatchSnapshotChecksum({
      noticeChecksum,
      bundleChecksum: exportBundle.artifactChecksum,
      attachmentManifestChecksum,
      recipientSnapshotJson,
      coverChecksum: coverResult.snapshot.checksumSha256,
      channel,
    });

    const snapshot = await tx.noticeDispatchPackageSnapshot.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        approvedDraftRevisionId: pkg.activeApprovedRevisionId,
        noticeExportId: exportBundle.id,
        exportManifestChecksum: exportBundle.artifactChecksum,
        bundleChecksum: exportBundle.artifactChecksum,
        noticeChecksum,
        attachmentManifestChecksum,
        templateVersion: pkg.activeApprovedRevision.templateVersion,
        language: pkg.language,
        governingLanguage: pkg.language,
        subject: coverResult.snapshot.subject,
        recipientSnapshot: required as unknown as Prisma.InputJsonValue,
        copiedRecipientSnapshot: copied as unknown as Prisma.InputJsonValue,
        deliveryMethodSnapshot: deliveryMethodSnapshot as Prisma.InputJsonValue,
        attachmentSnapshot: attachmentSnapshots as unknown as Prisma.InputJsonValue,
        coverMessageSnapshot: coverResult.snapshot as unknown as Prisma.InputJsonValue,
        channel,
        createdByUserId: ctx.user.id,
      },
    });

    await tx.noticeDispatchCoverMessage.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        snapshotId: snapshot.id,
        subject: coverResult.snapshot.subject,
        plainText: coverResult.snapshot.plainText,
        htmlSafe: coverResult.snapshot.htmlSafe,
        checksumSha256: coverResult.snapshot.checksumSha256,
        createdByUserId: ctx.user.id,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'AUTHORIZATION_PENDING' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.snapshot_create',
        entityType: 'notice_dispatch_package_snapshot',
        entityId: snapshot.id,
        metadata: { channel, checksum: snapshotChecksum },
      },
      tx,
    );

    return { snapshot, checksum: snapshotChecksum };
  });
}

export async function requestDispatchAuthorization(
  projectId: string,
  noticePackageId: string,
  snapshotId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.request_authorization');
  const parsed = RequestAuthSchema.safeParse(rawInput ?? {});
  if (!parsed.success)
    throw validationError('Invalid authorization request', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable(pkg.project.status);

    const snapshot = await tx.noticeDispatchPackageSnapshot.findFirst({
      where: { id: snapshotId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!snapshot) throw notFound();

    const recipients = [
      ...(snapshot.recipientSnapshot as RecipientSnapshot[]),
      ...(snapshot.copiedRecipientSnapshot as RecipientSnapshot[]),
    ];

    const auth = await tx.noticeDispatchAuthorization.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        dispatchPackageSnapshotId: snapshotId,
        requestedByUserId: ctx.user.id,
        status: 'REQUESTED',
        selectedChannel: snapshot.channel,
        recipientCount: recipients.filter((r) => !r.copiedRecipient).length,
        copiedRecipientCount: recipients.filter((r) => r.copiedRecipient).length,
        rationale: parsed.data.rationale,
        recipientsReviewed: false,
        methodReviewed: false,
        attachmentsReviewed: false,
        deadlineReviewed: false,
        scopeReviewed: false,
        deliveryRiskAcknowledged: false,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.request_authorization',
        entityType: 'notice_dispatch_authorization',
        entityId: auth.id,
      },
      tx,
    );

    return auth;
  });
}

export async function authorizeDispatch(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.authorize');
  const parsed = AuthorizeSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid authorization', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable(pkg.project.status);

    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
      include: { dispatchPackageSnapshot: true },
    });
    if (!auth) throw notFound();
    if (auth.status !== 'REQUESTED' && auth.status !== 'UNDER_REVIEW') {
      throw conflict(`Authorization status ${auth.status} cannot be authorized`);
    }

    if (dispatchSodEnabled() && pkg.sodEnforced) {
      if (auth.requestedByUserId === ctx.user.id) {
        throw forbidden('Segregation of duties: authorizer cannot be the requester');
      }
      if (auth.dispatchPackageSnapshot.createdByUserId === ctx.user.id) {
        throw forbidden('Segregation of duties: authorizer cannot be the snapshot creator');
      }
    }

    const checks = parsed.data;
    if (
      !checks.recipientsReviewed ||
      !checks.methodReviewed ||
      !checks.attachmentsReviewed ||
      !checks.deadlineReviewed ||
      !checks.scopeReviewed ||
      !checks.deliveryRiskAcknowledged
    ) {
      throw validationError('All authorization review checkboxes must be confirmed');
    }

    const updated = await tx.noticeDispatchAuthorization.update({
      where: { id: auth.id },
      data: {
        status: 'AUTHORIZED',
        authorizedByUserId: ctx.user.id,
        authorizedAt: new Date(),
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
        recipientsReviewed: true,
        methodReviewed: true,
        attachmentsReviewed: true,
        deadlineReviewed: true,
        scopeReviewed: true,
        deliveryRiskAcknowledged: true,
        rationale: checks.rationale ?? auth.rationale,
        expiresAt: checks.expiresAt ? new Date(checks.expiresAt) : auth.expiresAt,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'AUTHORIZED_FOR_DISPATCH' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.authorize',
        entityType: 'notice_dispatch_authorization',
        entityId: auth.id,
      },
      tx,
    );

    return updated;
  });
}

export async function rejectDispatchAuthorization(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.authorize');
  const parsed = RejectAuthSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid rejection', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!auth) throw notFound();
    if (auth.status !== 'REQUESTED' && auth.status !== 'UNDER_REVIEW') {
      throw conflict(`Authorization status ${auth.status} cannot be rejected`);
    }

    const updated = await tx.noticeDispatchAuthorization.update({
      where: { id: auth.id },
      data: {
        status: 'REJECTED',
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
        rationale: parsed.data.rationale,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'AUTHORIZATION_PENDING' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.reject',
        entityType: 'notice_dispatch_authorization',
        entityId: auth.id,
      },
      tx,
    );

    return updated;
  });
}

export async function revokeDispatchAuthorization(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.revoke');
  const parsed = RejectAuthSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid revocation', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!auth) throw notFound();
    if (auth.status !== 'AUTHORIZED') {
      throw conflict('Only authorized dispatch can be revoked');
    }

    const updated = await tx.noticeDispatchAuthorization.update({
      where: { id: auth.id },
      data: { status: 'REVOKED', rationale: parsed.data.rationale },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'AUTHORIZATION_PENDING' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.revoke',
        entityType: 'notice_dispatch_authorization',
        entityId: auth.id,
      },
      tx,
    );

    return updated;
  });
}

export async function validateDispatchReadiness(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'delivery_risk.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
      include: {
        dispatchPackageSnapshot: true,
        noticePackage: {
          include: {
            deliveryPreparations: true,
            deadlineCalculation: { select: { calculatedDeadlineAt: true } },
          },
        },
      },
    });
    if (!auth) throw notFound();

    const snapshot = auth.dispatchPackageSnapshot;
    const attachments = snapshot.attachmentSnapshot as AttachmentSnapshot[];
    const checksumOk = validateAttachmentChecksums(attachments, attachments).ok;

    const missingVerified = auth.noticePackage.deliveryPreparations.some(
      (p) => !p.copiedRecipient && p.verificationStatus !== 'VERIFIED',
    );

    const providerConfigured = getNoticeDeliveryProvider() !== null;
    const now = new Date();
    const authorizationExpired = auth.expiresAt != null && auth.expiresAt.getTime() < now.getTime();

    const risk = computeDeliveryRisk({
      deadlineAt: auth.noticePackage.deadlineCalculation?.calculatedDeadlineAt ?? null,
      missingVerifiedRecipient: missingVerified,
      providerConfigured,
      attachmentOverLimit: false,
      requiredRecipientFailed: false,
      receiptUnconfirmed: false,
      authorizationExpired,
      manualProofMissing: auth.selectedChannel.startsWith('MANUAL_'),
      dispatchedAfterDeadline: false,
      methodNotPermitted: false,
    });

    return {
      authorizationId: auth.id,
      authorizationStatus: auth.status,
      checksumValid: checksumOk,
      risk,
    };
  });
}

export async function sendApprovedNoticeEmail(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.send');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable(pkg.project.status);

    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
      include: { dispatchPackageSnapshot: true },
    });
    if (!auth) throw notFound();

    try {
      assertAuthorizationDispatchable({ status: auth.status, expiresAt: auth.expiresAt });
    } catch (err) {
      wrapDispatchError(err);
    }

    if (auth.selectedChannel !== 'CONTROLLED_EMAIL') {
      throw validationError('sendApprovedNoticeEmail requires CONTROLLED_EMAIL channel');
    }

    const provider = requireAutomatedDeliveryProvider();
    const configCheck = await provider.validateConfiguration();
    if (!configCheck.ok) {
      throw validationError(configCheck.reason ?? 'Provider configuration invalid');
    }

    const snapshot = auth.dispatchPackageSnapshot;
    const recipients = [
      ...(snapshot.recipientSnapshot as RecipientSnapshot[]),
      ...(snapshot.copiedRecipientSnapshot as RecipientSnapshot[]),
    ];
    const cover = snapshot.coverMessageSnapshot as {
      subject: string;
      plainText: string;
      htmlSafe: string | null;
      checksumSha256: string;
    };
    const attachments = snapshot.attachmentSnapshot as AttachmentSnapshot[];

    const attemptCount = await tx.noticeDispatchAttempt.count({
      where: { dispatchAuthorizationId: auth.id },
    });
    const attemptNumber = attemptCount + 1;
    const idempotencyKey = buildIdempotencyKey({
      authorizationId: auth.id,
      channel: auth.selectedChannel,
      attemptNumber,
      recipientPreparationIds: recipients.map((r) => r.preparationId),
    });
    const correlationId = createCorrelationId();

    const attempt = await tx.noticeDispatchAttempt.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        dispatchAuthorizationId: auth.id,
        dispatchPackageSnapshotId: snapshot.id,
        attemptNumber,
        channel: auth.selectedChannel,
        provider: provider.kind,
        status: 'PREPARED',
        initiatedByUserId: ctx.user.id,
        correlationId,
        idempotencyKey,
      },
    });

    await tx.noticeDispatchAuthorization.update({
      where: { id: auth.id },
      data: { status: 'USED' },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'DISPATCH_IN_PROGRESS' },
    });

    const prepareInput = {
      snapshotId: snapshot.id,
      recipients,
      cover,
      artifactChecksum: snapshot.bundleChecksum,
      attachmentSnapshots: attachments,
      idempotencyKey,
      correlationId,
    };

    await provider.prepareMessage(prepareInput);
    const result = await provider.sendMessage(prepareInput);

    const recipientRows = [];
    for (const r of result.recipients) {
      const prep = recipients.find((p) => p.preparationId === r.preparationId);
      const row = await tx.noticeDispatchRecipient.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          dispatchAttemptId: attempt.id,
          recipientType: prep?.copiedRecipient ? 'COPIED' : 'PRIMARY',
          preparationId: r.preparationId,
          displayName: prep?.displayName ?? 'Recipient',
          addressOrEmail: prep?.emailAddress ?? prep?.physicalAddress ?? prep?.platformAddress,
          copiedRecipient: prep?.copiedRecipient ?? false,
          requiredRecipient: prep?.required ?? true,
          method: prep?.method ?? auth.selectedChannel,
          status: mapProviderRecipientStatus(r.status),
          providerRecipientId: r.providerRecipientId ?? null,
          failureReason: r.failureReason ?? null,
          sentAt: result.sentAt ? new Date(result.sentAt) : null,
        },
      });
      recipientRows.push(row);
    }

    const aggregated = aggregateRecipientStatus(recipientRows.map((r) => r.status));
    const retryClass = classifyRetry({
      providerAccepted: result.outcome === 'ACCEPTED' || result.outcome === 'PARTIAL',
      providerMessageId: result.providerMessageId,
      failureCode: result.recipients.find((r) => r.failureReason)?.failureReason ?? null,
      timedOutAfterSubmit: result.outcome === 'TIMEOUT_AFTER_POSSIBLE_SUBMIT',
      checksumMismatch: false,
      authorizationValid: true,
      artifactPresent: true,
    });

    const finalAttempt = await tx.noticeDispatchAttempt.update({
      where: { id: attempt.id },
      data: {
        status: aggregated,
        providerMessageId: result.providerMessageId,
        providerSubmissionId: result.providerSubmissionId,
        startedAt: new Date(),
        completedAt: new Date(),
        retryClass,
        failureCode: result.outcome !== 'ACCEPTED' ? result.outcome : null,
      },
      include: { recipients: true },
    });

    const packageStatus = mapAttemptToPackageStatus(aggregated);
    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: packageStatus },
    });

    // Slice 7: sync path only — outbox type notice_dispatch_send not registered in dispatcher yet.
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.send',
        entityType: 'notice_dispatch_attempt',
        entityId: attempt.id,
        metadata: {
          provider: provider.kind,
          outcome: result.outcome,
          providerMessageId: result.providerMessageId,
        },
      },
      tx,
    );

    assertNoAutonomousResend();
    return finalAttempt;
  });
}

export async function recordManualDispatch(
  projectId: string,
  noticePackageId: string,
  authorizationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.record_manual');
  const parsed = ManualDispatchSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid manual dispatch', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable(pkg.project.status);

    const auth = await tx.noticeDispatchAuthorization.findFirst({
      where: { id: authorizationId, noticePackageId, tenantId: ctx.tenantId, projectId },
      include: { dispatchPackageSnapshot: true },
    });
    if (!auth) throw notFound();

    try {
      assertAuthorizationDispatchable({ status: auth.status, expiresAt: auth.expiresAt });
    } catch (err) {
      wrapDispatchError(err);
    }

    if (!auth.selectedChannel.startsWith('MANUAL_')) {
      throw validationError('Authorization channel is not manual');
    }

    const snapshot = auth.dispatchPackageSnapshot;
    const recipients = [
      ...(snapshot.recipientSnapshot as RecipientSnapshot[]),
      ...(snapshot.copiedRecipientSnapshot as RecipientSnapshot[]),
    ];

    const attemptCount = await tx.noticeDispatchAttempt.count({
      where: { dispatchAuthorizationId: auth.id },
    });
    const attemptNumber = attemptCount + 1;
    const idempotencyKey = buildIdempotencyKey({
      authorizationId: auth.id,
      channel: auth.selectedChannel,
      attemptNumber,
      recipientPreparationIds: recipients.map((r) => r.preparationId),
    });

    const attempt = await tx.noticeDispatchAttempt.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        dispatchAuthorizationId: auth.id,
        dispatchPackageSnapshotId: snapshot.id,
        attemptNumber,
        channel: auth.selectedChannel,
        provider: 'manual',
        status: 'MANUAL_DISPATCH_RECORDED',
        initiatedByUserId: ctx.user.id,
        correlationId: createCorrelationId(),
        idempotencyKey,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    for (const prep of recipients) {
      await tx.noticeDispatchRecipient.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          dispatchAttemptId: attempt.id,
          recipientType: prep.copiedRecipient ? 'COPIED' : 'PRIMARY',
          preparationId: prep.preparationId,
          displayName: prep.displayName,
          addressOrEmail: prep.emailAddress ?? prep.physicalAddress ?? prep.platformAddress,
          copiedRecipient: prep.copiedRecipient,
          requiredRecipient: prep.required,
          method: parsed.data.method,
          status: 'MANUALLY_CONFIRMED',
        },
      });
    }

    await tx.manualDispatchRecord.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        dispatchAttemptId: attempt.id,
        method: parsed.data.method,
        dispatchedByUserId: ctx.user.id,
        dispatchAt: new Date(parsed.data.dispatchAt),
        location: parsed.data.location,
        courierOrProviderName: parsed.data.courierOrProviderName,
        trackingNumber: parsed.data.trackingNumber,
        handDeliveredToName: parsed.data.handDeliveredToName,
        externalSubmissionReference: parsed.data.externalSubmissionReference,
        physicalReceiptReference: parsed.data.physicalReceiptReference,
        notes: parsed.data.notes,
      },
    });

    await tx.noticeDispatchAuthorization.update({
      where: { id: auth.id },
      data: { status: 'USED' },
    });

    await tx.noticeDispatchAttempt.update({
      where: { id: attempt.id },
      data: { status: 'AWAITING_EVIDENCE' },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'DISPATCHED' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_dispatch.record_manual',
        entityType: 'notice_dispatch_attempt',
        entityId: attempt.id,
      },
      tx,
    );

    return tx.noticeDispatchAttempt.findFirstOrThrow({
      where: { id: attempt.id },
      include: { recipients: true, manualDispatchRecord: true },
    });
  });
}

export async function uploadDispatchEvidence(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'dispatch_evidence.upload');
  const parsed = UploadEvidenceSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid evidence', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const attempt = await tx.noticeDispatchAttempt.findFirst({
      where: {
        id: parsed.data.attemptId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!attempt) throw notFound();

    const evidence = await tx.dispatchEvidence.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        dispatchAttemptId: attempt.id,
        dispatchRecipientId: parsed.data.recipientId,
        evidenceType: parsed.data.evidenceType,
        filename: parsed.data.filename,
        checksumSha256: parsed.data.checksumSha256,
        storageKey: parsed.data.storageKey,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
        recordedByUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'dispatch_evidence.upload',
        entityType: 'dispatch_evidence',
        entityId: evidence.id,
      },
      tx,
    );

    return evidence;
  });
}

export async function verifyDispatchEvidence(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'dispatch_evidence.verify');
  const parsed = VerifyEvidenceSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid verification', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const evidence = await tx.dispatchEvidence.findFirst({
      where: {
        id: parsed.data.evidenceId,
        tenantId: ctx.tenantId,
        projectId,
        dispatchAttempt: { noticePackageId },
      },
    });
    if (!evidence) throw notFound();

    const updated = await tx.dispatchEvidence.update({
      where: { id: evidence.id },
      data: {
        verificationStatus: parsed.data.verificationStatus,
        verifiedByUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'dispatch_evidence.verify',
        entityType: 'dispatch_evidence',
        entityId: evidence.id,
      },
      tx,
    );

    return updated;
  });
}

export async function recordAcknowledgment(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_acknowledgment.record');
  const parsed = AcknowledgmentSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid acknowledgment', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const attempt = await tx.noticeDispatchAttempt.findFirst({
      where: {
        id: parsed.data.attemptId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!attempt) throw notFound();

    const ack = await tx.noticeAcknowledgment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        dispatchAttemptId: attempt.id,
        dispatchRecipientId: parsed.data.recipientId,
        acknowledgmentType: parsed.data.acknowledgmentType,
        acknowledgedAt: new Date(parsed.data.acknowledgedAt),
        summary: parsed.data.summary,
        sourceEvidenceId: parsed.data.sourceEvidenceId,
        recordedByUserId: ctx.user.id,
        status: 'RECORDED',
      },
    });

    if (parsed.data.recipientId) {
      await tx.noticeDispatchRecipient.update({
        where: { id: parsed.data.recipientId },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(parsed.data.acknowledgedAt) },
      });
    }

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_acknowledgment.record',
        entityType: 'notice_acknowledgment',
        entityId: ack.id,
      },
      tx,
    );

    return ack;
  });
}

export async function verifyAcknowledgment(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_acknowledgment.verify');
  const parsed = VerifyAcknowledgmentSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid verification', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const ack = await tx.noticeAcknowledgment.findFirst({
      where: {
        id: parsed.data.acknowledgmentId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!ack) throw notFound();

    const updated = await tx.noticeAcknowledgment.update({
      where: { id: ack.id },
      data: { status: 'VERIFIED', verifiedByUserId: ctx.user.id },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_acknowledgment.verify',
        entityType: 'notice_acknowledgment',
        entityId: ack.id,
      },
      tx,
    );

    return updated;
  });
}

export async function assessReceipt(projectId: string, noticePackageId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_receipt.assess');
  const parsed = AssessReceiptSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid receipt assessment', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const attempt = await tx.noticeDispatchAttempt.findFirst({
      where: {
        id: parsed.data.attemptId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
      include: { recipients: true },
    });
    if (!attempt) throw notFound();

    const recipient = parsed.data.recipientId
      ? attempt.recipients.find((r) => r.id === parsed.data.recipientId)
      : attempt.recipients[0];

    const deemed = parsed.data.deemedReceiptRule
      ? assessDeemedReceipt({
          rule: parsed.data.deemedReceiptRule,
          sentAt: attempt.completedAt,
          deliveredAt: recipient?.deliveredAt ?? null,
        })
      : null;

    const assessment = await tx.noticeReceiptAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        dispatchAttemptId: attempt.id,
        dispatchRecipientId: parsed.data.recipientId,
        receiptStatus: parsed.data.receiptStatus,
        receiptAt: parsed.data.receiptAt ? new Date(parsed.data.receiptAt) : null,
        source: parsed.data.source,
        evidenceId: parsed.data.evidenceId,
        deemedReceiptRule: parsed.data.deemedReceiptRule,
        deemedReceiptResult: deemed as Prisma.InputJsonValue,
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
        rationale: parsed.data.rationale,
      },
    });

    if (deemed?.advisoryAt) {
      await tx.deemedReceiptAssessment.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          noticePackageId,
          receiptAssessmentId: assessment.id,
          ruleKind: parsed.data.deemedReceiptRule ?? 'NONE',
          inputs: { attemptId: attempt.id } as Prisma.InputJsonValue,
          calculationTrace: deemed.trace as Prisma.InputJsonValue,
          advisoryAt: deemed.advisoryAt,
          ambiguity: deemed.ambiguity,
        },
      });
    }

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_receipt.assess',
        entityType: 'notice_receipt_assessment',
        entityId: assessment.id,
      },
      tx,
    );

    return assessment;
  });
}

export async function confirmContractualService(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_receipt.confirm');
  const parsed = ConfirmServiceSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid confirmation', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);

    const assessment = await tx.noticeReceiptAssessment.findFirst({
      where: {
        id: parsed.data.assessmentId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
      include: { dispatchAttempt: true },
    });
    if (!assessment) throw notFound();

    if (dispatchSodEnabled() && pkg.sodEnforced) {
      if (assessment.dispatchAttempt.initiatedByUserId === ctx.user.id) {
        throw forbidden('Segregation of duties: confirmer cannot be dispatch initiator');
      }
    }

    const updated = await tx.noticeReceiptAssessment.update({
      where: { id: assessment.id },
      data: {
        contractualServiceStatus: 'HUMAN_CONFIRMED',
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
        rationale: parsed.data.rationale ?? assessment.rationale,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'RECEIPT_CONFIRMED' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_receipt.confirm',
        entityType: 'notice_receipt_assessment',
        entityId: assessment.id,
      },
      tx,
    );

    return updated;
  });
}

export async function listDispatchAttempts(projectId: string, noticePackageId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    return tx.noticeDispatchAttempt.findMany({
      where: { noticePackageId, tenantId: ctx.tenantId, projectId },
      orderBy: { initiatedAt: 'desc' },
      include: {
        recipients: true,
        manualDispatchRecord: true,
      },
    });
  });
}

export async function getDispatchAttempt(
  projectId: string,
  noticePackageId: string,
  attemptId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_dispatch.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const attempt = await tx.noticeDispatchAttempt.findFirst({
      where: { id: attemptId, noticePackageId, tenantId: ctx.tenantId, projectId },
      include: {
        recipients: true,
        manualDispatchRecord: true,
        dispatchEvidence: true,
        receiptAssessments: true,
        acknowledgments: true,
        dispatchAuthorization: true,
        dispatchPackageSnapshot: true,
      },
    });
    if (!attempt) throw notFound();
    return attempt;
  });
}

export async function getDeliveryRisk(
  projectId: string,
  noticePackageId: string,
  authorizationId?: string,
) {
  await requireProjectCapability(projectId, 'delivery_risk.read');
  if (!authorizationId) {
    const ctx = await requireProjectCapability(projectId, 'delivery_risk.read');
    return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
      const auth = await tx.noticeDispatchAuthorization.findFirst({
        where: { noticePackageId, tenantId: ctx.tenantId, projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (!auth) throw notFound();
      return validateDispatchReadiness(projectId, noticePackageId, auth.id);
    });
  }
  return validateDispatchReadiness(projectId, noticePackageId, authorizationId);
}

export async function processDeliveryWebhook(
  providerKind: string,
  headers: Record<string, string>,
  rawBody: Buffer,
) {
  const provider = getNoticeDeliveryProvider();
  if (!provider || provider.kind !== providerKind) {
    throw validationError('Unknown or unconfigured delivery provider');
  }
  if (!provider.verifyWebhook || !provider.parseWebhookEvent) {
    throw validationError('Provider does not support webhooks');
  }

  const verify = await provider.verifyWebhook(headers, rawBody);
  if (!verify.ok) throw validationError(verify.reason ?? 'Invalid webhook signature');

  const parsed = await provider.parseWebhookEvent(rawBody);

  const attemptLookup = await prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return tx.noticeDispatchAttempt.findFirst({
      where: { providerMessageId: parsed.providerMessageId },
      include: { recipients: true },
    });
  });
  if (!attemptLookup) throw notFound('Unknown provider message ID');

  return withTenantTransaction(
    { tenantId: attemptLookup.tenantId, userId: 'system' },
    async (tx) => {
      const attempt = await tx.noticeDispatchAttempt.findFirst({
        where: { id: attemptLookup.id },
        include: { recipients: true },
      });
      if (!attempt) throw notFound('Unknown provider message ID');

      const existing = await tx.deliveryProviderEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: providerKind,
            providerEventId: parsed.providerEventId,
          },
        },
      });
      if (existing) return { duplicate: true, event: existing };

      const event = await tx.deliveryProviderEvent.create({
        data: {
          tenantId: attempt.tenantId,
          projectId: attempt.projectId,
          provider: providerKind,
          providerEventId: parsed.providerEventId,
          providerMessageId: parsed.providerMessageId,
          eventType: parsed.eventType,
          occurredAt: new Date(parsed.occurredAt),
          signatureStatus: 'VERIFIED',
          payloadChecksum: sha256Hex(rawBody),
          redactedPayload: parsed.redactedPayload as Prisma.InputJsonValue,
          processingStatus: 'PROCESSED',
          dispatchAttemptId: attempt.id,
        },
      });

      for (const rs of parsed.recipientStatuses) {
        const recipient = attempt.recipients.find((r) => r.preparationId === rs.preparationId);
        if (!recipient) continue;
        const status = mapProviderRecipientStatus(rs.status);
        await tx.noticeDispatchRecipient.update({
          where: { id: recipient.id },
          data: {
            status,
            deliveredAt:
              status === 'DELIVERED' ? new Date(parsed.occurredAt) : recipient.deliveredAt,
          },
        });
      }

      const refreshed = await tx.noticeDispatchRecipient.findMany({
        where: { dispatchAttemptId: attempt.id },
      });
      const aggregated = aggregateRecipientStatus(refreshed.map((r) => r.status));
      await tx.noticeDispatchAttempt.update({
        where: { id: attempt.id },
        data: { status: aggregated },
      });

      await tx.noticePackage.update({
        where: { id: attempt.noticePackageId },
        data: { status: mapAttemptToPackageStatus(aggregated) },
      });

      return { duplicate: false, event, attemptStatus: aggregated };
    },
  );
}
