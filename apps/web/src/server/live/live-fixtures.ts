import { randomUUID } from 'node:crypto';
import type { PrismaClient, TenantRole } from '@prisma/client';
import { getServerEnv } from '@/lib/env';
import { signTenantId, verifySignedTenantValue } from '@/server/auth/active-tenant-crypto';
import { setRlsContext } from '@/server/db/tenant-context';

export type LiveActor = {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE';
};

export type LiveTenantFixture = {
  runId: string;
  tenantId: string;
  projectId: string;
  owner: LiveActor;
  /** Production-signed active-tenant cookie value (not a raw UUID). */
  signedActiveTenant: string;
};

/**
 * Privileged fixture bootstrap for Mode B live tests.
 * Creates run-scoped synthetic tenant/user/project — never reuses demo seed IDs.
 */
export async function bootstrapLiveTenant(
  prisma: PrismaClient,
  options?: { label?: string; tenantRole?: TenantRole },
): Promise<LiveTenantFixture> {
  const runId =
    process.env.GITHUB_RUN_ID?.replace(/\W/g, '') ||
    process.env.LIVE_RUN_ID?.replace(/\W/g, '') ||
    randomUUID().replace(/-/g, '').slice(0, 16);
  const label = (options?.label ?? 'live').replace(/\W/g, '').slice(0, 12);
  const stamp = `${label}-${runId}-${randomUUID().slice(0, 8)}`;
  const tenantRole = options?.tenantRole ?? 'TENANT_OWNER';

  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });

    const tenant = await tx.tenant.create({
      data: {
        name: `Live ${stamp}`,
        slug: `live-${stamp}`.slice(0, 64),
        status: 'ACTIVE',
      },
    });

    const user = await tx.user.create({
      data: {
        email: `owner-${stamp}@live-test.example`.toLowerCase(),
        name: `Live Owner ${label}`,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: tenantRole,
        status: 'ACTIVE',
      },
    });

    const project = await tx.project.create({
      data: {
        tenantId: tenant.id,
        name: `Live Project ${stamp}`,
        code: `LP-${stamp}`.slice(0, 32),
        countryCode: 'AE',
        defaultCurrency: 'AED',
        timezone: 'Asia/Dubai',
        status: 'ACTIVE',
      },
    });

    const projectMembership = await tx.projectMembership.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        userId: user.id,
        role: 'PROJECT_ADMIN',
        status: 'ACTIVE',
      },
    });

    const secret = getServerEnv().BETTER_AUTH_SECRET;
    const signedActiveTenant = signTenantId(tenant.id, secret);
    // Fail closed if signing/verification diverges from production path.
    if (verifySignedTenantValue(signedActiveTenant, secret) !== tenant.id) {
      throw new Error('live fixture: signed active tenant failed production verification');
    }

    console.info('[live-stage] fixture-user-created: ok');
    console.info('[live-stage] fixture-tenant-created: ok');
    console.info('[live-stage] fixture-tenant-membership-created: ok');
    console.info('[live-stage] fixture-project-created: ok');
    console.info('[live-stage] fixture-project-membership-created: ok');
    console.info('[live-stage] signed-active-tenant-context-created: ok');
    console.info(
      JSON.stringify({
        liveFixture: {
          runId,
          tenantId: tenant.id,
          projectId: project.id,
          userId: user.id,
          tenantMembershipStatus: membership.status,
          projectMembershipStatus: projectMembership.status,
          tenantRole: membership.role,
          projectRole: projectMembership.role,
        },
      }),
    );

    return {
      runId,
      tenantId: tenant.id,
      projectId: project.id,
      owner: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: 'ACTIVE',
      },
      signedActiveTenant,
    };
  });
}

/** Delete Slice-2 document graph then tenancy rows (FK-safe). Privileged only. */
export async function wipeLiveDocumentGraph(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
    await tx.evidenceSegment.deleteMany();
    await tx.extractedArtifact.deleteMany();
    await tx.documentProcessingRun.deleteMany();
    await tx.documentRelationship.deleteMany();
    await tx.uploadSession.deleteMany();
    // Clear currentVersion FK before deleting versions/documents.
    await tx.$executeRaw`UPDATE source_document SET "currentVersionId" = NULL`;
    await tx.documentVersion.deleteMany();
    await tx.sourceDocument.deleteMany();
    await tx.ingestionEvent.deleteMany();
    await tx.outboxEvent.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.projectMembership.deleteMany();
    await tx.project.deleteMany();
    await tx.tenantMembership.deleteMany();
    await tx.session.deleteMany();
    await tx.account.deleteMany();
    await tx.user.deleteMany();
    await tx.tenant.deleteMany();
  });
}

export async function inspectFixtureVisibility(
  prisma: PrismaClient,
  input: { tenantId: string; userId: string; projectId: string },
): Promise<{
  membershipVisible: boolean;
  projectVisible: boolean;
  currentRole: string;
}> {
  const roleRows = await prisma.$queryRaw<{ role: string }[]>`SELECT current_user AS role`;
  const membershipVisible = await prisma.$transaction(async (tx) => {
    await setRlsContext(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      bypass: false,
    });
    const row = await tx.tenantMembership.findFirst({
      where: { tenantId: input.tenantId, userId: input.userId, status: 'ACTIVE' },
      select: { id: true },
    });
    return Boolean(row);
  });
  const projectVisible = await prisma.$transaction(async (tx) => {
    await setRlsContext(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      bypass: false,
    });
    const row = await tx.project.findFirst({
      where: { id: input.projectId, tenantId: input.tenantId },
      select: { id: true },
    });
    return Boolean(row);
  });
  return {
    membershipVisible,
    projectVisible,
    currentRole: roleRows[0]?.role ?? 'unknown',
  };
}
