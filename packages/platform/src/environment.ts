export const APP_ENVIRONMENTS = ['LOCAL', 'TEST', 'CI', 'STAGING', 'PILOT', 'PRODUCTION'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type ProviderPolicy = {
  allowFakeProviders: boolean;
  allowLocalCaptureProviders: boolean;
  allowTestPurgeGucs: boolean;
  allowDebugRoutes: boolean;
  allowDevAuthShortcuts: boolean;
  requireStrongSecrets: boolean;
  requireClamav: boolean;
  requireMigrateRoleSeparation: boolean;
  rejectDefaultCredentials: boolean;
};

const POLICIES: Record<AppEnvironment, ProviderPolicy> = {
  LOCAL: {
    allowFakeProviders: true,
    allowLocalCaptureProviders: true,
    allowTestPurgeGucs: true,
    allowDebugRoutes: true,
    allowDevAuthShortcuts: true,
    requireStrongSecrets: false,
    requireClamav: false,
    requireMigrateRoleSeparation: false,
    rejectDefaultCredentials: false,
  },
  TEST: {
    allowFakeProviders: true,
    allowLocalCaptureProviders: true,
    allowTestPurgeGucs: true,
    allowDebugRoutes: true,
    allowDevAuthShortcuts: true,
    requireStrongSecrets: false,
    requireClamav: false,
    requireMigrateRoleSeparation: false,
    rejectDefaultCredentials: false,
  },
  CI: {
    allowFakeProviders: true,
    allowLocalCaptureProviders: true,
    allowTestPurgeGucs: true,
    allowDebugRoutes: false,
    allowDevAuthShortcuts: true,
    requireStrongSecrets: false,
    requireClamav: false,
    requireMigrateRoleSeparation: true,
    rejectDefaultCredentials: false,
  },
  STAGING: {
    allowFakeProviders: false,
    allowLocalCaptureProviders: true,
    allowTestPurgeGucs: false,
    allowDebugRoutes: false,
    allowDevAuthShortcuts: false,
    requireStrongSecrets: true,
    requireClamav: true,
    requireMigrateRoleSeparation: true,
    rejectDefaultCredentials: true,
  },
  PILOT: {
    allowFakeProviders: false,
    allowLocalCaptureProviders: false,
    allowTestPurgeGucs: false,
    allowDebugRoutes: false,
    allowDevAuthShortcuts: false,
    requireStrongSecrets: true,
    requireClamav: true,
    requireMigrateRoleSeparation: true,
    rejectDefaultCredentials: true,
  },
  PRODUCTION: {
    allowFakeProviders: false,
    allowLocalCaptureProviders: false,
    allowTestPurgeGucs: false,
    allowDebugRoutes: false,
    allowDevAuthShortcuts: false,
    requireStrongSecrets: true,
    requireClamav: true,
    requireMigrateRoleSeparation: true,
    rejectDefaultCredentials: true,
  },
};

/** Parse ContractRadar environment class. Rejects arbitrary strings. */
export function parseAppEnvironment(raw: string | undefined | null): AppEnvironment {
  if (!raw || !raw.trim()) return 'LOCAL';
  const normalized = raw.trim().toUpperCase();
  if ((APP_ENVIRONMENTS as readonly string[]).includes(normalized)) {
    return normalized as AppEnvironment;
  }
  // Compatibility with legacy APP_ENV / NODE_ENV values.
  switch (raw.trim().toLowerCase()) {
    case 'development':
    case 'dev':
    case 'local':
      return 'LOCAL';
    case 'test':
      return 'TEST';
    case 'ci':
      return 'CI';
    case 'staging':
    case 'stage':
      return 'STAGING';
    case 'pilot':
      return 'PILOT';
    case 'production':
    case 'prod':
      return 'PRODUCTION';
    default:
      throw new Error(
        `Invalid CONTRACTRADAR_ENV/APP_ENV "${raw}". Allowed: ${APP_ENVIRONMENTS.join(', ')}`,
      );
  }
}

export function resolveAppEnvironment(input: {
  contractradarEnv?: string | null;
  appEnv?: string | null;
  nodeEnv?: string | null;
  ci?: string | null;
}): AppEnvironment {
  if (input.contractradarEnv) return parseAppEnvironment(input.contractradarEnv);
  if (input.ci === 'true' || input.ci === '1') {
    if (input.appEnv) return parseAppEnvironment(input.appEnv);
    return 'CI';
  }
  if (input.appEnv) return parseAppEnvironment(input.appEnv);
  if (input.nodeEnv) return parseAppEnvironment(input.nodeEnv);
  return 'LOCAL';
}

export function policyForEnvironment(env: AppEnvironment): ProviderPolicy {
  return POLICIES[env];
}

export function isRestrictedEnvironment(env: AppEnvironment): boolean {
  return env === 'STAGING' || env === 'PILOT' || env === 'PRODUCTION';
}

export function isPilotOrProduction(env: AppEnvironment): boolean {
  return env === 'PILOT' || env === 'PRODUCTION';
}
