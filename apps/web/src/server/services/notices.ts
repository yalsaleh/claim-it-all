import {
  assembleDeterministicDraft,
  assessEvidenceCompleteness,
  DEFAULT_EVIDENCE_CATEGORIES,
  exportApprovedNotice,
  isNonWaivableException,
  NOTICE_DRAFTING_RULESET_VERSION,
  validateNoticeDraft,
  type AssembledSection,
} from '@contractradar/notice-drafting';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import { requireProjectCapability } from '@/server/authz/context';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';
import {
  createNoticeDraftAiProvider,
  validateNoticeAiDraftOutput,
} from '@/server/notices/ai-provider';

const PACKAGE_INCLUDE = {
  requirementSnapshots: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  evidenceRequirements: true,
  deliveryPreparations: true,
  facts: true,
  draftRevisions: {
    orderBy: { revisionNumber: 'desc' as const },
    take: 3,
    include: { sections: { orderBy: { sequence: 'asc' as const } } },
  },
  completenessAssessments: { orderBy: { assessmentRevision: 'desc' as const }, take: 1 },
  activeApprovedRevision: { include: { sections: { orderBy: { sequence: 'asc' as const } } } },
} satisfies Prisma.NoticePackageInclude;

const CreateNoticePackageSchema = z.object({
  deadlineCalculationId: z.string().uuid(),
  noticeType: z.enum([
    'INITIAL_NOTICE',
    'NOTICE_OF_CLAIM',
    'NOTICE_OF_DELAY',
    'NOTICE_OF_VARIATION',
    'NOTICE_OF_ADDITIONAL_COST',
    'NOTICE_OF_RESTRICTED_ACCESS',
    'NOTICE_OF_SUSPENSION',
    'NOTICE_OF_LATE_INFORMATION',
    'NOTICE_OF_DELAYED_PAYMENT',
    'NOTICE_OF_UNFORESEEN_CONDITION',
    'INTERIM_PARTICULARS',
    'FINAL_PARTICULARS',
    'RESERVATION_OF_RIGHTS',
    'RESPONSE',
    'OTHER',
  ]),
  title: z.string().trim().min(1).max(300),
  language: z.enum(['en', 'ar']),
  secondaryLanguage: z.enum(['en', 'ar']).optional(),
  projectDeadlineId: z.string().uuid().optional(),
  reference: z.string().trim().max(200).optional(),
});

const LinkEvidenceSchema = z.object({
  evidenceRequirementId: z.string().uuid(),
  role: z.enum([
    'PRIMARY',
    'SUPPORTING',
    'DATE_PROOF',
    'RECIPIENT_PROOF',
    'DELIVERY_PROOF',
    'IMPACT_PROOF',
    'COST_PROOF',
    'CONTRADICTING',
    'CONTEXT',
    'ATTACHMENT_CANDIDATE',
  ]),
  sourceDocumentId: z.string().uuid().optional(),
  documentVersionId: z.string().uuid().optional(),
  evidenceSegmentId: z.string().uuid().optional(),
  projectEventEvidenceId: z.string().uuid().optional(),
  reviewerAuthoredStatement: z.string().trim().max(5000).optional(),
  satisfactionStatus: z.enum(['PARTIAL', 'SATISFIED']).optional(),
});

const CreateQuestionSchema = z.object({
  category: z.enum([
    'FACT',
    'DATE',
    'RECIPIENT',
    'CONTRACT_BASIS',
    'AFFECTED_WORK',
    'CAUSATION',
    'IMPACT',
    'ATTACHMENT',
    'LANGUAGE',
    'OTHER',
  ]),
  questionText: z.string().trim().min(1).max(5000),
  reason: z.string().trim().max(5000).optional(),
  relatedEvidenceRequirementId: z.string().uuid().optional(),
  answerType: z.enum(['FREE_TEXT', 'YES_NO', 'DATE', 'DOCUMENT', 'ENUM']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
});

const AnswerQuestionSchema = z.object({
  responseText: z.string().trim().min(1).max(5000),
});

const CreateFactSchema = z.object({
  factType: z.enum([
    'EVENT_DATE',
    'AWARENESS_DATE',
    'INSTRUCTION_DATE',
    'RECEIPT_DATE',
    'PARTY_NAME',
    'ROLE_NAME',
    'PROJECT_NAME',
    'CONTRACT_REFERENCE',
    'NOTICE_REFERENCE',
    'DESCRIPTION_OF_EVENT',
    'DESCRIPTION_OF_EFFECT',
    'REQUESTED_ACTION',
    'OTHER',
  ]),
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(8000),
  sourceType: z
    .enum([
      'PROJECT_EVENT',
      'PROJECT_EVENT_DATE',
      'REVIEWER_ENTERED',
      'REQUIREMENT_SNAPSHOT',
      'OTHER',
    ])
    .default('REVIEWER_ENTERED'),
});

const VerifyFactSchema = z.object({
  verificationStatus: z
    .enum(['EVIDENCE_BACKED', 'HUMAN_CONFIRMED', 'DISPUTED'])
    .default('HUMAN_CONFIRMED'),
  approvedForDrafting: z.boolean().default(false),
});

const EditSectionSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

const ApprovalSchema = z.object({
  rationale: z.string().trim().max(5000).optional(),
  draftRevisionId: z.string().uuid().optional(),
});

const ExceptionSchema = z.object({
  issueCategory: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  rationale: z.string().trim().min(1).max(5000),
  risk: z.string().trim().max(5000).optional(),
});

const AttachmentSchema = z.object({
  externalFilename: z.string().trim().min(1).max(300),
  category: z.enum([
    'CORRESPONDENCE',
    'INSTRUCTION',
    'DRAWING',
    'RFI',
    'DAILY_REPORT',
    'PHOTOGRAPH',
    'OTHER',
  ]),
  description: z.string().trim().max(2000).optional(),
  sourceDocumentId: z.string().uuid().optional(),
  documentVersionId: z.string().uuid().optional(),
});

const CommentSchema = z.object({
  draftRevisionId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  commentType: z.enum(['FACTUAL', 'CONTRACTUAL', 'LANGUAGE', 'EVIDENCE', 'RECIPIENT', 'OTHER']),
  commentText: z.string().trim().min(1).max(5000),
  internalOnly: z.boolean().default(true),
});

function noticeSodEnabled(): boolean {
  return process.env.NOTICE_DRAFT_SEGREGATION_OF_DUTIES !== 'false';
}

function assertProjectMutable(status: string) {
  if (status === 'ARCHIVED') throw conflict('Archived projects are read-only');
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

/** Slice 6 boundary — controlled send lives only in notice-delivery.ts with human authorization. */
export function assertNoSendOperations(): void {
  const forbiddenNames = ['sendNotice', 'dispatchNotice', 'deliverNotice'];
  for (const name of forbiddenNames) {
    if (name in exports) {
      throw new Error(`Forbidden send operation exported: ${name}`);
    }
  }
}

async function loadPackage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  projectId: string,
  noticePackageId: string,
) {
  const pkg = await tx.noticePackage.findFirst({
    where: { id: noticePackageId, tenantId, projectId },
    include: PACKAGE_INCLUDE,
  });
  if (!pkg) throw notFound();
  return pkg;
}

async function loadLatestDraft(tx: Prisma.TransactionClient, noticePackageId: string) {
  return tx.noticeDraftRevision.findFirst({
    where: { noticePackageId },
    orderBy: { revisionNumber: 'desc' },
    include: { sections: { orderBy: { sequence: 'asc' } } },
  });
}

function mapCompletenessToPackageStatus(
  status: 'NOT_ASSESSED' | 'INCOMPLETE' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED',
): 'EVIDENCE_INCOMPLETE' | 'READY_FOR_DRAFT' {
  if (status === 'READY' || status === 'CONDITIONALLY_READY') return 'READY_FOR_DRAFT';
  return 'EVIDENCE_INCOMPLETE';
}

function mapDbCompleteness(
  status: 'NOT_ASSESSED' | 'INCOMPLETE' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED',
): string {
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'NOT_ASSESSED') return 'NOT_ASSESSED';
  if (status === 'INCOMPLETE') return 'INCOMPLETE';
  return status;
}

const EVIDENCE_DESCRIPTIONS: Record<string, string> = {
  EVENT_OCCURRENCE: 'Evidence that the triggering event occurred',
  TRIGGER_DATE: 'Verified trigger date for notice timing',
  CONTRACTUAL_BASIS: 'Approved notice rule snapshot and clause reference',
  RECIPIENT: 'Verified notice recipient',
  DELIVERY_METHOD: 'Permitted delivery method and contact point',
  CONTEMPORARY_RECORDS: 'Contemporary records supporting the notice',
};

async function seedRequirementSnapshot(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string },
  projectId: string,
  noticePackageId: string,
  snapshot: {
    id: string;
    sourceObligationId: string;
    sourceClauseId: string | null;
    contentRequirements: string | null;
    consequenceText: string | null;
    recipientRequirements: string | null;
    deliveryMethodRequirements: string | null;
    timeBarClassification: string;
  },
  calculation: { calculatedDeadlineAt: Date | null; deadlineTimezone: string },
  clauseRef: string | null,
) {
  const existing = await tx.noticeRequirementSnapshot.findFirst({
    where: { noticePackageId },
  });
  if (existing) return existing;

  return tx.noticeRequirementSnapshot.create({
    data: {
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      approvedNoticeRuleSnapshotId: snapshot.id,
      sourceObligationId: snapshot.sourceObligationId,
      sourceClauseId: snapshot.sourceClauseId,
      sourceClauseReference: clauseRef,
      requiredRecipients: snapshot.recipientRequirements,
      requiredDeliveryMethods: snapshot.deliveryMethodRequirements,
      requiredContentItems: snapshot.contentRequirements,
      requiredReservationLanguage: null,
      consequenceText: snapshot.consequenceText,
      verifiedDeadlineAt: calculation.calculatedDeadlineAt,
      verifiedDeadlineTimezone: calculation.deadlineTimezone,
      timeBarClassification: snapshot.timeBarClassification,
    },
  });
}

async function seedEvidenceRequirements(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string },
  projectId: string,
  noticePackageId: string,
  approvedRuleSnapshotId: string,
) {
  const existing = await tx.noticeEvidenceRequirement.count({ where: { noticePackageId } });
  if (existing > 0) return;

  await tx.noticeEvidenceRequirement.createMany({
    data: DEFAULT_EVIDENCE_CATEGORIES.map((category) => ({
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      category,
      description: EVIDENCE_DESCRIPTIONS[category] ?? category,
      mandatoryStatus: 'CONTRACTUALLY_REQUIRED' as const,
      satisfactionStatus:
        category === 'CONTRACTUAL_BASIS' ? ('SATISFIED' as const) : ('MISSING' as const),
      approvedRuleSnapshotId,
    })),
  });
}

async function seedDeliveryPreparations(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string },
  projectId: string,
  noticePackageId: string,
  obligationId: string,
  snapshotRecipients: string | null,
) {
  const existing = await tx.noticeDeliveryPreparation.count({ where: { noticePackageId } });
  if (existing > 0) return;

  const recipients = await tx.obligationRecipient.findMany({
    where: { obligationId, tenantId: ctx.tenantId, projectId },
    include: { contactPoint: true, contractRole: true },
  });

  if (recipients.length > 0) {
    await tx.noticeDeliveryPreparation.createMany({
      data: recipients.map((r) => {
        const cp = r.contactPoint;
        const label =
          cp?.namedPerson ?? cp?.organization ?? r.contractRole?.roleName ?? r.recipientKind;
        return {
          tenantId: ctx.tenantId,
          projectId,
          noticePackageId,
          recipientRole: r.contractRole?.roleName ?? r.recipientKind,
          namedRecipient: label,
          physicalAddress: cp?.physicalAddress,
          emailAddress: cp?.emailAddress,
          platformAddress: cp?.platformAddress,
          permittedMethod: cp?.permittedDeliveryMethod,
          selectedMethod: cp?.permittedDeliveryMethod,
          copiedRecipient: false,
          verificationStatus: 'MISSING' as const,
          contactPointId: cp?.id,
          obligationRecipientId: r.id,
        };
      }),
    });
    return;
  }

  await tx.noticeDeliveryPreparation.create({
    data: {
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      namedRecipient: snapshotRecipients ?? 'Recipient per approved snapshot (unverified)',
      verificationStatus: 'MISSING',
      copiedRecipient: false,
    },
  });
}

async function seedFactsFromEvent(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string },
  projectId: string,
  noticePackageId: string,
  event: { id: string; title: string; description: string | null },
  project: { name: string; code: string },
  dates: Array<{ dateType: string; dateValue: Date; verificationStatus: string }>,
) {
  const existing = await tx.noticeFact.count({ where: { noticePackageId } });
  if (existing > 0) return;

  const facts: Prisma.NoticeFactCreateManyInput[] = [
    {
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      factType: 'PROJECT_NAME',
      label: 'Project name',
      value: `${project.name} (${project.code})`,
      sourceType: 'PROJECT_EVENT',
      verificationStatus: 'HUMAN_CONFIRMED',
      approvedForDrafting: false,
    },
    {
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      factType: 'DESCRIPTION_OF_EVENT',
      label: 'Event description',
      value: event.description ?? event.title,
      sourceType: 'PROJECT_EVENT',
      projectEventId: event.id,
      verificationStatus: 'UNVERIFIED',
      approvedForDrafting: false,
    },
  ];

  for (const d of dates) {
    const factType =
      d.dateType === 'AWARENESS_DATE'
        ? 'AWARENESS_DATE'
        : d.dateType === 'INSTRUCTION_DATE'
          ? 'INSTRUCTION_DATE'
          : 'EVENT_DATE';
    const verified = d.verificationStatus === 'VERIFIED';
    facts.push({
      tenantId: ctx.tenantId,
      projectId,
      noticePackageId,
      factType,
      label: factType.replace(/_/g, ' '),
      value: d.dateValue.toISOString(),
      sourceType: 'PROJECT_EVENT_DATE',
      projectEventId: event.id,
      verificationStatus: verified ? 'EVIDENCE_BACKED' : 'UNVERIFIED',
      approvedForDrafting: false,
    });
  }

  await tx.noticeFact.createMany({ data: facts });
}

function sectionsToDb(
  sections: AssembledSection[],
  ctx: { tenantId: string },
  projectId: string,
  draftRevisionId: string,
): Prisma.NoticeDraftSectionCreateManyInput[] {
  return sections.map((s) => ({
    tenantId: ctx.tenantId,
    projectId,
    draftRevisionId,
    sectionType: s.sectionType,
    sequence: s.sequence,
    heading: s.heading,
    body: s.body,
    language: s.language,
    sourceFactIds: s.sourceFactIds,
    sourceEvidenceRefs: s.sourceEvidenceIds,
    sourceClauseRefs: s.sourceClauseIds,
    machineGenerated: s.machineGenerated,
    humanEdited: s.humanEdited,
    internalOnly: s.internalOnly,
    warnings: s.warnings,
  }));
}

async function buildDraftContext(
  tx: Prisma.TransactionClient,
  pkg: Awaited<ReturnType<typeof loadPackage>>,
) {
  const reqSnap = pkg.requirementSnapshots[0];
  if (!reqSnap) throw validationError('Requirement snapshot missing');

  const project = await tx.project.findFirstOrThrow({
    where: { id: pkg.projectId },
    select: { name: true, code: true },
  });
  const event = await tx.projectEvent.findFirstOrThrow({
    where: { id: pkg.projectEventId },
    select: { title: true, description: true },
  });

  return {
    language: pkg.language as 'en' | 'ar',
    noticeType: pkg.noticeType,
    title: pkg.title,
    projectName: project.name,
    projectCode: project.code,
    contractReference: pkg.reference ?? project.code,
    eventTitle: event.title,
    eventDescription: event.description,
    facts: pkg.facts.map((f) => ({
      id: f.id,
      factType: f.factType,
      label: f.label,
      value: f.value,
      approvedForDrafting: f.approvedForDrafting,
      verificationStatus: f.verificationStatus,
    })),
    requirement: {
      id: reqSnap.id,
      sourceClauseId: reqSnap.sourceClauseId,
      sourceClauseReference: reqSnap.sourceClauseReference,
      contentRequirements: reqSnap.requiredContentItems,
      consequenceText: reqSnap.consequenceText,
      reservationLanguage: reqSnap.requiredReservationLanguage,
      requiredDeliveryMethods: reqSnap.requiredDeliveryMethods,
      requiredRecipients: reqSnap.requiredRecipients,
      verifiedDeadlineAt: reqSnap.verifiedDeadlineAt?.toISOString() ?? null,
      verifiedDeadlineTimezone: reqSnap.verifiedDeadlineTimezone,
      timeBarClassification: reqSnap.timeBarClassification,
      continuingEventRequirements: reqSnap.continuingEventRequirements,
      interimParticularsRequirements: reqSnap.interimParticularsRequirements,
      finalParticularsRequirements: reqSnap.finalParticularsRequirements,
    },
    recipients: pkg.deliveryPreparations.map((r) => ({
      id: r.id,
      recipientLabel: r.namedRecipient ?? r.recipientRole ?? 'Recipient',
      selectedMethod: r.selectedMethod,
      permittedMethod: r.permittedMethod,
      emailAddress: r.emailAddress,
      physicalAddress: r.physicalAddress,
      verificationStatus: r.verificationStatus,
      copiedRecipient: r.copiedRecipient,
    })),
    attachments: [],
    templateVersion: 'synthetic-notice-template-v1',
  };
}

export async function createNoticePackageFromDeadline(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.create');
  const parsed = CreateNoticePackageSchema.safeParse(rawInput);
  if (!parsed.success)
    throw validationError('Invalid notice package input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, tenantId: ctx.tenantId },
    });
    if (!project) throw notFound();
    assertProjectMutable(project.status);

    const calculation = await tx.deadlineCalculation.findFirst({
      where: {
        id: parsed.data.deadlineCalculationId,
        tenantId: ctx.tenantId,
        projectId,
      },
      include: {
        approvedRuleSnapshot: {
          include: { sourceClause: { select: { clauseNumber: true } } },
        },
        projectEvent: true,
        eventRuleAssessment: true,
      },
    });
    if (!calculation) throw notFound();
    if (calculation.calculationStatus !== 'VERIFIED') {
      throw validationError('Deadline calculation must be VERIFIED');
    }

    const event = calculation.projectEvent;
    const confirmed =
      event.eventStatus === 'CONFIRMED' ||
      event.confirmationStatus === 'CONFIRMED_FOR_DEADLINE_ANALYSIS' ||
      event.confirmationStatus === 'CONFIRMED_FACT';
    if (!confirmed) throw validationError('Project event must be confirmed');

    const assessment = calculation.eventRuleAssessment;
    if (assessment.applicabilityStatus !== 'APPLICABLE') {
      throw validationError('Event rule assessment must be APPLICABLE');
    }

    const dates = await tx.projectEventDate.findMany({
      where: { projectEventId: event.id, tenantId: ctx.tenantId, projectId },
    });

    const sodEnforced = noticeSodEnabled();
    const pkg = await tx.noticePackage.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: calculation.contractPackageId,
        configurationRevisionId: calculation.configurationRevisionId,
        approvedNoticeRuleSnapshotId: calculation.approvedRuleSnapshotId,
        projectEventId: calculation.projectEventId,
        eventRuleAssessmentId: calculation.eventRuleAssessmentId,
        deadlineCalculationId: calculation.id,
        projectDeadlineId: parsed.data.projectDeadlineId,
        noticeType: parsed.data.noticeType,
        title: parsed.data.title,
        reference: parsed.data.reference,
        status: 'DRAFT',
        language: parsed.data.language,
        secondaryLanguage: parsed.data.secondaryLanguage,
        deadlineAt: calculation.calculatedDeadlineAt,
        deadlineTimezone: calculation.deadlineTimezone,
        createdByUserId: ctx.user.id,
        sodEnforced,
      },
    });

    const ruleSnap = calculation.approvedRuleSnapshot;
    await seedRequirementSnapshot(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.user.id },
      projectId,
      pkg.id,
      {
        id: ruleSnap.id,
        sourceObligationId: ruleSnap.sourceObligationId,
        sourceClauseId: ruleSnap.sourceClauseId,
        contentRequirements: ruleSnap.contentRequirements,
        consequenceText: ruleSnap.consequenceText,
        recipientRequirements: ruleSnap.recipientRequirements,
        deliveryMethodRequirements: ruleSnap.deliveryMethodRequirements,
        timeBarClassification: ruleSnap.timeBarClassification,
      },
      calculation,
      ruleSnap.sourceClause?.clauseNumber ?? null,
    );
    await seedEvidenceRequirements(tx, { tenantId: ctx.tenantId }, projectId, pkg.id, ruleSnap.id);
    await seedDeliveryPreparations(
      tx,
      { tenantId: ctx.tenantId },
      projectId,
      pkg.id,
      ruleSnap.sourceObligationId,
      ruleSnap.recipientRequirements,
    );
    await seedFactsFromEvent(
      tx,
      { tenantId: ctx.tenantId },
      projectId,
      pkg.id,
      event,
      project,
      dates,
    );

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_package.create',
        entityType: 'notice_package',
        entityId: pkg.id,
        metadata: { deadlineCalculationId: calculation.id, noticeType: parsed.data.noticeType },
      },
      tx,
    );

    return loadPackage(tx, ctx.tenantId, projectId, pkg.id);
  });
}

export async function listNoticePackages(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.noticePackage.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { draftRevisions: true, facts: true } },
      },
    }),
  );
}

export async function getNoticePackage(projectId: string, noticePackageId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    loadPackage(tx, ctx.tenantId, projectId, noticePackageId),
  );
}

export async function snapshotRequirements(projectId: string, noticePackageId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    if (pkg.requirementSnapshots.length > 0) return pkg.requirementSnapshots[0];

    const calc = await tx.deadlineCalculation.findFirstOrThrow({
      where: { id: pkg.deadlineCalculationId },
      include: {
        approvedRuleSnapshot: { include: { sourceClause: { select: { clauseNumber: true } } } },
      },
    });
    return seedRequirementSnapshot(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.user.id },
      projectId,
      noticePackageId,
      {
        id: calc.approvedRuleSnapshot.id,
        sourceObligationId: calc.approvedRuleSnapshot.sourceObligationId,
        sourceClauseId: calc.approvedRuleSnapshot.sourceClauseId,
        contentRequirements: calc.approvedRuleSnapshot.contentRequirements,
        consequenceText: calc.approvedRuleSnapshot.consequenceText,
        recipientRequirements: calc.approvedRuleSnapshot.recipientRequirements,
        deliveryMethodRequirements: calc.approvedRuleSnapshot.deliveryMethodRequirements,
        timeBarClassification: calc.approvedRuleSnapshot.timeBarClassification,
      },
      calc,
      calc.approvedRuleSnapshot.sourceClause?.clauseNumber ?? null,
    );
  });
}

export async function assessEvidenceCompletenessForPackage(
  projectId: string,
  noticePackageId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_evidence.assess');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    assertProjectMutable((await tx.project.findFirstOrThrow({ where: { id: projectId } })).status);

    const result = assessEvidenceCompleteness(
      pkg.evidenceRequirements.map((r) => ({
        category: r.category,
        mandatoryStatus: r.mandatoryStatus,
        satisfactionStatus: r.satisfactionStatus,
        waiverReason: r.waiverRationale,
      })),
      { assessed: true },
    );

    const lastRev = pkg.completenessAssessments[0]?.assessmentRevision ?? 0;
    const dbStatus =
      result.status === 'BLOCKED'
        ? 'BLOCKED'
        : result.status === 'NOT_ASSESSED'
          ? 'NOT_ASSESSED'
          : result.status === 'INCOMPLETE'
            ? 'INCOMPLETE'
            : result.status;

    const assessment = await tx.evidenceCompletenessAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        assessmentRevision: lastRev + 1,
        completenessStatus: dbStatus as
          | 'NOT_ASSESSED'
          | 'INCOMPLETE'
          | 'CONDITIONALLY_READY'
          | 'READY'
          | 'BLOCKED',
        blockingIssues: result.blockingIssues,
        nonBlockingWarnings: result.warnings,
        assessedByUserId: ctx.user.id,
        assessedAt: new Date(),
        rulesetVersion: NOTICE_DRAFTING_RULESET_VERSION,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: mapCompletenessToPackageStatus(result.status) },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_evidence.assess',
        entityType: 'evidence_completeness_assessment',
        entityId: assessment.id,
        metadata: { completenessStatus: dbStatus },
      },
      tx,
    );

    return { assessment, result };
  });
}

export async function linkEvidence(projectId: string, noticePackageId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_evidence.link');
  const parsed = LinkEvidenceSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid evidence link', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);

    const requirement = await tx.noticeEvidenceRequirement.findFirst({
      where: {
        id: parsed.data.evidenceRequirementId,
        noticePackageId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!requirement) throw notFound();

    if (parsed.data.documentVersionId) {
      const version = await tx.documentVersion.findFirst({
        where: {
          id: parsed.data.documentVersionId,
          tenantId: ctx.tenantId,
          projectId,
        },
      });
      if (!version) throw validationError('Document version not in project');
      if (
        parsed.data.sourceDocumentId &&
        version.sourceDocumentId !== parsed.data.sourceDocumentId
      ) {
        throw validationError('Document version does not match source document');
      }
    }

    const link = await tx.noticeEvidenceLink.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        evidenceRequirementId: requirement.id,
        role: parsed.data.role,
        sourceDocumentId: parsed.data.sourceDocumentId,
        documentVersionId: parsed.data.documentVersionId,
        evidenceSegmentId: parsed.data.evidenceSegmentId,
        projectEventEvidenceId: parsed.data.projectEventEvidenceId,
        reviewerAuthoredStatement: parsed.data.reviewerAuthoredStatement,
      },
    });

    if (parsed.data.satisfactionStatus) {
      await tx.noticeEvidenceRequirement.update({
        where: { id: requirement.id },
        data: { satisfactionStatus: parsed.data.satisfactionStatus },
      });
    }

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_evidence.link',
        entityType: 'notice_evidence_link',
        entityId: link.id,
      },
      tx,
    );
    return link;
  });
}

export async function verifyDeliveryPreparation(
  projectId: string,
  noticePackageId: string,
  preparationId: string,
  input?: { selectedMethod?: string; emailAddress?: string; physicalAddress?: string },
) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.update');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const prep = await tx.noticeDeliveryPreparation.findFirst({
      where: { id: preparationId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!prep) throw notFound();

    const updated = await tx.noticeDeliveryPreparation.update({
      where: { id: prep.id },
      data: {
        verificationStatus: 'VERIFIED',
        reviewerApproved: true,
        selectedMethod: input?.selectedMethod ?? prep.selectedMethod ?? prep.permittedMethod,
        emailAddress: input?.emailAddress ?? prep.emailAddress,
        physicalAddress: input?.physicalAddress ?? prep.physicalAddress,
      },
    });

    await tx.noticeEvidenceRequirement.updateMany({
      where: {
        noticePackageId,
        category: { in: ['RECIPIENT', 'DELIVERY_METHOD'] },
      },
      data: { satisfactionStatus: 'SATISFIED' },
    });

    return updated;
  });
}

export async function createReviewQuestion(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_question.create');
  const parsed = CreateQuestionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid question', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    return tx.noticeReviewQuestion.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        category: parsed.data.category,
        questionText: parsed.data.questionText,
        reason: parsed.data.reason,
        relatedEvidenceRequirementId: parsed.data.relatedEvidenceRequirementId,
        answerType: parsed.data.answerType,
        priority: parsed.data.priority,
        raisedByUserId: ctx.user.id,
      },
    });
  });
}

export async function answerReviewQuestion(
  projectId: string,
  noticePackageId: string,
  questionId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_question.answer');
  const parsed = AnswerQuestionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid answer', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const question = await tx.noticeReviewQuestion.findFirst({
      where: { id: questionId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!question) throw notFound();
    if (question.status !== 'OPEN') throw conflict('Question is not open');

    return tx.noticeReviewQuestion.update({
      where: { id: question.id },
      data: {
        responseText: parsed.data.responseText,
        status: 'ANSWERED',
        answeredByUserId: ctx.user.id,
        answeredAt: new Date(),
      },
    });
  });
}

export async function verifyQuestionAnswer(
  projectId: string,
  noticePackageId: string,
  questionId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const question = await tx.noticeReviewQuestion.findFirst({
      where: { id: questionId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!question) throw notFound();
    if (!question.responseText) throw validationError('Question has no answer to verify');

    return tx.noticeReviewQuestion.update({
      where: { id: question.id },
      data: {
        responseVerified: true,
        reviewedByUserId: ctx.user.id,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  });
}

export async function createNoticeFact(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_fact.create');
  const parsed = CreateFactSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid fact', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    return tx.noticeFact.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        factType: parsed.data.factType,
        label: parsed.data.label,
        value: parsed.data.value,
        sourceType: parsed.data.sourceType,
        reviewerEntered: parsed.data.sourceType === 'REVIEWER_ENTERED',
      },
    });
  });
}

export async function verifyNoticeFact(
  projectId: string,
  noticePackageId: string,
  factId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_fact.verify');
  const parsed = VerifyFactSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid verification', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const fact = await tx.noticeFact.findFirst({
      where: { id: factId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!fact) throw notFound();

    const updated = await tx.noticeFact.update({
      where: { id: fact.id },
      data: {
        verificationStatus: parsed.data.verificationStatus,
        approvedForDrafting: parsed.data.approvedForDrafting,
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
      },
    });

    if (parsed.data.approvedForDrafting) {
      const categoryMap: Partial<Record<string, string>> = {
        EVENT_DATE: 'TRIGGER_DATE',
        AWARENESS_DATE: 'TRIGGER_DATE',
        DESCRIPTION_OF_EVENT: 'EVENT_OCCURRENCE',
      };
      const cat = categoryMap[fact.factType];
      if (cat) {
        await tx.noticeEvidenceRequirement.updateMany({
          where: { noticePackageId, category: cat as 'EVENT_OCCURRENCE' | 'TRIGGER_DATE' },
          data: { satisfactionStatus: 'SATISFIED' },
        });
      }
    }

    return updated;
  });
}

export async function generateDeterministicDraft(projectId: string, noticePackageId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.generate');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    const draftCtx = await buildDraftContext(tx, pkg);
    const assembled = assembleDeterministicDraft(draftCtx);

    const maxRev = await tx.noticeDraftRevision.aggregate({
      where: { noticePackageId },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;
    const latestAssessment = pkg.completenessAssessments[0];

    const revision = await tx.noticeDraftRevision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        revisionNumber,
        status: 'DRAFT',
        language: pkg.language,
        templateVersion: assembled.templateVersion,
        generatedBy: 'deterministic',
        generatorVersion: assembled.generatorVersion,
        basedOnEvidenceAssessmentRevision: latestAssessment?.assessmentRevision,
        basedOnRequirementSnapshotId: pkg.requirementSnapshots[0]?.id,
        createdByUserId: ctx.user.id,
      },
    });

    await tx.noticeDraftSection.createMany({
      data: sectionsToDb(assembled.sections, { tenantId: ctx.tenantId }, projectId, revision.id),
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'DRAFTING' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_draft.generate',
        entityType: 'notice_draft_revision',
        entityId: revision.id,
        metadata: { deterministic: true, revisionNumber },
      },
      tx,
    );

    return tx.noticeDraftRevision.findFirstOrThrow({
      where: { id: revision.id },
      include: { sections: { orderBy: { sequence: 'asc' } } },
    });
  });
}

export async function generateAiAssistedDraft(projectId: string, noticePackageId: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.generate');
  const provider = createNoticeDraftAiProvider();
  if (!provider) throw validationError('AI provider not configured');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    const approvedFacts = pkg.facts.filter(
      (f) =>
        f.approvedForDrafting &&
        (f.verificationStatus === 'EVIDENCE_BACKED' || f.verificationStatus === 'HUMAN_CONFIRMED'),
    );
    if (approvedFacts.length === 0) throw validationError('No facts approved for drafting');

    const reqSnap = pkg.requirementSnapshots[0];
    const aiResponse = await provider.draftNotice({
      language: pkg.language as 'en' | 'ar',
      noticeType: pkg.noticeType,
      title: pkg.title,
      approvedFacts: approvedFacts.map((f) => ({
        id: f.id,
        factType: f.factType,
        label: f.label,
        value: f.value,
      })),
      approvedDeadlineIso: reqSnap?.verifiedDeadlineAt?.toISOString() ?? null,
      promptSchemaVersion: 'v1',
    });

    const validated = validateNoticeAiDraftOutput({
      response: aiResponse,
      allowedFactIds: new Set(pkg.facts.map((f) => f.id)),
      allowedEvidenceIds: new Set(
        (
          await tx.noticeEvidenceLink.findMany({
            where: { noticePackageId },
            select: { id: true },
          })
        ).map((l) => l.id),
      ),
      allowedClauseIds: new Set(reqSnap?.sourceClauseId ? [reqSnap.sourceClauseId] : []),
      approvedDeadlineIso: reqSnap?.verifiedDeadlineAt?.toISOString() ?? null,
      approvedFactValuesByType: new Map(approvedFacts.map((f) => [f.factType, f.value])),
    });
    if (!validated.ok) throw validationError('AI draft rejected', validated.errors);

    const maxRev = await tx.noticeDraftRevision.aggregate({
      where: { noticePackageId },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;
    const isTest = process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test';

    const revision = await tx.noticeDraftRevision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        revisionNumber,
        status: 'DRAFT',
        language: pkg.language,
        templateVersion: 'ai-assisted-v1',
        generatedBy: 'ai-assisted',
        generatorVersion: provider.name,
        promptVersion: null,
        providerMetadata: isTest
          ? { provider: provider.name, testOnly: provider.testOnly }
          : undefined,
        createdByUserId: ctx.user.id,
      },
    });

    await tx.noticeDraftSection.createMany({
      data: validated.data.sections.map((s, i) => ({
        tenantId: ctx.tenantId,
        projectId,
        draftRevisionId: revision.id,
        sectionType: s.sectionType,
        sequence: i + 1,
        heading: s.sectionType.replace(/_/g, ' '),
        body: s.draftedText,
        language: validated.data.language,
        sourceFactIds: s.sourceFactIds,
        sourceEvidenceRefs: s.sourceEvidenceIds,
        sourceClauseRefs: s.sourceClauseIds,
        machineGenerated: true,
        humanEdited: false,
        warnings: s.warnings,
      })),
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'DRAFTING' },
    });

    return tx.noticeDraftRevision.findFirstOrThrow({
      where: { id: revision.id },
      include: { sections: { orderBy: { sequence: 'asc' } } },
    });
  });
}

export async function editDraftSection(
  projectId: string,
  noticePackageId: string,
  revisionId: string,
  sectionId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.edit');
  const parsed = EditSectionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid section edit', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = await tx.noticeDraftRevision.findFirst({
      where: { id: revisionId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!revision) throw notFound();
    if (revision.status === 'APPROVED') throw conflict('Approved revisions are immutable');

    const section = await tx.noticeDraftSection.findFirst({
      where: { id: sectionId, draftRevisionId: revisionId },
    });
    if (!section) throw notFound();

    return tx.noticeDraftSection.update({
      where: { id: section.id },
      data: {
        body: stripHtml(parsed.data.body),
        humanEdited: true,
        machineGenerated: false,
      },
    });
  });
}

async function buildValidationInput(
  tx: Prisma.TransactionClient,
  pkg: Awaited<ReturnType<typeof loadPackage>>,
  revisionId: string,
) {
  const revision = await tx.noticeDraftRevision.findFirstOrThrow({
    where: { id: revisionId },
    include: { sections: true },
  });
  const calc = await tx.deadlineCalculation.findFirstOrThrow({
    where: { id: pkg.deadlineCalculationId },
  });
  const reqSnap = pkg.requirementSnapshots[0];
  const completeness = pkg.completenessAssessments[0];
  const openQuestions = await tx.noticeReviewQuestion.count({
    where: { noticePackageId: pkg.id, status: 'OPEN', priority: { in: ['HIGH', 'CRITICAL'] } },
  });
  const exceptions = await tx.noticeControlledException.count({
    where: { noticePackageId: pkg.id },
  });
  const unapproved = revision.sections.flatMap((s) => {
    const ids = Array.isArray(s.sourceFactIds) ? (s.sourceFactIds as string[]) : [];
    return ids;
  });
  const factMap = new Map(pkg.facts.map((f) => [f.id, f]));
  const unapprovedCount = unapproved.filter((id) => {
    const f = factMap.get(id);
    return f && !f.approvedForDrafting;
  }).length;

  return validateNoticeDraft({
    contractPackageId: pkg.contractPackageId,
    expectedContractPackageId: pkg.contractPackageId,
    configurationRevisionId: pkg.configurationRevisionId,
    expectedConfigurationRevisionId: pkg.configurationRevisionId,
    approvedRuleSnapshotId: pkg.approvedNoticeRuleSnapshotId,
    expectedApprovedRuleSnapshotId: pkg.approvedNoticeRuleSnapshotId,
    projectEventId: pkg.projectEventId,
    expectedProjectEventId: pkg.projectEventId,
    calculationStatus: calc.calculationStatus,
    calculationId: calc.id,
    expectedCalculationId: calc.id,
    hasVerifiedTriggerDate: pkg.facts.some(
      (f) =>
        f.approvedForDrafting &&
        ['EVENT_DATE', 'INSTRUCTION_DATE', 'AWARENESS_DATE'].includes(f.factType),
    ),
    hasVerifiedDeadline: Boolean(reqSnap?.verifiedDeadlineAt),
    clauseReferencePresent: Boolean(reqSnap?.sourceClauseReference),
    language: revision.language,
    requiredLanguage: pkg.language,
    recipients: pkg.deliveryPreparations.map((r) => ({
      verificationStatus: r.verificationStatus,
      copiedRecipient: r.copiedRecipient,
      hasContact: Boolean(r.emailAddress || r.physicalAddress || r.platformAddress),
      selectedMethod: r.selectedMethod,
      permittedMethod: r.permittedMethod,
    })),
    openBlockingQuestions: openQuestions,
    completenessStatus: mapDbCompleteness(
      (completeness?.completenessStatus ?? 'NOT_ASSESSED') as
        | 'NOT_ASSESSED'
        | 'INCOMPLETE'
        | 'CONDITIONALLY_READY'
        | 'READY'
        | 'BLOCKED',
    ),
    unapprovedFactsInDraft: unapprovedCount,
    hasInternalOnlyInExportCandidate: revision.sections.some(
      (s) => !s.internalOnly && /\[INTERNAL\]|INTERNAL ONLY/i.test(s.body),
    ),
    controlledExceptionsForBlockers: exceptions,
    nonWaivableBlockers: [],
    staleEvidenceAssessment: false,
    supersededCalculation: calc.calculationStatus === 'SUPERSEDED',
    reservationPresent: revision.sections.some((s) => s.sectionType === 'RESERVATION_OF_RIGHTS'),
    reservationRequired: true,
    attachmentMissingRequired: false,
  });
}

export async function runDraftValidation(
  projectId: string,
  noticePackageId: string,
  revisionId?: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    const revision =
      revisionId != null
        ? await tx.noticeDraftRevision.findFirstOrThrow({
            where: { id: revisionId, noticePackageId },
          })
        : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();

    const validation = await buildValidationInput(tx, pkg, revision.id);
    await tx.noticeDraftRevision.update({
      where: { id: revision.id },
      data: { validationSnapshot: validation as unknown as Prisma.InputJsonValue },
    });
    return validation;
  });
}

export async function submitDraftForReview(
  projectId: string,
  noticePackageId: string,
  rawInput?: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.submit');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid submit input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    const revision = parsed.data.draftRevisionId
      ? await tx.noticeDraftRevision.findFirstOrThrow({
          where: { id: parsed.data.draftRevisionId, noticePackageId },
        })
      : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();
    if (revision.status === 'APPROVED') throw conflict('Revision already approved');

    const validation = await buildValidationInput(tx, pkg, revision.id);
    if (!validation.ok)
      throw validationError('Draft validation has blocking issues', validation.blocking);

    await tx.noticeDraftRevision.update({
      where: { id: revision.id },
      data: {
        status: 'IN_REVIEW',
        submittedAt: new Date(),
        validationSnapshot: validation as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.noticeApprovalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: revision.id,
        decision: 'SUBMITTED',
        actorUserId: ctx.user.id,
        rationale: parsed.data.rationale,
        validationSnapshot: validation as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'IN_REVIEW' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_draft.submit',
        entityType: 'notice_draft_revision',
        entityId: revision.id,
      },
      tx,
    );
    return revision;
  });
}

export async function requestDraftChanges(
  projectId: string,
  noticePackageId: string,
  rawInput?: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = parsed.data.draftRevisionId
      ? await tx.noticeDraftRevision.findFirstOrThrow({
          where: { id: parsed.data.draftRevisionId, noticePackageId },
        })
      : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();

    await tx.noticeDraftRevision.update({
      where: { id: revision.id },
      data: { status: 'CHANGES_REQUESTED' },
    });
    await tx.noticeApprovalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: revision.id,
        decision: 'CHANGES_REQUESTED',
        actorUserId: ctx.user.id,
        rationale: parsed.data.rationale,
      },
    });
    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'CHANGES_REQUESTED' },
    });
    return revision;
  });
}

export async function recommendApproval(
  projectId: string,
  noticePackageId: string,
  rawInput?: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = parsed.data.draftRevisionId
      ? await tx.noticeDraftRevision.findFirstOrThrow({
          where: { id: parsed.data.draftRevisionId, noticePackageId },
        })
      : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();

    await tx.noticeApprovalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: revision.id,
        decision: 'RECOMMENDED_FOR_APPROVAL',
        actorUserId: ctx.user.id,
        rationale: parsed.data.rationale,
      },
    });
    return revision;
  });
}

export async function approveDraft(projectId: string, noticePackageId: string, rawInput?: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.approve');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid approval', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.noticePackage.findFirstOrThrow({
      where: { id: noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    const revision = parsed.data.draftRevisionId
      ? await tx.noticeDraftRevision.findFirstOrThrow({
          where: { id: parsed.data.draftRevisionId, noticePackageId },
        })
      : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();
    if (revision.status === 'APPROVED') throw conflict('Already approved');

    if (pkg.sodEnforced) {
      if (pkg.createdByUserId === ctx.user.id) {
        throw forbidden('Segregation of duties: approver must differ from package creator');
      }
      if (revision.createdByUserId === ctx.user.id) {
        throw forbidden('Segregation of duties: approver must differ from draft author');
      }
    }

    const validation = await buildValidationInput(
      tx,
      await loadPackage(tx, ctx.tenantId, projectId, noticePackageId),
      revision.id,
    );
    if (!validation.ok)
      throw validationError('Cannot approve draft with blocking validation issues');

    if (pkg.activeApprovedRevisionId) {
      await tx.noticeDraftRevision.update({
        where: { id: pkg.activeApprovedRevisionId },
        data: { status: 'SUPERSEDED' },
      });
    }

    const approved = await tx.noticeDraftRevision.update({
      where: { id: revision.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    const decision = await tx.noticeApprovalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: revision.id,
        decision: 'APPROVED',
        actorUserId: ctx.user.id,
        rationale: parsed.data.rationale,
        validationSnapshot: validation as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: {
        status: 'APPROVED',
        activeApprovedRevisionId: revision.id,
        approverUserId: ctx.user.id,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_draft.approve',
        entityType: 'notice_draft_revision',
        entityId: approved.id,
        metadata: { decisionId: decision.id },
      },
      tx,
    );

    return { revision: approved, decision };
  });
}

export async function rejectDraft(projectId: string, noticePackageId: string, rawInput?: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.reject');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid rejection', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = parsed.data.draftRevisionId
      ? await tx.noticeDraftRevision.findFirstOrThrow({
          where: { id: parsed.data.draftRevisionId, noticePackageId },
        })
      : await loadLatestDraft(tx, noticePackageId);
    if (!revision) throw notFound();

    await tx.noticeDraftRevision.update({
      where: { id: revision.id },
      data: { status: 'WITHDRAWN' },
    });
    await tx.noticeApprovalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: revision.id,
        decision: 'REJECTED',
        actorUserId: ctx.user.id,
        rationale: parsed.data.rationale,
      },
    });
    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'DRAFTING' },
    });
    return revision;
  });
}

export async function withdrawNoticePackage(
  projectId: string,
  noticePackageId: string,
  rawInput?: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_package.withdraw');
  const parsed = ApprovalSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid withdraw input', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    if (pkg.status === 'WITHDRAWN') throw conflict('Already withdrawn');
    if (pkg.status === 'SENT') throw validationError('Cannot withdraw sent notices in this slice');

    const updated = await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'WITHDRAWN' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_package.withdraw',
        entityType: 'notice_package',
        entityId: noticePackageId,
        metadata: { rationale: parsed.data.rationale },
      },
      tx,
    );
    return updated;
  });
}

export async function createControlledException(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_exception.approve');
  const parsed = ExceptionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid exception', parsed.error.flatten());
  if (isNonWaivableException(parsed.data.issueCategory)) {
    throw validationError(`Non-waivable exception: ${parsed.data.issueCategory}`);
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    return tx.noticeControlledException.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        issueCategory: parsed.data.issueCategory,
        description: parsed.data.description,
        risk: parsed.data.risk,
        rationale: parsed.data.rationale,
        approvedByUserId: ctx.user.id,
      },
    });
  });
}

export async function addAttachment(projectId: string, noticePackageId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'notice_attachment.manage');
  const parsed = AttachmentSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid attachment', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    if (parsed.data.documentVersionId) {
      const version = await tx.documentVersion.findFirst({
        where: { id: parsed.data.documentVersionId, tenantId: ctx.tenantId, projectId },
      });
      if (!version) throw validationError('Document version not in project');
    }
    const maxSeq = await tx.noticeAttachment.aggregate({
      where: { noticePackageId },
      _max: { sequence: true },
    });
    return tx.noticeAttachment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        externalFilename: parsed.data.externalFilename,
        category: parsed.data.category,
        description: parsed.data.description,
        sourceDocumentId: parsed.data.sourceDocumentId,
        documentVersionId: parsed.data.documentVersionId,
        sequence: (maxSeq._max.sequence ?? 0) + 1,
        addedByUserId: ctx.user.id,
      },
    });
  });
}

export async function setAttachmentInclusion(
  projectId: string,
  noticePackageId: string,
  attachmentId: string,
  inclusionStatus: 'INCLUDED' | 'EXCLUDED' | 'PROPOSED',
) {
  const ctx = await requireProjectCapability(projectId, 'notice_attachment.manage');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const attachment = await tx.noticeAttachment.findFirst({
      where: { id: attachmentId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!attachment) throw notFound();
    return tx.noticeAttachment.update({
      where: { id: attachment.id },
      data: { inclusionStatus, reviewedByUserId: ctx.user.id },
    });
  });
}

export async function generateExport(projectId: string, noticePackageId: string, format?: string) {
  const ctx = await requireProjectCapability(projectId, 'notice_export.generate');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.noticePackage.findFirst({
      where: { id: noticePackageId, tenantId: ctx.tenantId, projectId },
      include: {
        activeApprovedRevision: { include: { sections: { orderBy: { sequence: 'asc' } } } },
        deliveryPreparations: true,
        attachments: { where: { inclusionStatus: 'INCLUDED' } },
        approvalDecisions: {
          where: { decision: 'APPROVED' },
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!pkg) throw notFound();
    if (!pkg.activeApprovedRevision) {
      throw validationError('No active approved revision — export requires approval');
    }
    if (pkg.status !== 'APPROVED' && pkg.status !== 'EXPORTED') {
      throw validationError('Package must be approved before export');
    }

    const revision = pkg.activeApprovedRevision;
    const sections: AssembledSection[] = revision.sections.map((s) => ({
      sectionType: s.sectionType as AssembledSection['sectionType'],
      sequence: s.sequence,
      heading: s.heading,
      body: s.body,
      language: s.language,
      sourceFactIds: Array.isArray(s.sourceFactIds) ? (s.sourceFactIds as string[]) : [],
      sourceEvidenceIds: Array.isArray(s.sourceEvidenceRefs)
        ? (s.sourceEvidenceRefs as string[])
        : [],
      sourceClauseIds: Array.isArray(s.sourceClauseRefs) ? (s.sourceClauseRefs as string[]) : [],
      machineGenerated: s.machineGenerated,
      humanEdited: s.humanEdited,
      internalOnly: s.internalOnly,
      warnings: Array.isArray(s.warnings) ? (s.warnings as string[]) : [],
    }));

    const exported = exportApprovedNotice({
      title: pkg.title,
      sections,
      noticePackageId: pkg.id,
      draftRevisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      language: revision.language,
      generatorVersion: revision.generatorVersion,
      attachments: pkg.attachments.map((a) => ({
        id: a.id,
        filename: a.externalFilename,
        content: Buffer.from(`Attachment placeholder: ${a.externalFilename}`, 'utf8'),
        checksumSha256: a.checksumSha256,
        sequence: a.sequence,
      })),
      recipientPreparationIds: pkg.deliveryPreparations.map((r) => r.id),
      approvalDecisionId: pkg.approvalDecisions[0]?.id ?? null,
      approvedAt: revision.approvedAt?.toISOString() ?? null,
    });

    const bundles = [
      { format: 'PDF' as const, bytes: exported.pdf, checksum: exported.pdfChecksum },
      { format: 'DOCX' as const, bytes: exported.docx, checksum: exported.docxChecksum },
      {
        format: 'JSON_MANIFEST' as const,
        bytes: Buffer.from(JSON.stringify(exported.manifest), 'utf8'),
        checksum: exported.manifest.checksumSha256,
      },
      {
        format: 'PLAIN_TEXT' as const,
        bytes: Buffer.from(exported.plainText, 'utf8'),
        checksum: exported.manifest.checksumSha256,
      },
      { format: 'ATTACHMENT_ZIP' as const, bytes: exported.zip, checksum: exported.zipChecksum },
    ].filter((b) => !format || b.format === format);

    const created = [];
    for (const b of bundles) {
      const row = await tx.noticeExportBundle.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          noticePackageId,
          draftRevisionId: revision.id,
          format: b.format,
          artifactChecksum: b.checksum,
          storageKey: null,
          artifactBytes: b.bytes.length,
          manifest: {
            ...(b.format === 'JSON_MANIFEST'
              ? exported.manifest
              : { plainText: exported.plainText }),
            format: b.format,
          },
          templateVersion: revision.templateVersion,
          generatedByUserId: ctx.user.id,
          language: revision.language,
        },
      });
      created.push(row);
    }

    await tx.noticePackage.update({
      where: { id: noticePackageId },
      data: { status: 'EXPORTED' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_export.generate',
        entityType: 'notice_package',
        entityId: noticePackageId,
        metadata: { formats: created.map((c) => c.format), deliveryAuthorized: false },
      },
      tx,
    );

    assertNoSendOperations();
    return { bundles: created, plainText: exported.plainText, manifest: exported.manifest };
  });
}

export async function addReviewComment(
  projectId: string,
  noticePackageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  const parsed = CommentSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid comment', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await loadPackage(tx, ctx.tenantId, projectId, noticePackageId);
    return tx.noticeReviewComment.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        noticePackageId,
        draftRevisionId: parsed.data.draftRevisionId,
        sectionId: parsed.data.sectionId,
        commentType: parsed.data.commentType,
        commentText: parsed.data.commentText,
        internalOnly: parsed.data.internalOnly,
        raisedByUserId: ctx.user.id,
      },
    });
  });
}

export async function resolveReviewComment(
  projectId: string,
  noticePackageId: string,
  commentId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'notice_draft.review');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const comment = await tx.noticeReviewComment.findFirst({
      where: { id: commentId, noticePackageId, tenantId: ctx.tenantId, projectId },
    });
    if (!comment) throw notFound();
    return tx.noticeReviewComment.update({
      where: { id: comment.id },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: ctx.user.id,
        resolvedAt: new Date(),
      },
    });
  });
}

// Alias expected by task spec
export { assessEvidenceCompletenessForPackage as assessEvidenceCompleteness };
