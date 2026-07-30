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
  'notice_dispatch.prepare',
  'notice_dispatch.request_authorization',
  'notice_dispatch.authorize',
  'notice_dispatch.revoke',
  'notice_dispatch.send',
  'notice_dispatch.cancel',
  'notice_dispatch.retry',
  'notice_dispatch.record_manual',
  'notice_dispatch.read',
  'dispatch_evidence.upload',
  'dispatch_evidence.verify',
  'notice_receipt.assess',
  'notice_receipt.confirm',
  'notice_acknowledgment.record',
  'notice_acknowledgment.verify',
  'delivery_provider.manage',
  'delivery_webhook.read',
  'delivery_risk.read',
  'connector_account.create',
  'connector_account.read',
  'connector_account.update',
  'connector_account.validate',
  'connector_account.approve',
  'connector_account.disable',
  'connector_scope.create',
  'connector_scope.approve',
  'connector_sync.run',
  'connector_sync.cancel',
  'connector_sync.read',
  'operational_alert.read',
  'operational_alert.acknowledge',
  'operational_alert.assign',
  'operational_alert.dismiss',
  'operational_alert.resolve',
  'escalation_policy.manage',
  'escalation_policy.approve',
  'operational_task.create',
  'operational_task.assign',
  'operational_task.complete',
  'portfolio.read',
  'operations_dashboard.read',
  'internal_notification.read',
  'saved_view.manage',
];

const TENANT_PLATFORM_ADMIN: Capability[] = [
  'tenant_admin.read',
  'tenant_admin.manage',
  'tenant_invitation.manage',
  'tenant_limits.manage',
  'tenant_feature_flags.manage',
  'support_access.request',
  'support_access.approve',
  'support_access.revoke',
  'support_access.read',
  'provider_enablement.manage',
  'provider_enablement.approve',
  'provider_kill_switch.manage',
  'pilot_configuration.manage',
  'pilot_readiness.manage',
  'pilot_readiness.activate',
  'backup.run.read',
  'restore_test.read',
  'platform_operations.read',
  'incident.manage',
  'audit.export',
  'offboarding.manage',
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
  'notice_dispatch.read',
  'delivery_risk.read',
  'connector_account.read',
  'connector_sync.read',
  'operational_alert.read',
  'operations_dashboard.read',
  'internal_notification.read',
  'portfolio.read',
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
    ...TENANT_PLATFORM_ADMIN,
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
    ...TENANT_PLATFORM_ADMIN,
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
    'notice_dispatch.read',
    'delivery_risk.read',
    'connector_account.read',
    'connector_sync.read',
    'operational_alert.read',
    'operations_dashboard.read',
    'internal_notification.read',
    'portfolio.read',
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
    'notice_dispatch.read',
    'delivery_risk.read',
    'connector_account.read',
    'connector_sync.read',
    'operational_alert.read',
    'operations_dashboard.read',
    'internal_notification.read',
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
  'notice_dispatch.prepare',
  'notice_dispatch.request_authorization',
  'notice_dispatch.authorize',
  'notice_dispatch.revoke',
  'notice_dispatch.send',
  'notice_dispatch.cancel',
  'notice_dispatch.retry',
  'notice_dispatch.record_manual',
  'dispatch_evidence.upload',
  'dispatch_evidence.verify',
  'notice_receipt.assess',
  'notice_receipt.confirm',
  'notice_acknowledgment.record',
  'notice_acknowledgment.verify',
  'delivery_provider.manage',
  'connector_account.create',
  'connector_account.update',
  'connector_account.validate',
  'connector_account.approve',
  'connector_account.disable',
  'connector_scope.create',
  'connector_scope.approve',
  'connector_sync.run',
  'connector_sync.cancel',
  'operational_alert.acknowledge',
  'operational_alert.assign',
  'operational_alert.dismiss',
  'operational_alert.resolve',
  'escalation_policy.manage',
  'escalation_policy.approve',
  'operational_task.create',
  'operational_task.assign',
  'operational_task.complete',
  'saved_view.manage',
  'tenant_admin.manage',
  'tenant_invitation.manage',
  'support_access.approve',
  'provider_enablement.approve',
  'provider_kill_switch.manage',
  'pilot_readiness.activate',
  'offboarding.manage',
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
