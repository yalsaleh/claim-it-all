#!/usr/bin/env node
/**
 * Synthetic pilot tenant create — writes JSON under artifacts/pilot-readiness.
 * Rejects PRODUCTION default environment. Does not call real cloud APIs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.PILOT_READY_OUT_DIR
  ? path.resolve(process.env.PILOT_READY_OUT_DIR)
  : path.join(root, 'artifacts/pilot-readiness');
fs.mkdirSync(outDir, { recursive: true });

const env = String(process.env.CONTRACTRADAR_ENV || process.env.APP_ENV || 'PILOT').toUpperCase();
if (env === 'PRODUCTION' || env === 'PROD') {
  const report = {
    ok: false,
    status: 'BLOCKED',
    error: 'Refusing tenant-create when environment defaults to PRODUCTION',
  };
  fs.writeFileSync(
    path.join(outDir, 'pilot-tenant-create.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

const tenant = {
  tenantId: process.env.PILOT_TENANT_ID || `pilot-${randomUUID().slice(0, 8)}`,
  slug: process.env.PILOT_TENANT_SLUG || 'pilot-synthetic',
  displayName: process.env.PILOT_TENANT_NAME || 'Pilot Synthetic Tenant',
  environment: env === 'LOCAL' || env === 'TEST' || env === 'CI' ? env : 'PILOT',
  createdAt: new Date().toISOString(),
  synthetic: true,
  capabilities: {
    aiEnabled: false,
    realConnectorsEnabled: false,
    noticeDeliveryEnabled: false,
    autonomousSyncEnabled: false,
  },
  honesty: 'Synthetic tenant record only. Not provisioned in a real multi-tenant cloud.',
};

fs.writeFileSync(path.join(outDir, 'pilot-tenant.json'), `${JSON.stringify(tenant, null, 2)}\n`);
const report = { ok: true, status: 'CREATED_SYNTHETIC', tenant };
fs.writeFileSync(
  path.join(outDir, 'pilot-tenant-create.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
