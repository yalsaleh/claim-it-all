/**
 * Slice 9 platform hardening: invitations, support access SoD, kill switches, pilot readiness.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTestDatabaseUrl } from '@/lib/db-url-guard';
import { prisma } from '@/server/db';
import { setRlsContext } from '@/server/db/tenant-context';
import { purgeOpsTables } from '@/server/operations/test-purge';

vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/server/auth/active-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/active-tenant')>(
    '@/server/auth/active-tenant',
  );
  const state = await import('@/server/live/live-active-tenant-state');
  return {
    ...actual,
    readActiveTenantId: vi.fn(async () => {
      const signed = state.getLiveSignedActiveTenant();
      if (!signed) return null;
      const { verifySignedTenantValue } = await import('@/server/auth/active-tenant-crypto');
      const { getServerEnv } = await import('@/lib/env');
      return verifySignedTenantValue(signed, getServerEnv().BETTER_AUTH_SECRET);
    }),
    writeActiveTenantId: vi.fn(async (tenantId: string) => {
      const { signTenantId } = await import('@/server/auth/active-tenant-crypto');
      const { getServerEnv } = await import('@/lib/env');
      state.setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
    }),
    clearActiveTenantId: vi.fn(async () => {
      state.setLiveSignedActiveTenant(null);
    }),
  };
});

import { getSessionUser } from '@/server/auth/session';
import { setLiveSignedActiveTenant } from '@/server/live/live-active-tenant-state';
import { signTenantId } from '@/server/auth/active-tenant-crypto';
import { getServerEnv } from '@/lib/env';
import {
  approveSupportAccess,
  createPilotReadinessAssessment,
  inviteTenantUser,
  requestSupportAccess,
  setKillSwitch,
  updatePilotReadinessItem,
} from '@/server/services/platform';

requireTestDatabaseUrl();

async function withBypass<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, { bypass: true });
    return fn(tx);
  });
}

describe('platform hardening integration', () => {
  let tenantId: string;
  let owner: { id: string; email: string; name: string; status: 'ACTIVE' };
  let admin: { id: string; email: string; name: string; status: 'ACTIVE' };

  beforeAll(async () => {
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.APP_ENV = 'test';
    await withBypass(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('app.allow_ops_purge', 'on', true)`;
      await purgeOpsTables(tx);
      await tx.pilotReadinessItemRow.deleteMany().catch(() => undefined);
      await tx.pilotReadinessAssessment.deleteMany().catch(() => undefined);
      await tx.pilotConfiguration.deleteMany().catch(() => undefined);
      await tx.providerKillSwitch.deleteMany().catch(() => undefined);
      await tx.providerEnablement.deleteMany().catch(() => undefined);
      await tx.supportAccessAuditSession.deleteMany().catch(() => undefined);
      await tx.supportAccessRequest.deleteMany().catch(() => undefined);
      await tx.tenantInvitation.deleteMany().catch(() => undefined);
      await tx.tenantLimit.deleteMany().catch(() => undefined);
      await tx.tenantFeatureFlag.deleteMany().catch(() => undefined);
      await tx.tenantSettings.deleteMany().catch(() => undefined);
      await tx.tenantStorageUsage.deleteMany().catch(() => undefined);
      await tx.backupRun.deleteMany().catch(() => undefined);
      await tx.auditLog.deleteMany();
      await tx.projectMembership.deleteMany();
      await tx.project.deleteMany();
      await tx.tenantMembership.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const seeded = await withBypass(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: 'Pilot Tenant', slug: `pilot-${Date.now()}`, status: 'PROVISIONING' },
      });
      const ownerUser = await tx.user.create({
        data: {
          email: `owner-${Date.now()}@example.com`,
          name: 'Owner',
          status: 'ACTIVE',
        },
      });
      const adminUser = await tx.user.create({
        data: {
          email: `admin-${Date.now()}@example.com`,
          name: 'Admin',
          status: 'ACTIVE',
        },
      });
      await tx.tenantMembership.createMany({
        data: [
          { tenantId: tenant.id, userId: ownerUser.id, role: 'TENANT_OWNER', status: 'ACTIVE' },
          { tenantId: tenant.id, userId: adminUser.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
        ],
      });
      return {
        tenantId: tenant.id,
        owner: { ...ownerUser, status: 'ACTIVE' as const },
        admin: { ...adminUser, status: 'ACTIVE' as const },
      };
    });

    tenantId = seeded.tenantId;
    owner = seeded.owner;
    admin = seeded.admin;
    setLiveSignedActiveTenant(signTenantId(tenantId, getServerEnv().BETTER_AUTH_SECRET));
  });

  function mockUser(user: typeof owner) {
    vi.mocked(getSessionUser).mockResolvedValue(user);
  }

  it('invites users, enforces support SoD, kill switches, and non-waivable pilot items', async () => {
    mockUser(owner);
    const invited = await inviteTenantUser({
      email: 'new.user@example.com',
      role: 'VIEWER',
    });
    expect(invited.invitation.status).toBe('INVITED');
    expect(invited.deliveryToken.length).toBeGreaterThan(20);

    const supportReq = await requestSupportAccess({
      reason: 'Investigate connector sync failure for pilot tenant',
      requestedCapabilities: ['connector_sync.read', 'operations_dashboard.read'],
      requestedDurationMin: 60,
    });
    expect(supportReq.status).toBe('REQUESTED');

    await expect(approveSupportAccess(supportReq.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    mockUser(admin);
    const approved = await approveSupportAccess(supportReq.id);
    expect(approved.status).toBe('ACTIVE');

    mockUser(owner);
    const kill = await setKillSwitch({
      key: 'ai_calls',
      enabled: true,
      reason: 'Pause AI during pilot incident',
      scope: 'tenant',
    });
    expect(kill.enabled).toBe(true);

    const assessment = await createPilotReadinessAssessment();
    expect(assessment?.items.length).toBeGreaterThan(5);

    await expect(
      updatePilotReadinessItem(assessment!.id, 'recent_successful_backup', {
        status: 'BLOCKED',
        approvedException: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
