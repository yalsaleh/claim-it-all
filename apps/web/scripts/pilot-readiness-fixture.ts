/**
 * Synthetic pilot readiness fixture for CI evidence.
 * Proves pass path and a blocked negative path without real providers.
 */
import { PrismaClient } from '@prisma/client';
import { defaultPilotChecklist, evaluatePilotReadiness } from '@contractradar/platform';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', false)`;

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Pilot Fixture Tenant',
      slug: `pilot-fixture-${Date.now()}`,
      status: 'PROVISIONING',
    },
  });

  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      supportContact: 'pilot-support@example.com',
      incidentContacts: { primary: 'incident@example.com' },
    },
  });

  const backup = await prisma.backupRun.create({
    data: {
      environment: 'CI',
      backupType: 'postgresql_logical',
      status: 'SUCCEEDED',
      startedAt: new Date(),
      completedAt: new Date(),
      encryptionStatus: 'plaintext_local_artifact',
      correlationId: crypto.randomUUID(),
    },
  });

  await prisma.restoreTestRun.create({
    data: {
      backupRunId: backup.id,
      status: 'SUCCEEDED',
      targetEnvironment: 'CI',
      startedAt: new Date(),
      completedAt: new Date(),
      tenantIsolationResult: 'PASS',
      objectIntegrityResult: 'PASS',
      applicationReadinessResult: 'PASS',
    },
  });

  const positiveItems = defaultPilotChecklist().map((c) => ({
    ...c,
    status: 'READY' as const,
    evidence: 'ci-fixture',
  }));
  const positive = evaluatePilotReadiness({ items: positiveItems });

  const negativeItems = defaultPilotChecklist().map((c) => ({
    ...c,
    status: 'BLOCKED' as const,
    evidence: 'missing',
  }));
  const negative = evaluatePilotReadiness({ items: negativeItems });

  const report = {
    ok: positive.canActivate && !negative.canActivate && negative.status === 'BLOCKED',
    positive,
    negative,
    tenantId: tenant.id,
    notes: [
      'Synthetic fixture only',
      'Fake providers remain allowed in CI class; PRODUCTION rejection tested separately',
    ],
  };
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }));
  await prisma.$disconnect();
  process.exit(1);
});
