import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeDatabaseUrl } from '../src/lib/db-url-guard';

// Prefer the migration/bootstrap role. Runtime DATABASE_URL uses contractradar_app
// (FORCE RLS) and cannot drop/recreate schema objects owned by the migrator.
const databaseUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_MIGRATE_URL or DATABASE_URL is required for db reset');
  process.exit(1);
}

assertSafeDatabaseUrl(databaseUrl, {
  purpose: 'db reset',
  allowProductionOverride: process.env.ALLOW_UNSAFE_DB_RESET === 'true',
});

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'], {
  cwd: webRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

process.exit(result.status ?? 1);
