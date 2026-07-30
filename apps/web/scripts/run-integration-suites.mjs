#!/usr/bin/env node
/**
 * Run integration suites in isolated Vitest processes.
 *
 * A single Vitest/Prisma process can wedge after interactive transactions hit
 * immutability / parent-guard triggers (pool left in aborted state). CI and the
 * embedded runner both use this isolation pattern.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

export const DEFAULT_INTEGRATION_SUITES = [
  'src/server/authz/isolation.integration.test.ts',
  // Contracts before heavy ingestion/outbox suites: avoids embedded-PG pool stalls after
  // many intentional trigger-abort tests when exercising configuration approval.
  'src/server/contracts/contracts.integration.test.ts',
  'src/server/documents/ingestion.integration.test.ts',
  'src/server/queue/outbox.integration.test.ts',
  'src/server/detections/detections.integration.test.ts',
  'src/server/notices/notices.integration.test.ts',
  'src/server/notices/delivery.integration.test.ts',
  'src/server/deadlines/deadlines.integration.test.ts',
  'src/server/connectors/connectors.integration.test.ts',
  'src/server/platform/platform.integration.test.ts',
];

/**
 * @param {{
 *   env: NodeJS.ProcessEnv,
 *   migrateUrl: string,
 *   suites?: string[],
 *   databaseName?: string,
 * }} opts
 * @returns {number} exit code
 */
export function runIntegrationSuites(opts) {
  const suites = opts.suites?.length ? opts.suites : DEFAULT_INTEGRATION_SUITES;
  const databaseName = opts.databaseName ?? 'contractradar_test';
  const shell = process.platform === 'win32';

  for (const suite of suites) {
    for (const sql of [
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid() AND backend_type = 'client backend'`,
      'SELECT pg_sleep(0.2)',
      'TRUNCATE TABLE "tenant" CASCADE',
      'TRUNCATE TABLE "backup_run" CASCADE',
      'TRUNCATE TABLE "operational_incident" CASCADE',
    ]) {
      const reset = spawnSync(
        'pnpm',
        ['exec', 'prisma', 'db', 'execute', '--url', opts.migrateUrl, '--stdin'],
        {
          cwd: webRoot,
          env: { ...opts.env, DATABASE_URL: opts.migrateUrl },
          input: `${sql};\n`,
          stdio: ['pipe', 'inherit', 'inherit'],
          shell,
        },
      );
      if (reset.status !== 0) {
        console.warn(`Warning: between-suite SQL failed (${reset.status}): ${sql}`);
      }
    }

    console.log(`\n=== Integration suite: ${suite} ===`);
    const result = spawnSync(
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
        env: opts.env,
        stdio: 'inherit',
        shell,
      },
    );
    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  return 0;
}

function main() {
  const appUrl = process.env.INTEGRATION_DATABASE_URL || process.env.DATABASE_URL;
  const migrateUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
  if (!appUrl || !migrateUrl) {
    console.error(
      'INTEGRATION_DATABASE_URL (or DATABASE_URL) and DATABASE_MIGRATE_URL are required.',
    );
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    APP_ENV: process.env.APP_ENV || 'test',
    DATABASE_URL: appUrl,
    INTEGRATION_DATABASE_URL: appUrl,
    LIVE_INGESTION_TESTS: process.env.LIVE_INGESTION_TESTS || 'false',
    REQUIRE_LIVE_INGESTION_TESTS: process.env.REQUIRE_LIVE_INGESTION_TESTS || 'false',
    REQUIRE_INTEGRATION_DB: process.env.REQUIRE_INTEGRATION_DB || 'true',
  };

  const suites = process.argv.slice(2);
  const code = runIntegrationSuites({
    env,
    migrateUrl,
    suites: suites.length > 0 ? suites : undefined,
  });
  process.exit(code);
}

const isDirect =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirect) {
  main();
}
