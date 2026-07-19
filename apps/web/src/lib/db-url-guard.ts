/**
 * Guards against accidentally migrating/seeding/resetting production-like databases
 * from local tooling or misconfigured CI.
 */

const BLOCKED_HOST_SNIPPETS = [
  'amazonaws.com',
  'azure.com',
  'rds.amazonaws.com',
  'cloudsql',
  'supabase.co',
  'neon.tech',
  'railway.app',
  'render.com',
  'prisma.io',
];

export function assertSafeDatabaseUrl(
  databaseUrl: string,
  options?: { allowProductionOverride?: boolean; purpose?: string },
): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`Invalid DATABASE_URL for ${options?.purpose ?? 'database operation'}`);
  }

  const host = parsed.hostname.toLowerCase();
  const looksRemote =
    host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && !host.endsWith('.local');

  const blockedVendor = BLOCKED_HOST_SNIPPETS.some((snippet) => host.includes(snippet));

  if ((looksRemote || blockedVendor) && !options?.allowProductionOverride) {
    throw new Error(
      `Refusing ${options?.purpose ?? 'database operation'} against host "${host}". ` +
        'Set ALLOW_UNSAFE_DB_RESET=true only for an intentional non-local override.',
    );
  }

  if (parsed.pathname.includes('prod') && !options?.allowProductionOverride) {
    throw new Error(
      `Refusing ${options?.purpose ?? 'database operation'} against database name that looks production-like.`,
    );
  }
}

/**
 * Integration suites must opt in via INTEGRATION_DATABASE_URL.
 * Do not fall back to DATABASE_URL from apps/web/.env — that hides a missing test DB.
 */
export function requireTestDatabaseUrl(
  databaseUrl: string | undefined = process.env.INTEGRATION_DATABASE_URL,
): string {
  if (!databaseUrl) {
    throw new Error(
      'INTEGRATION_DATABASE_URL is required for integration tests. ' +
        'Use pnpm test:integration:embedded or point Compose at contractradar_test.',
    );
  }
  assertSafeDatabaseUrl(databaseUrl, { purpose: 'integration tests' });

  const name = new URL(databaseUrl).pathname.replace(/^\//, '').split('?')[0] ?? '';
  if (!name.includes('test') && process.env.ALLOW_NONTEST_DB !== 'true') {
    // Prefer dedicated test DB naming: contractradar_test
    if (name !== 'contractradar' && !name.endsWith('_test')) {
      throw new Error(
        `Integration tests expect a test database name containing "test" (got "${name}"). ` +
          'Use contractradar_test or set ALLOW_NONTEST_DB=true for an explicit local exception.',
      );
    }
  }

  return databaseUrl;
}
