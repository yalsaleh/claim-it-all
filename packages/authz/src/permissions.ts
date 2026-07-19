import type { Capability } from './capabilities';
import type { ProjectRole, ProjectStatus, TenantRole } from './roles';

const DOCUMENT_READ: Capability[] = [
  'document.read',
  'document.download',
  'document.processing.view',
];

const DOCUMENT_CONTRIBUTE: Capability[] = [
  ...DOCUMENT_READ,
  'document.create',
  'document.add_version',
];

const DOCUMENT_MANAGE: Capability[] = [
  ...DOCUMENT_CONTRIBUTE,
  'document.update_metadata',
  'document.archive',
  'document.processing.retry',
];

const DOCUMENT_QUARANTINE: Capability[] = [
  'document.quarantine.view',
  'document.quarantine.manage',
  'project.storage.manage',
];

const TENANT_ROLE_CAPABILITIES: Record<TenantRole, readonly Capability[]> = {
  TENANT_OWNER: [
    'tenant.read',
    'tenant.manage',
    'tenant.members.read',
    'tenant.members.manage',
    'project.create',
    'project.read',
    'project.update',
    'project.archive',
    'project.members.read',
    'project.members.manage',
    'audit.read',
    ...DOCUMENT_MANAGE,
    ...DOCUMENT_QUARANTINE,
  ],
  TENANT_ADMIN: [
    'tenant.read',
    'tenant.manage',
    'tenant.members.read',
    'tenant.members.manage',
    'project.create',
    'project.read',
    'project.update',
    'project.archive',
    'project.members.read',
    'project.members.manage',
    'audit.read',
    ...DOCUMENT_MANAGE,
    ...DOCUMENT_QUARANTINE,
  ],
  COMMERCIAL_MANAGER: [
    'tenant.read',
    'tenant.members.read',
    'project.create',
    'project.read',
    'project.update',
    'project.members.read',
    'audit.read',
    ...DOCUMENT_MANAGE,
  ],
  CONTRACTS_MANAGER: [
    'tenant.read',
    'tenant.members.read',
    'project.create',
    'project.read',
    'project.update',
    'project.members.read',
    'audit.read',
    ...DOCUMENT_MANAGE,
  ],
  PROJECT_MANAGER: [
    'tenant.read',
    'tenant.members.read',
    'project.create',
    'project.read',
    'project.update',
    'project.members.read',
    'project.members.manage',
    ...DOCUMENT_MANAGE,
  ],
  REVIEWER: ['tenant.read', 'project.read', 'project.members.read', ...DOCUMENT_READ],
  VIEWER: ['tenant.read', 'project.read', 'document.read', 'document.download'],
};

const PROJECT_ROLE_CAPABILITIES: Record<ProjectRole, readonly Capability[]> = {
  PROJECT_ADMIN: [
    'project.read',
    'project.update',
    'project.archive',
    'project.members.read',
    'project.members.manage',
    ...DOCUMENT_MANAGE,
    ...DOCUMENT_QUARANTINE,
  ],
  COMMERCIAL_LEAD: ['project.read', 'project.update', 'project.members.read', ...DOCUMENT_MANAGE],
  CONTRACTS_LEAD: ['project.read', 'project.update', 'project.members.read', ...DOCUMENT_MANAGE],
  PROJECT_MANAGER: [
    'project.read',
    'project.update',
    'project.members.read',
    'project.members.manage',
    ...DOCUMENT_MANAGE,
  ],
  REVIEWER: ['project.read', 'project.members.read', ...DOCUMENT_READ],
  CONTRIBUTOR: ['project.read', 'project.members.read', ...DOCUMENT_CONTRIBUTE],
  VIEWER: ['project.read', 'document.read', 'document.download'],
};

const MUTATING_PROJECT_CAPABILITIES = new Set<Capability>([
  'project.update',
  'project.archive',
  'project.members.manage',
  'document.create',
  'document.update_metadata',
  'document.add_version',
  'document.archive',
  'document.processing.retry',
  'document.quarantine.manage',
  'project.storage.manage',
]);

export function capabilitiesForTenantRole(role: TenantRole): ReadonlySet<Capability> {
  return new Set(TENANT_ROLE_CAPABILITIES[role]);
}

export function capabilitiesForProjectRole(role: ProjectRole): ReadonlySet<Capability> {
  return new Set(PROJECT_ROLE_CAPABILITIES[role]);
}

export function mergeCapabilities(
  ...sets: Array<ReadonlySet<Capability> | undefined>
): Set<Capability> {
  const merged = new Set<Capability>();
  for (const set of sets) {
    if (!set) continue;
    for (const capability of set) {
      merged.add(capability);
    }
  }
  return merged;
}

export function hasCapability(
  capabilities: ReadonlySet<Capability>,
  capability: Capability,
): boolean {
  return capabilities.has(capability);
}

export function resolveCapabilities(input: {
  tenantRole: TenantRole;
  projectRole?: ProjectRole | null;
  projectStatus?: ProjectStatus | null;
}): Set<Capability> {
  const tenantCaps = capabilitiesForTenantRole(input.tenantRole);
  const projectCaps = input.projectRole ? capabilitiesForProjectRole(input.projectRole) : undefined;

  const merged = mergeCapabilities(tenantCaps, projectCaps);

  if (input.projectStatus === 'ARCHIVED') {
    for (const capability of MUTATING_PROJECT_CAPABILITIES) {
      if (capability !== 'project.archive' && capability !== 'document.archive') {
        merged.delete(capability);
      }
    }
  }

  return merged;
}

export function tenantRoleCanAccessAllTenantProjects(role: TenantRole): boolean {
  return (
    role === 'TENANT_OWNER' ||
    role === 'TENANT_ADMIN' ||
    role === 'COMMERCIAL_MANAGER' ||
    role === 'CONTRACTS_MANAGER' ||
    role === 'PROJECT_MANAGER'
  );
}
