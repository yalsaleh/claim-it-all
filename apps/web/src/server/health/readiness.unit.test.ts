import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('@/server/db', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));
vi.mock('@/server/queue/ingestion-queue', () => ({
  redisReachable: vi.fn(async () => true),
}));
vi.mock('@/server/storage/object-storage', () => ({
  storageReachable: vi.fn(async () => true),
}));

import { evaluateWebReadiness, livePayload } from './readiness';
import { redisReachable } from '@/server/queue/ingestion-queue';
import { storageReachable } from '@/server/storage/object-storage';

describe('web readiness', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.mocked(redisReachable).mockResolvedValue(true);
    vi.mocked(storageReachable).mockResolvedValue(true);
    process.env.CONTRACTRADAR_ENV = 'CI';
    process.env.DATABASE_URL = 'postgresql://contractradar_app:x@localhost/db';
    process.env.APP_URL = 'http://127.0.0.1:3000';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.S3_ENDPOINT = 'http://127.0.0.1:9000';
    process.env.S3_BUCKET = 'bucket';
    process.env.DOCUMENT_INTELLIGENCE_URL = 'http://127.0.0.1:8000';
    process.env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN = 't'.repeat(32);
    process.env.MALWARE_SCANNER = 'fake_test';
  });

  it('live succeeds without DB', () => {
    expect(livePayload()).toEqual({ status: 'ok' });
  });

  it('ready fails without DB', async () => {
    queryRaw.mockRejectedValue(new Error('db down'));
    const result = await evaluateWebReadiness();
    expect(result.status).toBe('not_ready');
    expect(result.httpStatus).toBe(503);
    expect(result.checks.database?.status).toBe('error');
    expect(JSON.stringify(result)).not.toMatch(/password|secret|token/i);
  });

  it('ready succeeds with healthy synthetic deps', async () => {
    queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ migration_name: '20260729221000_test_purge_check_function' }])
      .mockResolvedValueOnce([{ rolname: 'contractradar_app', is_super: 'off' }])
      .mockResolvedValueOnce([{ ok: true }]);
    const result = await evaluateWebReadiness();
    expect(result.status).toBe('ready');
    expect(result.httpStatus).toBe(200);
  });

  it('ready fails when redis required is down', async () => {
    queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ migration_name: 'm' }])
      .mockResolvedValueOnce([{ rolname: 'contractradar_app', is_super: 'off' }])
      .mockResolvedValueOnce([{ ok: true }]);
    vi.mocked(redisReachable).mockResolvedValue(false);
    const result = await evaluateWebReadiness();
    expect(result.status).toBe('not_ready');
    expect(result.checks.redis?.status).toBe('error');
  });

  it('ready fails when storage is down', async () => {
    queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ migration_name: 'm' }])
      .mockResolvedValueOnce([{ rolname: 'contractradar_app', is_super: 'off' }])
      .mockResolvedValueOnce([{ ok: true }]);
    vi.mocked(storageReachable).mockResolvedValue(false);
    const result = await evaluateWebReadiness();
    expect(result.status).toBe('not_ready');
    expect(result.checks.objectStorage?.status).toBe('error');
  });

  it('unsafe runtime role blocks readiness', async () => {
    queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ migration_name: 'm' }])
      .mockResolvedValueOnce([{ rolname: 'postgres', is_super: 'on' }])
      .mockResolvedValueOnce([{ ok: true }]);
    const result = await evaluateWebReadiness();
    expect(result.status).toBe('not_ready');
    expect(result.checks.runtimeRole?.code).toBe('runtime_superuser');
  });
});
