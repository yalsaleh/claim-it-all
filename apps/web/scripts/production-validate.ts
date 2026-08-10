import { validateProductionConfig } from '@contractradar/platform';

function parseArgs(argv: string[]): { envOverride?: string } {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--env' && argv[i + 1]) {
      return { envOverride: argv[i + 1] };
    }
    if (arg.startsWith('--env=')) {
      return { envOverride: arg.slice('--env='.length) };
    }
  }
  return {};
}

const { envOverride } = parseArgs(process.argv.slice(2));
const raw = (
  envOverride ||
  process.env.CONTRACTRADAR_ENV ||
  process.env.APP_ENV ||
  process.env.NODE_ENV ||
  'LOCAL'
).toUpperCase();

const mapped = (['LOCAL', 'TEST', 'CI', 'STAGING', 'PILOT', 'PRODUCTION'] as const).includes(
  raw as 'LOCAL',
)
  ? (raw as 'LOCAL' | 'TEST' | 'CI' | 'STAGING' | 'PILOT' | 'PRODUCTION')
  : raw === 'DEVELOPMENT'
    ? 'LOCAL'
    : raw === 'STAGING'
      ? 'STAGING'
      : 'LOCAL';

const usePilotSynthetic = Boolean(envOverride && envOverride.toLowerCase() === 'pilot');

const pilotSynthetic = {
  databaseUrl:
    'postgresql://contractradar_app:pilot-strong-db-secret-not-default@db.internal:5432/contractradar',
  migrateDatabaseUrl:
    'postgresql://contractradar_migrate:pilot-strong-migrate-secret-ok@db.internal:5432/contractradar',
  redisUrl: 'redis://redis.internal:6379',
  s3Endpoint: 'https://objects.internal',
  s3AccessKeyId: 'pilot-access-key-not-default',
  s3SecretAccessKey: 'pilot-secret-key-not-default-value',
  betterAuthSecret: `pilot-auth-secret-${'a'.repeat(40)}`,
  documentIntelligenceToken: `pilot-di-token-${'b'.repeat(40)}`,
  malwareScanner: 'clamav',
  allowDevDefaults: false,
  allowTestPurge: false,
  connectorProvider: 'disabled',
  noticeDeliveryProvider: 'disabled',
  contractAiProvider: 'disabled',
  cookieSecure: true,
  backupConfigured: true,
  clamavHost: 'clamav.internal',
};

const report = validateProductionConfig(
  usePilotSynthetic
    ? {
        environment: 'PILOT',
        ...pilotSynthetic,
      }
    : {
        environment: mapped,
        databaseUrl: process.env.DATABASE_URL,
        migrateDatabaseUrl: process.env.DATABASE_MIGRATE_URL,
        redisUrl: process.env.REDIS_URL,
        s3Endpoint: process.env.S3_ENDPOINT,
        s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
        s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        betterAuthSecret: process.env.BETTER_AUTH_SECRET,
        documentIntelligenceToken: process.env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN,
        malwareScanner: process.env.MALWARE_SCANNER,
        allowDevDefaults: process.env.ALLOW_DEV_DEFAULTS === 'true',
        allowTestPurge: process.env.ALLOW_TEST_PURGE === 'true',
        connectorProvider: process.env.CONNECTOR_PROVIDER,
        noticeDeliveryProvider: process.env.NOTICE_DELIVERY_PROVIDER,
        contractAiProvider: process.env.CONTRACT_AI_PROVIDER,
        cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        backupConfigured: process.env.BACKUP_CONFIGURED === 'true',
        clamavHost: process.env.CLAMAV_HOST,
      },
);

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
