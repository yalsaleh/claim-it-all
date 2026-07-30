#!/usr/bin/env node
/**
 * Generate license inventory + enforce denied-license policy.
 * UNKNOWN licenses warn (or fail if policy.unknownLicenseSeverity === 'error').
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.SUPPLY_CHAIN_OUT_DIR
  ? path.resolve(process.env.SUPPLY_CHAIN_OUT_DIR)
  : path.join(root, 'artifacts/supply-chain');
fs.mkdirSync(outDir, { recursive: true });
const policy = JSON.parse(fs.readFileSync(path.join(root, 'security/license-policy.json'), 'utf8'));
const denied = new Set((policy.deniedLicenses || []).map((x) => normalizeLicense(x)));
const allowed = new Set((policy.allowedLicenses || []).map((x) => normalizeLicense(x)));

function normalizeLicense(raw) {
  return String(raw || 'UNKNOWN')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/LICEN[CS]E$/, '');
}

function licenseTokens(raw) {
  return String(raw || 'UNKNOWN')
    .split(/\s+(?:OR|AND)\s+|\s*\|\s*|\s*,\s*/i)
    .map(normalizeLicense)
    .filter(Boolean);
}

const byKey = new Map();
function upsert(pkg) {
  const key = `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;
  const prev = byKey.get(key);
  if (!prev || (prev.license === 'UNKNOWN' && pkg.license !== 'UNKNOWN')) {
    byKey.set(key, pkg);
  }
}

const lic = spawnSync('pnpm', ['licenses', 'list', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  shell: process.platform === 'win32',
});
if (lic.status === 0 && lic.stdout.trim().startsWith('{')) {
  try {
    const data = JSON.parse(lic.stdout);
    for (const [license, pkgs] of Object.entries(data)) {
      if (!Array.isArray(pkgs)) continue;
      for (const p of pkgs) {
        upsert({
          ecosystem: 'npm',
          name: p.name || p.packageName || 'unknown',
          version: Array.isArray(p.versions) ? p.versions[0] : p.version || '?',
          license,
          source: 'pnpm-licenses',
        });
      }
    }
  } catch {
    /* fall through */
  }
}

upsert({
  ecosystem: 'python',
  name: 'document-intelligence',
  version: 'workspace',
  license: 'UNKNOWN',
  source: 'pyproject.toml',
});

const packages = [...byKey.values()];
const findings = [];
for (const p of packages) {
  const tokens = licenseTokens(p.license);
  const isUnknown =
    tokens.length === 0 || tokens.every((t) => ['UNKNOWN', 'UNLICENSED', 'NONE', ''].includes(t));
  const deniedHit = tokens.find((t) => denied.has(t));
  if (deniedHit) {
    findings.push({
      severity: 'error',
      package: p.name,
      license: p.license,
      code: 'DENIED_LICENSE',
      matched: deniedHit,
    });
  } else if (isUnknown) {
    findings.push({
      severity: policy.unknownLicenseSeverity === 'error' ? 'error' : 'warn',
      package: p.name,
      license: p.license || 'UNKNOWN',
      code: 'UNKNOWN_LICENSE',
    });
  } else if (
    allowed.size > 0 &&
    !tokens.some((t) => allowed.has(t) || t.startsWith('MIT') || t.startsWith('APACHE'))
  ) {
    // Non-denied, non-allowlisted licenses are warnings for review (not silent fail).
    findings.push({
      severity: 'warn',
      package: p.name,
      license: p.license,
      code: 'REVIEW_LICENSE',
    });
  }
}

const hasError = findings.some((f) => f.severity === 'error');
const doc = {
  ok: !hasError,
  policy,
  packageCount: packages.length,
  findings: findings.slice(0, 300),
  packagesSample: packages.slice(0, 150),
  notes: 'Primary source is pnpm licenses list; UNKNOWN warns by default. Denied licenses fail CI.',
};
fs.writeFileSync(path.join(outDir, 'license-inventory.json'), JSON.stringify(doc, null, 2) + '\n');
const lines = [
  `License inventory: ${doc.ok ? 'PASS' : 'FAIL'}`,
  `Packages listed: ${doc.packageCount}`,
  `Findings: ${findings.length} (errors=${findings.filter((f) => f.severity === 'error').length})`,
  ...findings.slice(0, 40).map((f) => `- ${f.severity}: ${f.code} ${f.package} (${f.license})`),
];
fs.writeFileSync(path.join(outDir, 'license-policy.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exit(doc.ok ? 0 : 1);
