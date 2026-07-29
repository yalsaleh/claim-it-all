import type { Prisma } from '@prisma/client';

/** Test-only cleanup for notice drafting tables (requires app.allow_notice_purge). */
export async function purgeNoticeTables(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.allow_notice_purge', 'on', true)`;
  await tx.deliveryProviderEvent.deleteMany();
  await tx.deemedReceiptAssessment.deleteMany();
  await tx.noticeReceiptAssessment.deleteMany();
  await tx.noticeAcknowledgment.deleteMany();
  await tx.dispatchEvidence.deleteMany();
  await tx.noticeDispatchRecipient.deleteMany();
  await tx.manualDispatchRecord.deleteMany();
  await tx.noticeDispatchAttempt.deleteMany();
  await tx.noticeDispatchAuthorization.deleteMany();
  await tx.noticeDispatchCoverMessage.deleteMany();
  await tx.noticeDispatchPackageSnapshot.deleteMany();
  await tx.noticeExportBundle.deleteMany();
  await tx.noticeReviewComment.deleteMany();
  await tx.noticeApprovalDecision.deleteMany();
  await tx.noticeControlledException.deleteMany();
  await tx.noticeDraftSection.deleteMany();
  await tx.noticePackage.updateMany({ data: { activeApprovedRevisionId: null } });
  await tx.noticeDraftRevision.deleteMany();
  await tx.noticeAttachment.deleteMany();
  await tx.noticeDeliveryPreparation.deleteMany();
  await tx.noticeFact.deleteMany();
  await tx.noticeReviewQuestion.deleteMany();
  await tx.noticeEvidenceLink.deleteMany();
  await tx.evidenceCompletenessAssessment.deleteMany();
  await tx.noticeEvidenceRequirement.deleteMany();
  await tx.noticeRequirementSnapshot.deleteMany();
  await tx.noticePackage.deleteMany();
}
