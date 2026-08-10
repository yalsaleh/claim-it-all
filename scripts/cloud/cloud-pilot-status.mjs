#!/usr/bin/env node
/**
 * Emits cloud pilot evidence status. Never fabricates a successful cloud deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const hasAwsIdentity = Boolean(
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN,
);
const deployRequested = process.env.CLOUD_PILOT_DEPLOY === 'true';

const doc = {
  ok: true,
  status:
    deployRequested && hasAwsIdentity
      ? 'DEPLOY_REQUESTED — use Cloud pilot deploy workflow with protected environment'
      : 'NOT RUN — cloud environment unavailable',
  cloudProvider: 'aws',
  architecture: 'ECS Fargate + RDS + ElastiCache + private S3 + ALB + Secrets Manager',
  applyExecuted: false,
  realProvidersEnabled: [],
  realCustomerDataAccessed: false,
  realMessagesSent: false,
  sharpDecision:
    'REMEDIATED via pnpm override sharp@0.35.3 (EXC-2026-005 resolved) — AWS identity still required for apply',
  honesty:
    'Refuses to claim a cloud deploy without CLOUD_PILOT_DEPLOY=true, AWS identity, and human approval. No credentials are requested or fabricated.',
  gitSha: process.env.GITHUB_SHA || process.env.RELEASE_SHA || null,
  environment: 'PILOT',
  awsAccountId: process.env.AWS_ACCOUNT_ID || null,
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null,
  timestamp: new Date().toISOString(),
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(outDir, 'cloud-pilot-status.json'), `${JSON.stringify(doc, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, 'cloud-pilot-evidence-summary.json'),
  `${JSON.stringify(
    {
      ...doc,
      artifactsExpected: [
        'release-manifest.json',
        'network-security-report.json',
        'terraform-validate-report.json',
        'cloud-pilot-status.json',
      ],
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify(doc, null, 2));
