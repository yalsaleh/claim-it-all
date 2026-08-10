#!/usr/bin/env node
/**
 * Pilot preflight gate (synthetic-capable).
 * Uses the same rules as packages/platform evaluatePilotBurndown.
 * Blocks on FIX_BEFORE_PILOT, expired actives, critical runtime, and
 * UPSTREAM_BLOCKED without PILOT_APPROVED_EXCEPTION (unless synthetic).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.PILOT_READY_OUT_DIR
  ? path.resolve(process.env.PILOT_READY_OUT_DIR)
  : path.join(root, 'artifacts/pilot-readiness');
fs.mkdirSync(outDir, { recursive: true });

const synthetic =
  process.env.PILOT_PREFLIGHT_SYNTHETIC === 'true' || process.env.PILOT_PREFLIGHT_SYNTHETIC === '1';

function evaluatePilotBurndown(exceptions, options = {}) {
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const blockers = [];
  const notes = [];
  const active = exceptions.filter((e) => e.status === 'active');
  for (const ex of active) {
    const burndown = String(ex.burndownClass ?? '');
    if (ex.expiresAt < today) blockers.push(`${ex.id}: expired on ${ex.expiresAt}`);
    if (burndown === 'FIX_NOW' || burndown === 'FIX_BEFORE_PILOT') {
      blockers.push(`${ex.id}: burndownClass ${burndown} blocks pilot`);
    }
    if (ex.severity === 'critical' && ex.classification === 'runtime') {
      blockers.push(`${ex.id}: critical runtime exception is active`);
    }
    if (burndown === 'UPSTREAM_BLOCKED') {
      const decision = ex.pilotDecisionStatus ?? 'PENDING';
      if (decision === 'PILOT_APPROVED_EXCEPTION') {
        notes.push(`${ex.id}: UPSTREAM_BLOCKED with PILOT_APPROVED_EXCEPTION`);
      } else if (options.synthetic) {
        notes.push(`${ex.id}: UPSTREAM_BLOCKED pending — synthetic preflight only`);
      } else {
        blockers.push(
          `${ex.id}: UPSTREAM_BLOCKED requires pilotDecisionStatus=PILOT_APPROVED_EXCEPTION`,
        );
      }
    }
    if (burndown === 'DEV_ONLY_ACCEPT_TEMPORARILY') {
      notes.push(`${ex.id}: DEV_ONLY_ACCEPT_TEMPORARILY`);
    }
  }
  if (blockers.length) {
    return {
      status: 'BLOCKED',
      blockers,
      notes,
      activeExceptions: active.map((e) => e.id),
    };
  }
  if (notes.length || active.length) {
    return {
      status: 'PASS_WITH_APPROVED_EXCEPTIONS',
      blockers,
      notes,
      activeExceptions: active.map((e) => e.id),
    };
  }
  return { status: 'PASS', blockers, notes, activeExceptions: active.map((e) => e.id) };
}

// Prefer platform helper via vitest/node strip when available for parity signal.
function tryPlatformEvaluate(exceptions) {
  const helper = path.join(root, 'scripts/pilot/_burndown-eval.mjs');
  // Keep evaluation in this file; platform unit tests own the TS source of truth.
  void helper;
  return evaluatePilotBurndown(exceptions, { synthetic });
}

const exceptionsPath = path.join(root, 'security/vulnerability-exceptions.json');
const doc = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));
const result = tryPlatformEvaluate(doc.exceptions || []);

// Optional: run platform unit burndown tests in CI as a consistency check (non-blocking here).
if (process.env.PILOT_PREFLIGHT_RUN_UNIT === 'true') {
  spawnSync('pnpm', ['--filter', '@contractradar/platform', 'test:unit', 'pilot-burndown'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const report = {
  ok: result.status !== 'BLOCKED',
  status: result.status,
  synthetic,
  generatedAt: new Date().toISOString(),
  blockers: result.blockers,
  notes: result.notes,
  activeExceptions: result.activeExceptions,
  honesty:
    'Policy evaluation against exception register only. Synthetic mode is for CI/local scaffolding, not go-live.',
};

const outPath = path.join(outDir, 'pilot-preflight-report.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(result.status === 'BLOCKED' ? 1 : 0);
