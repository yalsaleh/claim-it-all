import { getServerEnv } from '@/lib/env';
import { prisma } from '@/server/db';
import { redisReachable } from '@/server/queue/ingestion-queue';
import { storageReachable } from '@/server/storage/object-storage';

export async function GET() {
  const env = getServerEnv();
  const checks: Record<string, { status: string; detail?: string }> = {
    database: { status: 'error' },
    redis: { status: 'error' },
    objectStorage: { status: 'error' },
    documentIntelligence: { status: 'error' },
    malwareScannerConfig: { status: 'error' },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch {
    checks.database = { status: 'error' };
  }

  checks.redis = { status: (await redisReachable()) ? 'ok' : 'error' };
  checks.objectStorage = { status: (await storageReachable()) ? 'ok' : 'error' };

  try {
    const response = await fetch(`${env.DOCUMENT_INTELLIGENCE_URL}/health/live`, {
      signal: AbortSignal.timeout(3000),
    });
    checks.documentIntelligence = { status: response.ok ? 'ok' : 'error' };
  } catch {
    checks.documentIntelligence = { status: 'error' };
  }

  if (env.MALWARE_SCANNER === 'clamav') {
    checks.malwareScannerConfig = { status: 'ok', detail: 'clamav' };
  } else if (env.MALWARE_SCANNER === 'fake_test' && env.NODE_ENV === 'test') {
    checks.malwareScannerConfig = { status: 'ok', detail: 'fake_test' };
  } else {
    checks.malwareScannerConfig = {
      status: 'error',
      detail: 'unsafe_or_disabled_scanner',
    };
  }

  const ready = Object.values(checks).every((c) => c.status === 'ok');
  return Response.json(
    {
      status: ready ? 'ready' : 'not_ready',
      checks,
    },
    { status: ready ? 200 : 503 },
  );
}
