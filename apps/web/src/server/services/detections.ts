import {
  DETECTOR_RULESET_VERSION,
  mapDetectionCategoryToProjectEventCategory,
  quoteChecksum,
  runAllDetectors,
  type DetectionCategory,
  type EvidenceSegmentInput,
} from '@contractradar/event-detection';
import type { Prisma, ProjectEventCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { writeAuditLog } from '@/server/audit';
import { requireProjectCapability } from '@/server/authz/context';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, notFound, validationError } from '@/server/errors';

const StartDetectionRunSchema = z.object({
  runType: z.enum([
    'MANUAL_HISTORICAL_SCAN',
    'DOCUMENT_RESCAN',
    'PROJECT_INCREMENTAL_SCAN',
    'FUTURE_LIVE_MONITORING',
  ]),
  analysisProfile: z
    .enum([
      'DETERMINISTIC_ONLY',
      'HYBRID_STANDARD',
      'HYBRID_ARABIC_ENGLISH',
      'PAYMENT_FOCUSED',
      'ACCESS_DELAY_FOCUSED',
      'CHANGE_FOCUSED',
    ])
    .default('DETERMINISTIC_ONLY'),
  documentVersionIds: z.array(z.string().uuid()).max(500).optional(),
});

const AcceptSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  eventCategory: z
    .enum([
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
    ])
    .optional(),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
  acceptedDateSuggestionIds: z.array(z.string().uuid()).max(20).default([]),
  rationale: z.string().trim().max(5000).optional(),
});

function assertProjectMutable(status: string) {
  if (status === 'ARCHIVED') {
    throw conflict('Archived projects are read-only');
  }
}

export async function startDetectionRun(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'detection_run.create');
  const parsed = StartDetectionRunSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid detection run', parsed.error.flatten());

  if (parsed.data.runType === 'FUTURE_LIVE_MONITORING') {
    throw validationError('FUTURE_LIVE_MONITORING is not available in this slice');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, tenantId: ctx.tenantId },
    });
    if (!project) throw notFound();
    assertProjectMutable(project.status);

    const correlationId = randomUUID();
    // Slice 5 executes DETERMINISTIC_ONLY even if a hybrid profile was requested.
    const run = await tx.projectEventDetectionRun.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        analysisProfile: 'DETERMINISTIC_ONLY',
        status: 'RUNNING',
        runType: parsed.data.runType,
        sourceDocumentVersionIds: parsed.data.documentVersionIds ?? undefined,
        startedByUserId: ctx.user.id,
        processorName: 'event-detection-orchestrator',
        processorVersion: 'slice5-v1',
        rulesetVersion: DETECTOR_RULESET_VERSION,
        correlationId,
        startedAt: new Date(),
      },
    });

    const versionFilter =
      parsed.data.documentVersionIds && parsed.data.documentVersionIds.length > 0
        ? { id: { in: parsed.data.documentVersionIds } }
        : {};

    const versions = await tx.documentVersion.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        uploadStatus: 'ACCEPTED',
        malwareScanStatus: 'CLEAN',
        ...versionFilter,
        sourceDocument: {
          status: { in: ['READY', 'PARTIALLY_PROCESSED'] },
        },
      },
      include: {
        sourceDocument: true,
        segments: { orderBy: { ordinal: 'asc' }, take: 50 },
      },
      take: 200,
    });

    const segmentInputs: EvidenceSegmentInput[] = [];
    for (const version of versions) {
      for (const segment of version.segments) {
        if (!segment.textContent?.trim()) continue;
        segmentInputs.push({
          id: segment.id,
          documentVersionId: version.id,
          sourceDocumentId: version.sourceDocumentId,
          documentType: version.sourceDocument.documentType,
          text: segment.textContent.slice(0, 50_000),
          language: (segment.language as EvidenceSegmentInput['language']) ?? 'UNKNOWN',
          sourceTimestamp: null,
          sourceTimezone: project.timezone,
        });
      }
    }

    const findings = runAllDetectors({ segments: segmentInputs });
    const warnings: string[] = [];
    if (parsed.data.analysisProfile !== 'DETERMINISTIC_ONLY') {
      warnings.push(
        'Hybrid AI profiles are configured but this run executed DETERMINISTIC_ONLY detectors; AI assist is optional and did not confirm facts.',
      );
    }

    // Active approved rule snapshots for advisory matching only.
    const packages = await tx.contractPackage.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        currentConfigurationRevisionId: { not: null },
      },
      select: { id: true, currentConfigurationRevisionId: true },
    });
    const revisionIds = packages
      .map((p) => p.currentConfigurationRevisionId)
      .filter((id): id is string => Boolean(id));
    const snapshots =
      revisionIds.length === 0
        ? []
        : await tx.approvedNoticeRuleSnapshot.findMany({
            where: {
              tenantId: ctx.tenantId,
              projectId,
              configurationRevisionId: { in: revisionIds },
            },
          });

    let suggestionsCreated = 0;
    for (const finding of findings) {
      const primarySeg = finding.evidence[0];
      const version = versions.find((v) => v.segments.some((s) => s.id === primarySeg?.segmentId));
      if (!version || !primarySeg) continue;

      const suggestion = await tx.projectEventSuggestion.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          detectionRunId: run.id,
          eventCategory: finding.category,
          eventSubcategory: finding.subcategory,
          suggestedTitle: finding.title,
          suggestedDescription: finding.description,
          confidenceBand: finding.confidenceBand,
          confidenceExplanation: finding.confidenceExplanation,
          interpretationSummary: finding.inferences.join(' | ') || null,
          factsSummary: finding.facts.join(' | '),
          assumptions: finding.assumptions,
          ambiguities: finding.ambiguities,
          missingEvidenceSummary: finding.missingEvidence,
          contradictions: finding.contradictions,
          detectorSource: 'DETERMINISTIC',
          status: 'PENDING_REVIEW',
        },
      });
      suggestionsCreated += 1;

      let seq = 0;
      for (const ev of finding.evidence) {
        const seg = versions.flatMap((v) => v.segments).find((s) => s.id === ev.segmentId);
        const ver = versions.find((v) => v.segments.some((s) => s.id === ev.segmentId));
        if (!seg || !ver) continue;
        await tx.projectEventSuggestionEvidence.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            suggestionId: suggestion.id,
            sourceDocumentId: ver.sourceDocumentId,
            documentVersionId: ver.id,
            evidenceSegmentId: seg.id,
            evidenceRole: ev.role,
            relevanceExplanation: ev.explanation,
            selectedQuote: ev.quote,
            quoteChecksum: quoteChecksum(ev.quote),
            extractionMethod: 'DETERMINISTIC_PHRASE_V1',
            confidenceBand: finding.confidenceBand,
            sequence: seq,
          },
        });
        seq += 1;
      }

      for (const date of finding.dateCandidates) {
        await tx.projectEventDateSuggestion.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            suggestionId: suggestion.id,
            dateType: date.dateType,
            suggestedValue: date.suggestedValue ? new Date(date.suggestedValue) : null,
            timezone: date.timezone,
            precision: date.precision,
            evidenceSegmentId: date.segmentId,
            extractionText: date.extractionText,
            basis: date.basis,
            ambiguity: date.ambiguity,
            status: 'PENDING_REVIEW',
          },
        });
      }

      for (const gap of finding.missingEvidence) {
        await tx.detectionEvidenceGap.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            suggestionId: suggestion.id,
            gapCode: gap.code,
            description: gap.description,
            whyItMatters: gap.whyItMatters,
            suggestedSourceType: gap.suggestedSourceType,
            priority: gap.priority,
            status: 'OPEN',
          },
        });
      }

      // Advisory rule candidates only — never mark APPLICABLE or calculate deadlines here.
      const mappedEventCategory = mapDetectionCategoryToProjectEventCategory(
        finding.category,
        finding.subcategory,
      );
      const ranked = [...snapshots]
        .map((snap) => {
          const notice = (snap.noticeCategory ?? '').toUpperCase();
          let score = 0;
          if (
            notice &&
            (notice.includes(mappedEventCategory) || mappedEventCategory.includes(notice))
          ) {
            score += 3;
          }
          if (snap.triggerBasis) score += 1;
          return { snap, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      for (const { snap, score } of ranked) {
        await tx.suggestionRuleCandidate.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            suggestionId: suggestion.id,
            approvedRuleSnapshotId: snap.id,
            matchReason:
              score > 0
                ? 'Ranked against active approved configuration for human review only — advisory, not applicable.'
                : 'Active approved configuration snapshot listed for human review only — not applicable yet.',
            matchedCategory: finding.category,
            matchedTriggerType: snap.triggerBasis,
            sourceClauseId: snap.sourceClauseId,
            confidenceBand: score >= 3 ? 'MEDIUM' : 'LOW',
            status: 'CANDIDATE',
          },
        });
      }
    }

    const completed = await tx.projectEventDetectionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        documentsConsidered: versions.length,
        segmentsConsidered: segmentInputs.length,
        suggestionsCreated,
        warnings: warnings.length ? warnings : undefined,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'detection_run.completed',
        entityType: 'project_event_detection_run',
        entityId: run.id,
        metadata: {
          suggestionsCreated,
          documentsConsidered: versions.length,
          rulesetVersion: DETECTOR_RULESET_VERSION,
          correlationId,
        },
      },
      tx,
    );

    return completed;
  });
}

export async function listDetectionRuns(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'detection_run.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectEventDetectionRun.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { queuedAt: 'desc' },
      take: 50,
    }),
  );
}

export async function getDetectionRun(projectId: string, runId: string) {
  const ctx = await requireProjectCapability(projectId, 'detection_run.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const run = await tx.projectEventDetectionRun.findFirst({
      where: { id: runId, tenantId: ctx.tenantId, projectId },
    });
    if (!run) throw notFound();
    return run;
  });
}

export async function listSuggestions(
  projectId: string,
  filters?: { status?: string; detectionRunId?: string },
) {
  const ctx = await requireProjectCapability(projectId, 'event_suggestion.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectEventSuggestion.findMany({
      where: {
        tenantId: ctx.tenantId,
        projectId,
        ...(filters?.status
          ? { status: filters.status as Prisma.EnumProjectEventSuggestionStatusFilter }
          : {}),
        ...(filters?.detectionRunId ? { detectionRunId: filters.detectionRunId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: {
          select: {
            evidenceLinks: true,
            dateSuggestions: true,
            evidenceGaps: true,
            ruleCandidates: true,
          },
        },
      },
    }),
  );
}

export async function getSuggestion(projectId: string, suggestionId: string) {
  const ctx = await requireProjectCapability(projectId, 'event_suggestion.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const suggestion = await tx.projectEventSuggestion.findFirst({
      where: { id: suggestionId, tenantId: ctx.tenantId, projectId },
      include: {
        evidenceLinks: { orderBy: { sequence: 'asc' } },
        dateSuggestions: true,
        evidenceGaps: true,
        ruleCandidates: true,
        reviewerFeedback: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!suggestion) throw notFound();
    return suggestion;
  });
}

export async function rejectSuggestion(projectId: string, suggestionId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'event_suggestion.reject');
  const parsed = z
    .object({
      reason: z.string().trim().min(1).max(2000),
      falsePositiveReason: z.string().trim().max(200).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid rejection', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const suggestion = await tx.projectEventSuggestion.findFirst({
      where: { id: suggestionId, tenantId: ctx.tenantId, projectId },
    });
    if (!suggestion) throw notFound();
    if (suggestion.status !== 'PENDING_REVIEW' && suggestion.status !== 'NEEDS_MORE_EVIDENCE') {
      throw conflict(`Cannot reject suggestion in status ${suggestion.status}`);
    }

    const updated = await tx.projectEventSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'REJECTED',
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      },
    });

    await tx.detectionReviewerFeedback.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        suggestionId: suggestion.id,
        authorUserId: ctx.user.id,
        decision: 'REJECTED',
        falsePositiveReason: parsed.data.falsePositiveReason,
        notes: parsed.data.reason,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'event_suggestion.rejected',
        entityType: 'project_event_suggestion',
        entityId: suggestion.id,
        metadata: { reason: parsed.data.reason },
      },
      tx,
    );

    return updated;
  });
}

export async function requestMoreEvidence(
  projectId: string,
  suggestionId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'event_suggestion.request_evidence');
  const parsed = z.object({ note: z.string().trim().min(1).max(2000) }).safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid request', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const suggestion = await tx.projectEventSuggestion.findFirst({
      where: { id: suggestionId, tenantId: ctx.tenantId, projectId },
    });
    if (!suggestion) throw notFound();

    const updated = await tx.projectEventSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'NEEDS_MORE_EVIDENCE',
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      },
    });

    await tx.detectionReviewerFeedback.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        suggestionId: suggestion.id,
        authorUserId: ctx.user.id,
        decision: 'NEEDS_MORE_EVIDENCE',
        notes: parsed.data.note,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'event_suggestion.request_evidence',
        entityType: 'project_event_suggestion',
        entityId: suggestion.id,
      },
      tx,
    );

    return updated;
  });
}

export async function acceptSuggestion(projectId: string, suggestionId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'event_suggestion.accept');
  const parsed = AcceptSuggestionSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid acceptance', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, tenantId: ctx.tenantId },
    });
    if (!project) throw notFound();
    assertProjectMutable(project.status);

    const suggestion = await tx.projectEventSuggestion.findFirst({
      where: { id: suggestionId, tenantId: ctx.tenantId, projectId },
      include: {
        evidenceLinks: true,
        dateSuggestions: true,
      },
    });
    if (!suggestion) throw notFound();

    if (suggestion.status === 'ACCEPTED' && suggestion.acceptedProjectEventId) {
      const existing = await tx.projectEvent.findFirstOrThrow({
        where: { id: suggestion.acceptedProjectEventId },
      });
      return { suggestion, projectEvent: existing, idempotent: true as const };
    }

    if (suggestion.status !== 'PENDING_REVIEW' && suggestion.status !== 'NEEDS_MORE_EVIDENCE') {
      throw conflict(`Cannot accept suggestion in status ${suggestion.status}`);
    }

    const mappedCategory = (parsed.data.eventCategory ??
      mapDetectionCategoryToProjectEventCategory(
        suggestion.eventCategory as DetectionCategory,
        suggestion.eventSubcategory,
      )) as ProjectEventCategory;

    const event = await tx.projectEvent.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        title: parsed.data.title ?? suggestion.suggestedTitle,
        description: parsed.data.description ?? suggestion.suggestedDescription,
        eventCategory: mappedCategory,
        eventSubcategory: suggestion.eventSubcategory,
        eventStatus: 'UNDER_REVIEW',
        confirmationStatus: 'UNCONFIRMED',
        timezone: parsed.data.timezone,
        reportedByUserId: ctx.user.id,
        source: 'DETECTION_ACCEPTED',
      },
    });

    for (const dateId of parsed.data.acceptedDateSuggestionIds) {
      const dateSug = suggestion.dateSuggestions.find((d) => d.id === dateId);
      if (!dateSug || !dateSug.suggestedValue) continue;
      if (dateSug.precision === 'UNKNOWN' || dateSug.precision === 'APPROXIMATE_DATE') {
        throw validationError(
          'Only exact/precise date suggestions may be accepted into ProjectEventDate',
        );
      }
      await tx.projectEventDate.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          projectEventId: event.id,
          dateType: dateSug.dateType,
          dateValue: dateSug.suggestedValue,
          timezone: dateSug.timezone ?? parsed.data.timezone,
          precision: dateSug.precision,
          verificationStatus: 'UNVERIFIED',
          assertedByUserId: ctx.user.id,
          notes: `Accepted from detection date suggestion ${dateSug.id}`,
        },
      });
      await tx.projectEventDateSuggestion.update({
        where: { id: dateSug.id },
        data: { status: 'ACCEPTED', reviewerDecision: 'ACCEPTED_INTO_EVENT' },
      });
    }

    for (const link of suggestion.evidenceLinks) {
      await tx.projectEventEvidence.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          projectEventId: event.id,
          sourceDocumentId: link.sourceDocumentId,
          documentVersionId: link.documentVersionId,
          evidenceSegmentId: link.evidenceSegmentId,
          purpose:
            link.evidenceRole === 'CONTRADICTING' ? 'CONTRADICTS_EVENT' : 'SUPPORTS_CLASSIFICATION',
          factualNote: link.selectedQuote.slice(0, 2000),
          linkedByUserId: ctx.user.id,
        },
      });
    }

    const updatedSuggestion = await tx.projectEventSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'ACCEPTED',
        acceptedProjectEventId: event.id,
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      },
    });

    const packageForDecision = await tx.contractPackage.findFirst({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'asc' },
    });
    if (packageForDecision) {
      await tx.reviewDecision.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          contractPackageId: packageForDecision.id,
          decisionType: 'ACCEPTED_SUGGESTION',
          actorUserId: ctx.user.id,
          entityType: 'project_event_suggestion',
          entityId: suggestion.id,
          beforeState: { status: suggestion.status },
          afterState: { status: 'ACCEPTED', projectEventId: event.id },
          rationale: parsed.data.rationale ?? 'Accepted detection suggestion into ProjectEvent',
        },
      });
    }

    await tx.detectionReviewerFeedback.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        suggestionId: suggestion.id,
        authorUserId: ctx.user.id,
        decision: 'ACCEPTED',
        notes: parsed.data.rationale,
        payload: { projectEventId: event.id },
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'event_suggestion.accepted',
        entityType: 'project_event_suggestion',
        entityId: suggestion.id,
        metadata: {
          projectEventId: event.id,
          note: 'No deadline activated; rule applicability not confirmed; no EventRuleAssessment created',
        },
      },
      tx,
    );

    const projectEvent = await tx.projectEvent.findFirstOrThrow({ where: { id: event.id } });
    return { suggestion: updatedSuggestion, projectEvent, idempotent: false as const };
  });
}
