import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvCacheForTests, validateEnvForTests } from './env';

const valid = {
  NODE_ENV: 'development',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://contractradar:contractradar@localhost:5432/contractradar',
  BETTER_AUTH_SECRET: 'dev-only-secret-change-me-to-a-long-random-value',
  DOCUMENT_INTELLIGENCE_URL: 'http://localhost:8000',
  DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'dev-internal-token-change-me',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_BUCKET: 'contractradar-documents',
  S3_FORCE_PATH_STYLE: 'true',
  LOG_LEVEL: 'info',
} as const;

describe('environment validation', () => {
  afterEach(() => {
    resetEnvCacheForTests();
  });

  it('accepts a complete development configuration', () => {
    const env = validateEnvForTests({ ...valid });
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        DATABASE_URL: '',
      }),
    ).toThrow();
  });

  it('rejects development secrets in production', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'dev-only-secret-change-me-to-a-long-random-value',
      }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects ALLOW_DEV_DEFAULTS in production', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'production-grade-secret-with-enough-length-32+',
        ALLOW_DEV_DEFAULTS: 'true',
      }),
    ).toThrow(/ALLOW_DEV_DEFAULTS/);
  });

  it('allows fake_test malware scanner in LOCAL/development class', () => {
    const env = validateEnvForTests({
      ...valid,
      NODE_ENV: 'development',
      MALWARE_SCANNER: 'fake_test',
    });
    expect(env.MALWARE_SCANNER).toBe('fake_test');
  });

  it('rejects fake_test malware scanner in PILOT', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        CONTRACTRADAR_ENV: 'PILOT',
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'production-grade-secret-with-enough-length-32+',
        DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'production-internal-token-32chars',
        S3_ACCESS_KEY_ID: 'not-minioadmin',
        S3_SECRET_ACCESS_KEY: 'not-minioadmin',
        ALLOW_DEV_DEFAULTS: 'false',
        MALWARE_SCANNER: 'fake_test',
      }),
    ).toThrow(/fake_test|clamav/);
  });

  it('allows fake_test malware scanner in test', () => {
    const env = validateEnvForTests({
      ...valid,
      NODE_ENV: 'test',
      MALWARE_SCANNER: 'fake_test',
    });
    expect(env.MALWARE_SCANNER).toBe('fake_test');
  });

  it('rejects fake connector provider in PILOT', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        CONTRACTRADAR_ENV: 'PILOT',
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'production-grade-secret-with-enough-length-32+',
        DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'production-internal-token-32chars',
        S3_ACCESS_KEY_ID: 'not-minioadmin',
        S3_SECRET_ACCESS_KEY: 'not-minioadmin',
        MALWARE_SCANNER: 'clamav',
        CONNECTOR_PROVIDER: 'fake',
      }),
    ).toThrow(/CONNECTOR_PROVIDER/);
  });

  it('requires clamav in production', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        NODE_ENV: 'production',
        APP_ENV: 'production',
        BETTER_AUTH_SECRET: 'production-grade-secret-with-enough-length-32+',
        DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'production-internal-token-32chars',
        S3_ACCESS_KEY_ID: 'prod-access-key',
        S3_SECRET_ACCESS_KEY: 'prod-secret-key',
        MALWARE_SCANNER: 'disabled_reject_all',
      }),
    ).toThrow(/clamav/);
  });

  it('rejects example storage credentials in production', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'production-grade-secret-with-enough-length-32+',
        DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: 'production-internal-token-32chars',
        MALWARE_SCANNER: 'clamav',
        S3_ACCESS_KEY_ID: 'minioadmin',
        S3_SECRET_ACCESS_KEY: 'minioadmin',
      }),
    ).toThrow(/example storage/);
  });

  it('rejects dangerously long download URL TTL', () => {
    expect(() =>
      validateEnvForTests({
        ...valid,
        DOWNLOAD_URL_TTL_SECONDS: '7200',
      }),
    ).toThrow(/DOWNLOAD_URL_TTL_SECONDS/);
  });
});
