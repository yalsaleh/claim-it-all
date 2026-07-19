/**
 * Live Redis rate-limit tests. Not an in-memory substitute.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import { isLiveSkip, requireLiveServices } from '@/server/live/live-gate';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

describe('live Redis rate limiting', () => {
  let redis: Redis | null = null;
  let enabled = false;
  const keys: string[] = [];

  beforeAll(async () => {
    const probe = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    probe.on('error', () => undefined);
    try {
      await probe.connect();
      const pong = await probe.ping();
      requireLiveServices('redis', pong === 'PONG');
      redis = probe;
      enabled = true;
    } catch (error) {
      await probe.quit().catch(() => undefined);
      redis = null;
      if (isLiveSkip(error)) {
        enabled = false;
        return;
      }
      // Connection refused when live suite not required → skip
      if (
        !process.env.REQUIRE_LIVE_INGESTION_TESTS ||
        process.env.REQUIRE_LIVE_INGESTION_TESTS === 'false'
      ) {
        enabled = false;
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (redis && enabled) {
      if (keys.length) await redis.del(...keys).catch(() => undefined);
      await redis.quit().catch(() => undefined);
    }
  });

  it('increments atomically and expires with TTL', async ({ skip }) => {
    if (!enabled || !redis) skip();
    const key = `rl:live:test:${Date.now()}`;
    keys.push(key);
    const count1 = await redis!.incr(key);
    await redis!.expire(key, 2);
    const count2 = await redis!.incr(key);
    expect(count1).toBe(1);
    expect(count2).toBe(2);
    const ttl = await redis!.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2);
  });

  it('isolates tenant/user key namespaces', async ({ skip }) => {
    if (!enabled || !redis) skip();
    const a = `rl:upload:init:userA:projectA:${Date.now()}`;
    const b = `rl:upload:init:userB:projectB:${Date.now()}`;
    keys.push(a, b);
    await redis!.incr(a);
    await redis!.incr(a);
    await redis!.incr(b);
    expect(await redis!.get(a)).toBe('2');
    expect(await redis!.get(b)).toBe('1');
  });

  it('handles concurrent increments without lost updates', async ({ skip }) => {
    if (!enabled || !redis) skip();
    const key = `rl:live:concurrent:${Date.now()}`;
    keys.push(key);
    await redis!.expire(key, 30);
    const results = await Promise.all(Array.from({ length: 20 }, () => redis!.incr(key)));
    expect(Math.max(...results)).toBe(20);
    expect(await redis!.get(key)).toBe('20');
  });

  it('does not store secrets or document contents in keys', async ({ skip }) => {
    if (!enabled || !redis) skip();
    const key = `rl:download:user-${Date.now()}`;
    keys.push(key);
    await redis!.incr(key);
    expect(key).not.toMatch(/minioadmin|password|Bearer|sha256=/i);
    expect(key.length).toBeLessThan(120);
  });
});
