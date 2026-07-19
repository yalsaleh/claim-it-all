import { describe, expect, it } from 'vitest';
import {
  canAssignProjectRole,
  canAssignTenantRole,
  capabilitiesForTenantRole,
  hasCapability,
  resolveCapabilities,
} from './index';

describe('tenant role capabilities', () => {
  it('allows owners and admins to create projects', () => {
    expect(hasCapability(capabilitiesForTenantRole('TENANT_OWNER'), 'project.create')).toBe(true);
    expect(hasCapability(capabilitiesForTenantRole('TENANT_ADMIN'), 'project.create')).toBe(true);
  });

  it('allows commercial and contracts managers to read projects', () => {
    expect(hasCapability(capabilitiesForTenantRole('COMMERCIAL_MANAGER'), 'project.read')).toBe(
      true,
    );
    expect(hasCapability(capabilitiesForTenantRole('CONTRACTS_MANAGER'), 'project.read')).toBe(
      true,
    );
  });

  it('prevents viewers from mutating projects', () => {
    const caps = resolveCapabilities({ tenantRole: 'VIEWER', projectRole: 'VIEWER' });
    expect(hasCapability(caps, 'project.update')).toBe(false);
    expect(hasCapability(caps, 'project.archive')).toBe(false);
    expect(hasCapability(caps, 'project.members.manage')).toBe(false);
  });

  it('blocks project managers from managing tenant owners', () => {
    expect(canAssignTenantRole('PROJECT_MANAGER', 'TENANT_OWNER')).toBe(false);
    expect(canAssignTenantRole('TENANT_ADMIN', 'TENANT_OWNER')).toBe(false);
    expect(canAssignTenantRole('TENANT_OWNER', 'TENANT_ADMIN')).toBe(true);
  });
});

describe('archived project read-only', () => {
  it('removes mutating project capabilities when archived', () => {
    const caps = resolveCapabilities({
      tenantRole: 'TENANT_ADMIN',
      projectRole: 'PROJECT_ADMIN',
      projectStatus: 'ARCHIVED',
    });
    expect(hasCapability(caps, 'project.read')).toBe(true);
    expect(hasCapability(caps, 'project.update')).toBe(false);
    expect(hasCapability(caps, 'project.members.manage')).toBe(false);
    expect(hasCapability(caps, 'project.archive')).toBe(true);
  });
});

describe('project role assignment authority', () => {
  it('allows project admins to assign roles at or below their rank', () => {
    expect(canAssignProjectRole(null, 'PROJECT_ADMIN', 'VIEWER')).toBe(true);
    expect(canAssignProjectRole(null, 'REVIEWER', 'VIEWER')).toBe(false);
  });
});
