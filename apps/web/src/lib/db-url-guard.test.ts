import { describe, expect, it } from 'vitest';
import { assertSafeDatabaseUrl, requireTestDatabaseUrl } from './db-url-guard';

describe('db url guard', () => {
  it('allows localhost urls', () => {
    expect(() =>
      assertSafeDatabaseUrl('postgresql://u:p@localhost:5432/contractradar_test', {
        purpose: 'test',
      }),
    ).not.toThrow();
  });

  it('blocks cloud hosts without override', () => {
    expect(() =>
      assertSafeDatabaseUrl('postgresql://u:p@db.amazonaws.com:5432/app', { purpose: 'seed' }),
    ).toThrow(/Refusing/);
  });

  it('requireTestDatabaseUrl demands INTEGRATION_DATABASE_URL', () => {
    expect(() => requireTestDatabaseUrl(undefined)).toThrow(/INTEGRATION_DATABASE_URL is required/);
  });
});
