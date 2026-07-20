import { calculateDeadline, type ExecutableRuleInput } from '@contractradar/contract-rules';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { requireProjectCapability } from '@/server/authz/context';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';

const CreateProjectEventSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  eventCategory: z.enum([
    'LATE_DRAWING_OR_APPROVAL',
    'SUSPENSION',
    'RESTRICTED_ACCESS',
    'SCOPE_CHANGE',
    'ADDITIONAL_WORK',
    'DELAYED_PAYMENT',
    'UNFORESEEN_SITE_CONDITION',
    'INSTRUCTION',
    'REJECTION',
    'CERTIFICATION',
    'PAYMENT_EVENT',
    'OTHER',
  ]),
  eventSubcategory: z.string().trim().max(200).optional(),
  contractPackageId: z.string().uuid().optional(),
  timezone: z.string().trim().min(1).max(100),
  eventReference: z.string().trim().max(200).optional(),
});

const AddProjectEventDateSchema = z.object({
  dateType: z.enum([
    'OCCURRENCE_DATE',
    'AWARENESS_DATE',
    'INSTRUCTION_DATE',
    'RECEIPT_DATE',
    'ACCESS_DENIAL_DATE',
    'PAYMENT_DUE_DATE',
    'CERTIFICATE_DATE',
    'DISCOVERY_DATE',
    'CONTINUING_EVENT_START',
    'CONTINUING_EVENT_END',
    'CUSTOM',
  ]),
  dateValue: z.string().datetime({ offset: true }).or(z.string().date()),
  timezone: z.string().trim().min(1).max(100),
  precision: z.enum(['EXACT_DATETIME', 'EXACT_DATE', 'APPROXIMATE_DATE', 'DATE_RANGE', 'UNKNOWN']),
  notes: z.string().trim().max(2000).optional(),
});

const LinkProjectEventEvidenceSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  documentVersionId: z.string().uuid(),
  evidenceSegmentId: z.string().uuid().optional(),
  purpose: z.enum([
    'PROVES_OCCURRENCE',
    'PROVES_AWARENESS',
    'PROVES_RECEIPT',
    'PROVES_INSTRUCTION',
    'PROVES_CONTINUING_EFFECT',
    'SUPPORTS_CLASSIFICATION',
    'CONTRADICTS_EVENT',
    'OTHER',
  ]),
  factualNote: z.string().trim().max(5000).optional(),
});

const ConfirmProjectEventSchema = z.object({
  confirmationStatus: z.enum(['CONFIRMED_FOR_DEADLINE_ANALYSIS', 'CONFIRMED_FACT']),
  rationale: z.string().trim().max(2000).optional(),
});

const ConfirmRuleApplicabilitySchema = z.object({
  approvedRuleSnapshotId: z.string().uuid(),
  rationale: z.string().trim().min(1).max(5000),
});

const CreateProjectCalendarSchema = z.object({
  name: z.string().trim().min(1).max(200),
  timezone: z.string().trim().min(1).max(100),
  weekendDays: z.array(z.number().int().min(1).max(7)).default([6, 7]),
  source: z
    .enum(['CONTRACT_DEFINED', 'JURISDICTIONAL', 'PROJECT_POLICY', 'INTERNAL_POLICY'])
    .optional(),
});

const CreateCalendarRevisionSchema = z.object({
  timezone: z.string().trim().min(1).max(100).optional(),
  weekendDays: z.array(z.number().int().min(1).max(7)),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  specialWorkingDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});

const CalculateEventDeadlineSchema = z.object({
  assessmentId: z.string().uuid(),
  calendarRevisionId: z.string().uuid(),
  triggerDateId: z.string().uuid(),
});

const RecalculateDeadlineSchema = z.object({
  triggerDateId: z.string().uuid().optional(),
  calendarRevisionId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(5000),
});

function deadlineCalcSegregationEnabled(): boolean {
  return process.env.DEADLINE_CALC_SEGREGATION_OF_DUTIES !== 'false';
}

function calendarRevisionToEngineInput(revision: {
  timezone: string;
  weekendDays: Prisma.JsonValue;
  holidayDates: Prisma.JsonValue | null;
  specialWorkingDays: Prisma.JsonValue | null;
}) {
  return {
    timezone: revision.timezone,
    weekendDays: Array.isArray(revision.weekendDays) ? (revision.weekendDays as number[]) : [6, 7],
    holidays: Array.isArray(revision.holidayDates) ? (revision.holidayDates as string[]) : [],
    specialWorkingDays: Array.isArray(revision.specialWorkingDays)
      ? (revision.specialWorkingDays as string[])
      : [],
  };
}

function snapshotStructuredRule(structuredRule: Prisma.JsonValue): ExecutableRuleInput {
  const raw = structuredRule as Record<string, unknown>;
  if (raw && typeof raw === 'object' && 'durationUnit' in raw && 'counting' in raw) {
    return raw as ExecutableRuleInput;
  }
  throw validationError('Approved rule snapshot has no executable structured rule');
}

function parseDateValue(value: string): Date {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw validationError('Invalid date value');
  }
  return dt;
}

async function loadProjectEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  projectId: string,
  eventId: string,
) {
  const event = await tx.projectEvent.findFirst({
    where: { id: eventId, tenantId, projectId },
    include: {
      dates: { orderBy: { createdAt: 'asc' } },
      evidence: { orderBy: { createdAt: 'asc' } },
      eventRuleAssessments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!event) throw notFound();
  return event;
}

export async function createProjectEvent(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'project_event.create');
  const parsed = CreateProjectEventSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid project event', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    if (parsed.data.contractPackageId) {
      const pkg = await tx.contractPackage.findFirst({
        where: {
          id: parsed.data.contractPackageId,
          tenantId: ctx.tenantId,
          projectId,
        },
      });
      if (!pkg) throw notFound();
    }

    const created = await tx.projectEvent.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: parsed.data.contractPackageId,
        title: parsed.data.title,
        description: parsed.data.description,
        eventCategory: parsed.data.eventCategory,
        eventSubcategory: parsed.data.eventSubcategory,
        eventReference: parsed.data.eventReference,
        timezone: parsed.data.timezone,
        reportedByUserId: ctx.user.id,
        eventStatus: 'DRAFT',
        confirmationStatus: 'UNCONFIRMED',
        source: 'MANUAL',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_event.created',
        entityType: 'project_event',
        entityId: created.id,
        metadata: { title: created.title, eventCategory: created.eventCategory },
      },
      tx,
    );
    return created;
  });
}

export async function listProjectEvents(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectEvent.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { dates: true, evidence: true, deadlineCalculations: true } },
      },
    }),
  );
}

export async function getProjectEvent(projectId: string, eventId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    loadProjectEvent(tx, ctx.tenantId, projectId, eventId),
  );
}

export async function addProjectEventDate(projectId: string, eventId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'project_event.update');
  const parsed = AddProjectEventDateSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid event date', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);
    const created = await tx.projectEventDate.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectEventId: eventId,
        dateType: parsed.data.dateType,
        dateValue: parseDateValue(parsed.data.dateValue),
        timezone: parsed.data.timezone,
        precision: parsed.data.precision,
        notes: parsed.data.notes,
        assertedByUserId: ctx.user.id,
        verificationStatus: 'UNVERIFIED',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_event_date.added',
        entityType: 'project_event_date',
        entityId: created.id,
        metadata: { projectEventId: eventId, dateType: created.dateType },
      },
      tx,
    );
    return created;
  });
}

export async function verifyProjectEventDate(projectId: string, eventId: string, dateId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.confirm');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const date = await tx.projectEventDate.findFirst({
      where: {
        id: dateId,
        tenantId: ctx.tenantId,
        projectId,
        projectEventId: eventId,
      },
    });
    if (!date) throw notFound();
    if (date.verificationStatus === 'VERIFIED') {
      throw conflict('Event date is already verified');
    }
    if (!['EXACT_DATE', 'EXACT_DATETIME'].includes(date.precision)) {
      throw validationError(
        'Only EXACT_DATE or EXACT_DATETIME dates can be verified for deadlines',
      );
    }

    const updated = await tx.projectEventDate.update({
      where: { id: date.id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedByUserId: ctx.user.id,
        verifiedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_event_date.verified',
        entityType: 'project_event_date',
        entityId: updated.id,
        metadata: { projectEventId: eventId },
      },
      tx,
    );
    return updated;
  });
}

export async function linkProjectEventEvidence(
  projectId: string,
  eventId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'project_event.update');
  const parsed = LinkProjectEventEvidenceSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid evidence link', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);

    const source = await tx.sourceDocument.findFirst({
      where: {
        id: parsed.data.sourceDocumentId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!source) throw notFound();

    const version = await tx.documentVersion.findFirst({
      where: {
        id: parsed.data.documentVersionId,
        tenantId: ctx.tenantId,
        projectId,
        sourceDocumentId: source.id,
      },
    });
    if (!version) throw notFound();

    if (parsed.data.evidenceSegmentId) {
      const segment = await tx.evidenceSegment.findFirst({
        where: {
          id: parsed.data.evidenceSegmentId,
          tenantId: ctx.tenantId,
          projectId,
          documentVersionId: version.id,
        },
      });
      if (!segment) throw notFound();
    }

    const linked = await tx.projectEventEvidence.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectEventId: eventId,
        sourceDocumentId: source.id,
        documentVersionId: version.id,
        evidenceSegmentId: parsed.data.evidenceSegmentId,
        purpose: parsed.data.purpose,
        factualNote: parsed.data.factualNote,
        linkedByUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_event_evidence.linked',
        entityType: 'project_event_evidence',
        entityId: linked.id,
        metadata: { projectEventId: eventId, sourceDocumentId: source.id },
      },
      tx,
    );
    return linked;
  });
}

export async function confirmProjectEvent(projectId: string, eventId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'project_event.confirm');
  const parsed = ConfirmProjectEventSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid confirmation', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const event = await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);
    if (
      event.confirmationStatus !== 'UNCONFIRMED' &&
      event.confirmationStatus !== 'INSUFFICIENT_EVIDENCE'
    ) {
      throw conflict(`Event cannot be confirmed from status ${event.confirmationStatus}`);
    }

    const updated = await tx.projectEvent.update({
      where: { id: event.id },
      data: {
        confirmationStatus: parsed.data.confirmationStatus,
        eventStatus: 'CONFIRMED',
        confirmedByUserId: ctx.user.id,
        confirmedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_event.confirmed',
        entityType: 'project_event',
        entityId: updated.id,
        metadata: {
          confirmationStatus: parsed.data.confirmationStatus,
          rationale: parsed.data.rationale,
        },
      },
      tx,
    );
    return updated;
  });
}

export async function listCandidateRuleSnapshots(projectId: string, eventId: string) {
  const ctx = await requireProjectCapability(projectId, 'deadline_rule.assess');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);

    const packages = await tx.contractPackage.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      select: { id: true },
    });
    const packageIds = packages.map((p) => p.id);
    if (packageIds.length === 0) return [];

    return tx.approvedNoticeRuleSnapshot.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: { in: packageIds },
        configurationRevision: { isActiveApproved: true, status: 'APPROVED' },
      },
      include: {
        configurationRevision: {
          select: { id: true, revisionNumber: true, contractPackageId: true },
        },
        sourceNoticeRule: { select: { id: true, noticeCategory: true, reviewStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

export async function confirmRuleApplicability(
  projectId: string,
  eventId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'deadline_rule.assess');
  const parsed = ConfirmRuleApplicabilitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid rule applicability', parsed.error.flatten());
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const event = await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);
    if (event.confirmationStatus !== 'CONFIRMED_FOR_DEADLINE_ANALYSIS') {
      throw validationError('Event must be CONFIRMED_FOR_DEADLINE_ANALYSIS before rule assessment');
    }

    const snapshot = await tx.approvedNoticeRuleSnapshot.findFirst({
      where: {
        id: parsed.data.approvedRuleSnapshotId,
        tenantId: ctx.tenantId,
        projectId,
        configurationRevision: { isActiveApproved: true, status: 'APPROVED' },
      },
    });
    if (!snapshot) throw notFound();

    const existing = await tx.eventRuleAssessment.findFirst({
      where: {
        projectEventId: eventId,
        approvedRuleSnapshotId: snapshot.id,
        applicabilityStatus: 'APPLICABLE',
        assessmentSource: 'HUMAN_CONFIRMED',
      },
    });
    if (existing) throw conflict('Rule applicability already confirmed for this snapshot');

    const assessment = await tx.eventRuleAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectEventId: eventId,
        contractPackageId: snapshot.contractPackageId,
        configurationRevisionId: snapshot.configurationRevisionId,
        approvedRuleSnapshotId: snapshot.id,
        applicabilityStatus: 'APPLICABLE',
        assessmentSource: 'HUMAN_CONFIRMED',
        reviewerUserId: ctx.user.id,
        reviewedAt: new Date(),
        rationale: parsed.data.rationale,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'event_rule_assessment.confirmed',
        entityType: 'event_rule_assessment',
        entityId: assessment.id,
        metadata: {
          projectEventId: eventId,
          approvedRuleSnapshotId: snapshot.id,
        },
      },
      tx,
    );
    return assessment;
  });
}

export async function listProjectCalendars(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectCalendar.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        currentRevision: true,
        _count: { select: { revisions: true } },
      },
    }),
  );
}

export async function createProjectCalendar(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'project_calendar.manage');
  const parsed = CreateProjectCalendarSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid calendar', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const created = await tx.projectCalendar.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        weekendDays: parsed.data.weekendDays,
        source: parsed.data.source ?? 'PROJECT_POLICY',
        status: 'DRAFT',
        createdByUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_calendar.created',
        entityType: 'project_calendar',
        entityId: created.id,
        metadata: { name: created.name },
      },
      tx,
    );
    return created;
  });
}

export async function createCalendarRevision(
  projectId: string,
  calendarId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'project_calendar.manage');
  const parsed = CreateCalendarRevisionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid calendar revision', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const calendar = await tx.projectCalendar.findFirst({
      where: { id: calendarId, tenantId: ctx.tenantId, projectId },
    });
    if (!calendar) throw notFound();

    const maxRev = await tx.projectCalendarRevision.aggregate({
      where: { projectCalendarId: calendarId },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;

    const revision = await tx.projectCalendarRevision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectCalendarId: calendarId,
        revisionNumber,
        timezone: parsed.data.timezone ?? calendar.timezone,
        weekendDays: parsed.data.weekendDays,
        holidayDates: parsed.data.holidays,
        specialWorkingDays: parsed.data.specialWorkingDays,
        effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
        effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
        status: 'DRAFT',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_calendar_revision.created',
        entityType: 'project_calendar_revision',
        entityId: revision.id,
        metadata: { projectCalendarId: calendarId, revisionNumber },
      },
      tx,
    );
    return revision;
  });
}

export async function approveCalendarRevision(
  projectId: string,
  calendarId: string,
  revisionId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'project_calendar.approve');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = await tx.projectCalendarRevision.findFirst({
      where: {
        id: revisionId,
        projectCalendarId: calendarId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!revision) throw notFound();
    if (revision.status !== 'DRAFT' && revision.status !== 'IN_REVIEW') {
      throw conflict(`Calendar revision cannot be approved from status ${revision.status}`);
    }

    const calendar = await tx.projectCalendar.findFirstOrThrow({
      where: { id: calendarId, tenantId: ctx.tenantId, projectId },
    });
    if (
      process.env.PROJECT_CALENDAR_SEGREGATION_OF_DUTIES === 'true' &&
      calendar.createdByUserId === ctx.user.id
    ) {
      throw forbidden('Segregation of duties: calendar approver must differ from creator');
    }

    if (calendar.currentRevisionId) {
      await tx.projectCalendarRevision.update({
        where: { id: calendar.currentRevisionId },
        data: { status: 'SUPERSEDED' },
      });
    }

    const approved = await tx.projectCalendarRevision.update({
      where: { id: revision.id },
      data: {
        status: 'APPROVED',
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
      },
    });

    await tx.projectCalendar.update({
      where: { id: calendarId },
      data: {
        status: 'APPROVED',
        currentRevisionId: approved.id,
        approvedByUserId: ctx.user.id,
        weekendDays: approved.weekendDays as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_calendar_revision.approved',
        entityType: 'project_calendar_revision',
        entityId: approved.id,
        metadata: { projectCalendarId: calendarId, revisionNumber: approved.revisionNumber },
      },
      tx,
    );
    return approved;
  });
}

export async function calculateEventDeadline(
  projectId: string,
  eventId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'deadline.calculate');
  const parsed = CalculateEventDeadlineSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid calculation input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const event = await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);
    if (event.confirmationStatus !== 'CONFIRMED_FOR_DEADLINE_ANALYSIS') {
      throw validationError('Event must be CONFIRMED_FOR_DEADLINE_ANALYSIS');
    }

    const result = await calculateEventDeadlineInternal(tx, ctx, projectId, eventId, {
      assessmentId: parsed.data.assessmentId,
      calendarRevisionId: parsed.data.calendarRevisionId,
      triggerDateId: parsed.data.triggerDateId,
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'deadline_calculation.created',
        entityType: 'deadline_calculation',
        entityId: result.id,
        metadata: {
          projectEventId: eventId,
          calculationStatus: result.calculationStatus,
        },
      },
      tx,
    );

    return result;
  });
}

export async function verifyDeadlineCalculation(projectId: string, calculationId: string) {
  const ctx = await requireProjectCapability(projectId, 'deadline.verify');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const calculation = await tx.deadlineCalculation.findFirst({
      where: { id: calculationId, tenantId: ctx.tenantId, projectId },
    });
    if (!calculation) throw notFound();
    if (calculation.calculationStatus === 'VERIFIED') {
      throw conflict('Calculation is already verified');
    }
    if (calculation.calculationStatus === 'BLOCKED') {
      throw validationError('Blocked calculations cannot be verified');
    }
    if (
      calculation.calculationStatus !== 'REVIEW_REQUIRED' &&
      calculation.calculationStatus !== 'CALCULATED'
    ) {
      throw conflict(`Calculation cannot be verified from status ${calculation.calculationStatus}`);
    }
    if (deadlineCalcSegregationEnabled() && calculation.calculatedByUserId === ctx.user.id) {
      throw forbidden('Segregation of duties: verifier must differ from calculator');
    }

    const updated = await tx.deadlineCalculation.update({
      where: { id: calculation.id },
      data: {
        calculationStatus: 'VERIFIED',
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'deadline_calculation.verified',
        entityType: 'deadline_calculation',
        entityId: updated.id,
        metadata: { projectEventId: calculation.projectEventId },
      },
      tx,
    );
    return updated;
  });
}

export async function createTrackedDeadline(projectId: string, calculationId: string) {
  const ctx = await requireProjectCapability(projectId, 'deadline.track');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const calculation = await tx.deadlineCalculation.findFirst({
      where: { id: calculationId, tenantId: ctx.tenantId, projectId },
      include: {
        milestones: {
          where: { classification: 'CONTRACTUAL' },
          orderBy: { sequence: 'asc' },
          take: 1,
        },
        approvedRuleSnapshot: { select: { noticeCategory: true } },
      },
    });
    if (!calculation) throw notFound();
    if (calculation.calculationStatus !== 'VERIFIED') {
      throw validationError('Calculation must be VERIFIED before tracking');
    }

    const existing = await tx.projectDeadline.findFirst({
      where: {
        deadlineCalculationId: calculation.id,
        status: { notIn: ['SUPERSEDED', 'CANCELLED'] },
      },
    });
    if (existing) throw conflict('A tracked deadline already exists for this calculation');

    const contractualMilestone = calculation.milestones[0] ?? null;
    const deadline = await tx.projectDeadline.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectEventId: calculation.projectEventId,
        contractPackageId: calculation.contractPackageId,
        deadlineCalculationId: calculation.id,
        deadlineMilestoneId: contractualMilestone?.id,
        title: `Notice deadline — ${calculation.approvedRuleSnapshot.noticeCategory ?? 'GENERAL'}`,
        deadlineType: calculation.approvedRuleSnapshot.noticeCategory ?? 'NOTICE',
        dueAt: calculation.calculatedDeadlineAt,
        timezone: calculation.deadlineTimezone,
        status: 'UPCOMING',
        riskStatus: 'UNKNOWN',
      },
    });

    await tx.deadlineStatusHistory.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        projectDeadlineId: deadline.id,
        fromStatus: null,
        toStatus: 'UPCOMING',
        changedByUserId: ctx.user.id,
        reason: 'Tracked from verified calculation',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'project_deadline.tracked',
        entityType: 'project_deadline',
        entityId: deadline.id,
        metadata: { deadlineCalculationId: calculation.id },
      },
      tx,
    );
    return deadline;
  });
}

export async function recalculateDeadline(
  projectId: string,
  calculationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'deadline.recalculate');
  const parsed = RecalculateDeadlineSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid recalculation input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const prior = await tx.deadlineCalculation.findFirst({
      where: { id: calculationId, tenantId: ctx.tenantId, projectId },
    });
    if (!prior) throw notFound();
    if (prior.calculationStatus !== 'VERIFIED' && prior.calculationStatus !== 'REVIEW_REQUIRED') {
      throw conflict(`Cannot recalculate from status ${prior.calculationStatus}`);
    }

    const evidence = prior.triggerDateEvidence as { projectEventDateId?: string } | null;
    const resolvedTriggerId = parsed.data.triggerDateId ?? evidence?.projectEventDateId;
    if (!resolvedTriggerId) {
      throw validationError('triggerDateId is required for recalculation');
    }

    const calendarRevisionId = parsed.data.calendarRevisionId ?? prior.calendarRevisionId;

    const newCalculation = await calculateEventDeadlineInternal(
      tx,
      ctx,
      projectId,
      prior.projectEventId,
      {
        assessmentId: prior.eventRuleAssessmentId,
        calendarRevisionId,
        triggerDateId: resolvedTriggerId,
        supersedesCalculationId: prior.id,
        recalculationReason: parsed.data.reason,
      },
    );

    await tx.deadlineCalculation.update({
      where: { id: prior.id },
      data: { calculationStatus: 'SUPERSEDED' },
    });

    const tracked = await tx.projectDeadline.findMany({
      where: {
        deadlineCalculationId: prior.id,
        status: { notIn: ['SUPERSEDED', 'CANCELLED'] },
      },
    });

    for (const oldDeadline of tracked) {
      const superseding = await tx.projectDeadline.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          projectEventId: prior.projectEventId,
          contractPackageId: prior.contractPackageId,
          deadlineCalculationId: newCalculation.id,
          title: oldDeadline.title,
          deadlineType: oldDeadline.deadlineType,
          dueAt: newCalculation.calculatedDeadlineAt,
          timezone: newCalculation.deadlineTimezone,
          status: 'UPCOMING',
          riskStatus: 'UNKNOWN',
        },
      });

      await tx.projectDeadline.update({
        where: { id: oldDeadline.id },
        data: {
          status: 'SUPERSEDED',
          supersededById: superseding.id,
        },
      });

      await tx.deadlineStatusHistory.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          projectDeadlineId: oldDeadline.id,
          fromStatus: oldDeadline.status,
          toStatus: 'SUPERSEDED',
          changedByUserId: ctx.user.id,
          reason: parsed.data.reason,
        },
      });
    }

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'deadline_calculation.recalculated',
        entityType: 'deadline_calculation',
        entityId: newCalculation.id,
        metadata: {
          supersedesCalculationId: prior.id,
          reason: parsed.data.reason,
        },
      },
      tx,
    );

    return newCalculation;
  });
}

async function calculateEventDeadlineInternal(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; user: { id: string } },
  projectId: string,
  eventId: string,
  input: {
    assessmentId: string;
    calendarRevisionId: string;
    triggerDateId: string;
    supersedesCalculationId?: string;
    recalculationReason?: string;
  },
) {
  const assessment = await tx.eventRuleAssessment.findFirstOrThrow({
    where: {
      id: input.assessmentId,
      tenantId: ctx.tenantId,
      projectId,
      projectEventId: eventId,
      applicabilityStatus: 'APPLICABLE',
      assessmentSource: 'HUMAN_CONFIRMED',
    },
    include: {
      approvedRuleSnapshot: { include: { configurationRevision: true } },
    },
  });

  const triggerDate = await tx.projectEventDate.findFirstOrThrow({
    where: {
      id: input.triggerDateId,
      tenantId: ctx.tenantId,
      projectId,
      projectEventId: eventId,
      verificationStatus: 'VERIFIED',
      precision: { in: ['EXACT_DATE', 'EXACT_DATETIME'] },
    },
  });

  const calendarRevision = await tx.projectCalendarRevision.findFirstOrThrow({
    where: {
      id: input.calendarRevisionId,
      tenantId: ctx.tenantId,
      projectId,
      status: 'APPROVED',
    },
  });

  const snapshot = assessment.approvedRuleSnapshot;
  if (
    !snapshot.configurationRevision.isActiveApproved ||
    snapshot.configurationRevision.status !== 'APPROVED'
  ) {
    throw validationError('Rule snapshot must come from active approved configuration');
  }
  const structuredRule = snapshotStructuredRule(snapshot.structuredRule);
  const engineResult = calculateDeadline({
    rule: structuredRule,
    triggerDateIso: triggerDate.dateValue.toISOString(),
    triggerPrecision: triggerDate.precision === 'EXACT_DATETIME' ? 'EXACT_DATETIME' : 'EXACT_DATE',
    calendar: calendarRevisionToEngineInput(calendarRevision),
  });

  const calculationStatus = engineResult.status === 'BLOCKED' ? 'BLOCKED' : 'REVIEW_REQUIRED';

  const maxVersion = await tx.deadlineCalculation.aggregate({
    where: { projectEventId: eventId, eventRuleAssessmentId: assessment.id },
    _max: { calculationVersion: true },
  });
  const calculationVersion = (maxVersion._max.calculationVersion ?? 0) + 1;

  const calculation = await tx.deadlineCalculation.create({
    data: {
      tenantId: ctx.tenantId,
      projectId,
      projectEventId: eventId,
      eventRuleAssessmentId: assessment.id,
      contractPackageId: snapshot.contractPackageId,
      configurationRevisionId: snapshot.configurationRevisionId,
      approvedRuleSnapshotId: snapshot.id,
      calendarRevisionId: calendarRevision.id,
      projectCalendarId: calendarRevision.projectCalendarId,
      calculationStatus,
      calculationVersion,
      triggerDateType: triggerDate.dateType,
      triggerDateValue: triggerDate.dateValue,
      triggerTimezone: triggerDate.timezone,
      triggerDateEvidence: {
        projectEventDateId: triggerDate.id,
        precision: triggerDate.precision,
      },
      durationValue: snapshot.durationValue,
      durationUnit: snapshot.durationUnit,
      countingConvention: snapshot.countingConvention,
      startDateRule: snapshot.startDateRule,
      endDateRule: snapshot.endDateRule,
      businessDayAdjustment: snapshot.businessDayAdjustment,
      calculatedDeadlineAt: engineResult.contractualDeadlineAt
        ? new Date(engineResult.contractualDeadlineAt)
        : null,
      calculatedDeadlineDate: engineResult.contractualDeadlineDate,
      deadlineTimezone: engineResult.deadlineTimezone,
      blockedReason:
        engineResult.blockedReasons.length > 0 ? engineResult.blockedReasons.join('; ') : null,
      calculationTrace: engineResult.trace as Prisma.InputJsonValue,
      calculatedByUserId: ctx.user.id,
      supersedesCalculationId: input.supersedesCalculationId,
      recalculationReason: input.recalculationReason,
    },
  });

  if (engineResult.status === 'CALCULATED' && engineResult.contractualDeadlineAt) {
    await tx.deadlineMilestone.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          projectId,
          deadlineCalculationId: calculation.id,
          kind: 'INITIAL_NOTICE',
          classification: 'CONTRACTUAL',
          label: 'Contractual notice deadline',
          dueAt: new Date(engineResult.contractualDeadlineAt),
          dueDate: engineResult.contractualDeadlineDate,
          timezone: engineResult.deadlineTimezone,
          sequence: 0,
        },
        ...engineResult.internalMilestones.map((internal, index) => ({
          tenantId: ctx.tenantId,
          projectId,
          deadlineCalculationId: calculation.id,
          kind: 'INTERNAL_REVIEW_TARGET' as const,
          classification: 'INTERNAL' as const,
          label: internal.label,
          dueAt: new Date(internal.dueAtIso),
          dueDate: internal.dueAtIso.slice(0, 10),
          timezone: engineResult.deadlineTimezone,
          offsetDaysBeforeDeadline: internal.offsetDaysBeforeDeadline,
          sequence: index + 1,
        })),
      ],
    });
  }

  return tx.deadlineCalculation.findUniqueOrThrow({
    where: { id: calculation.id },
    include: { milestones: { orderBy: { sequence: 'asc' } } },
  });
}

export async function listEventCalculations(projectId: string, eventId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadProjectEvent(tx, ctx.tenantId, projectId, eventId);
    return tx.deadlineCalculation.findMany({
      where: { tenantId: ctx.tenantId, projectId, projectEventId: eventId },
      orderBy: { createdAt: 'desc' },
      include: { milestones: { orderBy: { sequence: 'asc' } } },
    });
  });
}

export async function getLatestEventCalculation(projectId: string, eventId: string) {
  const items = await listEventCalculations(projectId, eventId);
  return items[0] ?? null;
}

export async function listProjectDeadlines(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectDeadline.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: {
        projectEvent: { select: { id: true, title: true, eventCategory: true } },
        deadlineCalculation: {
          select: { id: true, calculationStatus: true, calculatedDeadlineDate: true },
        },
      },
    }),
  );
}

export async function getDeadlineCalculation(projectId: string, calculationId: string) {
  const ctx = await requireProjectCapability(projectId, 'project_event.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const calculation = await tx.deadlineCalculation.findFirst({
      where: { id: calculationId, tenantId: ctx.tenantId, projectId },
      include: {
        milestones: { orderBy: { sequence: 'asc' } },
        eventRuleAssessment: true,
        approvedRuleSnapshot: { select: { id: true, noticeCategory: true, structuredRule: true } },
        calendarRevision: { select: { id: true, revisionNumber: true, timezone: true } },
      },
    });
    if (!calculation) throw notFound();
    return calculation;
  });
}
