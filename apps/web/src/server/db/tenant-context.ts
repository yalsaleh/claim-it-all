import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/db';

export type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Transaction-scoped PostgreSQL GUCs for RLS.
 * Uses set_config(..., is_local := true) so pooled connections cannot leak context.
 */
export async function setRlsContext(
  client: DbClient,
  input: {
    userId?: string | null;
    tenantId?: string | null;
    bypass?: boolean;
  },
): Promise<void> {
  await client.$executeRaw`SELECT set_config('app.current_user_id', ${input.userId ?? ''}, true)`;
  await client.$executeRaw`SELECT set_config('app.current_tenant_id', ${input.tenantId ?? ''}, true)`;
  await client.$executeRaw`SELECT set_config('app.bypass_rls', ${input.bypass ? 'on' : 'off'}, true)`;
}

/** Privileged path for seed/admin/fixtures. Never call from request handlers. */
export async function withBypassRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

/** Authenticated user context without an active tenant (org picker, membership checks). */
export async function withUserTransaction<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { userId, bypass: false });
    return fn(tx);
  });
}

/** Full tenant-scoped request transaction. */
export async function withTenantTransaction<T>(
  input: { tenantId: string; userId: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, {
      userId: input.userId,
      tenantId: input.tenantId,
      bypass: false,
    });
    return fn(tx);
  });
}
