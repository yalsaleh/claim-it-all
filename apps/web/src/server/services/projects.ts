import {
  canAssignProjectRole,
  hasCapability,
  tenantRoleCanAccessAllTenantProjects,
} from '@contractradar/authz';
import type { ProjectRole } from '@contractradar/authz';
import { requireProjectCapability, requireTenantCapability } from '@/server/authz/context';
import { writeAuditLog } from '@/server/audit';
import { withTenantTransaction } from '@/server/db/tenant-context';
import { forbidden, notFound, validationError } from '@/server/errors';
import {
  AddProjectMemberInputSchema,
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
} from '@/server/validation/project';

export async function listProjectsForActiveTenant() {
  const ctx = await requireTenantCapability('project.read');
  const tenantWide = tenantRoleCanAccessAllTenantProjects(ctx.tenantRole);

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.project.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(tenantWide
          ? {}
          : {
              memberships: {
                some: {
                  userId: ctx.user.id,
                  status: 'ACTIVE',
                },
              },
            }),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
  );
}

export async function createProject(rawInput: unknown) {
  const ctx = await requireTenantCapability('project.create');
  const parsed = CreateProjectInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid project payload', parsed.error.flatten());
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const created = await tx.project.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description,
        countryCode: parsed.data.countryCode,
        defaultCurrency: parsed.data.defaultCurrency,
        timezone: parsed.data.timezone,
        status: parsed.data.status ?? 'DRAFT',
      },
    });

    await tx.projectMembership.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: created.id,
        userId: ctx.user.id,
        role: 'PROJECT_ADMIN',
        status: 'ACTIVE',
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: created.id,
        actorUserId: ctx.user.id,
        action: 'project.created',
        entityType: 'project',
        entityId: created.id,
        metadata: {
          code: created.code,
          status: created.status,
        },
      },
      tx,
    );

    return created;
  });
}

export async function getProject(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'project.read');
  return ctx.project;
}

export async function updateProject(projectId: string, rawInput: unknown) {
  const parsed = UpdateProjectInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid project update', parsed.error.flatten());
  }

  const access = await requireProjectCapability(projectId, 'project.read');
  const isRestore =
    access.project.status === 'ARCHIVED' &&
    parsed.data.status !== undefined &&
    parsed.data.status !== 'ARCHIVED';
  const isArchive = parsed.data.status === 'ARCHIVED';

  const ctx = isRestore
    ? await requireProjectCapability(projectId, 'project.archive')
    : await requireProjectCapability(projectId, 'project.update');

  if (isArchive && !hasCapability(ctx.capabilities, 'project.archive')) {
    throw forbidden('You cannot archive this project');
  }

  if (access.project.status === 'ARCHIVED' && !isRestore) {
    throw forbidden('Archived projects are read-only');
  }
  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const project = await tx.project.update({
      where: {
        id: ctx.project.id,
        tenantId: ctx.tenantId,
      },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.countryCode !== undefined ? { countryCode: parsed.data.countryCode } : {}),
        ...(parsed.data.defaultCurrency !== undefined
          ? { defaultCurrency: parsed.data.defaultCurrency }
          : {}),
        ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
    });

    const action = isArchive
      ? 'project.archived'
      : isRestore
        ? 'project.restored'
        : 'project.updated';

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: project.id,
        actorUserId: ctx.user.id,
        action,
        entityType: 'project',
        entityId: project.id,
        metadata: { fields: Object.keys(parsed.data) },
      },
      tx,
    );

    return project;
  });
}

export async function listProjectMembers(projectId: string) {
  const ctx = await requireProjectCapability(projectId, 'project.members.read');

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) =>
    tx.projectMembership.findMany({
      where: {
        projectId: ctx.project.id,
        tenantId: ctx.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  );
}

export async function addProjectMember(projectId: string, rawInput: unknown) {
  const ctx = await requireProjectCapability(projectId, 'project.members.manage');
  const parsed = AddProjectMemberInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw validationError('Invalid membership payload', parsed.error.flatten());
  }

  if (!canAssignProjectRole(ctx.tenantRole, ctx.projectRole, parsed.data.role as ProjectRole)) {
    await withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
      await writeAuditLog(
        {
          tenantId: ctx.tenantId,
          projectId: ctx.project.id,
          actorUserId: ctx.user.id,
          action: 'authz.denied',
          entityType: 'project_membership',
          metadata: { reason: 'role_assignment_authority', role: parsed.data.role },
        },
        tx,
      );
    });
    throw forbidden('You cannot assign this project role');
  }

  return withTenantTransaction({ tenantId: ctx.tenantId, userId: ctx.user.id }, async (tx) => {
    const tenantMembership = await tx.tenantMembership.findFirst({
      where: {
        tenantId: ctx.tenantId,
        userId: parsed.data.userId,
        status: 'ACTIVE',
      },
    });

    if (!tenantMembership) {
      throw notFound();
    }

    const project = await tx.project.findFirst({
      where: { id: ctx.project.id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!project) {
      throw notFound();
    }

    const existing = await tx.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: parsed.data.userId,
        },
      },
    });

    const created = await tx.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: parsed.data.userId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        projectId: project.id,
        userId: parsed.data.userId,
        role: parsed.data.role,
        status: 'ACTIVE',
      },
      update: {
        role: parsed.data.role,
        status: 'ACTIVE',
        tenantId: ctx.tenantId,
      },
    });

    await writeAuditLog(
      {
        tenantId: ctx.tenantId,
        projectId: project.id,
        actorUserId: ctx.user.id,
        action: existing ? 'project.membership.role_changed' : 'project.membership.created',
        entityType: 'project_membership',
        entityId: created.id,
        metadata: {
          targetUserId: parsed.data.userId,
          role: parsed.data.role,
        },
      },
      tx,
    );

    return created;
  });
}
