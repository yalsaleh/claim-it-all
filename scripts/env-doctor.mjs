#!/usr/bin/env node
/**
 * Local environment preflight. Never prints secrets or full database URLs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function redactUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port || (u.protocol === 'postgresql:' ? '5432' : ''),
      database: u.pathname.replace(/^\//, '').split('?')[0] || null,
      user: u.username ? '[set]' : null,
      password: u.password ? '[redacted]' : null,
      queryKeys: [...u.searchParams.keys()],
    };
  } catch {
    return { parseError: true };
  }
}

function portOpen(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: Number(port) }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

const dbUrl = process.env.DATABASE_URL || '';
const migrateUrl = process.env.DATABASE_MIGRATE_URL || '';
const redisUrl = process.env.REDIS_URL || '';
const envFiles = ['.env', 'apps/web/.env', '.env.local']
  .map((p) => path.join(root, p))
  .filter((p) => fs.existsSync(p))
  .map((p) => path.relative(root, p));

const db = redactUrl(dbUrl);
const migrate = redactUrl(migrateUrl);
const redis = redactUrl(redisUrl);

const docker = hasCmd('docker');
const stalePorts = [];
for (const candidate of [db, migrate]) {
  if (candidate?.port && !['5432', '54329', ''].includes(String(candidate.port))) {
    // Flag uncommon ports that often linger from failed local experiments.
    if (['54331', '54330', '54328'].includes(String(candidate.port))) {
      stalePorts.push(String(candidate.port));
    }
  }
}

const pgHost = db?.host || '127.0.0.1';
const pgPort = Number(db?.port || 5432);
const redisHost = redis?.host || '127.0.0.1';
const redisPort = Number(redis?.port || 6379);

const [pgUp, redisUp] = await Promise.all([
  portOpen(pgHost, pgPort),
  portOpen(redisHost, redisPort),
]);

const embeddedDir = path.join(root, '.embedded-postgres/data/PG_VERSION');
const embeddedAvailable = fs.existsSync(embeddedDir);

const report = {
  ok: true,
  dockerAvailable: docker,
  postgresqlReachable: pgUp,
  redisReachable: redisUp,
  embeddedPostgresDataPresent: embeddedAvailable,
  envFilesPresent: envFiles,
  database: db,
  migrateDatabase: migrate,
  redis: redis,
  possibleStalePorts: stalePorts,
  commandsRequiringDocker: [
    'local Docker Compose data-plane',
    'local Docker Postgres migrate reproduction',
  ],
  commandsWithoutDocker: [
    'pnpm verify:local (uses embedded Postgres for integration)',
    'pnpm test:unit',
    'pnpm production:validate',
    'pnpm security:audit',
    'pnpm env:doctor',
  ],
  classification: !pgUp
    ? 'NOT RUN — PostgreSQL unavailable (local environment)'
    : !docker
      ? 'PARTIAL — Docker unavailable; Postgres reachable'
      : 'OK',
};

console.log(JSON.stringify(report, null, 2));
process.exit(0);
