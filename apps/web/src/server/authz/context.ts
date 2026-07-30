import type { Capability, ProjectRole, TenantRole } from '@contractradar/authz';
import {
  hasCapability,
  resolveCapabilities,
  tenantRoleCanAccessAllTenantProjects,
} from '@contractradar/authz';
import type { Prisma, Project, ProjectStatus, TenantMembership } from '@prisma/client';
import { clearActiveTenantId, readActiveTenantId } from '@/server/auth/active-tenant';
import { getSessionUser, type SessionUser } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction, withUserTransaction } from '@/server/db/tenant-context';
import { forbidden, notFound, unauthorized } from '@/server/errors';

export type AuthenticatedUser = SessionUser;

export type TenantContext = {
  user: AuthenticatedUser;
  tenantId: string;
  membership: TenantMembership;
  tenantRole: TenantRole;
  capabilities: Set<Capability>;
};

export type ProjectContext = TenantContext & {
  project: Project;
  projectRole: ProjectRole | null;
};

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getSessionUser();
  if (!user) {
    throw unauthorized();
  }
  if (user.status !== 'ACTIVE') {
    throw forbidden('User account is not active');
  }
  return user;
}

export async function requireTenantMembership(tenantId?: string): Promise<TenantContext> {
  const user = await requireAuthenticatedUser();
  const resolvedTenantId = tenantId ?? (await readActiveTenantId());

  if (!resolvedTenantId) {
    throw forbidden('No organization selected');
  }

  const membership = await withTenantTransaction(
    { tenantId: resolvedTenantId, userId: user.id },
    async (tx) =>
      tx.tenantMembership.findFirst({
        where: {
          tenantId: resolvedTenantId,
          userId: user.id,
          status: 'ACTIVE',
          // PROVISIONING/PILOT_ENDING remain accessible for onboarding/admin; SUSPENDED/ARCHIVED/OFFBOARDING are not.
          tenant: { status: { in: ['ACTIVE', 'PROVISIONING', 'PILOT_ENDING'] } },
        },
      }),
  );

  if (!membership) {
    // Stale/tampered cookie: clear selector. Never authorize from cookie alone.
    if (!tenantId) {
      await clearActiveTenantId();
    }
    throw forbidden('You do not have access to this organization');
  }

  const tenantRole = membership.role as TenantRole;
  const capabilities = resolveCapabilities({ tenantRole });

  return {
    user,
    tenantId: membership.tenantId,
    membership,
    tenantRole,
    capabilities,
  };
}

export async function requireTenantRole(
  roles: TenantRole[],
  tenantId?: string,
): Promise<TenantContext> {
  const ctx = await requireTenantMembership(tenantId);
  if (!roles.includes(ctx.tenantRole)) {
    throw forbidden();
  }
  return ctx;
}

export async function requireTenantCapability(
  capability: Capability,
  tenantId?: string,
): Promise<TenantContext> {
  const ctx = await requireTenantMembership(tenantId);
  if (!hasCapability(ctx.capabilities, capability)) {
    await withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
      await writeAuditLog(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'authz.denied',
          entityType: 'capability',
          entityId: capability,
          metadata: { capability, tenantRole: ctx.tenantRole },
        },
        tx,
      );
    });
    throw forbidden();
  }
  return ctx;
}

async function loadAuthorizedProject(
  ctx: TenantContext,
  projectId: string,
): Promise<ProjectContext> {
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        tenantId: ctx.tenantId,
      },
    });

    if (!project) {
      throw notFound();
    }

    const projectMembership = await tx.projectMembership.findFirst({
      where: {
        projectId: project.id,
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        status: 'ACTIVE',
      },
    });

    const hasTenantWideAccess = tenantRoleCanAccessAllTenantProjects(ctx.tenantRole);

    if (!projectMembership && !hasTenantWideAccess) {
      throw notFound();
    }

    const projectRole = (projectMembership?.role as ProjectRole | undefined) ?? null;
    const capabilities = resolveCapabilities({
      tenantRole: ctx.tenantRole,
      projectRole,
      projectStatus: project.status as ProjectStatus,
    });

    return {
      ...ctx,
      project,
      projectRole,
      capabilities,
    };
  });
}

export async function getAuthorizedProject(projectId: string): Promise<ProjectContext> {
  const ctx = await requireTenantMembership();
  return loadAuthorizedProject(ctx, projectId);
}

export async function requireProjectAccess(projectId: string): Promise<ProjectContext> {
  const ctx = await getAuthorizedProject(projectId);
  if (!hasCapability(ctx.capabilities, 'project.read')) {
    throw notFound();
  }
  return ctx;
}

export async function requireProjectRole(
  projectId: string,
  roles: ProjectRole[],
): Promise<ProjectContext> {
  const ctx = await requireProjectAccess(projectId);
  if (!ctx.projectRole || !roles.includes(ctx.projectRole)) {
    if (
      ctx.tenantRole === 'TENANT_OWNER' ||
      ctx.tenantRole === 'TENANT_ADMIN' ||
      ctx.tenantRole === 'PROJECT_MANAGER'
    ) {
      return ctx;
    }
    throw forbidden();
  }
  return ctx;
}

export async function requireProjectCapability(
  projectId: string,
  capability: Capability,
): Promise<ProjectContext> {
  const ctx = await requireProjectAccess(projectId);
  if (!hasCapability(ctx.capabilities, capability)) {
    await withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
      await writeAuditLog(
        {
          tenantId: ctx.tenantId,
          projectId: ctx.project.id,
          actorUserId: ctx.user.id,
          action: 'authz.denied',
          entityType: 'capability',
          entityId: capability,
          metadata: {
            capability,
            tenantRole: ctx.tenantRole,
            projectRole: ctx.projectRole,
            projectStatus: ctx.project.status,
          },
        },
        tx,
      );
    });
    throw forbidden();
  }
  return ctx;
}

/** Used by tenant listing before an active org is selected. */
export async function withAuthenticatedUserDb<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const user = await requireAuthenticatedUser();
  return withUserTransaction(user.id, fn);
}
