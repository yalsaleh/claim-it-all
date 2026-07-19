/**
 * In-memory holder for production-signed active-tenant cookie values in live tests.
 * Product code still verifies via verifySignedTenantValue — never store raw UUIDs here
 * unless they were produced by signTenantId.
 */
let signedActiveTenant: string | null = null;

export function setLiveSignedActiveTenant(value: string | null): void {
  signedActiveTenant = value;
}

export function getLiveSignedActiveTenant(): string | null {
  return signedActiveTenant;
}
