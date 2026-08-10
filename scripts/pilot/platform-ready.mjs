#!/usr/bin/env node
/**
 * Synthetic / local platform readiness probe for pilot scaffolding.
 * Does not deploy or contact real cloud providers.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.PILOT_READY_OUT_DIR
  ? path.resolve(process.env.PILOT_READY_OUT_DIR)
  : path.join(root, 'artifacts/pilot-readiness');
fs.mkdirSync(outDir, { recursive: true });

function parseUrl(raw) {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function probeTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve({ ok: true });
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    socket.on('error', (err) => {
      resolve({ ok: false, error: err.code || err.message });
    });
  });
}

function enabledFlag(name, defaultEnabled = true) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultEnabled;
  return !['0', 'false', 'off', 'disabled'].includes(String(v).toLowerCase());
}

async function checkComponent(name, { required, urlEnv, hostEnv, portEnv, defaultPort }) {
  const hasUrl = Boolean(urlEnv && process.env[urlEnv]);
  const hasHost = Boolean(hostEnv && process.env[hostEnv]);
  if (
    !required &&
    !enabledFlag(`PILOT_PROBE_${name.toUpperCase()}`, false) &&
    !hasUrl &&
    !hasHost
  ) {
    return {
      name,
      status: 'SKIPPED',
      required: false,
      detail: 'optional component disabled / unset — does not fail readiness',
    };
  }

  const url = urlEnv ? parseUrl(process.env[urlEnv]) : null;
  let host = (hostEnv && process.env[hostEnv]) || url?.hostname;
  let port = Number((portEnv && process.env[portEnv]) || url?.port || defaultPort || 0);
  if (!host || !port) {
    return {
      name,
      status: required ? 'FAIL' : 'SKIPPED',
      required,
      detail: `missing ${urlEnv || hostEnv || 'endpoint'}`,
    };
  }
  const probe = await probeTcp(host, port);
  return {
    name,
    status: probe.ok ? 'PASS' : required ? 'FAIL' : 'DEGRADED',
    required,
    host,
    port,
    detail: probe.ok ? 'tcp open' : probe.error,
  };
}

const components = [
  await checkComponent('postgres', {
    required: true,
    urlEnv: 'DATABASE_URL',
    hostEnv: 'PILOT_DB_HOST',
    portEnv: 'PILOT_DB_PORT',
    defaultPort: 5432,
  }),
  await checkComponent('redis', {
    required: true,
    urlEnv: 'REDIS_URL',
    hostEnv: 'PILOT_REDIS_HOST',
    portEnv: 'PILOT_REDIS_PORT',
    defaultPort: 6379,
  }),
  await checkComponent('object_storage', {
    required: false,
    urlEnv: 'S3_ENDPOINT',
    hostEnv: 'PILOT_S3_HOST',
    portEnv: 'PILOT_S3_PORT',
    defaultPort: 9000,
  }),
  await checkComponent('document_intelligence', {
    required: false,
    urlEnv: 'DOCUMENT_INTELLIGENCE_URL',
    hostEnv: 'PILOT_DI_HOST',
    portEnv: 'PILOT_DI_PORT',
    defaultPort: 8000,
  }),
  await checkComponent('clamav', {
    required: false,
    urlEnv: '',
    hostEnv: 'CLAMAV_HOST',
    portEnv: 'CLAMAV_PORT',
    defaultPort: 3310,
  }),
];

const failedRequired = components.filter((c) => c.required && c.status === 'FAIL');
const degraded = components.filter((c) => c.status === 'DEGRADED');
let status = 'READY';
if (failedRequired.length > 0) status = 'NOT_READY';
else if (degraded.length > 0) status = 'DEGRADED';

const report = {
  ok: status !== 'NOT_READY',
  status,
  generatedAt: new Date().toISOString(),
  honesty: 'Local/synthetic TCP probes only. Not a cloud deploy health claim.',
  components,
  releaseSha: process.env.RELEASE_SHA || process.env.GITHUB_SHA || null,
};

const outPath = path.join(outDir, 'platform-readiness-report.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(status === 'NOT_READY' ? 1 : 0);
