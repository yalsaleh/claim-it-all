import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeDatabaseUrl } from '../src/lib/db-url-guard';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
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
  env: process.env,
});

process.exit(result.status ?? 1);
