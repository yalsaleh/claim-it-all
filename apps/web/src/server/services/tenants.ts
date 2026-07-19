import { writeActiveTenantId } from '@/server/auth/active-tenant';
import {
  requireAuthenticatedUser,
  requireTenantMembership,
  withAuthenticatedUserDb,
} from '@/server/authz/context';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { validationError } from '@/server/errors';
import { SelectTenantInputSchema } from '@/server/validation/project';

export async function listAuthorizedTenants() {
  const user = await requireAuthenticatedUser();

  return withAuthenticatedUserDb(async (tx) =>
    tx.tenant.findMany({
      where: {
        status: 'ACTIVE',
        memberships: {
          some: {
            userId: user.id,
            status: 'ACTIVE',
          },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        memberships: {
          where: { userId: user.id, status: 'ACTIVE' },
          select: { role: true },
          take: 1,
        },
      },
    }),
  );
}

export async function selectActiveTenant(rawInput: unknown) {
  const parsed = SelectTenantInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid organization selection', parsed.error.flatten());
  }

  // Membership check rejects unknown/foreign tenants without leaking existence details.
  const ctx = await requireTenantMembership(parsed.data.tenantId);
  await writeActiveTenantId(ctx.tenantId);

  await withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: 'tenant.selected',
        entityType: 'tenant',
        entityId: ctx.tenantId,
      },
      tx,
    );
  });

  return { tenantId: ctx.tenantId };
}
