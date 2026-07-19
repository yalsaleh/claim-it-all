export const TENANT_ROLES = [
  'TENANT_OWNER',
  'TENANT_ADMIN',
  'COMMERCIAL_MANAGER',
  'CONTRACTS_MANAGER',
  'PROJECT_MANAGER',
  'REVIEWER',
  'VIEWER',
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const PROJECT_ROLES = [
  'PROJECT_ADMIN',
  'COMMERCIAL_LEAD',
  'CONTRACTS_LEAD',
  'PROJECT_MANAGER',
  'REVIEWER',
  'CONTRIBUTOR',
  'VIEWER',
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Higher number = more administrative authority within the tenant. */
export const TENANT_ROLE_RANK: Record<TenantRole, number> = {
  TENANT_OWNER: 100,
  TENANT_ADMIN: 90,
  COMMERCIAL_MANAGER: 50,
  CONTRACTS_MANAGER: 50,
  PROJECT_MANAGER: 40,
  REVIEWER: 20,
  VIEWER: 10,
};

export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  PROJECT_ADMIN: 100,
  COMMERCIAL_LEAD: 70,
  CONTRACTS_LEAD: 70,
  PROJECT_MANAGER: 60,
  REVIEWER: 40,
  CONTRIBUTOR: 30,
  VIEWER: 10,
};

export function canAssignTenantRole(actorRole: TenantRole, targetRole: TenantRole): boolean {
  // Only owner/admin may manage memberships; never assign above own rank.
  if (actorRole !== 'TENANT_OWNER' && actorRole !== 'TENANT_ADMIN') {
    return false;
  }
  if (actorRole === 'TENANT_ADMIN' && targetRole === 'TENANT_OWNER') {
    return false;
  }
  return TENANT_ROLE_RANK[actorRole] >= TENANT_ROLE_RANK[targetRole];
}

export function canAssignProjectRole(
  actorTenantRole: TenantRole | null,
  actorProjectRole: ProjectRole | null,
  targetRole: ProjectRole,
): boolean {
  const tenantCanManage =
    actorTenantRole === 'TENANT_OWNER' ||
    actorTenantRole === 'TENANT_ADMIN' ||
    actorTenantRole === 'PROJECT_MANAGER';

  if (tenantCanManage) {
    return true;
  }

  if (actorProjectRole === 'PROJECT_ADMIN') {
    return PROJECT_ROLE_RANK[actorProjectRole] >= PROJECT_ROLE_RANK[targetRole];
  }

  return false;
}
