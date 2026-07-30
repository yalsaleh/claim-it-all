#!/usr/bin/env node
/**
 * Gate critical/high advisories via an owned, expiring exception register.
 * Captures pnpm audit (nonzero OK) then fails policy evaluation correctly.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = process.env.SUPPLY_CHAIN_OUT_DIR
  ? path.resolve(process.env.SUPPLY_CHAIN_OUT_DIR)
  : path.join(root, 'artifacts/supply-chain');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const auditJsonPath = path.join(outDir, `pnpm-audit-${stamp}.json`);
const reportJsonPath = path.join(outDir, `vulnerability-policy-${stamp}.json`);
const reportTxtPath = path.join(outDir, `vulnerability-policy-${stamp}.txt`);
const exceptionsPath = path.join(root, 'security/vulnerability-exceptions.json');

function runPnpmAudit() {
  const result = spawnSync('pnpm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  const stdout = result.stdout || '';
  fs.writeFileSync(auditJsonPath, stdout || '{}');
  let parsed = {};
  try {
    parsed = JSON.parse(stdout || '{}');
  } catch {
    parsed = { parseError: true, rawLength: stdout.length };
  }
  return { exitCode: result.status ?? 1, parsed };
}

function normalizeFindings(audit) {
  const advisories = audit.advisories || {};
  const findings = [];
  for (const [advisoryId, adv] of Object.entries(advisories)) {
    const paths = (adv.findings || []).flatMap((f) => f.paths || []) || [];
    const dependencyPath = paths[0] || `unknown>${adv.module_name}`;
    findings.push({
      advisoryId: String(advisoryId),
      package: adv.module_name,
      severity: String(adv.severity || 'unknown').toLowerCase(),
      title: adv.title || '',
      vulnerableVersions: adv.vulnerable_versions || '',
      patchedVersions: adv.patched_versions || '',
      dependencyPath,
      url: adv.url || '',
      classification: classify(adv.module_name, dependencyPath),
    });
  }
  return findings;
}

function classify(pkg, depPath) {
  const p = `${pkg} ${depPath}`.toLowerCase();
  if (
    p.includes('vitest') ||
    p.includes('vite') ||
    p.includes('eslint') ||
    p.includes('@types/') ||
    p.includes('prettier') ||
    p.includes('tsx@') ||
    p.includes('embedded-postgres')
  ) {
    return 'development';
  }
  return 'runtime';
}

function loadExceptions() {
  if (!fs.existsSync(exceptionsPath)) {
    throw new Error(`Missing exception register: ${exceptionsPath}`);
  }
  const doc = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));
  if (!Array.isArray(doc.exceptions)) throw new Error('exceptions must be an array');
  for (const ex of doc.exceptions) {
    for (const key of [
      'id',
      'advisoryId',
      'package',
      'dependencyPath',
      'severity',
      'classification',
      'owner',
      'reason',
      'mitigation',
      'approvedBy',
      'expiresAt',
      'status',
    ]) {
      if (!ex[key] || String(ex[key]).trim() === '') {
        throw new Error(`Malformed exception ${ex.id || '?'}: missing ${key}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.expiresAt)) {
      throw new Error(`Malformed exception ${ex.id}: expiresAt must be YYYY-MM-DD`);
    }
  }
  return doc;
}

function matchException(finding, exceptions, now) {
  const matches = exceptions.filter((ex) => {
    if (ex.status !== 'active') return false;
    if (String(ex.advisoryId) !== String(finding.advisoryId)) return false;
    if (ex.package !== finding.package) return false;
    // Path must be equal or a prefix match of the reported path (no unrelated suppression).
    if (
      finding.dependencyPath !== ex.dependencyPath &&
      !finding.dependencyPath.startsWith(ex.dependencyPath)
    ) {
      return false;
    }
    return true;
  });
  if (matches.length === 0) return { matched: false };
  const ex = matches[0];
  const expired = ex.expiresAt < now.toISOString().slice(0, 10);
  return { matched: true, exception: ex, expired };
}

function evaluate(findings, doc) {
  const now = new Date();
  const policy = doc.policy || {};
  const failures = [];
  const approved = [];
  const ignored = [];

  for (const finding of findings) {
    const sev = finding.severity;
    if (sev !== 'critical' && sev !== 'high') {
      ignored.push({ ...finding, reason: 'below_gating_severity' });
      continue;
    }
    const m = matchException(finding, doc.exceptions, now);
    if (!m.matched) {
      failures.push({
        code: 'UNAPPROVED_FINDING',
        finding,
        message: `Unapproved ${sev} advisory ${finding.advisoryId} for ${finding.package} (${finding.classification})`,
      });
      continue;
    }
    if (m.expired) {
      failures.push({
        code: 'EXPIRED_EXCEPTION',
        finding,
        exceptionId: m.exception.id,
        message: `Exception ${m.exception.id} expired on ${m.exception.expiresAt}`,
      });
      continue;
    }
    approved.push({ finding, exceptionId: m.exception.id, expiresAt: m.exception.expiresAt });
  }

  // Expired active exceptions fail even if unused? Policy: expire fails when matched above.
  // Also fail register entries that claim active but are past expiry (hygiene).
  for (const ex of doc.exceptions) {
    if (ex.status === 'active' && ex.expiresAt < now.toISOString().slice(0, 10)) {
      if (!failures.some((f) => f.exceptionId === ex.id)) {
        failures.push({
          code: 'EXPIRED_EXCEPTION',
          exceptionId: ex.id,
          message: `Active exception ${ex.id} is past expiry ${ex.expiresAt}`,
        });
      }
    }
  }

  const ok =
    failures.length === 0 &&
    policy.failOnUnapprovedCritical !== false &&
    policy.failOnUnapprovedHigh !== false;

  return {
    ok: failures.length === 0,
    generatedAt: now.toISOString(),
    counts: {
      findings: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      approvedExceptionsUsed: approved.length,
      failures: failures.length,
    },
    failures,
    approved,
    ignoredSample: ignored.slice(0, 20),
    auditArtifact: path.relative(root, auditJsonPath),
  };
}

function main() {
  const { parsed } = runPnpmAudit();
  if (parsed.parseError) {
    console.error('Failed to parse pnpm audit JSON');
    process.exit(2);
  }
  let doc;
  try {
    doc = loadExceptions();
  } catch (err) {
    console.error(String(err));
    process.exit(2);
  }
  const findings = normalizeFindings(parsed);
  const report = evaluate(findings, doc);
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2) + '\n');
  const lines = [
    `Vulnerability policy: ${report.ok ? 'PASS' : 'FAIL'}`,
    `Findings: ${report.counts.findings} (critical=${report.counts.critical}, high=${report.counts.high})`,
    `Approved exceptions used: ${report.counts.approvedExceptionsUsed}`,
    `Failures: ${report.counts.failures}`,
    ...report.failures.map((f) => `- ${f.code}: ${f.message}`),
    `Audit JSON: ${report.auditArtifact}`,
    `Policy JSON: ${path.relative(root, reportJsonPath)}`,
  ];
  fs.writeFileSync(reportTxtPath, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  // Also write stable latest names for workflows
  fs.copyFileSync(auditJsonPath, path.join(outDir, 'pnpm-audit.json'));
  fs.copyFileSync(reportJsonPath, path.join(outDir, 'vulnerability-policy.json'));
  fs.copyFileSync(reportTxtPath, path.join(outDir, 'vulnerability-policy.txt'));
  fs.copyFileSync(exceptionsPath, path.join(outDir, 'vulnerability-exceptions.snapshot.json'));
  process.exit(report.ok ? 0 : 1);
}

main();
