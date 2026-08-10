#!/usr/bin/env node
/**
 * Generate a synthetic release manifest JSON (digest placeholders allowed when marked).
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

function gitSha() {
  if (process.env.RELEASE_SHA) return process.env.RELEASE_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '0000000';
  }
}

function placeholderDigest(label) {
  const hex = createHash('sha256').update(`placeholder:${label}:${gitSha()}`).digest('hex');
  return `sha256:${hex}`;
}

const sha = gitSha();
const releaseId = process.env.RELEASE_ID || `rc-${sha.slice(0, 12)}`;
const migrationVersion =
  process.env.MIGRATION_VERSION ||
  process.env.DATABASE_MIGRATION_VERSION ||
  'SYNTHETIC_MIGRATION_VERSION';

const manifest = {
  schemaVersion: 1,
  releaseId,
  state: 'CANDIDATE',
  gitSha: sha,
  createdAt: new Date().toISOString(),
  migrationVersion,
  images: [
    {
      name: 'contractradar-web',
      digest: process.env.IMAGE_DIGEST_WEB || placeholderDigest('web'),
      tag: process.env.IMAGE_TAG_WEB || releaseId,
    },
    {
      name: 'contractradar-document-intelligence',
      digest: process.env.IMAGE_DIGEST_DI || placeholderDigest('di'),
      tag: process.env.IMAGE_TAG_DI || releaseId,
    },
  ],
  sbomDigest: process.env.SBOM_DIGEST || placeholderDigest('sbom'),
  vulnerabilityPolicyDigest: process.env.VULN_POLICY_DIGEST || placeholderDigest('vuln-policy'),
  notes:
    'Synthetic release candidate manifest. Digests may be placeholders until real image build evidence exists. Not a production deploy.',
  honesty: 'Scaffolding only — no registry push, no cloud deploy.',
};

// Reject accidental latest tags even in generator.
for (const img of manifest.images) {
  if (img.tag && String(img.tag).toLowerCase() === 'latest') {
    console.error('Refusing to generate manifest with tag "latest"');
    process.exit(1);
  }
}

const outPath = path.join(outDir, 'release-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
