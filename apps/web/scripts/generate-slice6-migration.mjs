import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(webRoot, '../../.embedded-postgres-migrate');
const port = 54330;
const databaseName = 'contractradar_migrate';
const { default: EmbeddedPostgres } = await import('embedded-postgres');

fs.mkdirSync(dataDir, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dataDir, 'data'),
  user: 'contractradar',
  password: 'contractradar',
  port,
  persistent: false,
});

if (!fs.existsSync(path.join(dataDir, 'data', 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();
try {
  try {
    await pg.createDatabase(databaseName);
  } catch {
    // exists
  }
  const url = `postgresql://contractradar:contractradar@127.0.0.1:${port}/${databaseName}?schema=public`;
  const env = { ...process.env, DATABASE_URL: url };
  let r = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: webRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error('migrate deploy failed');
  r = spawnSync(
    'pnpm',
    [
      'exec',
      'prisma',
      'migrate',
      'diff',
      '--from-url',
      url,
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ],
    {
      cwd: webRoot,
      env,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error('diff failed');
  }
  const outDir = path.join(webRoot, 'prisma/migrations/20260729120000_notice_drafting_slice6');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'migration.sql'), r.stdout);
  console.log('Wrote migration, bytes', r.stdout.length);
} finally {
  await pg.stop();
}
