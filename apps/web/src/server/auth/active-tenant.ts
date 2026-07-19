import { cookies } from 'next/headers';
import { EntityIdSchema } from '@contractradar/shared';
import { getServerEnv } from '@/lib/env';
import { signTenantId, verifySignedTenantValue } from '@/server/auth/active-tenant-crypto';

export const ACTIVE_TENANT_COOKIE = 'cr_active_tenant';

export async function readActiveTenantId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_TENANT_COOKIE)?.value;
  if (!value) {
    return null;
  }

  const secret = getServerEnv().BETTER_AUTH_SECRET;
  const verified = verifySignedTenantValue(value, secret);
  if (verified) {
    return verified;
  }

  // Legacy unsigned UUID during transition — still revalidated via membership.
  const legacy = EntityIdSchema.safeParse(value);
  return legacy.success ? legacy.data : null;
}

export async function writeActiveTenantId(tenantId: string): Promise<void> {
  const env = getServerEnv();
  const jar = await cookies();
  jar.set(ACTIVE_TENANT_COOKIE, signTenantId(tenantId, env.BETTER_AUTH_SECRET), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function clearActiveTenantId(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTIVE_TENANT_COOKIE);
}
