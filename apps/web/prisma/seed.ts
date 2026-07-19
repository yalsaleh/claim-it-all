import { randomBytes } from 'node:crypto';
import { PrismaClient, type ProjectRole, type TenantRole } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { assertSafeDatabaseUrl } from '../src/lib/db-url-guard';

/**
 * Development-only seed. Refuses production NODE_ENV and non-local DB hosts
 * unless ALLOW_UNSAFE_DB_RESET=true is explicitly set.
 */

const prisma = new PrismaClient();

function resolvePassword(envKey: string, label: string): { password: string; generated: boolean } {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.length >= 12) {
    return { password: fromEnv, generated: false };
  }
  const password = `Dev-${label}-${randomBytes(9).toString('base64url')}!`;
  return { password, generated: true };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed in production');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seed');
  }

  assertSafeDatabaseUrl(databaseUrl, {
    purpose: 'seed',
    allowProductionOverride: process.env.ALLOW_UNSAFE_DB_RESET === 'true',
  });

  const ownerSecret = resolvePassword('SEED_OWNER_PASSWORD', 'Owner');
  const viewerSecret = resolvePassword('SEED_VIEWER_PASSWORD', 'Viewer');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

    const tenant = await tx.tenant.upsert({
      where: { slug: 'demo-gulf-contractor' },
      update: {
        name: 'Demo Gulf Contractor LLC',
        status: 'ACTIVE',
      },
      create: {
        name: 'Demo Gulf Contractor LLC',
        slug: 'demo-gulf-contractor',
        status: 'ACTIVE',
      },
    });

    async function upsertUser(input: { email: string; name: string; password: string }) {
      const email = input.email.toLowerCase();
      const passwordHash = await hashPassword(input.password);
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        const account = await tx.account.findFirst({
          where: { userId: existing.id, providerId: 'credential' },
        });
        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: { password: passwordHash },
          });
        } else {
          await tx.account.create({
            data: {
              userId: existing.id,
              accountId: existing.id,
              providerId: 'credential',
              password: passwordHash,
            },
          });
        }
        return existing;
      }

      const user = await tx.user.create({
        data: {
          email,
          name: input.name,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: passwordHash,
        },
      });
      return user;
    }

    const owner = await upsertUser({
      email: 'owner@demo-contractor.example',
      name: 'Aisha Al-Mutairi',
      password: ownerSecret.password,
    });

    const viewer = await upsertUser({
      email: 'viewer@demo-contractor.example',
      name: 'Omar Haddad',
      password: viewerSecret.password,
    });

    async function ensureTenantMembership(userId: string, role: TenantRole) {
      await tx.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId } },
        update: { role, status: 'ACTIVE' },
        create: { tenantId: tenant.id, userId, role, status: 'ACTIVE' },
      });
    }

    await ensureTenantMembership(owner.id, 'TENANT_OWNER');
    await ensureTenantMembership(viewer.id, 'VIEWER');

    const projectA = await tx.project.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: 'KWI-RING-01' } },
      update: {
        name: 'Kuwait Ring Road Package A',
        description: 'Fictional highway package for local platform testing.',
        status: 'ACTIVE',
        countryCode: 'KW',
        defaultCurrency: 'KWD',
        timezone: 'Asia/Kuwait',
      },
      create: {
        tenantId: tenant.id,
        name: 'Kuwait Ring Road Package A',
        code: 'KWI-RING-01',
        description: 'Fictional highway package for local platform testing.',
        status: 'ACTIVE',
        countryCode: 'KW',
        defaultCurrency: 'KWD',
        timezone: 'Asia/Kuwait',
      },
    });

    const projectB = await tx.project.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: 'DXB-TOWER-07' } },
      update: {
        name: 'Dubai Coastal Tower Package 7',
        description: 'Fictional high-rise package for membership scoping tests.',
        status: 'ACTIVE',
        countryCode: 'AE',
        defaultCurrency: 'AED',
        timezone: 'Asia/Dubai',
      },
      create: {
        tenantId: tenant.id,
        name: 'Dubai Coastal Tower Package 7',
        code: 'DXB-TOWER-07',
        description: 'Fictional high-rise package for membership scoping tests.',
        status: 'ACTIVE',
        countryCode: 'AE',
        defaultCurrency: 'AED',
        timezone: 'Asia/Dubai',
      },
    });

    async function ensureProjectMembership(projectId: string, userId: string, role: ProjectRole) {
      await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId, userId } },
        update: { role, status: 'ACTIVE', tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          projectId,
          userId,
          role,
          status: 'ACTIVE',
        },
      });
    }

    await ensureProjectMembership(projectA.id, owner.id, 'PROJECT_ADMIN');
    await ensureProjectMembership(projectA.id, viewer.id, 'VIEWER');
    await ensureProjectMembership(projectB.id, owner.id, 'PROJECT_ADMIN');
  });

  console.log('Seed complete for Demo Gulf Contractor LLC (local development only)');
  console.log(`  owner@demo-contractor.example / ${ownerSecret.password}`);
  console.log(`  viewer@demo-contractor.example / ${viewerSecret.password}`);
  if (ownerSecret.generated || viewerSecret.generated) {
    console.log('  (Passwords were generated for this run. Set SEED_*_PASSWORD to pin them.)');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
