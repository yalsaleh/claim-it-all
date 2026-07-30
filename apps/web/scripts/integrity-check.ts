import { PrismaClient } from '@prisma/client';
import { parseAppEnvironment, policyForEnvironment } from '@contractradar/platform';

const prisma = new PrismaClient();
const findings: Array<{ code: string; severity: string; message: string }> = [];

function note(code: string, severity: string, message: string) {
  findings.push({ code, severity, message });
}

async function main() {
  const env = parseAppEnvironment(
    process.env.CONTRACTRADAR_ENV || process.env.APP_ENV || process.env.NODE_ENV || 'LOCAL',
  );
  const policy = policyForEnvironment(env);

  const rls = await prisma.$queryRaw<
    Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>
  >`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('tenant','project','source_document','audit_log','tenant_settings','connector_account')
    ORDER BY 1
  `;
  for (const row of rls) {
    if (!row.relrowsecurity || !row.relforcerowsecurity) {
      note('RLS_NOT_FORCED', 'error', `FORCE RLS missing on ${row.relname}`);
    }
  }

  if (!policy.allowFakeProviders) {
    for (const [name, value] of [
      ['CONNECTOR_PROVIDER', process.env.CONNECTOR_PROVIDER],
      ['NOTICE_DELIVERY_PROVIDER', process.env.NOTICE_DELIVERY_PROVIDER],
    ] as const) {
      if (value && ['fake', 'local_fixture', 'local_capture', 'fake_test'].includes(value)) {
        note('FAKE_PROVIDER', 'error', `${name}=${value} forbidden in ${env}`);
      }
    }
  }

  const lastBackup = await prisma.backupRun.findFirst({
    where: { status: 'SUCCEEDED' },
    orderBy: { completedAt: 'desc' },
  });
  if (!lastBackup) note('BACKUP_MISSING', 'warn', 'No successful BackupRun recorded');

  const ok = !findings.some((f) => f.severity === 'error');
  console.log(JSON.stringify({ environment: env, ok, findings }, null, 2));
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }));
  await prisma.$disconnect();
  process.exit(1);
});
