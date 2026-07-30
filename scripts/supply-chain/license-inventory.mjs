#!/usr/bin/env node
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
const denied = (policy.deniedLicenses || []).map((x) => String(x).toUpperCase());

const packages = [];
const lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
for (const m of lock.matchAll(/^\s{2}([^\s][^:]+?)@([^:]+):\s*$/gm)) {
  packages.push({
    ecosystem: 'npm',
    name: m[1],
    version: m[2],
    license: 'UNKNOWN',
    source: 'pnpm-lock',
  });
}
packages.push({
  ecosystem: 'python',
  name: 'document-intelligence',
  version: 'workspace',
  license: 'UNKNOWN',
  source: 'pyproject.toml',
});

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
        packages.push({
          ecosystem: 'npm',
          name: p.name || p.packageName || 'unknown',
          version: Array.isArray(p.versions) ? p.versions[0] : p.version || '?',
          license,
          source: 'pnpm-licenses',
        });
      }
    }
  } catch {
    /* keep lock-only inventory */
  }
}

const findings = [];
for (const p of packages) {
  const licName = String(p.license || 'UNKNOWN').toUpperCase();
  if (denied.some((d) => licName.includes(d))) {
    findings.push({
      severity: 'error',
      package: p.name,
      license: licName,
      code: 'DENIED_LICENSE',
    });
  } else if (
    ['UNKNOWN', 'UNLICENSED', 'NONE', ''].includes(licName) &&
    p.name !== '_license_list_error'
  ) {
    findings.push({
      severity: 'warn',
      package: p.name,
      license: licName,
      code: 'UNKNOWN_LICENSE',
    });
  }
}

const doc = {
  ok: !findings.some((f) => f.severity === 'error'),
  policy,
  packageCount: packages.length,
  findings: findings.slice(0, 200),
  packagesSample: packages.slice(0, 100),
};
fs.writeFileSync(path.join(outDir, 'license-inventory.json'), JSON.stringify(doc, null, 2) + '\n');
const lines = [
  `License inventory: ${doc.ok ? 'PASS' : 'FAIL'}`,
  `Packages listed: ${doc.packageCount}`,
  `Findings: ${findings.length}`,
  ...findings.slice(0, 30).map((f) => `- ${f.severity}: ${f.code} ${f.package} (${f.license})`),
];
fs.writeFileSync(path.join(outDir, 'license-policy.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exit(doc.ok ? 0 : 1);
