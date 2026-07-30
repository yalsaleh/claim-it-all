import { createHash, randomBytes } from 'node:crypto';
import {
  defaultPilotChecklist,
  evaluatePilotReadiness,
  evaluateTenantLimit,
  isKillSwitchActive,
  type KillSwitchKey,
  type TenantLimitKey,
} from '@contractradar/platform';
import type { Prisma, TenantFeatureFlagKey } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import { requireAuthenticatedUser, requireTenantCapability } from '@/server/authz/context';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';

const InviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum([
    'TENANT_OWNER',
    'TENANT_ADMIN',
    'COMMERCIAL_MANAGER',
    'CONTRACTS_MANAGER',
    'PROJECT_MANAGER',
    'REVIEWER',
    'VIEWER',
  ]),
});

const SupportRequestSchema = z.object({
  reason: z.string().trim().min(10).max(5000),
  requestedCapabilities: z.array(z.string()).min(1).max(20),
  requestedDurationMin: z
    .number()
    .int()
    .min(15)
    .max(24 * 60),
  projectId: z.string().uuid().optional(),
});

const KillSwitchSchema = z.object({
  key: z.enum([
    'connector_ingestion',
    'ai_calls',
    'email_delivery',
    'webhook_processing',
    'scheduled_synchronization',
    'background_detection',
    'export_generation',
  ]),
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(2000),
  scope: z.enum(['global', 'tenant']).default('tenant'),
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function upsertTenantSettings(rawInput: unknown) {
  const ctx = await requireTenantCapability('tenant_admin.manage');
  const parsed = z
    .object({
      legalDisplayName: z.string().trim().max(200).optional(),
      defaultTimezone: z.string().trim().max(64).optional(),
      defaultLanguage: z.string().trim().max(16).optional(),
      supportContact: z.string().trim().max(320).optional(),
      incidentContacts: z.record(z.string()).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid tenant settings', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const settings = await tx.tenantSettings.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        ...parsed.data,
        incidentContacts: parsed.data.incidentContacts as Prisma.InputJsonValue | undefined,
      },
      update: {
        ...parsed.data,
        incidentContacts: parsed.data.incidentContacts as Prisma.InputJsonValue | undefined,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'tenant_settings.updated',
        entityType: 'tenant_settings',
        entityId: settings.id,
      },
      tx,
    );
    return settings;
  });
}

export async function setTenantFeatureFlag(rawInput: unknown) {
  const ctx = await requireTenantCapability('tenant_feature_flags.manage');
  const parsed = z
    .object({
      flag: z.enum([
        'CONNECTORS',
        'CONTROLLED_DELIVERY',
        'AI_ASSISTED_EXTRACTION',
        'AI_ASSISTED_DETECTION',
        'AI_ASSISTED_DRAFTING',
        'PORTFOLIO_DASHBOARD',
        'BILINGUAL_SUPPORT',
        'PROVIDER_INTEGRATIONS',
        'PILOT_ONLY_FEATURES',
      ]),
      enabled: z.boolean(),
      rolloutMode: z.enum(['OFF', 'INTERNAL', 'PILOT', 'GA']).default('PILOT'),
      reason: z.string().trim().max(2000).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid feature flag', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const row = await tx.tenantFeatureFlag.upsert({
      where: {
        tenantId_flag: {
          tenantId: ctx.tenantId,
          flag: parsed.data.flag as TenantFeatureFlagKey,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        flag: parsed.data.flag as TenantFeatureFlagKey,
        enabled: parsed.data.enabled,
        rolloutMode: parsed.data.rolloutMode,
        configuredByUserId: ctx.user.id,
        reason: parsed.data.reason,
      },
      update: {
        enabled: parsed.data.enabled,
        rolloutMode: parsed.data.rolloutMode,
        reason: parsed.data.reason,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'tenant_feature_flag.set',
        entityType: 'tenant_feature_flag',
        entityId: row.id,
        metadata: { flag: parsed.data.flag, enabled: parsed.data.enabled },
      },
      tx,
    );
    return row;
  });
}

export async function setTenantLimit(rawInput: unknown) {
  const ctx = await requireTenantCapability('tenant_limits.manage');
  const parsed = z
    .object({
      limitKey: z.string().trim().min(1).max(64),
      limitValue: z.number().int().nonnegative(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid limit', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.tenantLimit.upsert({
      where: {
        tenantId_limitKey: { tenantId: ctx.tenantId, limitKey: parsed.data.limitKey },
      },
      create: {
        tenantId: ctx.tenantId,
        limitKey: parsed.data.limitKey,
        limitValue: BigInt(parsed.data.limitValue),
      },
      update: { limitValue: BigInt(parsed.data.limitValue) },
    }),
  );
}

export async function assertTenantLimit(limitKey: TenantLimitKey, increment = 1) {
  const ctx = await requireTenantCapability('tenant_admin.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const row = await tx.tenantLimit.findUnique({
      where: { tenantId_limitKey: { tenantId: ctx.tenantId, limitKey } },
    });
    if (!row) return { allowed: true as const, nearLimit: false };
    const decision = evaluateTenantLimit({
      key: limitKey,
      limit: Number(row.limitValue),
      used: Number(row.usedValue) + increment,
      warningThresholdRatio: row.warningThresholdRatio,
    });
    if (!decision.allowed) {
      await tx.operationalAlert.create({
        data: {
          tenantId: ctx.tenantId,
          alertType: 'TENANT_LIMIT_EXCEEDED',
          severity: 'HIGH',
          title: `Tenant limit exceeded: ${limitKey}`,
          description: `Limit ${limitKey} blocked a mutating operation.`,
          sourceEntityType: 'tenant_limit',
          sourceEntityId: row.id,
          status: 'OPEN',
          dedupeKey: createHash('sha256')
            .update(`TENANT_LIMIT_EXCEEDED|${limitKey}|${ctx.tenantId}`)
            .digest('hex'),
          detectedAt: new Date(),
          firstObservedAt: new Date(),
          lastObservedAt: new Date(),
          rulesetVersion: 'platform-v1',
        },
      });
      throw conflict(`Tenant limit exceeded: ${limitKey}`);
    }
    return decision;
  });
}

export async function inviteTenantUser(rawInput: unknown) {
  const ctx = await requireTenantCapability('tenant_invitation.manage');
  const parsed = InviteSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid invitation', parsed.error.flatten());

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  const invitation = await withTenantTransaction(
    { tenantId: ctx.tenantId, userId: ctx.user.id },
    async (tx) => {
      const created = await tx.tenantInvitation.create({
        data: {
          tenantId: ctx.tenantId,
          email: parsed.data.email.toLowerCase(),
          role: parsed.data.role,
          status: 'INVITED',
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdByUserId: ctx.user.id,
        },
      });
      await writeAuditLog(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'tenant_invitation.created',
          entityType: 'tenant_invitation',
          entityId: created.id,
          metadata: { emailDomain: parsed.data.email.split('@')[1] ?? null },
        },
        tx,
      );
      return created;
    },
  );

  // Return token once for test/local delivery capture — never logged.
  return { invitation, deliveryToken: token };
}

export async function revokeInvitation(invitationId: string) {
  const ctx = await requireTenantCapability('tenant_invitation.manage');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const inv = await tx.tenantInvitation.findFirst({
      where: { id: invitationId, tenantId: ctx.tenantId },
    });
    if (!inv) throw notFound();
    if (inv.status !== 'INVITED') throw conflict('Invitation is not active');
    const updated = await tx.tenantInvitation.update({
      where: { id: invitationId },
      data: { status: 'DISABLED', revokedAt: new Date() },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'tenant_invitation.revoked',
        entityType: 'tenant_invitation',
        entityId: invitationId,
      },
      tx,
    );
    return updated;
  });
}

export async function acceptInvitation(rawInput: unknown) {
  const user = await requireAuthenticatedUser();
  const parsed = z
    .object({ token: z.string().min(20), tenantId: z.string().uuid() })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid accept payload', parsed.error.flatten());
  const tokenHash = hashToken(parsed.data.token);

  return withTenantTransaction({ tenantId: parsed.data.tenantId, userId: user.id }, async (tx) => {
    const inv = await tx.tenantInvitation.findFirst({
      where: {
        tenantId: parsed.data.tenantId,
        tokenHash,
        status: 'INVITED',
      },
    });
    if (!inv) throw notFound();
    if (inv.expiresAt.getTime() < Date.now()) throw conflict('Invitation expired');
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw forbidden('Invitation email does not match authenticated user');
    }

    await tx.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: inv.tenantId, userId: user.id } },
      create: {
        tenantId: inv.tenantId,
        userId: user.id,
        role: inv.role,
        status: 'ACTIVE',
      },
      update: { role: inv.role, status: 'ACTIVE' },
    });

    const updated = await tx.tenantInvitation.update({
      where: { id: inv.id },
      data: { status: 'ACTIVE', acceptedAt: new Date() },
    });

    await writeAuditLog(
      {
        tenantId: inv.tenantId,
        actorUserId: user.id,
        action: 'tenant_invitation.accepted',
        entityType: 'tenant_invitation',
        entityId: inv.id,
      },
      tx,
    );
    return updated;
  });
}

export async function requestSupportAccess(rawInput: unknown) {
  const ctx = await requireTenantCapability('support_access.request');
  const parsed = SupportRequestSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid support request', parsed.error.flatten());

  // Support access cannot request legal approval capabilities.
  const blocked = parsed.data.requestedCapabilities.filter((c) =>
    /notice_draft\.approve|notice_dispatch\.(authorize|send)|notice_receipt\.confirm/.test(c),
  );
  if (blocked.length) {
    throw forbidden('Support access cannot include contractual approval/dispatch capabilities');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const req = await tx.supportAccessRequest.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: parsed.data.projectId,
        requestingOperatorId: ctx.user.id,
        reason: parsed.data.reason,
        requestedCapabilities: parsed.data.requestedCapabilities,
        requestedDurationMin: parsed.data.requestedDurationMin,
        status: 'REQUESTED',
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'support_access.requested',
        entityType: 'support_access_request',
        entityId: req.id,
      },
      tx,
    );
    return req;
  });
}

export async function approveSupportAccess(requestId: string) {
  const ctx = await requireTenantCapability('support_access.approve');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const req = await tx.supportAccessRequest.findFirst({
      where: { id: requestId, tenantId: ctx.tenantId },
    });
    if (!req) throw notFound();
    if (req.requestingOperatorId === ctx.user.id) {
      throw forbidden('Segregation of duties: cannot approve own support access request');
    }
    if (req.status !== 'REQUESTED') throw conflict('Request is not awaiting approval');

    const expiresAt = new Date(Date.now() + req.requestedDurationMin * 60_000);
    const updated = await tx.supportAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACTIVE',
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
        expiresAt,
      },
    });
    await tx.supportAccessAuditSession.create({
      data: {
        tenantId: ctx.tenantId,
        requestId,
        operatorUserId: req.requestingOperatorId,
        endsAt: expiresAt,
        active: true,
      },
    });
    await tx.operationalAlert.create({
      data: {
        tenantId: ctx.tenantId,
        alertType: 'SUPPORT_ACCESS_ACTIVE',
        severity: 'HIGH',
        title: 'Support access session active',
        description: 'A time-limited support access session was approved.',
        sourceEntityType: 'support_access_request',
        sourceEntityId: requestId,
        status: 'OPEN',
        dedupeKey: createHash('sha256').update(`SUPPORT_ACCESS_ACTIVE|${requestId}`).digest('hex'),
        detectedAt: new Date(),
        firstObservedAt: new Date(),
        lastObservedAt: new Date(),
        rulesetVersion: 'platform-v1',
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'support_access.approved',
        entityType: 'support_access_request',
        entityId: requestId,
        supportSessionId: requestId,
      },
      tx,
    );
    return updated;
  });
}

export async function revokeSupportAccess(requestId: string) {
  const ctx = await requireTenantCapability('support_access.revoke');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const req = await tx.supportAccessRequest.findFirst({
      where: { id: requestId, tenantId: ctx.tenantId },
    });
    if (!req) throw notFound();
    const updated = await tx.supportAccessRequest.update({
      where: { id: requestId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await tx.supportAccessAuditSession.updateMany({
      where: { requestId, tenantId: ctx.tenantId, active: true },
      data: { active: false, endedAt: new Date() },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'support_access.revoked',
        entityType: 'support_access_request',
        entityId: requestId,
      },
      tx,
    );
    return updated;
  });
}

export async function setKillSwitch(rawInput: unknown) {
  const ctx = await requireTenantCapability('provider_kill_switch.manage');
  const parsed = KillSwitchSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid kill switch', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const tenantId = parsed.data.scope === 'tenant' ? ctx.tenantId : null;
    const existing = await tx.providerKillSwitch.findFirst({
      where: { tenantId, key: parsed.data.key, scope: parsed.data.scope },
    });
    const row = existing
      ? await tx.providerKillSwitch.update({
          where: { id: existing.id },
          data: {
            enabled: parsed.data.enabled,
            reason: parsed.data.reason,
          },
        })
      : await tx.providerKillSwitch.create({
          data: {
            tenantId,
            key: parsed.data.key,
            scope: parsed.data.scope,
            enabled: parsed.data.enabled,
            reason: parsed.data.reason,
            configuredByUserId: ctx.user.id,
          },
        });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'provider_kill_switch.set',
        entityType: 'provider_kill_switch',
        entityId: row.id,
        metadata: { key: parsed.data.key, enabled: parsed.data.enabled },
      },
      tx,
    );
    return row;
  });
}

export async function isProviderKillSwitchActive(key: KillSwitchKey): Promise<boolean> {
  const ctx = await requireTenantCapability('platform_operations.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const rows = await tx.providerKillSwitch.findMany({
      where: {
        key,
        enabled: true,
        OR: [
          { scope: 'global', tenantId: null },
          { scope: 'tenant', tenantId: ctx.tenantId },
        ],
      },
    });
    return isKillSwitchActive(
      rows.map((r) => ({
        key: r.key as KillSwitchKey,
        enabled: r.enabled,
        scope: r.scope as 'global' | 'tenant',
        tenantId: r.tenantId ?? undefined,
      })),
      key,
      ctx.tenantId,
    );
  });
}

export async function createPilotReadinessAssessment() {
  const ctx = await requireTenantCapability('pilot_readiness.manage');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const assessment = await tx.pilotReadinessAssessment.create({
      data: { tenantId: ctx.tenantId, status: 'IN_PROGRESS' },
    });
    for (const item of defaultPilotChecklist()) {
      await tx.pilotReadinessItemRow.create({
        data: {
          assessmentId: assessment.id,
          requirement: item.requirement,
          status: 'NOT_STARTED',
          nonWaivable: item.nonWaivable,
        },
      });
    }
    return tx.pilotReadinessAssessment.findFirst({
      where: { id: assessment.id },
      include: { items: true },
    });
  });
}

export async function updatePilotReadinessItem(
  assessmentId: string,
  requirement: string,
  rawInput: unknown,
) {
  const ctx = await requireTenantCapability('pilot_readiness.manage');
  const parsed = z
    .object({
      status: z.enum([
        'NOT_STARTED',
        'IN_PROGRESS',
        'BLOCKED',
        'READY_WITH_EXCEPTIONS',
        'READY',
        'EXPIRED',
      ]),
      evidence: z.string().trim().max(5000).optional(),
      approvedException: z.boolean().optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid readiness item', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const assessment = await tx.pilotReadinessAssessment.findFirst({
      where: { id: assessmentId, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!assessment) throw notFound();
    const item = assessment.items.find((i) => i.requirement === requirement);
    if (!item) throw notFound();
    if (item.nonWaivable && parsed.data.approvedException) {
      throw forbidden('Non-waivable pilot readiness items cannot be waived');
    }
    await tx.pilotReadinessItemRow.update({
      where: { id: item.id },
      data: {
        status: parsed.data.status,
        evidence: parsed.data.evidence,
        approvedException: parsed.data.approvedException ?? false,
      },
    });
    const items = await tx.pilotReadinessItemRow.findMany({ where: { assessmentId } });
    const evaluation = evaluatePilotReadiness({
      items: items.map((i) => ({
        requirement: i.requirement,
        status: i.status,
        nonWaivable: i.nonWaivable,
        approvedException: i.approvedException,
        evidence: i.evidence ?? undefined,
      })),
    });
    return tx.pilotReadinessAssessment.update({
      where: { id: assessmentId },
      data: { status: evaluation.status },
      include: { items: true },
    });
  });
}

export async function activatePilot(assessmentId: string) {
  const ctx = await requireTenantCapability('pilot_readiness.activate');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const assessment = await tx.pilotReadinessAssessment.findFirst({
      where: { id: assessmentId, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!assessment) throw notFound();
    const evaluation = evaluatePilotReadiness({
      items: assessment.items.map((i) => ({
        requirement: i.requirement,
        status: i.status,
        nonWaivable: i.nonWaivable,
        approvedException: i.approvedException,
      })),
    });
    if (!evaluation.canActivate) {
      throw conflict(`Pilot activation blocked: ${evaluation.blockers.join(', ')}`);
    }
    await tx.tenant.update({
      where: { id: ctx.tenantId },
      data: { status: 'ACTIVE' },
    });
    const pilot = await tx.pilotConfiguration.create({
      data: {
        tenantId: ctx.tenantId,
        status: 'ACTIVE',
        startDate: new Date(),
        createdByUserId: ctx.user.id,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'pilot.activated',
        entityType: 'pilot_configuration',
        entityId: pilot.id,
      },
      tx,
    );
    return pilot;
  });
}

export async function createProviderEnablement(rawInput: unknown) {
  const ctx = await requireTenantCapability('provider_enablement.manage');
  const parsed = z
    .object({
      provider: z.string().trim().min(2).max(64),
      environment: z.enum(['STAGING', 'PILOT', 'PRODUCTION', 'LOCAL', 'TEST', 'CI']),
      secretReference: z.string().trim().min(3).max(512).optional(),
      approvedUseCases: z.array(z.string()).max(20).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid provider enablement', parsed.error.flatten());
  if (parsed.data.secretReference && !parsed.data.secretReference.includes('://')) {
    throw validationError('secretReference must be a non-sensitive reference URI');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const row = await tx.providerEnablement.create({
      data: {
        tenantId: ctx.tenantId,
        provider: parsed.data.provider,
        environment: parsed.data.environment,
        status: 'TECHNICAL_VALIDATION',
        secretReference: parsed.data.secretReference,
        approvedUseCases: parsed.data.approvedUseCases as Prisma.InputJsonValue | undefined,
        configuredByUserId: ctx.user.id,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'provider_enablement.created',
        entityType: 'provider_enablement',
        entityId: row.id,
        metadata: {
          provider: parsed.data.provider,
          hasSecretReference: Boolean(parsed.data.secretReference),
        },
      },
      tx,
    );
    return row;
  });
}

export async function approveProviderEnablement(
  id: string,
  status: 'APPROVED_FOR_PILOT' | 'ENABLED',
) {
  const ctx = await requireTenantCapability('provider_enablement.approve');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const row = await tx.providerEnablement.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound();
    if (row.configuredByUserId === ctx.user.id) {
      throw forbidden('Segregation of duties: approver cannot be the configurator');
    }
    // Credentials alone never enable — require prior technical/security states.
    if (
      row.status !== 'TECHNICAL_VALIDATION' &&
      row.status !== 'SECURITY_REVIEW' &&
      row.status !== 'APPROVED_FOR_STAGING' &&
      row.status !== 'APPROVED_FOR_PILOT'
    ) {
      throw conflict('Provider is not in an approvable state');
    }
    const updated = await tx.providerEnablement.update({
      where: { id },
      data: {
        status,
        approvedByUserId: ctx.user.id,
        enabledAt: status === 'ENABLED' ? new Date() : row.enabledAt,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'provider_enablement.approved',
        entityType: 'provider_enablement',
        entityId: id,
        metadata: { status },
      },
      tx,
    );
    return updated;
  });
}

export async function getPlatformOperationsDashboard() {
  const ctx = await requireTenantCapability('platform_operations.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const [openAlerts, killSwitches, supportSessions, lastBackup, lastRestore, limits, storage] =
      await Promise.all([
        tx.operationalAlert.count({
          where: {
            tenantId: ctx.tenantId,
            status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
          },
        }),
        tx.providerKillSwitch.findMany({
          where: { OR: [{ tenantId: ctx.tenantId }, { scope: 'global', tenantId: null }] },
        }),
        tx.supportAccessAuditSession.count({
          where: { tenantId: ctx.tenantId, active: true },
        }),
        tx.backupRun.findFirst({
          where: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }], status: 'SUCCEEDED' },
          orderBy: { completedAt: 'desc' },
        }),
        tx.restoreTestRun.findFirst({
          where: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }], status: 'SUCCEEDED' },
          orderBy: { completedAt: 'desc' },
        }),
        tx.tenantLimit.findMany({ where: { tenantId: ctx.tenantId } }),
        tx.tenantStorageUsage.findUnique({ where: { tenantId: ctx.tenantId } }),
      ]);

    return {
      environment: process.env.CONTRACTRADAR_ENV ?? process.env.APP_ENV ?? 'LOCAL',
      openAlertCount: openAlerts,
      activeSupportSessions: supportSessions,
      killSwitches: killSwitches.map((k) => ({
        key: k.key,
        enabled: k.enabled,
        scope: k.scope,
        reason: k.reason,
      })),
      lastSuccessfulBackupAt: lastBackup?.completedAt?.toISOString() ?? null,
      lastSuccessfulRestoreTestAt: lastRestore?.completedAt?.toISOString() ?? null,
      limits: limits.map((l) => ({
        key: l.limitKey,
        limit: l.limitValue.toString(),
        used: l.usedValue.toString(),
      })),
      storage,
    };
  });
}

export async function recordBackupRun(rawInput: unknown) {
  const ctx = await requireTenantCapability('backup.run.read');
  const parsed = z
    .object({
      environment: z.string().min(2).max(32),
      backupType: z.string().min(2).max(64),
      status: z.enum([
        'QUEUED',
        'RUNNING',
        'SUCCEEDED',
        'FAILED',
        'PARTIALLY_SUCCEEDED',
        'CANCELLED',
      ]),
      manifestLocation: z.string().max(1024).optional(),
      checksum: z.string().max(128).optional(),
      databaseMigrationVersion: z.string().max(128).optional(),
      objectCount: z.number().int().nonnegative().optional(),
      failureCode: z.string().max(64).optional(),
      failureMessageSafe: z.string().max(500).optional(),
      correlationId: z.string().max(128).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid backup run', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.backupRun.create({
      data: {
        tenantId: ctx.tenantId,
        environment: parsed.data.environment,
        backupType: parsed.data.backupType,
        status: parsed.data.status,
        startedAt: new Date(),
        completedAt: parsed.data.status === 'SUCCEEDED' ? new Date() : null,
        manifestLocation: parsed.data.manifestLocation,
        checksum: parsed.data.checksum,
        databaseMigrationVersion: parsed.data.databaseMigrationVersion,
        objectCount: parsed.data.objectCount ?? 0,
        failureCode: parsed.data.failureCode,
        failureMessageSafe: parsed.data.failureMessageSafe,
        initiatedByUserId: ctx.user.id,
        correlationId: parsed.data.correlationId,
      },
    }),
  );
}
