#!/usr/bin/env node
/**
 * pnpm production:validate — redacted readiness report (no secrets printed).
 */
import { validateProductionConfig } from '../../packages/platform/dist/index.js';

const report = validateProductionConfig({
  environment:
    process.env.CONTRACTRADAR_ENV || process.env.APP_ENV || process.env.NODE_ENV || 'LOCAL',
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
  connectorProvider: process.env.CONNECTOR_PROVIDER,
  noticeDeliveryProvider: process.env.NOTICE_DELIVERY_PROVIDER,
  contractAiProvider: process.env.CONTRACT_AI_PROVIDER,
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  backupConfigured: process.env.BACKUP_CONFIGURED === 'true',
  clamavHost: process.env.CLAMAV_HOST,
});

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
