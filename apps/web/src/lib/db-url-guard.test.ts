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
    // Default-parameter semantics treat an omitted/undefined argument as
    // "read process.env". Isolate the env so CI (which sets INTEGRATION_DATABASE_URL
    // for the whole workflow) cannot mask a missing URL.
    const previous = process.env.INTEGRATION_DATABASE_URL;
    delete process.env.INTEGRATION_DATABASE_URL;
    try {
      expect(() => requireTestDatabaseUrl()).toThrow(/INTEGRATION_DATABASE_URL is required/);
      expect(() => requireTestDatabaseUrl('')).toThrow(/INTEGRATION_DATABASE_URL is required/);
    } finally {
      if (previous === undefined) delete process.env.INTEGRATION_DATABASE_URL;
      else process.env.INTEGRATION_DATABASE_URL = previous;
    }
  });
});
