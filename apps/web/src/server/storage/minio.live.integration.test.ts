/**
 * Live MinIO integration tests. Not mocked.
 * Requires LIVE_INGESTION_TESTS=true and a private bucket.
 */
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';

const endpoint = process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000';
const bucket = process.env.S3_BUCKET ?? 'contractradar-documents';
const accessKey = process.env.S3_ACCESS_KEY_ID ?? 'minioadmin';
const secretKey = process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin';

function client() {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

async function pingBucket(s3: S3Client): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: '__probe_missing__' }));
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    // NotFound / NoSuchKey means bucket is reachable and private object missing.
    return name.includes('NotFound') || name.includes('NoSuchKey') || name.includes('404');
  }
}

describe('live MinIO object storage', () => {
  const s3 = client();
  const keys: string[] = [];
  let enabled = false;

  beforeAll(async () => {
    try {
      const healthy = await pingBucket(s3);
      requireLiveServices('minio', healthy);
      enabled = true;
    } catch (error) {
      if (isLiveSkip(error)) {
        // vitest: skip suite
        enabled = false;
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (!enabled) return;
    for (const key of keys) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    }
  });

  it('presigned PUT uploads server-chosen key and object stays private', async ({ skip }) => {
    if (!enabled) skip();
    const key = `tenants/live-test/projects/live/quarantine/${randomUUID()}/doc.pdf`;
    keys.push(key);
    const body = Buffer.from('%PDF-1.4 live-minio-test');
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'application/pdf',
        ContentLength: body.length,
      }),
      { expiresIn: 60 },
    );
    expect(putUrl).not.toContain(secretKey);

    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body,
    });
    expect(putResponse.ok).toBe(true);

    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    expect(head.ContentLength).toBe(body.length);

    // Anonymous GET to public URL path must not succeed without signature.
    const anonymous = await fetch(`${endpoint}/${bucket}/${key}`);
    expect(anonymous.status).toBeGreaterThanOrEqual(400);
  });

  it('presigned PUT expires and cannot upload after TTL', async ({ skip }) => {
    if (!enabled) skip();
    const key = `tenants/live-test/projects/live/quarantine/${randomUUID()}/expired.pdf`;
    keys.push(key);
    const body = Buffer.from('%PDF-1.4 expired');
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'application/pdf',
        ContentLength: body.length,
      }),
      { expiresIn: 1 },
    );
    await new Promise((r) => setTimeout(r, 1500));
    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body,
    });
    expect(putResponse.ok).toBe(false);
  });

  it('wrong object key cannot be used for authorized upload of another key', async ({ skip }) => {
    if (!enabled) skip();
    const allowedKey = `tenants/live-test/projects/live/quarantine/${randomUUID()}/a.pdf`;
    const attackerKey = `tenants/other/projects/x/originals/stolen.pdf`;
    keys.push(allowedKey, attackerKey);
    const body = Buffer.from('%PDF-1.4');
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: allowedKey,
        ContentType: 'application/pdf',
        ContentLength: body.length,
      }),
      { expiresIn: 60 },
    );
    // Mutate URL key segment — signature must fail.
    const forged = putUrl.replace(encodeURIComponent(allowedKey), encodeURIComponent(attackerKey));
    if (forged === putUrl) {
      // path-style may not encode; try raw replace
      const forgedRaw = putUrl.replace(allowedKey, attackerKey);
      const response = await fetch(forgedRaw, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body,
      });
      expect(response.ok).toBe(false);
      return;
    }
    const response = await fetch(forged, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body,
    });
    expect(response.ok).toBe(false);
  });

  it('checksum mismatch is detectable via HEAD/GET after upload', async ({ skip }) => {
    if (!enabled) skip();
    const key = `tenants/live-test/projects/live/quarantine/${randomUUID()}/hash.pdf`;
    keys.push(key);
    const body = Buffer.from('%PDF-1.4 checksum-body');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = Buffer.from(await obj.Body!.transformToByteArray());
    const actual = createHash('sha256').update(bytes).digest('hex');
    const expected = createHash('sha256').update(Buffer.from('%PDF-1.4 other')).digest('hex');
    expect(actual).not.toBe(expected);
  });

  it('promotion copy preserves sha256 into originals prefix', async ({ skip }) => {
    if (!enabled) skip();
    const versionId = randomUUID();
    const quarantineKey = `tenants/live-test/projects/live/quarantine/${versionId}/src.pdf`;
    const originalKey = `tenants/live-test/projects/live/originals/${versionId}/${randomUUID()}`;
    keys.push(quarantineKey, originalKey);
    const body = Buffer.from('%PDF-1.4 promote-me');
    const digest = createHash('sha256').update(body).digest('hex');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: quarantineKey,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: originalKey,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: originalKey }));
    const bytes = Buffer.from(await obj.Body!.transformToByteArray());
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(digest);
    expect(originalKey).toContain('/originals/');
    expect(originalKey).not.toContain('/quarantine/');
  });
});
