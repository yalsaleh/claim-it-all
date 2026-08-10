#!/usr/bin/env node
/**
 * Rough pilot cost estimate from Terraform variable defaults / sizing.
 * Not a bill guarantee.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.CLOUD_PILOT_OUT_DIR
  ? path.resolve(process.env.CLOUD_PILOT_OUT_DIR)
  : path.join(root, 'artifacts/cloud-pilot');
fs.mkdirSync(outDir, { recursive: true });

const doc = {
  ok: true,
  status: 'ESTIMATE_ONLY',
  currency: 'USD',
  period: 'month',
  disclaimer:
    'Order-of-magnitude estimate from default pilot sizes. Not a promise of actual AWS charges.',
  assumptions: {
    region: 'us-east-1',
    webDesired: 1,
    workerDesired: 1,
    dbInstanceClass: 'db.t4g.medium',
    redisNodeType: 'cache.t4g.micro',
    natGateways: 2,
    alb: 1,
    ecr: 2,
    s3: 'low synthetic volume',
    cloudwatch: 'basic alarms + 14d logs',
  },
  lineItemsUsd: [
    { component: 'NAT Gateways (2)', low: 64, high: 90 },
    { component: 'ALB', low: 20, high: 45 },
    { component: 'ECS Fargate (web+workers+clamav+di)', low: 80, high: 220 },
    { component: 'RDS PostgreSQL db.t4g.medium', low: 50, high: 90 },
    { component: 'ElastiCache cache.t4g.micro', low: 12, high: 25 },
    { component: 'S3 + backups', low: 5, high: 40 },
    { component: 'Secrets Manager + CloudWatch + ECR', low: 10, high: 40 },
  ],
  estimatedTotalUsd: { low: 241, high: 550 },
  guardrails: {
    budgetAlarm: 'AWS Budgets in monitoring.tf',
    scalingCaps: 'desired_count variables; no unbounded autoscaling',
    storageLifecycle: 'S3 lifecycle in data.tf',
    logRetentionDays: 14,
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(outDir, 'pilot-cost-estimate.json'),
  `${JSON.stringify(doc, null, 2)}\n`,
);
console.log(JSON.stringify(doc, null, 2));
