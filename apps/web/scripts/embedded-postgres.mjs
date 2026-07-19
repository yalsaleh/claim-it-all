#!/usr/bin/env node
/**
 * Starts an embedded PostgreSQL for local Slice 1B verification when Docker is unavailable.
 * Usage:
 *   node apps/web/scripts/embedded-postgres.mjs up
 *   node apps/web/scripts/embedded-postgres.mjs down
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const EmbeddedPostgres = require('embedded-postgres').default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const dataDir = path.join(root, '.embedded-postgres');
const stateFile = path.join(dataDir, 'state.json');
const port = Number(process.env.EMBEDDED_PG_PORT || 54329);
const databaseName = process.env.EMBEDDED_PG_DATABASE || 'contractradar_test';

const cmd = process.argv[2] || 'up';

async function up() {
  fs.mkdirSync(dataDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dataDir, 'data'),
    user: 'contractradar',
    password: 'contractradar',
    port,
    persistent: true,
  });

  if (!fs.existsSync(path.join(dataDir, 'data', 'PG_VERSION'))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(databaseName);
  } catch {
    // already exists
  }

  const url = `postgresql://contractradar:contractradar@127.0.0.1:${port}/${databaseName}?schema=public`;
  fs.writeFileSync(stateFile, JSON.stringify({ port, databaseName, url }, null, 2));
  const envPath = path.join(root, 'apps/web/.env.test');
  fs.writeFileSync(
    envPath,
    [
      'NODE_ENV=test',
      `DATABASE_URL=${url}`,
      'APP_URL=http://localhost:3000',
      'BETTER_AUTH_SECRET=ci-test-secret-with-sufficient-length-32',
      'BETTER_AUTH_URL=http://localhost:3000',
      'DOCUMENT_INTELLIGENCE_URL=http://localhost:8000',
      'DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=ci-internal-token-32chars',
      'REDIS_URL=redis://127.0.0.1:6379',
      'S3_ENDPOINT=http://localhost:9000',
      'S3_REGION=us-east-1',
      'S3_ACCESS_KEY_ID=minioadmin',
      'S3_SECRET_ACCESS_KEY=minioadmin',
      'S3_BUCKET=contractradar-documents',
      'S3_FORCE_PATH_STYLE=true',
      'LOG_LEVEL=info',
      'ALLOW_DEV_DEFAULTS=true',
      'ALLOW_NONTEST_DB=true',
      '',
    ].join('\n'),
  );
  console.log(`Embedded PostgreSQL ready on port ${port}`);
  console.log(`DATABASE_URL=${url}`);
  console.log(`Wrote ${envPath}`);
  // Keep process alive
  process.on('SIGINT', async () => {
    await pg.stop();
    process.exit(0);
  });
  console.log('Press Ctrl+C to stop.');
  await new Promise(() => undefined);
}

async function down() {
  if (!fs.existsSync(stateFile)) {
    console.log('No embedded postgres state found.');
    return;
  }
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dataDir, 'data'),
    user: 'contractradar',
    password: 'contractradar',
    port: state.port,
    persistent: true,
  });
  try {
    await pg.stop();
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
  console.log('Embedded PostgreSQL stopped.');
}

if (cmd === 'up') {
  await up();
} else if (cmd === 'down') {
  await down();
} else {
  console.error('Usage: embedded-postgres.mjs up|down');
  process.exit(1);
}
