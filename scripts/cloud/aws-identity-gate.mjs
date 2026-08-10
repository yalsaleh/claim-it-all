#!/usr/bin/env node
/**
 * Record AWS identity availability without printing secrets.
 * Exits 0 with NOT RUN when unavailable (static path); exits 2 when identity
 * is required (CLOUD_REQUIRE_AWS=true) but missing.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

function gitSha() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return (r.stdout || '').trim() || process.env.GITHUB_SHA || 'unknown';
}

const requireAws = process.env.CLOUD_REQUIRE_AWS === 'true';
const awsCli = spawnSync('aws', ['--version'], { encoding: 'utf8' });
let account = null;
let arn = null;
let status = 'NOT RUN — AWS identity unavailable';

if (awsCli.status === 0) {
  const id = spawnSync(
    'aws',
    ['sts', 'get-caller-identity', '--query', '{Account:Account,Arn:Arn}', '--output', 'json'],
    { encoding: 'utf8' },
  );
  if (id.status === 0 && id.stdout) {
    try {
      const parsed = JSON.parse(id.stdout);
      account = parsed.Account || null;
      arn = parsed.Arn || null;
      status = 'AVAILABLE';
    } catch {
      status = 'NOT RUN — AWS identity unavailable';
    }
  }
}

const doc = {
  ok: !requireAws || status === 'AVAILABLE',
  status,
  gitSha: gitSha(),
  environment: 'PILOT',
  awsAccountId: account,
  principalArn: arn,
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null,
  timestamp: new Date().toISOString(),
  awsCliPresent: awsCli.status === 0,
  honesty: 'Never prints access keys, secret keys, or session tokens. Does not fabricate accounts.',
};

fs.writeFileSync(
  path.join(outDir, 'aws-identity-report.json'),
  `${JSON.stringify(doc, null, 2)}\n`,
);
console.log(JSON.stringify(doc, null, 2));
if (requireAws && status !== 'AVAILABLE') process.exit(2);
process.exit(0);
