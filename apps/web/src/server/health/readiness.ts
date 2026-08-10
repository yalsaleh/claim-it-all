import { parseAppEnvironment, policyForEnvironment } from '@contractradar/platform';
import { prisma } from '@/server/db';
import { redisReachable } from '@/server/queue/ingestion-queue';
import { storageReachable } from '@/server/storage/object-storage';

export type ReadyCheck = { status: 'ok' | 'error'; code?: string };

export type WebReadinessResult = {
  status: 'ready' | 'not_ready';
  checks: Record<string, ReadyCheck>;
  httpStatus: 200 | 503;
};

function classifyEnv(): string {
  try {
    return parseAppEnvironment(
      process.env.CONTRACTRADAR_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV,
    );
  } catch {
    return 'UNKNOWN';
  }
}

/**
 * Process liveness — no external dependencies.
 */
export function livePayload(): { status: 'ok' } {
  return { status: 'ok' };
}

/**
 * Application readiness. Never throws; returns redacted public codes only.
 * Detailed diagnostics belong in structured server logs.
 */
export async function evaluateWebReadiness(): Promise<WebReadinessResult> {
  const checks: Record<string, ReadyCheck> = {
    configuration: { status: 'error', code: 'config_unvalidated' },
    database: { status: 'error', code: 'db_unreachable' },
    schema: { status: 'error', code: 'schema_unknown' },
    runtimeRole: { status: 'error', code: 'role_unknown' },
    rls: { status: 'error', code: 'rls_unknown' },
    redis: { status: 'error', code: 'redis_unreachable' },
    objectStorage: { status: 'error', code: 'storage_unreachable' },
  };

  const classified = classifyEnv();
  const policy =
    classified === 'UNKNOWN'
      ? null
      : policyForEnvironment(
          classified as 'LOCAL' | 'TEST' | 'CI' | 'STAGING' | 'PILOT' | 'PRODUCTION',
        );

  // Soft parse of required env keys without throwing secrets into the response.
  const required = [
    'DATABASE_URL',
    'APP_URL',
    'BETTER_AUTH_SECRET',
    'REDIS_URL',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'DOCUMENT_INTELLIGENCE_URL',
    'DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN',
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length === 0) {
    checks.configuration = { status: 'ok' };
  } else {
    checks.configuration = { status: 'error', code: 'config_incomplete' };
    console.error('web_readiness_config_incomplete', { missing });
  }

  if (policy?.requireClamav && process.env.MALWARE_SCANNER !== 'clamav') {
    checks.configuration = { status: 'error', code: 'scanner_policy' };
    console.error('web_readiness_scanner_policy', { classified });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = { status: 'error', code: 'db_unreachable' };
    console.error('web_readiness_db', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  if (checks.database.status === 'ok') {
    try {
      const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `;
      if (rows.length > 0) {
        checks.schema = { status: 'ok' };
      } else {
        checks.schema = { status: 'error', code: 'migrations_missing' };
      }
    } catch {
      checks.schema = { status: 'error', code: 'migrations_unreadable' };
    }

    try {
      const roleRows = await prisma.$queryRaw<Array<{ rolname: string; is_super: string }>>`
        SELECT current_user::text AS rolname, current_setting('is_superuser') AS is_super
      `;
      const role = roleRows[0];
      if (role && role.is_super === 'off') {
        checks.runtimeRole = { status: 'ok' };
      } else {
        checks.runtimeRole = { status: 'error', code: 'runtime_superuser' };
        console.error('web_readiness_runtime_role', {
          role: role?.rolname,
          is_super: role?.is_super,
        });
      }
    } catch {
      checks.runtimeRole = { status: 'error', code: 'role_unreadable' };
    }

    try {
      const rlsRows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
        SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity) AS ok
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('tenant', 'project')
      `;
      if (rlsRows[0]?.ok) {
        checks.rls = { status: 'ok' };
      } else {
        checks.rls = { status: 'error', code: 'rls_incomplete' };
      }
    } catch {
      checks.rls = { status: 'error', code: 'rls_unreadable' };
    }
  }

  const redisRequired = classified !== 'LOCAL' || Boolean(process.env.REDIS_URL);
  if (redisRequired) {
    checks.redis = { status: (await redisReachable()) ? 'ok' : 'error', code: 'redis_unreachable' };
    if (checks.redis.status === 'ok') delete checks.redis.code;
  } else {
    checks.redis = { status: 'ok' };
  }

  const storageRequired = Boolean(process.env.S3_ENDPOINT);
  if (storageRequired) {
    checks.objectStorage = {
      status: (await storageReachable()) ? 'ok' : 'error',
      code: 'storage_unreachable',
    };
    if (checks.objectStorage.status === 'ok') delete checks.objectStorage.code;
  } else {
    checks.objectStorage = { status: 'ok' };
  }

  // DI is a platform dependency, not a hard web-serving prerequisite for all pages.
  // Include as soft check only when explicitly required.
  if (process.env.WEB_READY_REQUIRE_DI === 'true') {
    try {
      const response = await fetch(`${process.env.DOCUMENT_INTELLIGENCE_URL}/health/live`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.documentIntelligence = {
        status: response.ok ? 'ok' : 'error',
        code: response.ok ? undefined : 'di_unreachable',
      };
    } catch {
      checks.documentIntelligence = { status: 'error', code: 'di_unreachable' };
    }
  }

  const ready = Object.values(checks).every((c) => c.status === 'ok');
  return {
    status: ready ? 'ready' : 'not_ready',
    checks,
    httpStatus: ready ? 200 : 503,
  };
}
