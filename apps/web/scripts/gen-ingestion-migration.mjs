import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const dataDir = path.resolve(webRoot, '../../.embedded-postgres/data');
const port = 54329;
const { default: EmbeddedPostgres } = await import('embedded-postgres');

function run(cmd, args, env = {}) {
  console.log('>', cmd, args.join(' '));
  const result = spawnSync(cmd, args, {
    cwd: webRoot,
    env: {
      ...process.env,
      ...env,
      PATH: `${process.env.HOME}/.local/node/bin:${process.env.PATH}`,
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'contractradar',
  password: 'contractradar',
  port,
  persistent: true,
});

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('Initialising…');
  await pg.initialise();
}
console.log('Starting…');
await pg.start();
await new Promise((r) => setTimeout(r, 500));

for (const db of ['prisma_shadow', 'contractradar_test']) {
  try {
    await pg.createDatabase(db);
    console.log('Created', db);
  } catch (error) {
    console.log('DB exists or create skipped:', db, String(error.message || error));
  }
}

const migrateUrl = `postgresql://contractradar:contractradar@127.0.0.1:${port}/contractradar_test?schema=public`;
const shadowUrl = `postgresql://contractradar:contractradar@127.0.0.1:${port}/prisma_shadow?schema=public`;

console.log('migrate deploy…');
const deployStatus = run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  DATABASE_URL: migrateUrl,
});
if (deployStatus !== 0) {
  await pg.stop();
  process.exit(deployStatus);
}

console.log('migrate diff…');
const diff = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
    '--shadow-database-url',
    shadowUrl,
  ],
  {
    cwd: webRoot,
    env: {
      ...process.env,
      DATABASE_URL: migrateUrl,
      PATH: `${process.env.HOME}/.local/node/bin:${process.env.PATH}`,
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);
if (diff.stderr) process.stderr.write(diff.stderr);
if (diff.status !== 0) {
  console.error('diff failed', diff.status);
  await pg.stop();
  process.exit(diff.status ?? 1);
}

const outDir = path.join(webRoot, 'prisma/migrations/20260719010000_document_ingestion');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'migration.sql'), diff.stdout || '');
console.log('Wrote', path.join(outDir, 'migration.sql'), 'bytes', (diff.stdout || '').length);
await pg.stop();
process.exit(0);
