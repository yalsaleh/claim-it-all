#!/usr/bin/env node
/**
 * Build real-cloud-release-manifest.json. Fails closed on placeholders / missing digests.
 * Does not synthesize scaffold digests (unlike local release-manifest.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const DIGEST_RE = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /placeholder:|SYNTHETIC_|scaffolding|local-scaffold|REPLACE_/i;

function gitSha() {
  if (process.env.RELEASE_SHA) return process.env.RELEASE_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return (r.stdout || '').trim();
}

function readJson(p) {
  if (!p || !fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fileDigest(p) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
}

function assertDigest(label, value) {
  if (!value || !DIGEST_RE.test(value)) {
    throw new Error(`${label} must be sha256:<64 hex>, got ${JSON.stringify(value)}`);
  }
  if (PLACEHOLDER.test(value)) throw new Error(`${label} looks like a placeholder`);
}

const sha = gitSha();
if (!sha || sha.length < 7) throw new Error('gitSha unavailable');

const digestReport =
  readJson(path.join(outDir, 'ecr-image-digest-report.json')) ||
  readJson(path.join(outDir, 'image-digest-report.json')) ||
  readJson(path.join(root, 'artifacts/pilot-readiness', 'image-digest-report.json'));

const webDigest =
  process.env.IMAGE_DIGEST_WEB || digestReport?.web?.digest || digestReport?.web?.repoDigest;
const diDigest =
  process.env.IMAGE_DIGEST_DI || digestReport?.di?.digest || digestReport?.di?.repoDigest;
const workerDigest = process.env.IMAGE_DIGEST_WORKER || digestReport?.worker?.digest || diDigest;

const sbomPath = [
  process.env.SBOM_PATH,
  path.join(outDir, 'sbom.json'),
  path.join(root, 'artifacts/supply-chain/sbom.json'),
].find((p) => p && fs.existsSync(p));
const vulnPath = [
  process.env.VULN_POLICY_PATH,
  path.join(outDir, 'vulnerability-policy.json'),
  path.join(root, 'artifacts/supply-chain/vulnerability-policy.json'),
].find((p) => p && fs.existsSync(p));

const errors = [];
try {
  assertDigest('web image digest', webDigest);
} catch (e) {
  errors.push(e.message);
}
try {
  assertDigest('di image digest', diDigest);
} catch (e) {
  errors.push(e.message);
}
try {
  assertDigest('worker image digest', workerDigest);
} catch (e) {
  errors.push(e.message);
}

const sbomDigest = process.env.SBOM_DIGEST || (sbomPath ? fileDigest(sbomPath) : '');
const vulnDigest = process.env.VULN_POLICY_DIGEST || (vulnPath ? fileDigest(vulnPath) : '');
try {
  assertDigest('sbomDigest', sbomDigest);
} catch (e) {
  errors.push(e.message);
}
try {
  assertDigest('vulnerabilityPolicyDigest', vulnDigest);
} catch (e) {
  errors.push(e.message);
}

const migDir = path.join(root, 'apps/web/prisma/migrations');
const migrationVersion =
  process.env.MIGRATION_VERSION ||
  (fs.existsSync(migDir)
    ? fs
        .readdirSync(migDir)
        .filter((n) => fs.existsSync(path.join(migDir, n, 'migration.sql')))
        .sort()
        .at(-1)
    : '');
if (!migrationVersion) errors.push('migrationVersion missing');

const tfDir = path.join(root, 'infrastructure/pilot/terraform');
const infrastructureRevision = `sha256:${createHash('sha256')
  .update(
    fs
      .readdirSync(tfDir)
      .filter((f) => f.endsWith('.tf'))
      .sort()
      .map((f) => fs.readFileSync(path.join(tfDir, f)))
      .join('|'),
  )
  .digest('hex')}`;

const exceptions = readJson(path.join(root, 'security/vulnerability-exceptions.json'));
const sharp = (exceptions?.exceptions || []).find(
  (e) => e.id === 'EXC-2026-005' && e.status === 'active',
);
const sharpDecision = sharp?.pilotDecisionStatus || 'PENDING';

const approvalPath = path.join(
  root,
  'security/pilot-approved-exceptions',
  `EXC-2026-005.${sha}.json`,
);
const hasShaBoundApproval = fs.existsSync(approvalPath);

const doc = {
  schemaVersion: 1,
  releaseId: `cloud-${sha.slice(0, 12)}`,
  state: errors.length ? 'REJECTED' : 'RELEASE_CANDIDATE',
  gitSha: sha,
  environment: 'PILOT',
  awsAccountId: process.env.AWS_ACCOUNT_ID || null,
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null,
  createdAt: new Date().toISOString(),
  timestamp: new Date().toISOString(),
  migrationVersion,
  images: [
    { name: 'contractradar-web', digest: webDigest || '', tag: process.env.IMAGE_TAG_WEB },
    {
      name: 'contractradar-document-intelligence',
      digest: diDigest || '',
      tag: process.env.IMAGE_TAG_DI,
    },
    { name: 'contractradar-worker', digest: workerDigest || '', tag: process.env.IMAGE_TAG_WORKER },
  ],
  sbomDigest,
  vulnerabilityPolicyDigest: vulnDigest,
  infrastructureRevision,
  environmentPolicyVersion: process.env.ENVIRONMENT_POLICY_VERSION || 'ADR-103/ADR-104',
  backupVerificationId: process.env.BACKUP_VERIFICATION_ID || null,
  restoreVerificationId: process.env.RESTORE_VERIFICATION_ID || null,
  pilotPreflightId: process.env.PILOT_PREFLIGHT_ID || null,
  vulnerabilityExceptionDecision: {
    sharp: sharpDecision,
    shaBoundApprovalPresent: hasShaBoundApproval,
  },
  status: errors.length ? 'FAILED' : 'PASSED',
  errors,
  honesty:
    'Real-cloud manifest refuses scaffold digests. Requires ECR/image digest evidence + SBOM + vuln policy files.',
};

fs.writeFileSync(
  path.join(outDir, 'real-cloud-release-manifest.json'),
  `${JSON.stringify(doc, null, 2)}\n`,
);
console.log(JSON.stringify(doc, null, 2));
if (errors.length) process.exit(2);
if (
  ['latest', 'Latest'].includes(process.env.IMAGE_TAG_WEB) ||
  process.env.IMAGE_TAG_DI === 'latest'
) {
  console.error('latest tag rejected');
  process.exit(2);
}
process.exit(0);
