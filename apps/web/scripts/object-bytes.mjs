#!/usr/bin/env node
/**
 * Synthetic CI object put/get/delete/checksum helper (MinIO/S3).
 * Usage:
 *   node scripts/backup/object-bytes.mjs put <key> <file>
 *   node scripts/backup/object-bytes.mjs get <key> <file>
 *   node scripts/backup/object-bytes.mjs del <key>
 *   node scripts/backup/object-bytes.mjs backup-dir <dir> <manifest.json>
 *   node scripts/backup/object-bytes.mjs restore-dir <manifest.json>
 *   node scripts/backup/object-bytes.mjs missing <key>   # exits 0 if missing, 1 if present
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing S3_* env');
  process.exit(2);
}

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: { accessKeyId, secretAccessKey },
});

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const c of body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function put(key, file) {
  const body = fs.readFileSync(file);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
  console.log(sha256(body));
}

async function get(key, file) {
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buf = await streamToBuffer(out.Body);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(sha256(buf));
}

async function del(key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function missing(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    process.exit(1); // present
  } catch {
    process.exit(0); // missing
  }
}

async function backupDir(dir, manifestPath) {
  fs.mkdirSync(dir, { recursive: true });
  const objects = [];
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const obj of page.Contents || []) {
      if (!obj.Key) continue;
      const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }));
      const buf = await streamToBuffer(got.Body);
      const dest = path.join(dir, obj.Key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      objects.push({ key: obj.Key, sha256: sha256(buf), bytes: buf.length });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const doc = {
    type: 'object_storage_byte_backup',
    createdAt: new Date().toISOString(),
    endpoint,
    bucket,
    dataDir: path.basename(dir),
    objectCount: objects.length,
    objects,
    encryptionStatus: 'plaintext_local_artifact',
    note: 'Synthetic CI MinIO byte backup via AWS SDK',
  };
  fs.writeFileSync(manifestPath, JSON.stringify(doc, null, 2) + '\n');
  console.log(manifestPath);
}

async function restoreDir(manifestPath) {
  const doc = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (doc.type !== 'object_storage_byte_backup')
    throw new Error('invalid object backup manifest type');
  if (!doc.objects?.length) throw new Error('object backup manifest has no objects');
  const dataDir = path.join(path.dirname(manifestPath), doc.dataDir);
  for (const o of doc.objects) {
    const file = path.join(dataDir, o.key);
    if (!fs.existsSync(file)) throw new Error(`missing object in backup: ${o.key}`);
    const buf = fs.readFileSync(file);
    const digest = sha256(buf);
    if (digest !== o.sha256) throw new Error(`checksum mismatch before restore: ${o.key}`);
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: o.key, Body: buf }));
  }
  console.log('restored', doc.objects.length);
}

const [cmd, a, b] = process.argv.slice(2);
const runners = {
  put: () => put(a, b),
  get: () => get(a, b),
  del: () => del(a),
  missing: () => missing(a),
  'backup-dir': () => backupDir(a, b),
  'restore-dir': () => restoreDir(a),
};
if (!runners[cmd]) {
  console.error('unknown command', cmd);
  process.exit(2);
}
runners[cmd]().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
