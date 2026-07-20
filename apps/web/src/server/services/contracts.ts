import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireProjectCapability } from '@/server/authz/context';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { conflict, forbidden, notFound, validationError } from '@/server/errors';
import { resolveContractAiProvider, validateAiResponse } from '@/server/contracts/ai-provider';
import {
  extractClauseCandidatesFromText,
  extractCrossReferenceCandidates,
  extractDefinedTermCandidates,
  extractPartyRoleCandidates,
  probeNoticeTimingExpression,
} from '@/server/contracts/structure-extract';

const CreatePackageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  contractReference: z.string().trim().max(200).optional(),
  contractFormFamily: z.string().trim().max(100).optional(),
  contractFormEdition: z.string().trim().max(100).optional(),
  governingLaw: z.string().trim().max(200).optional(),
  jurisdiction: z.string().trim().max(200).optional(),
});

const AttachDocumentSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  documentVersionId: z.string().uuid().optional(),
  contractDocumentType: z.enum([
    'AGREEMENT',
    'LETTER_OF_ACCEPTANCE',
    'CONDITIONS_OF_CONTRACT',
    'GENERAL_CONDITIONS',
    'PARTICULAR_CONDITIONS',
    'CONTRACT_DATA',
    'APPENDIX_TO_TENDER',
    'EMPLOYERS_REQUIREMENTS',
    'SPECIFICATIONS',
    'BILL_OF_QUANTITIES',
    'DRAWINGS',
    'SCHEDULES',
    'ADDENDUM',
    'AMENDMENT',
    'SUPPLEMENTAL_AGREEMENT',
    'CLARIFICATION',
    'TENDER_SUBMISSION',
    'OTHER',
  ]),
  title: z.string().trim().min(1).max(300),
  reference: z.string().trim().max(200).optional(),
  language: z.enum(['EN', 'AR', 'MIXED', 'UNKNOWN']).optional(),
  precedenceRank: z.number().int().min(0).max(10_000).optional(),
});

function segregationEnabled(): boolean {
  // Default on; set CONTRACT_CONFIG_SEGREGATION_OF_DUTIES=false only for explicit test bypass.
  return process.env.CONTRACT_CONFIG_SEGREGATION_OF_DUTIES !== 'false';
}

export async function listContractPackages(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.contractPackage.findMany({
      where: { tenantId: ctx.tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            documents: true,
            clauses: true,
            obligations: true,
            noticeRules: true,
            configurationIssues: true,
          },
        },
        currentConfigurationRevision: {
          select: { id: true, revisionNumber: true, status: true, approvedAt: true },
        },
      },
    }),
  );
}

export async function createContractPackage(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.create');
  const parsed = CreatePackageSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid contract package', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const created = await tx.contractPackage.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        name: parsed.data.name,
        description: parsed.data.description,
        contractReference: parsed.data.contractReference,
        contractFormFamily: parsed.data.contractFormFamily,
        contractFormEdition: parsed.data.contractFormEdition,
        governingLaw: parsed.data.governingLaw,
        jurisdiction: parsed.data.jurisdiction,
        status: 'DRAFT',
        createdByUserId: ctx.user.id,
      },
    });
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_package.created',
        entityType: 'contract_package',
        entityId: created.id,
        metadata: { name: created.name },
      },
      tx,
    );
    return created;
  });
}

export async function getContractPackage(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.contractPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId, projectId },
      include: {
        documents: { orderBy: [{ precedenceRank: 'asc' }, { createdAt: 'asc' }] },
        currentConfigurationRevision: true,
        _count: {
          select: {
            clauses: true,
            obligations: true,
            noticeRules: true,
            configurationIssues: true,
            analysisRuns: true,
          },
        },
      },
    });
    if (!pkg) throw notFound();
    return pkg;
  });
}

export async function attachContractDocument(
  projectId: string,
  packageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_document.attach');
  const parsed = AttachDocumentSchema.safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid attachment', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.contractPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId, projectId },
    });
    if (!pkg) throw notFound();

    const source = await tx.sourceDocument.findFirst({
      where: {
        id: parsed.data.sourceDocumentId,
        tenantId: ctx.tenantId,
        projectId,
      },
    });
    if (!source) throw notFound();

    const versionId = parsed.data.documentVersionId ?? source.currentVersionId;
    if (!versionId) throw validationError('Source document has no current version');
    const version = await tx.documentVersion.findFirst({
      where: {
        id: versionId,
        sourceDocumentId: source.id,
        tenantId: ctx.tenantId,
        projectId,
        malwareScanStatus: 'CLEAN',
        uploadStatus: 'ACCEPTED',
      },
    });
    if (!version) {
      throw validationError('Document version must be CLEAN and ACCEPTED before attachment');
    }

    const attached = await tx.contractDocument.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        sourceDocumentId: source.id,
        documentVersionId: version.id,
        contractDocumentType: parsed.data.contractDocumentType,
        title: parsed.data.title,
        reference: parsed.data.reference,
        language: parsed.data.language ?? source.language,
        precedenceRank: parsed.data.precedenceRank,
        status: 'REVIEW_REQUIRED',
        isExecuted: false,
        isCurrent: true,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_document.attached',
        entityType: 'contract_document',
        entityId: attached.id,
        metadata: {
          contractPackageId: packageId,
          sourceDocumentId: source.id,
          documentVersionId: version.id,
          contractDocumentType: attached.contractDocumentType,
        },
      },
      tx,
    );
    return attached;
  });
}

export async function startDeterministicStructureAnalysis(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_structure.run');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.contractPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId, projectId },
      include: { documents: true },
    });
    if (!pkg) throw notFound();
    if (pkg.documents.length === 0) {
      throw validationError('Attach at least one contract document before analysis');
    }

    const run = await tx.contractAnalysisRun.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        analysisProfile: 'structure_v1_deterministic',
        status: 'RUNNING',
        processorName: 'contract-structure-deterministic',
        processorVersion: '0.1.0',
        sourceDocumentVersions: pkg.documents.map((d) => d.documentVersionId),
        correlationId: randomUUID(),
        startedAt: new Date(),
      },
    });

    let suggestionCount = 0;
    let clauseCount = 0;
    for (const doc of pkg.documents) {
      const segments = await tx.evidenceSegment.findMany({
        where: {
          tenantId: ctx.tenantId,
          projectId,
          documentVersionId: doc.documentVersionId,
        },
        orderBy: { ordinal: 'asc' },
        take: 500,
      });
      const text = segments
        .map((s) => s.textContent ?? '')
        .filter(Boolean)
        .join('\n');
      if (!text.trim()) {
        await tx.contractConfigurationIssue.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            severity: 'HIGH',
            category: 'UNREADABLE_CLAUSE',
            sourceEntityType: 'contract_document',
            sourceEntityId: doc.id,
            description: 'No evidence segment text available for deterministic clause extraction.',
            status: 'OPEN',
          },
        });
        continue;
      }

      const candidates = extractClauseCandidatesFromText(text);
      for (const candidate of candidates) {
        const suggestion = await tx.contractExtractionSuggestion.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            analysisRunId: run.id,
            suggestionType: 'CLAUSE',
            proposedData: candidate,
            evidenceSegmentId: segments[0]?.id,
            evidenceLocator: segments[0]?.locator ?? undefined,
            confidence: candidate.extractionConfidence,
            extractionMethod: candidate.extractionMethod,
            modelProvider: 'deterministic',
            modelName: null,
            status: 'PENDING_REVIEW',
          },
        });
        suggestionCount += 1;

        // Machine-suggested clause rows are reviewable structure, not approved interpretation.
        const clause = await tx.contractClause.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            contractDocumentId: doc.id,
            documentVersionId: doc.documentVersionId,
            clauseNumber: candidate.clauseNumber,
            normalizedClauseNumber: candidate.normalizedClauseNumber,
            heading: candidate.heading,
            level: candidate.level,
            sequence: candidate.sequence,
            language: doc.language,
            sourceText: candidate.sourceText,
            textChecksum: candidate.textChecksum,
            evidenceSegmentId: segments[0]?.id,
            evidenceLocator: segments[0]?.locator ?? undefined,
            extractionMethod: candidate.extractionMethod,
            extractionConfidence: candidate.extractionConfidence,
            reviewStatus: 'MACHINE_SUGGESTED',
          },
        });
        clauseCount += 1;

        const timing = probeNoticeTimingExpression(candidate.sourceText);
        if (
          timing.durationUnit === 'CALENDAR_DAY' ||
          timing.durationUnit === 'PROMPT' ||
          /\bnotice\b|إشعار/i.test(candidate.sourceText)
        ) {
          await tx.contractExtractionSuggestion.create({
            data: {
              tenantId: ctx.tenantId,
              projectId,
              contractPackageId: packageId,
              analysisRunId: run.id,
              suggestionType: 'NOTICE_RULE',
              proposedData: {
                sourceSuggestionId: suggestion.id,
                timing,
                rawExcerpt: candidate.sourceText.slice(0, 500),
              },
              confidence: timing.vague ? 0.35 : 0.55,
              extractionMethod: 'DETERMINISTIC',
              modelProvider: 'deterministic',
              status: 'PENDING_REVIEW',
            },
          });
          suggestionCount += 1;

          const obligation = await tx.contractObligation.create({
            data: {
              tenantId: ctx.tenantId,
              projectId,
              contractPackageId: packageId,
              sourceClauseId: clause.id,
              obligationType: 'NOTICE',
              actionDescription: candidate.sourceText.slice(0, 2000),
              triggerDescription: 'As stated in source clause (machine-suggested)',
              timingExpression: candidate.sourceText.match(
                /within\s+\d+\s+(calendar\s+)?days?|promptly|immediately|reasonable/i,
              )?.[0],
              isTimeBarredCandidate: /time[- ]?bar|condition precedent|shall be deemed/i.test(
                candidate.sourceText,
              ),
              isConditionPrecedentCandidate: /condition precedent/i.test(candidate.sourceText),
              machineInterpretation: `Deterministic notice candidate; vague=${timing.vague}`,
              confidence: timing.vague ? 0.35 : 0.55,
              reviewStatus: 'MACHINE_SUGGESTED',
              evidenceSegmentId: segments[0]?.id,
              evidenceLocator: segments[0]?.locator ?? undefined,
            },
          });

          await tx.noticeRule.create({
            data: {
              tenantId: ctx.tenantId,
              projectId,
              contractPackageId: packageId,
              obligationId: obligation.id,
              noticeCategory: 'GENERAL_NOTICE',
              triggerBasis: 'SOURCE_TEXT',
              durationValue: timing.durationValue,
              durationUnit: timing.durationUnit,
              calendarBasis: timing.durationUnit === 'CALENDAR_DAY' ? 'CALENDAR_DAYS' : null,
              timeBarClassification: timing.vague ? 'UNCERTAIN' : 'PROCEDURAL_DEADLINE',
              ambiguityStatus: timing.vague ? 'AMBIGUOUS' : 'PARTIALLY_AMBIGUOUS',
              consequenceText: null,
              reviewStatus: 'MACHINE_SUGGESTED',
              evidenceSegmentId: segments[0]?.id,
              evidenceLocator: segments[0]?.locator ?? undefined,
            },
          });

          if (timing.vague) {
            await tx.contractConfigurationIssue.create({
              data: {
                tenantId: ctx.tenantId,
                projectId,
                contractPackageId: packageId,
                severity: 'MEDIUM',
                category: 'UNCLEAR_DEADLINE',
                sourceEntityType: 'contract_clause',
                sourceEntityId: clause.id,
                description:
                  'Vague or non-numeric timing expression detected; must remain non-executable until human classification.',
                status: 'OPEN',
              },
            });
          }
        }
      }

      for (const term of extractDefinedTermCandidates(text)) {
        await tx.contractExtractionSuggestion.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            analysisRunId: run.id,
            suggestionType: 'DEFINED_TERM',
            proposedData: term,
            evidenceSegmentId: segments[0]?.id,
            evidenceLocator: segments[0]?.locator ?? undefined,
            confidence: term.extractionConfidence,
            extractionMethod: 'DETERMINISTIC',
            modelProvider: 'deterministic',
            status: 'PENDING_REVIEW',
          },
        });
        suggestionCount += 1;
      }

      for (const party of extractPartyRoleCandidates(text)) {
        await tx.contractExtractionSuggestion.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            analysisRunId: run.id,
            suggestionType: party.kind,
            proposedData: party,
            evidenceSegmentId: segments[0]?.id,
            evidenceLocator: segments[0]?.locator ?? undefined,
            confidence: party.extractionConfidence,
            extractionMethod: 'DETERMINISTIC',
            modelProvider: 'deterministic',
            status: 'PENDING_REVIEW',
          },
        });
        suggestionCount += 1;
      }

      for (const xref of extractCrossReferenceCandidates(text)) {
        await tx.contractExtractionSuggestion.create({
          data: {
            tenantId: ctx.tenantId,
            projectId,
            contractPackageId: packageId,
            analysisRunId: run.id,
            suggestionType: 'CROSS_REFERENCE',
            proposedData: xref,
            evidenceSegmentId: segments[0]?.id,
            evidenceLocator: segments[0]?.locator ?? undefined,
            confidence: xref.extractionConfidence,
            extractionMethod: 'DETERMINISTIC',
            modelProvider: 'deterministic',
            status: 'PENDING_REVIEW',
          },
        });
        suggestionCount += 1;
        if (xref.ambiguous) {
          await tx.contractConfigurationIssue.create({
            data: {
              tenantId: ctx.tenantId,
              projectId,
              contractPackageId: packageId,
              severity: 'LOW',
              category: 'UNRESOLVED_CROSS_REFERENCE',
              sourceEntityType: 'contract_document',
              sourceEntityId: doc.id,
              description: `Ambiguous cross-reference candidate: ${xref.rawReferenceText}`,
              status: 'OPEN',
            },
          });
        }
      }

      const aiProvider = resolveContractAiProvider();
      if (aiProvider) {
        const aiRaw = await aiProvider.analyzeSegments({
          segments: segments
            .filter((s) => s.textContent)
            .slice(0, 20)
            .map((s) => ({ id: s.id, text: s.textContent! })),
          promptSchemaVersion: 'contract_ai_v1',
        });
        const ai = validateAiResponse(aiRaw);
        for (const s of ai.suggestions) {
          await tx.contractExtractionSuggestion.create({
            data: {
              tenantId: ctx.tenantId,
              projectId,
              contractPackageId: packageId,
              analysisRunId: run.id,
              suggestionType: s.suggestionType,
              proposedData: { ...s.proposedData, rationale: s.rationale },
              evidenceSegmentId: s.evidenceSegmentId ?? segments[0]?.id,
              confidence: s.confidence,
              extractionMethod: 'AI_ASSISTED',
              modelProvider: ai.provider,
              modelName: ai.model,
              modelMetadata: { promptSchemaVersion: ai.promptSchemaVersion, testOnly: ai.testOnly },
              status: 'PENDING_REVIEW',
            },
          });
          suggestionCount += 1;
        }
      }
    }

    await tx.contractAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        suggestionCount,
      },
    });
    await tx.contractPackage.update({
      where: { id: packageId },
      data: { status: 'REVIEW_REQUIRED' },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_structure.analysis_started',
        entityType: 'contract_analysis_run',
        entityId: run.id,
        metadata: {
          contractPackageId: packageId,
          suggestionCount,
          clauseCount,
          profile: 'structure_v1_deterministic',
        },
      },
      tx,
    );

    return { runId: run.id, suggestionCount, clauseCount };
  });
}

export async function reviewClause(
  projectId: string,
  packageId: string,
  clauseId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_structure.review');
  const parsed = z
    .object({
      decision: z.enum(['VERIFIED', 'CORRECTED', 'REJECTED']),
      correctedText: z.string().trim().min(1).max(50_000).optional(),
      rationale: z.string().trim().max(2000).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid clause review', parsed.error.flatten());
  if (parsed.data.decision === 'CORRECTED' && !parsed.data.correctedText) {
    throw validationError('correctedText is required for CORRECTED decisions');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const clause = await tx.contractClause.findFirst({
      where: { id: clauseId, tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
    });
    if (!clause) throw notFound();

    const before = {
      reviewStatus: clause.reviewStatus,
      normalizedText: clause.normalizedText,
    };

    if (parsed.data.decision === 'CORRECTED' && parsed.data.correctedText) {
      const maxRev = await tx.clauseTextRevision.aggregate({
        where: { contractClauseId: clause.id },
        _max: { revisionNumber: true },
      });
      const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;
      await tx.clauseTextRevision.create({
        data: {
          tenantId: ctx.tenantId,
          projectId,
          contractClauseId: clause.id,
          revisionNumber,
          revisedText: parsed.data.correctedText,
          revisionReason: parsed.data.rationale ?? 'Human correction',
          revisionKind: 'HUMAN_CORRECTION',
          createdByUserId: ctx.user.id,
          status: 'DRAFT',
        },
      });
      await tx.contractClause.update({
        where: { id: clause.id },
        data: {
          normalizedText: parsed.data.correctedText,
          reviewStatus: 'CORRECTED',
        },
      });
    } else {
      await tx.contractClause.update({
        where: { id: clause.id },
        data: { reviewStatus: parsed.data.decision },
      });
    }

    await tx.reviewDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        decisionType:
          parsed.data.decision === 'VERIFIED'
            ? 'ACCEPTED_SUGGESTION'
            : parsed.data.decision === 'CORRECTED'
              ? 'CORRECTED_EXTRACTION'
              : 'REJECTED_INTERPRETATION',
        actorUserId: ctx.user.id,
        entityType: 'contract_clause',
        entityId: clause.id,
        beforeState: before,
        afterState: { reviewStatus: parsed.data.decision },
        rationale: parsed.data.rationale,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_clause.reviewed',
        entityType: 'contract_clause',
        entityId: clause.id,
        metadata: { decision: parsed.data.decision, contractPackageId: packageId },
      },
      tx,
    );

    return tx.contractClause.findUniqueOrThrow({ where: { id: clause.id } });
  });
}

export async function createAndSubmitConfigurationRevision(
  projectId: string,
  packageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_configuration.submit');
  const parsed = z
    .object({
      summary: z.string().trim().max(2000).optional(),
    })
    .safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid revision payload', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.contractPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId, projectId },
      include: { documents: true },
    });
    if (!pkg) throw notFound();

    const maxRev = await tx.contractConfigurationRevision.aggregate({
      where: { contractPackageId: packageId },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;
    const revision = await tx.contractConfigurationRevision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        revisionNumber,
        status: 'IN_REVIEW',
        summary: parsed.data.summary ?? `Revision ${revisionNumber}`,
        basedOnDocumentVersions: pkg.documents.map((d) => d.documentVersionId),
        createdByUserId: ctx.user.id,
        submittedByUserId: ctx.user.id,
        submittedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_configuration.submitted',
        entityType: 'contract_configuration_revision',
        entityId: revision.id,
        metadata: { revisionNumber, contractPackageId: packageId },
      },
      tx,
    );
    return revision;
  });
}

export async function approveConfigurationRevision(
  projectId: string,
  packageId: string,
  revisionId: string,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_configuration.approve');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = await tx.contractConfigurationRevision.findFirst({
      where: {
        id: revisionId,
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
      },
    });
    if (!revision) throw notFound();
    if (revision.status !== 'IN_REVIEW' && revision.status !== 'CHANGES_REQUESTED') {
      throw conflict(`Revision cannot be approved from status ${revision.status}`);
    }
    if (
      segregationEnabled() &&
      (revision.submittedByUserId === ctx.user.id || revision.createdByUserId === ctx.user.id)
    ) {
      throw forbidden('Segregation of duties: approver must differ from submitter/creator');
    }

    await tx.contractConfigurationRevision.updateMany({
      where: {
        contractPackageId: packageId,
        isActiveApproved: true,
      },
      data: {
        isActiveApproved: false,
        status: 'SUPERSEDED',
      },
    });

    const approved = await tx.contractConfigurationRevision.update({
      where: { id: revision.id },
      data: {
        status: 'APPROVED',
        isActiveApproved: true,
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
      },
    });

    await tx.contractPackage.update({
      where: { id: packageId },
      data: {
        status: 'APPROVED',
        currentConfigurationRevisionId: approved.id,
      },
    });

    await tx.reviewDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        configurationRevisionId: approved.id,
        decisionType: 'APPROVED_RULE',
        actorUserId: ctx.user.id,
        entityType: 'contract_configuration_revision',
        entityId: approved.id,
        afterState: { status: 'APPROVED', revisionNumber: approved.revisionNumber },
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_configuration.approved',
        entityType: 'contract_configuration_revision',
        entityId: approved.id,
        metadata: {
          contractPackageId: packageId,
          revisionNumber: approved.revisionNumber,
        },
      },
      tx,
    );

    return approved;
  });
}

export async function getApprovedConfiguration(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const pkg = await tx.contractPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId, projectId },
    });
    if (!pkg) throw notFound();
    const revision = await tx.contractConfigurationRevision.findFirst({
      where: {
        contractPackageId: packageId,
        tenantId: ctx.tenantId,
        isActiveApproved: true,
        status: 'APPROVED',
      },
    });
    if (!revision) throw notFound();
    const [clauses, obligations, noticeRules, documents] = await Promise.all([
      tx.contractClause.findMany({
        where: { contractPackageId: packageId, reviewStatus: { in: ['VERIFIED', 'CORRECTED'] } },
        orderBy: [{ sequence: 'asc' }],
      }),
      tx.contractObligation.findMany({ where: { contractPackageId: packageId } }),
      tx.noticeRule.findMany({ where: { contractPackageId: packageId } }),
      tx.contractDocument.findMany({ where: { contractPackageId: packageId } }),
    ]);
    return { package: pkg, revision, documents, clauses, obligations, noticeRules };
  });
}

export async function listPackageClauses(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.contractClause.findMany({
      where: { tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
      orderBy: [{ sequence: 'asc' }],
      take: 500,
    }),
  );
}

export async function listPackageObligations(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.contractObligation.findMany({
      where: { tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
      include: { noticeRules: true, sourceClause: { select: { id: true, clauseNumber: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
  );
}

export async function listPackageNoticeRules(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.noticeRule.findMany({
      where: { tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
      include: {
        obligation: { select: { id: true, obligationType: true, actionDescription: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
  );
}

export async function listPackageIssues(projectId: string, packageId: string) {
  const ctx = await requireProjectCapability(projectId, 'contract_package.read');
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.contractConfigurationIssue.findMany({
      where: { tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    }),
  );
}

export async function reviewObligation(
  projectId: string,
  packageId: string,
  obligationId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_structure.review');
  const parsed = z
    .object({
      decision: z.enum(['VERIFIED', 'APPROVED', 'REJECTED']),
      humanApprovedInterpretation: z.string().trim().max(10_000).optional(),
      rationale: z.string().trim().max(2000).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid obligation review', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const obligation = await tx.contractObligation.findFirst({
      where: {
        id: obligationId,
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
      },
    });
    if (!obligation) throw notFound();

    const updated = await tx.contractObligation.update({
      where: { id: obligation.id },
      data: {
        reviewStatus: parsed.data.decision,
        humanApprovedInterpretation:
          parsed.data.humanApprovedInterpretation ?? obligation.humanApprovedInterpretation,
      },
    });

    await tx.reviewDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        decisionType:
          parsed.data.decision === 'REJECTED' ? 'REJECTED_INTERPRETATION' : 'APPROVED_RULE',
        actorUserId: ctx.user.id,
        entityType: 'contract_obligation',
        entityId: obligation.id,
        beforeState: { reviewStatus: obligation.reviewStatus },
        afterState: { reviewStatus: parsed.data.decision },
        rationale: parsed.data.rationale,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_obligation.reviewed',
        entityType: 'contract_obligation',
        entityId: obligation.id,
        metadata: { decision: parsed.data.decision, contractPackageId: packageId },
      },
      tx,
    );
    return updated;
  });
}

export async function reviewNoticeRule(
  projectId: string,
  packageId: string,
  noticeRuleId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_structure.review');
  const parsed = z
    .object({
      decision: z.enum(['VERIFIED', 'APPROVED', 'REJECTED']),
      timeBarClassification: z
        .enum([
          'EXPRESS_CONDITION_PRECEDENT',
          'EXPRESS_TIME_BAR',
          'PROCEDURAL_DEADLINE',
          'RECOMMENDED_INTERNAL_DEADLINE',
          'UNCERTAIN',
          'NOT_A_TIME_BAR',
        ])
        .optional(),
      rationale: z.string().trim().max(2000).optional(),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid notice-rule review', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const rule = await tx.noticeRule.findFirst({
      where: {
        id: noticeRuleId,
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
      },
    });
    if (!rule) throw notFound();

    const classification = parsed.data.timeBarClassification ?? rule.timeBarClassification;
    if (
      parsed.data.decision === 'APPROVED' &&
      (classification === 'UNCERTAIN' ||
        rule.durationUnit === 'PROMPT' ||
        rule.durationUnit === 'REASONABLE_TIME')
    ) {
      // Approval of structured metadata is allowed, but ambiguity stays explicit.
    }

    const updated = await tx.noticeRule.update({
      where: { id: rule.id },
      data: {
        reviewStatus: parsed.data.decision,
        timeBarClassification: classification,
        ambiguityStatus:
          classification === 'UNCERTAIN' ||
          rule.durationUnit === 'PROMPT' ||
          rule.durationUnit === 'REASONABLE_TIME'
            ? 'AMBIGUOUS'
            : 'CLEAR',
      },
    });

    await tx.reviewDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        decisionType:
          parsed.data.decision === 'REJECTED' ? 'REJECTED_INTERPRETATION' : 'APPROVED_RULE',
        actorUserId: ctx.user.id,
        entityType: 'notice_rule',
        entityId: rule.id,
        beforeState: {
          reviewStatus: rule.reviewStatus,
          timeBarClassification: rule.timeBarClassification,
        },
        afterState: {
          reviewStatus: parsed.data.decision,
          timeBarClassification: classification,
        },
        rationale: parsed.data.rationale,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'notice_rule.reviewed',
        entityType: 'notice_rule',
        entityId: rule.id,
        metadata: {
          decision: parsed.data.decision,
          timeBarClassification: classification,
          contractPackageId: packageId,
          note: 'Structured rules are not active for project events until configuration revision approval',
        },
      },
      tx,
    );
    return updated;
  });
}

export async function resolveConfigurationIssue(
  projectId: string,
  packageId: string,
  issueId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_issue.manage');
  const parsed = z
    .object({
      resolution: z.string().trim().min(1).max(5000),
      status: z.enum(['RESOLVED', 'WAIVED', 'DEFERRED']).default('RESOLVED'),
    })
    .safeParse(rawInput);
  if (!parsed.success) throw validationError('Invalid issue resolution', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const issue = await tx.contractConfigurationIssue.findFirst({
      where: { id: issueId, tenantId: ctx.tenantId, projectId, contractPackageId: packageId },
    });
    if (!issue) throw notFound();

    const updated = await tx.contractConfigurationIssue.update({
      where: { id: issue.id },
      data: {
        status: parsed.data.status,
        resolution: parsed.data.resolution,
        resolvedByUserId: ctx.user.id,
        resolvedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_issue.resolved',
        entityType: 'contract_configuration_issue',
        entityId: issue.id,
        metadata: { status: parsed.data.status, contractPackageId: packageId },
      },
      tx,
    );
    return updated;
  });
}

export async function requestConfigurationChanges(
  projectId: string,
  packageId: string,
  revisionId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_configuration.approve');
  const parsed = z
    .object({ rationale: z.string().trim().min(1).max(2000) })
    .safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid change request', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const revision = await tx.contractConfigurationRevision.findFirst({
      where: {
        id: revisionId,
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        status: 'IN_REVIEW',
      },
    });
    if (!revision) throw notFound();

    const updated = await tx.contractConfigurationRevision.update({
      where: { id: revision.id },
      data: { status: 'CHANGES_REQUESTED' },
    });

    await tx.reviewDecision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        configurationRevisionId: revision.id,
        decisionType: 'REQUESTED_CHANGES',
        actorUserId: ctx.user.id,
        entityType: 'contract_configuration_revision',
        entityId: revision.id,
        beforeState: { status: 'IN_REVIEW' },
        afterState: { status: 'CHANGES_REQUESTED' },
        rationale: parsed.data.rationale,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_configuration.changes_requested',
        entityType: 'contract_configuration_revision',
        entityId: revision.id,
        metadata: { contractPackageId: packageId },
      },
      tx,
    );
    return updated;
  });
}

export async function supersedeApprovedConfiguration(
  projectId: string,
  packageId: string,
  rawInput: unknown,
) {
  const ctx = await requireProjectCapability(projectId, 'contract_configuration.supersede');
  const parsed = z
    .object({ summary: z.string().trim().max(2000).optional() })
    .safeParse(rawInput ?? {});
  if (!parsed.success) throw validationError('Invalid supersession', parsed.error.flatten());

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const current = await tx.contractConfigurationRevision.findFirst({
      where: {
        contractPackageId: packageId,
        tenantId: ctx.tenantId,
        isActiveApproved: true,
        status: 'APPROVED',
      },
    });
    if (!current) throw notFound();

    await tx.contractConfigurationRevision.update({
      where: { id: current.id },
      data: { isActiveApproved: false, status: 'SUPERSEDED' },
    });

    const maxRev = await tx.contractConfigurationRevision.aggregate({
      where: { contractPackageId: packageId },
      _max: { revisionNumber: true },
    });
    const revisionNumber = (maxRev._max.revisionNumber ?? 0) + 1;
    const draft = await tx.contractConfigurationRevision.create({
      data: {
        tenantId: ctx.tenantId,
        projectId,
        contractPackageId: packageId,
        revisionNumber,
        status: 'DRAFT',
        summary: parsed.data.summary ?? `Supersedes revision ${current.revisionNumber}`,
        basedOnDocumentVersions: current.basedOnDocumentVersions ?? undefined,
        createdByUserId: ctx.user.id,
        supersedesRevisionId: current.id,
      },
    });

    await tx.contractPackage.update({
      where: { id: packageId },
      data: {
        status: 'REVIEW_REQUIRED',
        currentConfigurationRevisionId: null,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId,
        actorUserId: ctx.user.id,
        action: 'contract_configuration.superseded',
        entityType: 'contract_configuration_revision',
        entityId: current.id,
        metadata: {
          contractPackageId: packageId,
          newDraftRevisionId: draft.id,
        },
      },
      tx,
    );
    return { superseded: current, draft };
  });
}
