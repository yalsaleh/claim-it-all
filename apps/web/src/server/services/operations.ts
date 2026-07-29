import {
  computeDashboardCounts,
  dedupeKey,
  evaluateOperationalAlerts,
  OPERATIONS_RULESET_VERSION,
  type AlertSnapshot,
  type AlertStatus,
  type AlertType,
  type DeadlineSnapshot,
  type NoticeSnapshot,
} from '@contractradar/operations';
import type {
  OperationalAlertStatus,
  OperationalTaskStatus,
  OperationalTaskType,
  Prisma,
  ProjectDeadlineStatus,
} from '@prisma/client';
import { tenantRoleCanAccessAllTenantProjects } from '@contractradar/authz';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import {
  requireAuthenticatedUser,
  requireProjectCapability,
  requireTenantCapability,
} from '@/server/authz/context';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';

const AssignAlertSchema = z.object({
  ownerUserId: z.string().uuid().optional(),
  ownerRoleId: z.string().uuid().optional(),
});

const DismissAlertSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

const ResolveAlertSchema = z.object({
  resolution: z.string().trim().min(1).max(5000),
});

const CreateEscalationPolicySchema = z.object({
  name: z.string().trim().min(1).max(200),
  projectId: z.string().uuid().optional(),
  alertTypes: z.array(z.string()).max(20).default([]),
  severityThreshold: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(1),
        afterMinutes: z.number().int().min(0),
        targetUserId: z.string().uuid().optional(),
        targetRoleId: z.string().uuid().optional(),
        createTask: z.boolean().default(true),
      }),
    )
    .max(10)
    .default([]),
});

const CreateTaskSchema = z.object({
  sourceAlertId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  taskType: z
    .enum([
      'REVIEW_EVENT_SUGGESTION',
      'VERIFY_EVENT_DATE',
      'PROVIDE_EVIDENCE',
      'REVIEW_DEADLINE',
      'PREPARE_NOTICE',
      'REVIEW_NOTICE',
      'APPROVE_NOTICE',
      'AUTHORIZE_DISPATCH',
      'VERIFY_DISPATCH',
      'CONFIRM_RECEIPT',
      'FIX_CONNECTOR',
      'REVIEW_CONTRACT_CONFIGURATION',
      'OTHER',
    ])
    .default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  dueAt: z.string().datetime().optional(),
});

const AssignTaskSchema = z.object({
  assignedUserId: z.string().uuid().optional(),
  assignedRoleId: z.string().uuid().optional(),
});

const CompleteTaskSchema = z.object({
  completionNotes: z.string().trim().max(5000).optional(),
});

const CreateNotificationSchema = z.object({
  recipientUserId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10000),
  sourceEntityType: z.string().trim().max(100).optional(),
  sourceEntityId: z.string().uuid().optional(),
});

const SaveViewSchema = z.object({
  name: z.string().trim().min(1).max(200),
  viewType: z.string().trim().min(1).max(100),
  filters: z.record(z.unknown()).default({}),
  projectId: z.string().uuid().optional(),
});

function mapDeadlineStatus(status: ProjectDeadlineStatus): DeadlineSnapshot['status'] {
  switch (status) {
    case 'COMPLETED':
    case 'CANCELLED':
    case 'SUPERSEDED':
      return 'CLOSED';
    case 'OVERDUE':
      return 'MISSED';
    default:
      return 'OPEN';
  }
}

function mapAlertStatusToOps(status: OperationalAlertStatus): AlertStatus {
  switch (status) {
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return 'ACKNOWLEDGED';
    case 'RESOLVED':
    case 'DISMISSED':
    case 'SUPERSEDED':
      return 'RESOLVED';
    default:
      return 'OPEN';
  }
}

function mapAlertToSnapshot(alert: {
  id: string;
  alertType: string;
  severity: string;
  status: OperationalAlertStatus;
  sourceEntityType: string;
  sourceEntityId: string;
}): AlertSnapshot {
  return {
    id: alert.id,
    alertType: alert.alertType as AlertType,
    severity: alert.severity as AlertSnapshot['severity'],
    status: mapAlertStatusToOps(alert.status),
    entityType: alert.sourceEntityType,
    entityId: alert.sourceEntityId,
  };
}

async function loadEvaluationInput(
  tx: Prisma.TransactionClient,
  projectId: string,
  tenantId: string,
) {
  const [deadlines, notices, failedSyncs, suggestions, existingAlerts] = await Promise.all([
    tx.projectDeadline.findMany({
      where: { tenantId, projectId },
      select: { id: true, title: true, dueAt: true, status: true, projectId: true },
    }),
    tx.noticePackage.findMany({
      where: { tenantId, projectId },
      select: { id: true, status: true, updatedAt: true, projectId: true },
    }),
    tx.connectorSyncRun.findMany({
      where: { tenantId, projectId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        connectorAccountId: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    tx.projectEventSuggestion.count({
      where: { tenantId, projectId, status: 'PENDING_REVIEW' },
    }),
    tx.operationalAlert.findMany({
      where: { tenantId, projectId },
    }),
  ]);

  const lastSuccess = await tx.connectorSyncRun.findFirst({
    where: { tenantId, projectId, status: 'SUCCEEDED' },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true, connectorAccountId: true },
  });

  const deadlineSnapshots: DeadlineSnapshot[] = deadlines.map((d) => ({
    id: d.id,
    title: d.title,
    dueAt: d.dueAt?.toISOString() ?? new Date().toISOString(),
    status: mapDeadlineStatus(d.status),
    projectId: d.projectId,
  }));

  const noticeSnapshots: NoticeSnapshot[] = notices.map((n) => ({
    id: n.id,
    status: n.status,
    updatedAt: n.updatedAt.toISOString(),
    projectId: n.projectId,
  }));

  const syncFailures = failedSyncs.map((s) => ({
    connectorId: s.connectorAccountId,
    failedAt: (s.completedAt ?? s.createdAt).toISOString(),
    lastSuccessAt: lastSuccess?.completedAt?.toISOString() ?? null,
  }));

  return {
    deadlines: deadlineSnapshots,
    notices: noticeSnapshots,
    syncFailures,
    reviewQueueDepth: suggestions,
    existingAlerts: existingAlerts.map((a) => ({
      alertType: a.alertType as AlertType,
      entityType: a.sourceEntityType,
      entityId: a.sourceEntityId,
      status: mapAlertStatusToOps(a.status),
      severity: a.severity as AlertSnapshot['severity'],
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      suppressedUntil: null,
      dedupeKey: a.dedupeKey,
    })),
  };
}

export async function evaluateAndUpsertAlerts(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'operational_alert.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const input = await loadEvaluationInput(tx, projectId, ctx.tenantId);
    const candidates = evaluateOperationalAlerts(input);
    const now = new Date();
    const upserted = [];

    for (const candidate of candidates) {
      const key =
        candidate.dedupeKey ??
        dedupeKey(candidate.alertType, candidate.entityType, candidate.entityId);
      const existing = await tx.operationalAlert.findFirst({
        where: { tenantId: ctx.tenantId, dedupeKey: key },
      });

      if (
        existing &&
        (existing.status === 'OPEN' ||
          existing.status === 'ACKNOWLEDGED' ||
          existing.status === 'IN_PROGRESS')
      ) {
        const updated = await tx.operationalAlert.update({
          where: { id: existing.id },
          data: { lastObservedAt: now },
        });
        upserted.push(updated);
        continue;
      }

      if (existing && (existing.status === 'RESOLVED' || existing.status === 'DISMISSED')) {
        continue;
      }

      const created = await tx.operationalAlert.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          alertType: candidate.alertType,
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.message,
          sourceEntityType: candidate.entityType,
          sourceEntityId: candidate.entityId,
          status: 'OPEN',
          dedupeKey: key,
          detectedAt: new Date(candidate.occurredAt),
          firstObservedAt: now,
          lastObservedAt: now,
          rulesetVersion: OPERATIONS_RULESET_VERSION,
        },
      });

      await tx.operationalAlertEvent.create({
        data: {
          tenantId: ctx.tenantId,
          alertId: created.id,
          eventType: 'DETECTED',
          actorUserId: ctx.user.id,
        },
      });

      upserted.push(created);
    }

    await rebuildProjectOperationsSummary(projectId, tx);
    return upserted;
  });
}

export async function listAlerts(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'operational_alert.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.operationalAlert.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: [{ severity: 'desc' }, { lastObservedAt: 'desc' }],
    }),
  );
}

export async function acknowledgeAlert(alertId: string) {
  const ctx = await requireTenantCapability('operational_alert.acknowledge');
  return mutateAlert(alertId, ctx, 'operational_alert.acknowledge', async (tx, alert) => {
    if (alert.status !== 'OPEN') throw conflict('Alert is not open');
    const updated = await tx.operationalAlert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });
    await tx.operationalAlertEvent.create({
      data: {
        tenantId: ctx.tenantId,
        alertId,
        eventType: 'ACKNOWLEDGED',
        actorUserId: ctx.user.id,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: alert.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_alert.acknowledged',
        entityType: 'operational_alert',
        entityId: alertId,
      },
      tx,
    );
    return updated;
  });
}

export async function assignAlert(alertId: string, rawInput: unknown) {
  const parsed = AssignAlertSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid assign payload', parsed.error.flatten());
  const ctx = await requireTenantCapability('operational_alert.assign');
  return mutateAlert(alertId, ctx, 'operational_alert.assign', async (tx, alert) => {
    const updated = await tx.operationalAlert.update({
      where: { id: alertId },
      data: {
        ownerUserId: parsed.data.ownerUserId,
        ownerRoleId: parsed.data.ownerRoleId,
        status: alert.status === 'OPEN' ? 'IN_PROGRESS' : alert.status,
      },
    });
    await tx.operationalAlertEvent.create({
      data: {
        tenantId: ctx.tenantId,
        alertId,
        eventType: 'ASSIGNED',
        actorUserId: ctx.user.id,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: alert.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_alert.assigned',
        entityType: 'operational_alert',
        entityId: alertId,
      },
      tx,
    );
    return updated;
  });
}

export async function dismissAlert(alertId: string, rawInput: unknown) {
  const parsed = DismissAlertSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid dismiss payload', parsed.error.flatten());
  const ctx = await requireTenantCapability('operational_alert.dismiss');
  return mutateAlert(alertId, ctx, 'operational_alert.dismiss', async (tx, alert) => {
    const updated = await tx.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'DISMISSED',
        resolution: parsed.data.reason,
        resolvedAt: new Date(),
      },
    });
    await tx.operationalAlertEvent.create({
      data: {
        tenantId: ctx.tenantId,
        alertId,
        eventType: 'DISMISSED',
        actorUserId: ctx.user.id,
        note: parsed.data.reason,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: alert.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_alert.dismissed',
        entityType: 'operational_alert',
        entityId: alertId,
        metadata: { reasonPresent: true },
      },
      tx,
    );
    return updated;
  });
}

export async function resolveAlert(alertId: string, rawInput: unknown) {
  const parsed = ResolveAlertSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid resolve payload', parsed.error.flatten());
  const ctx = await requireTenantCapability('operational_alert.resolve');
  return mutateAlert(alertId, ctx, 'operational_alert.resolve', async (tx, alert) => {
    const updated = await tx.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolution: parsed.data.resolution,
        resolvedAt: new Date(),
      },
    });
    await tx.operationalAlertEvent.create({
      data: {
        tenantId: ctx.tenantId,
        alertId,
        eventType: 'RESOLVED',
        actorUserId: ctx.user.id,
        note: parsed.data.resolution,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: alert.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_alert.resolved',
        entityType: 'operational_alert',
        entityId: alertId,
        metadata: { resolutionPresent: true },
      },
      tx,
    );
    return updated;
  });
}

async function mutateAlert<T>(
  alertId: string,
  ctx: Awaited<ReturnType<typeof requireTenantCapability>>,
  capability: Parameters<typeof requireProjectCapability>[1],
  fn: (
    tx: Prisma.TransactionClient,
    alert: { id: string; projectId: string | null; status: OperationalAlertStatus },
  ) => Promise<T>,
): Promise<T> {
  const alert = await withTenantTransaction(
    { tenantId: ctx.tenantId, userId: ctx.user.id },
    async (tx) => tx.operationalAlert.findFirst({ where: { id: alertId, tenantId: ctx.tenantId } }),
  );
  if (!alert) throw notFound();
  if (alert.projectId) {
    await requireProjectCapability(alert.projectId, capability);
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const current = await tx.operationalAlert.findFirst({
      where: { id: alertId, tenantId: ctx.tenantId },
    });
    if (!current) throw notFound();
    return fn(tx, current);
  });
}

export async function createEscalationPolicy(rawInput: unknown) {
  const ctx = await requireTenantCapability('escalation_policy.manage');
  const parsed = CreateEscalationPolicySchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid escalation policy', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const policy = await tx.escalationPolicy.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        alertTypes: parsed.data.alertTypes as Prisma.InputJsonValue,
        severityThreshold: parsed.data.severityThreshold,
        status: 'DRAFT',
        createdByUserId: ctx.user.id,
      },
    });

    for (const step of parsed.data.steps) {
      await tx.escalationStep.create({
        data: {
          tenantId: ctx.tenantId,
          escalationPolicyId: policy.id,
          stepOrder: step.stepOrder,
          afterMinutes: step.afterMinutes,
          targetUserId: step.targetUserId,
          targetRoleId: step.targetRoleId,
          createTask: step.createTask,
        },
      });
    }

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: parsed.data.projectId,
        actorUserId: ctx.user.id,
        action: 'escalation_policy.created',
        entityType: 'escalation_policy',
        entityId: policy.id,
      },
      tx,
    );

    return tx.escalationPolicy.findFirst({
      where: { id: policy.id },
      include: { steps: true },
    });
  });
}

export async function approveEscalationPolicy(policyId: string) {
  const ctx = await requireTenantCapability('escalation_policy.approve');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const policy = await tx.escalationPolicy.findFirst({
      where: { id: policyId, tenantId: ctx.tenantId },
    });
    if (!policy) throw notFound();
    if (policy.createdByUserId === ctx.user.id) {
      throw forbidden('Segregation of duties: approver cannot be the creator');
    }
    const updated = await tx.escalationPolicy.update({
      where: { id: policyId },
      data: { status: 'APPROVED', approvedByUserId: ctx.user.id },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: policy.projectId,
        actorUserId: ctx.user.id,
        action: 'escalation_policy.approved',
        entityType: 'escalation_policy',
        entityId: policyId,
      },
      tx,
    );
    return updated;
  });
}

export async function createTaskFromAlert(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'operational_task.create');
  const parsed = CreateTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid task payload', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    if (parsed.data.sourceAlertId) {
      const alert = await tx.operationalAlert.findFirst({
        where: { id: parsed.data.sourceAlertId, tenantId: ctx.tenantId, projectId },
      });
      if (!alert) throw notFound('Source alert not found');
    }

    const task = await tx.operationalTask.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        sourceAlertId: parsed.data.sourceAlertId,
        title: parsed.data.title,
        description: parsed.data.description,
        taskType: parsed.data.taskType as OperationalTaskType,
        priority: parsed.data.priority,
        status: 'OPEN',
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'operational_task.created',
        entityType: 'operational_task',
        entityId: task.id,
      },
      tx,
    );
    return task;
  });
}

export async function listTasks(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'operations_dashboard.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.operationalTask.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export async function assignTask(taskId: string, rawInput: unknown) {
  const parsed = AssignTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid assign payload', parsed.error.flatten());
  const ctx = await requireTenantCapability('operational_task.assign');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const task = await tx.operationalTask.findFirst({
      where: { id: taskId, tenantId: ctx.tenantId },
    });
    if (!task) throw notFound();
    await requireProjectCapability(task.projectId, 'operational_task.assign');

    const updated = await tx.operationalTask.update({
      where: { id: taskId },
      data: {
        assignedUserId: parsed.data.assignedUserId,
        assignedRoleId: parsed.data.assignedRoleId,
        status: task.status === 'OPEN' ? 'ACKNOWLEDGED' : task.status,
        acknowledgedAt: task.acknowledgedAt ?? new Date(),
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: task.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_task.assigned',
        entityType: 'operational_task',
        entityId: taskId,
      },
      tx,
    );
    return updated;
  });
}

/** Completing a task MUST NOT mutate notice/deadline/event legal state. */
export async function completeTask(taskId: string, rawInput: unknown) {
  const parsed = CompleteTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid complete payload', parsed.error.flatten());
  const ctx = await requireTenantCapability('operational_task.complete');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const task = await tx.operationalTask.findFirst({
      where: { id: taskId, tenantId: ctx.tenantId },
    });
    if (!task) throw notFound();
    await requireProjectCapability(task.projectId, 'operational_task.complete');

    const updated = await tx.operationalTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED' satisfies OperationalTaskStatus,
        completedAt: new Date(),
        completionNotes: parsed.data.completionNotes,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: task.projectId,
        actorUserId: ctx.user.id,
        action: 'operational_task.completed',
        entityType: 'operational_task',
        entityId: taskId,
        metadata: { notesPresent: Boolean(parsed.data.completionNotes) },
      },
      tx,
    );
    return updated;
  });
}

export async function createInternalNotification(rawInput: unknown) {
  const ctx = await requireTenantCapability('internal_notification.read');
  const parsed = CreateNotificationSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid notification', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.internalNotification.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: parsed.data.projectId,
        recipientUserId: parsed.data.recipientUserId,
        channel: 'IN_APP',
        status: 'DELIVERED',
        title: parsed.data.title,
        body: parsed.data.body,
        sourceEntityType: parsed.data.sourceEntityType,
        sourceEntityId: parsed.data.sourceEntityId,
      },
    }),
  );
}

export async function listInternalNotifications() {
  const user = await requireAuthenticatedUser();
  const ctx = await requireTenantCapability('internal_notification.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.internalNotification.findMany({
      where: { tenantId: ctx.tenantId, recipientUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireAuthenticatedUser();
  const ctx = await requireTenantCapability('internal_notification.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const notification = await tx.internalNotification.findFirst({
      where: { id: notificationId, tenantId: ctx.tenantId, recipientUserId: user.id },
    });
    if (!notification) throw notFound();
    return tx.internalNotification.update({
      where: { id: notificationId },
      data: { status: 'READ', readAt: new Date() },
    });
  });
}

export async function getProjectOperationsDashboard(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'operations_dashboard.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const input = await loadEvaluationInput(tx, projectId, ctx.tenantId);
    const alerts = await tx.operationalAlert.findMany({
      where: { tenantId: ctx.tenantId, projectId },
    });
    const alertSnapshots = alerts.map(mapAlertToSnapshot);
    const counts = computeDashboardCounts({
      deadlines: input.deadlines,
      notices: input.notices,
      alerts: alertSnapshots,
    });

    const summary = await tx.projectOperationsSummary.findFirst({
      where: { tenantId: ctx.tenantId, projectId },
    });

    const lastSync = await tx.connectorSyncRun.findFirst({
      where: { tenantId: ctx.tenantId, projectId, status: 'SUCCEEDED' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    return {
      counts,
      summary,
      lastSuccessfulSyncAt: lastSync?.completedAt?.toISOString() ?? null,
      rulesetVersion: OPERATIONS_RULESET_VERSION,
    };
  });
}

export async function getPortfolioDashboard() {
  const ctx = await requireTenantCapability('portfolio.read');
  const tenantWide = tenantRoleCanAccessAllTenantProjects(ctx.tenantRole);

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(tenantWide
          ? {}
          : {
              memberships: {
                some: { userId: ctx.user.id, status: 'ACTIVE' },
              },
            }),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, status: true },
    });

    const items = [];
    for (const project of projects) {
      const input = await loadEvaluationInput(tx, project.id, ctx.tenantId);
      const alerts = await tx.operationalAlert.findMany({
        where: { tenantId: ctx.tenantId, projectId: project.id },
      });
      const counts = computeDashboardCounts({
        deadlines: input.deadlines,
        notices: input.notices,
        alerts: alerts.map(mapAlertToSnapshot),
      });
      items.push({
        project,
        counts,
      });
    }

    return { items };
  });
}

export async function listTimeline(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'operations_dashboard.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectTimelineEvent.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    }),
  );
}

export async function saveView(rawInput: unknown) {
  const ctx = await requireTenantCapability('saved_view.manage');
  const parsed = SaveViewSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid saved view', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.operationalSavedView.create({
      data: {
        tenantId: ctx.tenantId,
        ownerUserId: ctx.user.id,
        name: parsed.data.name,
        viewType: parsed.data.viewType,
        filters: parsed.data.filters as Prisma.InputJsonValue,
        projectId: parsed.data.projectId,
      },
    }),
  );
}

export async function listSavedViews(projectId?: string) {
  const ctx = await requireTenantCapability('saved_view.manage');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.operationalSavedView.findMany({
      where: {
        tenantId: ctx.tenantId,
        ownerUserId: ctx.user.id,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    }),
  );
}

export async function rebuildProjectOperationsSummary(
  projectId: string,
  txOverride?: Prisma.TransactionClient,
) {
  const ctx = await requireProjectCapability(projectId, 'operations_dashboard.read');
  const rebuild = async (tx: Prisma.TransactionClient) => {
    const input = await loadEvaluationInput(tx, projectId, ctx.tenantId);
    const alerts = await tx.operationalAlert.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    });
    const counts = computeDashboardCounts({
      deadlines: input.deadlines,
      notices: input.notices,
      alerts: alerts.map(mapAlertToSnapshot),
    });

    const criticalAlertCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const lastSync = await tx.connectorSyncRun.findFirst({
      where: { tenantId: ctx.tenantId, projectId, status: 'SUCCEEDED' },
      orderBy: { completedAt: 'desc' },
    });

    const pendingSuggestions = await tx.projectEventSuggestion.count({
      where: { tenantId: ctx.tenantId, projectId, status: 'PENDING_REVIEW' },
    });

    const noticeBlockers = input.notices.filter(
      (n) => n.status === 'DRAFT' || n.status === 'IN_REVIEW' || n.status === 'EVIDENCE_INCOMPLETE',
    ).length;

    return tx.projectOperationsSummary.upsert({
      where: { projectId },
      create: {
        tenantId: ctx.tenantId,
        projectId,
        criticalAlertCount,
        openAlertCount: counts.alertsOpen,
        deadlinesDueSoonCount: counts.deadlinesDueWithin24h,
        overdueDeadlineCount: counts.deadlinesOverdue,
        pendingSuggestionCount: pendingSuggestions,
        noticeBlockerCount: noticeBlockers,
        lastSuccessfulSyncAt: lastSync?.completedAt ?? null,
        rebuiltAt: new Date(),
      },
      update: {
        criticalAlertCount,
        openAlertCount: counts.alertsOpen,
        deadlinesDueSoonCount: counts.deadlinesDueWithin24h,
        overdueDeadlineCount: counts.deadlinesOverdue,
        pendingSuggestionCount: pendingSuggestions,
        noticeBlockerCount: noticeBlockers,
        lastSuccessfulSyncAt: lastSync?.completedAt ?? null,
        rebuiltAt: new Date(),
      },
    });
  };

  if (txOverride) return rebuild(txOverride);
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, rebuild);
}
