#!/usr/bin/env node
/**
 * Isolated cloud restore rehearsal. Never claims PASS without a real restore target.
 * Does not destroy primary pilot infrastructure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const restoreTarget = process.env.CLOUD_RESTORE_TARGET_ID || '';
const hasAws = Boolean(
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN,
);

const doc = {
  ok: false,
  status:
    hasAws && restoreTarget
      ? 'BLOCKED — restore orchestration requires operator runbook execution against isolated target'
      : 'NOT RUN — cloud environment unavailable',
  restoreTargetId: restoreTarget || null,
  primaryInfrastructureDestroyed: false,
  verified: {
    migrations: false,
    forceRls: false,
    tenantIsolation: false,
    auditIntegrity: false,
    documentReferences: false,
    objectChecksums: false,
    applicationReadiness: false,
  },
  temporaryEnvironmentDestroyed: false,
  honesty:
    'This report is not equivalent to CI/MinIO synthetic restore. Real cloud restore evidence requires an isolated AWS restore environment.',
  generatedAt: new Date().toISOString(),
};

const outPath = path.join(outDir, 'cloud-restore-rehearsal-report.json');
fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(JSON.stringify(doc, null, 2));
process.exit(0);
