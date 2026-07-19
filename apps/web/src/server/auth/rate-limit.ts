import Redis from 'ioredis';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  try {
    const env = getServerEnv();
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function limitWithRedis(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    logger.warn('rate_limit_redis_unavailable', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

function limitWithMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }
  current.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds,
  };
}

/**
 * Login rate limit. Uses Redis when available.
 * Production fails closed if Redis is down unless ALLOW_DEV_DEFAULTS is explicitly set
 * (development-only escape hatch).
 */
async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
  failClosedName: string;
}): Promise<RateLimitResult> {
  const env = getServerEnv();
  const redisResult = await limitWithRedis(input.key, input.limit, input.windowSeconds);
  if (redisResult) {
    return redisResult;
  }

  if (env.NODE_ENV === 'production' && !env.ALLOW_DEV_DEFAULTS) {
    logger.error('rate_limit_fail_closed', { key: input.failClosedName });
    return { allowed: false, remaining: 0, retryAfterSeconds: input.windowSeconds };
  }

  return limitWithMemory(input.key, input.limit, input.windowSeconds);
}

export async function consumeLoginRateLimit(input: {
  ip: string;
  email: string;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    key: `login:${input.ip}:${input.email.toLowerCase()}`,
    limit: 10,
    windowSeconds: 60,
    failClosedName: 'login',
  });
}

export async function consumeUploadInitiateRateLimit(input: {
  userId: string;
  projectId: string;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    key: `upload:init:${input.userId}:${input.projectId}`,
    limit: 30,
    windowSeconds: 60,
    failClosedName: 'upload_initiate',
  });
}

export async function consumeUploadCompleteRateLimit(input: {
  userId: string;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    key: `upload:complete:${input.userId}`,
    limit: 60,
    windowSeconds: 60,
    failClosedName: 'upload_complete',
  });
}

export async function consumeDownloadRateLimit(input: {
  userId: string;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    key: `download:${input.userId}`,
    limit: 60,
    windowSeconds: 60,
    failClosedName: 'download',
  });
}

export async function consumeProcessingRetryRateLimit(input: {
  userId: string;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    key: `processing:retry:${input.userId}`,
    limit: 20,
    windowSeconds: 60,
    failClosedName: 'processing_retry',
  });
}

export function resetRateLimitStateForTests(): void {
  memoryBuckets.clear();
  if (redisClient) {
    void redisClient.quit().catch(() => undefined);
  }
  redisClient = undefined;
}
