import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertConnectorProviderAllowed, FakeConnectorProvider } from '@contractradar/connectors';
import { requireConnectorProvider, tryCreateConnectorProvider } from '@/server/connectors/provider';

describe('connector provider wrapper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates fake provider in test environment', () => {
    process.env.CONNECTOR_PROVIDER = 'fake';
    process.env.APP_ENV = 'test';
    const provider = requireConnectorProvider();
    expect(provider.kind).toBe('fake');
    expect(provider.testOnly).toBe(true);
  });

  it('returns null when provider is none', () => {
    process.env.CONNECTOR_PROVIDER = 'none';
    expect(tryCreateConnectorProvider()).toBeNull();
  });

  it('rejects fake provider in production', () => {
    const provider = new FakeConnectorProvider();
    expect(() => assertConnectorProviderAllowed(provider, 'production')).toThrow(/not allowed/);
  });

  it('rejects fake provider in staging', () => {
    process.env.CONNECTOR_PROVIDER = 'fake';
    process.env.APP_ENV = 'staging';
    expect(() => requireConnectorProvider()).toThrow(/not allowed/);
  });
});
