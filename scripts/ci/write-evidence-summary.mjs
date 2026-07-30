#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [workflow, status, outDir, ...rest] = process.argv.slice(2);
if (!workflow || !status || !outDir) {
  console.error(
    'Usage: write-evidence-summary.mjs <workflow> <PASS|FAIL> <outDir> [checksExecuted=a,b] [checksNotRun=c] [knownGaps=d]',
  );
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
function parseKV(prefix) {
  const hit = rest.find((x) => x.startsWith(prefix));
  if (!hit) return [];
  return hit
    .slice(prefix.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
const summary = {
  commitSha: process.env.GITHUB_SHA || process.env.COMMIT_SHA || 'local',
  workflow,
  status,
  checksExecuted: parseKV('checksExecuted='),
  checksNotRun: parseKV('checksNotRun='),
  knownGaps: parseKV('knownGaps='),
  artifacts: fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f !== 'evidence-summary.json')
    : [],
  timestamp: new Date().toISOString(),
  labelNotes: {
    PASS: 'Check executed and succeeded',
    FAIL: 'Check executed and failed',
    NOT_RUN: 'Check not executed in this workflow',
    DEFERRED: 'Intentionally postponed',
    NOT_VERIFIED: 'External/production verification unavailable',
  },
};
const dest = path.join(outDir, 'evidence-summary.json');
fs.writeFileSync(dest, JSON.stringify(summary, null, 2) + '\n');
console.log(dest);
