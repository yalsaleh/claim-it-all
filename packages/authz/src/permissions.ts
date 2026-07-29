import type { Capability } from './capabilities';
import type { ProjectRole, ProjectStatus, TenantRole } from './roles';

const EVENT_DEADLINE: Capability[] = [
  'project_event.create',
  'project_event.read',
  'project_event.update',
  'project_event.confirm',
  'project_event.dispute',
  'deadline_rule.assess',
  'deadline.calculate',
  'deadline.review',
  'deadline.verify',
  'deadline.track',
  'deadline.assign',
  'deadline.complete',
  'deadline.recalculate',
  'project_calendar.manage',
  'project_calendar.approve',
  'warning_policy.manage',
  'detection_run.create',
  'detection_run.read',
  'detection_run.cancel',
  'event_suggestion.read',
  'event_suggestion.review',
  'event_suggestion.accept',
  'event_suggestion.reject',
  'event_suggestion.merge',
  'event_suggestion.request_evidence',
  'detection_rules.manage',
  'detection_evaluation.read',
  'reviewer_feedback.read',
  'notice_package.create',
  'notice_package.read',
  'notice_package.update',
  'notice_package.withdraw',
  'notice_evidence.assess',
  'notice_evidence.link',
  'notice_question.create',
  'notice_question.answer',
  'notice_fact.create',
  'notice_fact.verify',
  'notice_draft.generate',
  'notice_draft.edit',
  'notice_draft.review',
  'notice_draft.submit',
  'notice_draft.approve',
  'notice_draft.reject',
  'notice_exception.approve',
  'notice_attachment.manage',
  'notice_export.generate',
  'notice_export.read',
  'notice_template.manage',
  'notice_template.approve',
];

const DOCUMENT_READ: Capability[] = [
  'document.read',
  'document.download',
  'document.processing.view',
  'contract_package.read',
  'project_event.read',
  'detection_run.read',
  'event_suggestion.read',
  'notice_package.read',
  'notice_export.read',
];

const DOCUMENT_CONTRIBUTE: Capability[] = [
  ...DOCUMENT_READ,
  'document.create',
  'document.add_version',
  'contract_document.attach',
];

const CONTRACT_REVIEW: Capability[] = ['contract_structure.review', 'contract_issue.manage'];

const CONTRACT_MANAGE: Capability[] = [
  'contract_package.create',
  'contract_package.update',
  'contract_structure.run',
  'contract_configuration.submit',
  ...CONTRACT_REVIEW,
];

const CONTRACT_APPROVE: Capability[] = [
  'contract_configuration.approve',
  'contract_configuration.supersede',
];

const DOCUMENT_MANAGE: Capability[] = [
  ...DOCUMENT_CONTRIBUTE,
  'document.update_metadata',
  'document.archive',
  'document.processing.retry',
  ...CONTRACT_MANAGE,
  ...EVENT_DEADLINE,
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
    ...CONTRACT_APPROVE,
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
    ...CONTRACT_APPROVE,
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
    ...CONTRACT_APPROVE,
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
    ...CONTRACT_APPROVE,
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
  REVIEWER: [
    'tenant.read',
    'project.read',
    'project.members.read',
    ...DOCUMENT_READ,
    ...CONTRACT_REVIEW,
  ],
  VIEWER: [
    'tenant.read',
    'project.read',
    'document.read',
    'document.download',
    'contract_package.read',
    'detection_run.read',
    'event_suggestion.read',
    'detection_evaluation.read',
    'reviewer_feedback.read',
    'notice_package.read',
    'notice_export.read',
  ],
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
    ...CONTRACT_APPROVE,
  ],
  COMMERCIAL_LEAD: [
    'project.read',
    'project.update',
    'project.members.read',
    ...DOCUMENT_MANAGE,
    ...CONTRACT_APPROVE,
  ],
  CONTRACTS_LEAD: [
    'project.read',
    'project.update',
    'project.members.read',
    ...DOCUMENT_MANAGE,
    ...CONTRACT_APPROVE,
  ],
  PROJECT_MANAGER: [
    'project.read',
    'project.update',
    'project.members.read',
    'project.members.manage',
    ...DOCUMENT_MANAGE,
  ],
  REVIEWER: ['project.read', 'project.members.read', ...DOCUMENT_READ, ...CONTRACT_REVIEW],
  CONTRIBUTOR: ['project.read', 'project.members.read', ...DOCUMENT_CONTRIBUTE],
  VIEWER: [
    'project.read',
    'document.read',
    'document.download',
    'contract_package.read',
    'detection_run.read',
    'event_suggestion.read',
    'detection_evaluation.read',
    'reviewer_feedback.read',
    'notice_package.read',
    'notice_export.read',
  ],
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
  'contract_package.create',
  'contract_package.update',
  'contract_document.attach',
  'contract_structure.run',
  'contract_structure.review',
  'contract_configuration.submit',
  'contract_configuration.approve',
  'contract_configuration.supersede',
  'contract_issue.manage',
  'project_event.create',
  'project_event.update',
  'project_event.confirm',
  'project_event.dispute',
  'deadline_rule.assess',
  'deadline.calculate',
  'deadline.review',
  'deadline.verify',
  'deadline.track',
  'deadline.assign',
  'deadline.complete',
  'deadline.recalculate',
  'project_calendar.manage',
  'project_calendar.approve',
  'warning_policy.manage',
  'detection_run.create',
  'detection_run.cancel',
  'event_suggestion.review',
  'event_suggestion.accept',
  'event_suggestion.reject',
  'event_suggestion.merge',
  'event_suggestion.request_evidence',
  'detection_rules.manage',
  'notice_package.create',
  'notice_package.update',
  'notice_package.withdraw',
  'notice_evidence.assess',
  'notice_evidence.link',
  'notice_question.create',
  'notice_question.answer',
  'notice_fact.create',
  'notice_fact.verify',
  'notice_draft.generate',
  'notice_draft.edit',
  'notice_draft.review',
  'notice_draft.submit',
  'notice_draft.approve',
  'notice_draft.reject',
  'notice_exception.approve',
  'notice_attachment.manage',
  'notice_export.generate',
  'notice_template.manage',
  'notice_template.approve',
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
