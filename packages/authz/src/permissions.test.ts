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
    expect(hasCapability(caps, 'contract_package.read')).toBe(true);
    expect(hasCapability(caps, 'contract_configuration.approve')).toBe(false);
    expect(hasCapability(caps, 'deadline.calculate')).toBe(false);
    expect(hasCapability(caps, 'project_event.read')).toBe(false);
    expect(hasCapability(caps, 'detection_run.create')).toBe(false);
    expect(hasCapability(caps, 'detection_run.read')).toBe(true);
    expect(hasCapability(caps, 'event_suggestion.read')).toBe(true);
    expect(hasCapability(caps, 'event_suggestion.accept')).toBe(false);
    expect(hasCapability(caps, 'notice_package.read')).toBe(true);
    expect(hasCapability(caps, 'notice_draft.approve')).toBe(false);
    expect(hasCapability(caps, 'notice_dispatch.send')).toBe(false);
    expect(hasCapability(caps, 'notice_dispatch.read')).toBe(true);
    expect(hasCapability(caps, 'operations_dashboard.read')).toBe(true);
    expect(hasCapability(caps, 'portfolio.read')).toBe(true);
    expect(hasCapability(caps, 'connector_account.approve')).toBe(false);
  });

  it('grants tenant owners connector approve and portfolio read', () => {
    const owner = capabilitiesForTenantRole('TENANT_OWNER');
    expect(hasCapability(owner, 'connector_account.approve')).toBe(true);
    expect(hasCapability(owner, 'portfolio.read')).toBe(true);
    expect(hasCapability(owner, 'operations_dashboard.read')).toBe(true);

    const admin = capabilitiesForTenantRole('TENANT_ADMIN');
    expect(hasCapability(admin, 'connector_account.approve')).toBe(true);
    expect(hasCapability(admin, 'portfolio.read')).toBe(true);
  });

  it('grants contracts managers package and approval capabilities', () => {
    const caps = capabilitiesForTenantRole('CONTRACTS_MANAGER');
    expect(hasCapability(caps, 'contract_package.create')).toBe(true);
    expect(hasCapability(caps, 'contract_structure.review')).toBe(true);
    expect(hasCapability(caps, 'contract_configuration.approve')).toBe(true);
    expect(hasCapability(caps, 'project_event.create')).toBe(true);
    expect(hasCapability(caps, 'deadline.calculate')).toBe(true);
    expect(hasCapability(caps, 'project_calendar.approve')).toBe(true);
    expect(hasCapability(caps, 'detection_run.create')).toBe(true);
    expect(hasCapability(caps, 'event_suggestion.accept')).toBe(true);
    expect(hasCapability(caps, 'notice_package.create')).toBe(true);
    expect(hasCapability(caps, 'notice_draft.approve')).toBe(true);
    expect(hasCapability(caps, 'notice_export.generate')).toBe(true);
    expect(hasCapability(caps, 'notice_dispatch.authorize')).toBe(true);
    expect(hasCapability(caps, 'notice_dispatch.send')).toBe(true);
    expect(hasCapability(caps, 'notice_receipt.confirm')).toBe(true);
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
