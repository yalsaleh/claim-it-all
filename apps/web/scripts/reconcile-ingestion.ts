/**
 * Privileged dry-run reconciliation for ingestion custody inconsistencies.
 *
 *   ALLOW_BYPASS_RLS=true pnpm --filter @contractradar/web exec tsx scripts/reconcile-ingestion.ts
 *   ... --apply   # performs safe corrective actions with ingestion events
 */
import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type Finding = {
  code: string;
  tenantId?: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  detail: string;
};

async function main() {
  const findings: Finding[] = [];

  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

  const expiredSessions = await prisma.uploadSession.findMany({
    where: {
      status: { in: ['UPLOAD_AUTHORIZED', 'UPLOADED', 'VALIDATING'] },
      expiresAt: { lt: new Date() },
    },
    take: 200,
  });
  for (const session of expiredSessions) {
    findings.push({
      code: 'EXPIRED_UPLOAD_SESSION',
      tenantId: session.tenantId,
      projectId: session.projectId,
      entityType: 'upload_session',
      entityId: session.id,
      detail: `status=${session.status} key=${session.storageKey.includes('/quarantine/') ? 'quarantine' : 'other'}`,
    });
  }

  const pendingOutbox = await prisma.outboxEvent.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      availableAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
    take: 200,
  });
  for (const event of pendingOutbox) {
    findings.push({
      code: 'STALE_OUTBOX',
      tenantId: event.tenantId,
      projectId: event.projectId,
      entityType: 'outbox_event',
      entityId: event.id,
      detail: `status=${event.status} attempts=${event.attempts}`,
    });
  }

  const stuckRuns = await prisma.documentProcessingRun.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    take: 200,
  });
  for (const run of stuckRuns) {
    findings.push({
      code: 'STUCK_PROCESSING_RUN',
      tenantId: run.tenantId,
      projectId: run.projectId,
      entityType: 'document_processing_run',
      entityId: run.id,
      detail: 'RUNNING > 1h',
    });
  }

  const quarantineAccepted = await prisma.documentVersion.findMany({
    where: {
      uploadStatus: 'ACCEPTED',
      malwareScanStatus: 'CLEAN',
      storageKey: { contains: '/quarantine/' },
    },
    take: 200,
  });
  for (const version of quarantineAccepted) {
    findings.push({
      code: 'ACCEPTED_STILL_IN_QUARANTINE',
      tenantId: version.tenantId,
      projectId: version.projectId,
      entityType: 'document_version',
      entityId: version.id,
      detail: 'Accepted/clean version storageKey still under quarantine prefix',
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        findingCount: findings.length,
        findings,
      },
      null,
      2,
    ),
  );

  if (apply) {
    for (const session of expiredSessions) {
      await prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED', failureCode: 'EXPIRED_RECONCILED' },
      });
      await prisma.ingestionEvent.create({
        data: {
          tenantId: session.tenantId,
          projectId: session.projectId,
          uploadSessionId: session.id,
          eventType: 'reconcile.upload_session_expired',
          metadata: { script: 'reconcile-ingestion' },
        },
      });
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
