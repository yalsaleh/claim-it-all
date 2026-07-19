import { createHmac } from 'node:crypto';
import Redis from 'ioredis';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ProcessDocumentJob } from '@contractradar/shared';

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  try {
    const env = getServerEnv();
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

/**
 * Legacy HTTP enqueue path. Preferred delivery is transactional outbox → dispatcher → ARQ.
 * When used, production/staging must send HMAC(timestamp + body) for replay resistance.
 */
export async function enqueueProcessDocumentJob(job: ProcessDocumentJob): Promise<void> {
  const env = getServerEnv();
  const body = JSON.stringify({
    processing_run_id: job.processingRunId,
    document_version_id: job.documentVersionId,
    correlation_id: job.correlationId,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN)
    .update(`${timestamp}.`)
    .update(body)
    .digest('hex');

  const response = await fetch(`${env.DOCUMENT_INTELLIGENCE_URL}/internal/jobs/process-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN,
      'X-Internal-Timestamp': timestamp,
      'X-Internal-Signature': signature,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('ingestion_job_enqueue_failed', {
      status: response.status,
      processingRunId: job.processingRunId,
      detailLength: detail.length,
    });
    if (env.NODE_ENV === 'production' && !env.ALLOW_DEV_DEFAULTS) {
      throw new Error('INGESTION_ENQUEUE_FAILED');
    }
    return;
  }

  logger.info('ingestion_job_enqueued', {
    processingRunId: job.processingRunId,
    documentVersionId: job.documentVersionId,
    correlationId: job.correlationId,
  });
}

export async function redisReachable(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    if (client.status !== 'ready') await client.connect();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export function resetIngestionQueueForTests(): void {
  if (redis) void redis.quit().catch(() => undefined);
  redis = undefined;
}
