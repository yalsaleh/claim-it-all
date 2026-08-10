#!/usr/bin/env node
/**
 * Validate synthetic pilot tenant JSON produced by tenant-create.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
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
    error: 'Refusing tenant-validate when environment defaults to PRODUCTION',
  };
  fs.writeFileSync(
    path.join(outDir, 'pilot-tenant-validate.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

const tenantPath = path.join(outDir, 'pilot-tenant.json');
const errors = [];
if (!fs.existsSync(tenantPath)) {
  errors.push('missing pilot-tenant.json — run pilot:tenant:create first');
}

let tenant = null;
if (errors.length === 0) {
  tenant = JSON.parse(fs.readFileSync(tenantPath, 'utf8'));
  if (!tenant.tenantId) errors.push('tenantId required');
  if (!tenant.synthetic) errors.push('tenant must be marked synthetic for this scaffolding path');
  if (String(tenant.environment).toUpperCase() === 'PRODUCTION') {
    errors.push('tenant.environment must not be PRODUCTION');
  }
  const caps = tenant.capabilities || {};
  for (const key of [
    'aiEnabled',
    'realConnectorsEnabled',
    'noticeDeliveryEnabled',
    'autonomousSyncEnabled',
  ]) {
    if (caps[key] !== false) errors.push(`capabilities.${key} must be false for pilot scaffolding`);
  }
}

const report = {
  ok: errors.length === 0,
  status: errors.length === 0 ? 'VALID' : 'INVALID',
  errors,
  tenant,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(outDir, 'pilot-tenant-validate.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
