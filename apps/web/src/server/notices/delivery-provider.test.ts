import { describe, expect, it } from 'vitest';
import { FakeNoticeDeliveryProvider } from '@contractradar/notice-delivery';
import { assertDeliveryProviderAllowed } from '@contractradar/notice-delivery';

describe('delivery provider production guard', () => {
  it('rejects test-only fake provider in production', () => {
    const provider = new FakeNoticeDeliveryProvider('success');
    expect(() => assertDeliveryProviderAllowed(provider, 'production')).toThrow(
      /not allowed in this environment/i,
    );
  });

  it('rejects test-only fake provider in staging', () => {
    const provider = new FakeNoticeDeliveryProvider('success');
    expect(() => assertDeliveryProviderAllowed(provider, 'staging')).toThrow(
      /not allowed in this environment/i,
    );
  });

  it('allows fake provider in test', () => {
    const provider = new FakeNoticeDeliveryProvider('success');
    expect(() => assertDeliveryProviderAllowed(provider, 'test')).not.toThrow();
  });
});
