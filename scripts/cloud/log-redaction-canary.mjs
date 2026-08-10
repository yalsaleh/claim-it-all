#!/usr/bin/env node
/**
 * Synthetic secret canary redaction verification (local/CI).
 * Cloud log sink verification requires a live log group and remains NOT RUN without it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const canaries = [
  'password=CANARY_PASSWORD_VALUE',
  'DATABASE_URL=postgresql://user:CANARY_DB_SECRET@db/app',
  'BETTER_AUTH_SECRET=CANARY_AUTH_SECRET_VALUE',
  'Authorization: Bearer CANARY_ACCESS_TOKEN',
  'session=CANARY_SESSION_COOKIE',
  'provider_token=CANARY_PROVIDER_CRED',
  'https://example.local/object?X-Amz-Signature=CANARY_SIGNED_URL',
  'NOTICE_BODY=CANARY_NOTICE_BODY_SHOULD_NOT_LOG',
];

const cloudLogGroup = process.env.PILOT_CLOUDWATCH_LOG_GROUP || '';

const doc = {
  ok: true,
  status: cloudLogGroup
    ? 'PARTIAL — canaries defined; live CloudWatch pull not executed in this scaffold'
    : 'NOT RUN — cloud log group unavailable; local canary set recorded only',
  canaries,
  mustNotAppearInLogs: [
    'passwords',
    'DB URLs',
    'auth secrets',
    'access tokens',
    'session cookies',
    'provider credentials',
    'signed URLs',
    'document bodies',
    'notice bodies',
  ],
  cloudLogGroup: cloudLogGroup || null,
  liveVerification: false,
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(outDir, 'log-redaction-report.json'),
  `${JSON.stringify(doc, null, 2)}\n`,
);
console.log(JSON.stringify(doc, null, 2));
