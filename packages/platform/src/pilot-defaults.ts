/**
 * Safe defaults for PILOT class scaffolding.
 * Real providers, AI, and delivery remain OFF until explicitly enabled after approval.
 */

export type PilotCapabilityDefaults = {
  aiEnabled: boolean;
  realConnectorsEnabled: boolean;
  noticeDeliveryEnabled: boolean;
  autonomousSyncEnabled: boolean;
  allowFakeProviders: boolean;
  allowDevDefaults: boolean;
};

export const PILOT_SAFE_DEFAULTS: PilotCapabilityDefaults = {
  aiEnabled: false,
  realConnectorsEnabled: false,
  noticeDeliveryEnabled: false,
  autonomousSyncEnabled: false,
  allowFakeProviders: false,
  allowDevDefaults: false,
};

export function resolvePilotCapabilityFlags(
  overrides: Partial<PilotCapabilityDefaults> = {},
): PilotCapabilityDefaults {
  return {
    ...PILOT_SAFE_DEFAULTS,
    ...overrides,
    // Hard floor: never silently re-enable fake providers in pilot defaults helper.
    allowFakeProviders: false,
  };
}

export function assertPilotSafeDefaults(flags: PilotCapabilityDefaults): void {
  if (flags.aiEnabled) throw new Error('PILOT default violation: AI must be off');
  if (flags.realConnectorsEnabled) {
    throw new Error('PILOT default violation: real connectors must be off');
  }
  if (flags.noticeDeliveryEnabled) {
    throw new Error('PILOT default violation: notice delivery must be off');
  }
  if (flags.autonomousSyncEnabled) {
    throw new Error('PILOT default violation: autonomous sync must be off');
  }
  if (flags.allowFakeProviders) {
    throw new Error('PILOT default violation: fake providers must be off');
  }
}
