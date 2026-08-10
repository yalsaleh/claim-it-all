#!/usr/bin/env node
/**
 * Cloud smoke suite entrypoint. Refuses to fabricate PASS without a live pilot base URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = (process.env.PILOT_CLOUD_BASE_URL || '').replace(/\/$/, '');
const checks = [
  'https_reachable',
  'liveness',
  'readiness',
  'authentication',
  'tenant_isolation',
  'project_create_read',
  'synthetic_upload',
  'malware_scan',
  'object_promotion',
  'extraction',
  'contract_config',
  'event_detection',
  'human_confirmation',
  'deadline_calculation',
  'notice_drafting',
  'export',
  'manual_dispatch_record',
  'operations_dashboard',
  'portfolio_dashboard',
  'alert_creation',
  'audit_logging',
  'queue_processing',
  'outbox_processing',
  'restart_recovery',
];

const doc = {
  ok: false,
  status: baseUrl
    ? 'BLOCKED — live smoke runner not yet wired for this environment URL; refuse synthetic PASS'
    : 'NOT RUN — cloud environment unavailable (PILOT_CLOUD_BASE_URL unset)',
  baseUrl: baseUrl || null,
  checks,
  realDeliveryAttempted: false,
  realProvidersEnabled: [],
  generatedAt: new Date().toISOString(),
};

const outPath = path.join(outDir, 'cloud-smoke-report.json');
fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(JSON.stringify(doc, null, 2));
process.exit(baseUrl ? 2 : 0);
