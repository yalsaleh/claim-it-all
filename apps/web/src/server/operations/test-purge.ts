import type { Prisma } from '@prisma/client';

/** Test-only cleanup for connector + operations tables (requires app.allow_ops_purge). */
export async function purgeOpsTables(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.allow_ops_purge', 'on', true)`;
  await tx.internalNotification.deleteMany();
  await tx.operationalSavedView.deleteMany();
  await tx.operationalTask.deleteMany();
  await tx.operationalAlertEvent.deleteMany();
  await tx.operationalAlert.deleteMany();
  await tx.escalationStep.deleteMany();
  await tx.escalationPolicy.deleteMany();
  await tx.projectTimelineEvent.deleteMany();
  await tx.projectOperationsSummary.deleteMany();
  await tx.externalRecord.deleteMany();
  await tx.connectorProviderEvent.deleteMany();
  await tx.connectorSyncRun.deleteMany();
  await tx.connectorScopeApproval.deleteMany();
  await tx.connectorProjectScope.deleteMany();
  await tx.connectorAccount.deleteMany();
}
