import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from '@/lib/env';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const env = getServerEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function getDefaultBucket(): string {
  return getServerEnv().S3_BUCKET;
}

export async function createUploadAuthorization(input: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}): Promise<{ uploadUrl: string; headers: Record<string, string> }> {
  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: input.expiresInSeconds,
  });
  return {
    uploadUrl,
    headers: {
      'Content-Type': input.contentType,
      'Content-Length': String(input.contentLength),
    },
  };
}

export async function createDownloadAuthorization(input: {
  bucket: string;
  key: string;
  expiresInSeconds: number;
  responseContentDisposition?: string;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ResponseContentDisposition: input.responseContentDisposition,
  });
  return getSignedUrl(getClient(), command, { expiresIn: input.expiresInSeconds });
}

export async function headObject(input: {
  bucket: string;
  key: string;
}): Promise<{ contentLength: number; contentType?: string; etag?: string }> {
  const result = await getClient().send(
    new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }),
  );
  return {
    contentLength: result.ContentLength ?? 0,
    contentType: result.ContentType,
    etag: result.ETag,
  };
}

export async function getObjectBytes(input: {
  bucket: string;
  key: string;
  maxBytes: number;
}): Promise<Uint8Array> {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
  );
  const body = result.Body;
  if (!body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > input.maxBytes) {
      throw new Error('OBJECT_TOO_LARGE_TO_BUFFER');
    }
    chunks.push(chunk);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Copy quarantine object to immutable originals prefix. Does not delete source. */
export async function copyObject(input: {
  bucket: string;
  fromKey: string;
  toKey: string;
}): Promise<void> {
  await getClient().send(
    new CopyObjectCommand({
      Bucket: input.bucket,
      CopySource: `${input.bucket}/${input.fromKey}`,
      Key: input.toKey,
      MetadataDirective: 'COPY',
    }),
  );
}

/** Only for unaccepted temporary/quarantine objects — never accepted originals. */
export async function deleteTemporaryObject(input: { bucket: string; key: string }): Promise<void> {
  if (!input.key.includes('/quarantine/')) {
    throw new Error('REFUSING_DELETE_NON_QUARANTINE_OBJECT');
  }
  await getClient().send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }));
}

export async function storageReachable(): Promise<boolean> {
  try {
    const env = getServerEnv();
    await getClient().send(
      new HeadObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: '__healthcheck_missing__',
      }),
    );
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    // NotFound / NoSuchKey means endpoint+credentials work
    if (name === 'NotFound' || name === 'NoSuchKey') return true;
    const message = error instanceof Error ? error.message : '';
    if (message.includes('NotFound') || message.includes('NoSuchKey')) return true;
    return false;
  }
}

export function resetObjectStorageClientForTests(): void {
  client = null;
}
