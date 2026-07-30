import {
  isPilotOrProduction,
  isRestrictedEnvironment,
  parseAppEnvironment,
  policyForEnvironment,
  type AppEnvironment,
} from './environment';
import { redactSecretLike } from './secrets';

export type ValidationFinding = {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  field?: string;
};

export type ProductionValidateInput = {
  environment: string;
  databaseUrl?: string;
  migrateDatabaseUrl?: string;
  redisUrl?: string;
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  betterAuthSecret?: string;
  documentIntelligenceToken?: string;
  malwareScanner?: string;
  allowDevDefaults?: boolean;
  connectorProvider?: string;
  noticeDeliveryProvider?: string;
  contractAiProvider?: string;
  cookieSecure?: boolean;
  origins?: string[];
  backupConfigured?: boolean;
  clamavHost?: string;
};

export type ProductionValidateReport = {
  environment: AppEnvironment;
  ok: boolean;
  findings: ValidationFinding[];
  redactedConfig: Record<string, unknown>;
};

const WEAK_SECRETS = [
  'replace-with-a-long-random-secret',
  'dev-only-secret-change-me',
  'ci-test-secret-with-sufficient-length-32',
  'change-me',
];

const DEFAULT_CREDS = new Set(['minioadmin', 'contractradar', 'password', 'secret', 'changeme']);

const FAKE_PROVIDERS = new Set([
  'fake',
  'fake_test',
  'local_fixture',
  'local_capture',
  'deterministic',
]);

function dbRole(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.username || null;
  } catch {
    return null;
  }
}

export function validateProductionConfig(input: ProductionValidateInput): ProductionValidateReport {
  const environment = parseAppEnvironment(input.environment);
  const policy = policyForEnvironment(environment);
  const findings: ValidationFinding[] = [];
  const restricted = isRestrictedEnvironment(environment);
  const pilotProd = isPilotOrProduction(environment);

  if (!input.databaseUrl) {
    findings.push({
      code: 'CFG_DB_MISSING',
      severity: 'error',
      message: 'DATABASE_URL is required',
    });
  }
  if (!input.redisUrl && restricted) {
    findings.push({
      code: 'CFG_REDIS_MISSING',
      severity: 'error',
      message: 'REDIS_URL is required in restricted environments',
    });
  }
  if (!input.s3Endpoint && restricted) {
    findings.push({
      code: 'CFG_S3_MISSING',
      severity: 'error',
      message: 'Object storage endpoint is required',
    });
  }

  const runtimeRole = dbRole(input.databaseUrl);
  const migrateRole = dbRole(input.migrateDatabaseUrl);
  if (policy.requireMigrateRoleSeparation) {
    if (!input.migrateDatabaseUrl) {
      findings.push({
        code: 'CFG_MIGRATE_URL_MISSING',
        severity: 'error',
        message: 'DATABASE_MIGRATE_URL must be set separately from the runtime role',
      });
    } else if (runtimeRole && migrateRole && runtimeRole === migrateRole) {
      findings.push({
        code: 'CFG_DB_ROLE_COLLAPSE',
        severity: 'error',
        message: 'Runtime DB role must differ from migration DB role',
        field: 'DATABASE_URL',
      });
    }
  }
  if (runtimeRole && ['postgres', 'contractradar'].includes(runtimeRole) && restricted) {
    findings.push({
      code: 'CFG_RUNTIME_SUPERUSER',
      severity: 'error',
      message: 'Runtime database role must not be a bootstrap/superuser-style role',
      field: 'DATABASE_URL',
    });
  }

  if (policy.requireStrongSecrets) {
    if (!input.betterAuthSecret || input.betterAuthSecret.length < 32) {
      findings.push({
        code: 'CFG_AUTH_SECRET_WEAK',
        severity: 'error',
        message: 'BETTER_AUTH_SECRET must be at least 32 characters',
      });
    } else if (WEAK_SECRETS.some((w) => input.betterAuthSecret!.includes(w))) {
      findings.push({
        code: 'CFG_AUTH_SECRET_PLACEHOLDER',
        severity: 'error',
        message: 'BETTER_AUTH_SECRET must not use a development placeholder',
      });
    }
  }

  if (policy.rejectDefaultCredentials) {
    if (
      (input.s3AccessKeyId && DEFAULT_CREDS.has(input.s3AccessKeyId)) ||
      (input.s3SecretAccessKey && DEFAULT_CREDS.has(input.s3SecretAccessKey)) ||
      (input.documentIntelligenceToken &&
        (input.documentIntelligenceToken.includes('dev-internal') ||
          input.documentIntelligenceToken.includes('change-me') ||
          input.documentIntelligenceToken.includes('ci-internal')))
    ) {
      findings.push({
        code: 'CFG_DEFAULT_CREDENTIALS',
        severity: 'error',
        message: 'Default/example credentials are forbidden',
      });
    }
  }

  if (input.allowDevDefaults && restricted) {
    findings.push({
      code: 'CFG_DEV_DEFAULTS',
      severity: 'error',
      message: 'ALLOW_DEV_DEFAULTS cannot be enabled outside LOCAL/TEST/CI',
    });
  }

  if (policy.requireClamav && input.malwareScanner && input.malwareScanner !== 'clamav') {
    findings.push({
      code: 'CFG_SCANNER',
      severity: 'error',
      message: 'Restricted environments require MALWARE_SCANNER=clamav',
    });
  }
  if (policy.requireClamav && !input.clamavHost && restricted) {
    findings.push({
      code: 'CFG_CLAMAV_HOST',
      severity: 'warn',
      message: 'CLAMAV_HOST should be configured for restricted environments',
    });
  }

  if (!policy.allowFakeProviders) {
    for (const [field, value] of [
      ['CONNECTOR_PROVIDER', input.connectorProvider],
      ['NOTICE_DELIVERY_PROVIDER', input.noticeDeliveryProvider],
      ['CONTRACT_AI_PROVIDER', input.contractAiProvider],
    ] as const) {
      if (value && FAKE_PROVIDERS.has(value)) {
        findings.push({
          code: 'CFG_FAKE_PROVIDER',
          severity: 'error',
          message: `${field}=${value} is forbidden in ${environment}`,
          field,
        });
      }
    }
  }

  if (pilotProd && input.cookieSecure === false) {
    findings.push({
      code: 'CFG_INSECURE_COOKIE',
      severity: 'error',
      message: 'Secure cookies are required in PILOT/PRODUCTION',
    });
  }

  if (restricted && input.backupConfigured === false) {
    findings.push({
      code: 'CFG_BACKUP_MISSING',
      severity: 'warn',
      message: 'Backup configuration is not marked configured',
    });
  }

  const ok = !findings.some((f) => f.severity === 'error');
  const redactedConfig = redactSecretLike({
    environment,
    databaseRole: runtimeRole,
    migrateRole,
    redisConfigured: Boolean(input.redisUrl),
    s3Endpoint: input.s3Endpoint,
    malwareScanner: input.malwareScanner,
    connectorProvider: input.connectorProvider,
    noticeDeliveryProvider: input.noticeDeliveryProvider,
    contractAiProvider: input.contractAiProvider,
    allowDevDefaults: input.allowDevDefaults,
    backupConfigured: input.backupConfigured,
    cookieSecure: input.cookieSecure,
  }) as Record<string, unknown>;

  return { environment, ok, findings, redactedConfig };
}
