#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const dataDir = path.join(webRoot, '../../.embedded-postgres');
const port = Number(process.env.EMBEDDED_PG_PORT || 54329);
const databaseName = 'contractradar_test';

const { default: EmbeddedPostgres } = await import('embedded-postgres');

fs.mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: path.join(dataDir, 'data'),
  user: 'contractradar',
  password: 'contractradar',
  port,
  persistent: true,
});

const migrateUrl = `postgresql://contractradar:contractradar@127.0.0.1:${port}/${databaseName}?schema=public`;
// App/tests must use non-superuser role so FORCE RLS is enforced.
// Keep the pool small so aborted interactive transactions cannot exhaust embedded Postgres.
const appUrl = `postgresql://contractradar_app:contractradar@127.0.0.1:${port}/${databaseName}?schema=public&connection_limit=5`;

async function main() {
  if (!fs.existsSync(path.join(dataDir, 'data', 'PG_VERSION'))) {
    console.log('Initialising embedded PostgreSQL…');
    await pg.initialise();
  }
  console.log('Starting embedded PostgreSQL…');
  await pg.start();
  try {
    await pg.createDatabase(databaseName);
  } catch {
    // exists
  }

  const migrateEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: migrateUrl,
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'ci-test-secret-with-sufficient-length-32',
    BETTER_AUTH_URL: 'http://localhost:3000',
    DOCUMENT_INTELLIGENCE_URL: 'http://localhost:8000',
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'ci-internal-token-32chars',
    REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET: 'contractradar-documents',
    S3_FORCE_PATH_STYLE: 'true',
    LOG_LEVEL: 'info',
    ALLOW_DEV_DEFAULTS: 'true',
    MALWARE_SCANNER: 'fake_test',
    APP_ENV: 'test',
  };

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URL: appUrl,
    INTEGRATION_DATABASE_URL: appUrl,
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'ci-test-secret-with-sufficient-length-32',
    BETTER_AUTH_URL: 'http://localhost:3000',
    DOCUMENT_INTELLIGENCE_URL: 'http://localhost:8000',
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'ci-internal-token-32chars',
    REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET: 'contractradar-documents',
    S3_FORCE_PATH_STYLE: 'true',
    LOG_LEVEL: 'info',
    ALLOW_DEV_DEFAULTS: 'true',
    MALWARE_SCANNER: 'fake_test',
    // Never run live MinIO/Redis/ClamAV suites inside the embedded runner.
    LIVE_INGESTION_TESTS: 'false',
    REQUIRE_LIVE_INGESTION_TESTS: 'false',
    ALLOW_NONTEST_DB: 'true',
    REQUIRE_INTEGRATION_DB: 'true',
    SEED_OWNER_PASSWORD: 'ChangeMe-Owner-2026!',
    SEED_VIEWER_PASSWORD: 'ChangeMe-Viewer-2026!',
  };

  console.log('Migrating (bootstrap role)…');
  let result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: webRoot,
    env: migrateEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    await pg.stop();
    process.exit(result.status ?? 1);
  }

  console.log('Seeding (app role + RLS bypass)…');
  result = spawnSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    cwd: webRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    await pg.stop();
    process.exit(result.status ?? 1);
  }

  console.log('Running integration tests (fail if DB unavailable)…');
  const vitestArgs = process.argv.slice(2);
  // Run each suite in a fresh Vitest process. Interactive transactions that hit
  // DB immutability/parent-guard triggers can leave the Prisma pool wedged for
  // later files in the same process (embedded runner).
  const defaultSuites = [
    'src/server/authz/isolation.integration.test.ts',
    'src/server/documents/ingestion.integration.test.ts',
    'src/server/queue/outbox.integration.test.ts',
    'src/server/contracts/contracts.integration.test.ts',
    'src/server/detections/detections.integration.test.ts',
    'src/server/deadlines/deadlines.integration.test.ts',
  ];
  const suites = vitestArgs.length > 0 ? vitestArgs : defaultSuites;
  for (const suite of suites) {
    for (const sql of [
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'contractradar_test' AND pid <> pg_backend_pid() AND backend_type = 'client backend'",
      'TRUNCATE TABLE "tenant" CASCADE',
    ]) {
      const reset = spawnSync(
        'pnpm',
        ['exec', 'prisma', 'db', 'execute', '--url', migrateUrl, '--stdin'],
        {
          cwd: webRoot,
          env: migrateEnv,
          input: `${sql};\n`,
          stdio: ['pipe', 'inherit', 'inherit'],
          shell: process.platform === 'win32',
        },
      );
      if (reset.status !== 0) {
        console.warn(`Warning: between-suite SQL failed (${reset.status}): ${sql}`);
      }
    }

    console.log(`\n=== Integration suite: ${suite} ===`);
    result = spawnSync(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.integration.config.ts',
        '--reporter=verbose',
        suite,
      ],
      {
        cwd: webRoot,
        env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    if (result.status !== 0) {
      await pg.stop();
      process.exit(result.status ?? 1);
    }
  }

  await pg.stop();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pg.stop();
  } catch {
    // ignore
  }
  process.exit(1);
});
