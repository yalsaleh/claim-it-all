#!/usr/bin/env node
/**
 * Generate release manifest. When image-digest-report.json / SBOM / vuln policy exist,
 * wire real digests. Cloud deploy must set REQUIRE_REAL_DIGESTS=true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.PILOT_READY_OUT_DIR
  ? path.resolve(process.env.PILOT_READY_OUT_DIR)
  : path.join(root, 'artifacts/pilot-readiness');
fs.mkdirSync(outDir, { recursive: true });

const requireReal = process.env.REQUIRE_REAL_DIGESTS === 'true';

function gitSha() {
  if (process.env.RELEASE_SHA) return process.env.RELEASE_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function fileDigest(filePath) {
  const buf = fs.readFileSync(filePath);
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

function findFirst(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function latestMigrationVersion() {
  const migDir = path.join(root, 'apps/web/prisma/migrations');
  if (!fs.existsSync(migDir)) return null;
  const names = fs
    .readdirSync(migDir)
    .filter((n) => fs.existsSync(path.join(migDir, n, 'migration.sql')))
    .sort();
  return names.length ? names[names.length - 1] : null;
}

const sha = gitSha();
if (!sha) {
  console.error('gitSha unavailable');
  process.exit(1);
}

const digestReportPath = findFirst([
  path.join(outDir, 'image-digest-report.json'),
  path.join(root, 'artifacts/pilot-readiness/image-digest-report.json'),
]);
let webDigest = process.env.IMAGE_DIGEST_WEB || '';
let diDigest = process.env.IMAGE_DIGEST_DI || '';
if (digestReportPath) {
  const report = JSON.parse(fs.readFileSync(digestReportPath, 'utf8'));
  webDigest = webDigest || report.web?.digest || report.web?.imageId || '';
  diDigest = diDigest || report.di?.digest || report.di?.imageId || '';
}

const sbomPath = findFirst([
  process.env.SBOM_PATH,
  path.join(outDir, 'sbom.json'),
  path.join(root, 'artifacts/supply-chain/sbom.json'),
  path.join(root, 'artifacts/pilot-readiness/sbom.json'),
]);
const vulnPath = findFirst([
  process.env.VULN_POLICY_PATH,
  path.join(outDir, 'vulnerability-policy.json'),
  path.join(root, 'artifacts/supply-chain/vulnerability-policy.json'),
  path.join(root, 'artifacts/pilot-readiness/vulnerability-policy.json'),
]);

let sbomDigest = process.env.SBOM_DIGEST || (sbomPath ? fileDigest(sbomPath) : '');
let vulnDigest = process.env.VULN_POLICY_DIGEST || (vulnPath ? fileDigest(vulnPath) : '');
let migrationVersion = process.env.MIGRATION_VERSION || latestMigrationVersion() || '';

const infraRevisionPath = path.join(root, 'infrastructure/pilot/terraform');
const infrastructureRevision =
  process.env.INFRA_REVISION ||
  (fs.existsSync(infraRevisionPath)
    ? `sha256:${createHash('sha256')
        .update(
          fs
            .readdirSync(infraRevisionPath)
            .filter((f) => f.endsWith('.tf'))
            .sort()
            .map((f) => fs.readFileSync(path.join(infraRevisionPath, f)))
            .join('|'),
        )
        .digest('hex')}`
    : '');

const missing = [];
if (!webDigest) missing.push('web image digest');
if (!diDigest) missing.push('di image digest');
if (!sbomDigest) missing.push('sbom digest');
if (!vulnDigest) missing.push('vulnerability policy digest');
if (!migrationVersion) missing.push('migration version');

if (requireReal && missing.length) {
  console.error(`REQUIRE_REAL_DIGESTS=true but missing: ${missing.join(', ')}`);
  process.exit(1);
}

if (!requireReal && missing.length) {
  // Local scaffolding only — fail closed for cloud path via REQUIRE_REAL_DIGESTS.
  const hex = (label) =>
    `sha256:${createHash('sha256').update(`local-scaffold:${label}:${sha}`).digest('hex')}`;
  if (!webDigest) webDigest = hex('web');
  if (!diDigest) diDigest = hex('di');
  if (!sbomDigest) sbomDigest = hex('sbom');
  if (!vulnDigest) vulnDigest = hex('vuln');
  if (!migrationVersion) migrationVersion = latestMigrationVersion() || 'unknown';
}

const releaseId = process.env.RELEASE_ID || `rc-${sha.slice(0, 12)}`;
const manifest = {
  schemaVersion: 1,
  releaseId,
  state: 'RELEASE_CANDIDATE',
  gitSha: sha,
  createdAt: new Date().toISOString(),
  migrationVersion,
  images: [
    { name: 'contractradar-web', digest: webDigest, tag: process.env.IMAGE_TAG_WEB || releaseId },
    {
      name: 'contractradar-document-intelligence',
      digest: diDigest,
      tag: process.env.IMAGE_TAG_DI || releaseId,
    },
  ],
  sbomDigest,
  vulnerabilityPolicyDigest: vulnDigest,
  infrastructureRevision: infrastructureRevision || undefined,
  environmentPolicyVersion: process.env.ENVIRONMENT_POLICY_VERSION || 'ADR-103/ADR-104',
  backupVerificationId: process.env.BACKUP_VERIFICATION_ID,
  restoreVerificationId: process.env.RESTORE_VERIFICATION_ID,
  pilotPreflightId: process.env.PILOT_PREFLIGHT_ID,
  notes: requireReal
    ? 'Release candidate with wired immutable digests from build evidence.'
    : 'Local/CI scaffolding may synthesize digests when build evidence is absent. Cloud deploy requires REQUIRE_REAL_DIGESTS=true.',
  honesty: requireReal
    ? 'Digests wired from image-digest-report / SBOM / vulnerability-policy files.'
    : 'Scaffolding allowed only when REQUIRE_REAL_DIGESTS is not set.',
};

for (const img of manifest.images) {
  if (img.tag && String(img.tag).toLowerCase() === 'latest') {
    console.error('Refusing tag latest');
    process.exit(1);
  }
}

const outPath = path.join(outDir, 'release-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
