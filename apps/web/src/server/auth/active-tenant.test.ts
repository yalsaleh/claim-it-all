import { describe, expect, it } from 'vitest';
import { signTenantId, verifySignedTenantValue } from './active-tenant-crypto';

describe('active tenant cookie signing', () => {
  const secret = 'unit-test-secret-with-sufficient-length-32';
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('signs and verifies tenant ids', () => {
    const signed = signTenantId(tenantId, secret);
    expect(signed.startsWith(`${tenantId}.`)).toBe(true);
    expect(verifySignedTenantValue(signed, secret)).toBe(tenantId);
  });

  it('rejects tampered signatures', () => {
    expect(verifySignedTenantValue(`${tenantId}.deadbeef`, secret)).toBeNull();
    expect(verifySignedTenantValue(tenantId, secret)).toBeNull();
  });
});
