import { describe, expect, it } from 'vitest';
import {
  PILOT_SAFE_DEFAULTS,
  assertPilotSafeDefaults,
  resolvePilotCapabilityFlags,
} from './pilot-defaults';

describe('pilot defaults', () => {
  it('keeps AI, connectors, delivery, and autonomous sync off', () => {
    expect(PILOT_SAFE_DEFAULTS.aiEnabled).toBe(false);
    expect(PILOT_SAFE_DEFAULTS.realConnectorsEnabled).toBe(false);
    expect(PILOT_SAFE_DEFAULTS.noticeDeliveryEnabled).toBe(false);
    expect(PILOT_SAFE_DEFAULTS.autonomousSyncEnabled).toBe(false);
    expect(() => assertPilotSafeDefaults(PILOT_SAFE_DEFAULTS)).not.toThrow();
  });

  it('does not allow resolve helper to re-enable fake providers', () => {
    const flags = resolvePilotCapabilityFlags({ allowFakeProviders: true, aiEnabled: true });
    expect(flags.allowFakeProviders).toBe(false);
    expect(flags.aiEnabled).toBe(true);
    expect(() => assertPilotSafeDefaults(flags)).toThrow(/AI must be off/);
  });
});
