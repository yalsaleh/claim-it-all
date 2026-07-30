export const PILOT_CHECK_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_WITH_EXCEPTIONS',
  'READY',
  'EXPIRED',
] as const;

export type PilotCheckStatus = (typeof PILOT_CHECK_STATUSES)[number];

export type PilotReadinessItem = {
  requirement: string;
  status: PilotCheckStatus;
  nonWaivable: boolean;
  approvedException?: boolean;
  evidence?: string;
};

export type PilotReadinessInput = {
  items: PilotReadinessItem[];
};

/** Non-waivable controls that block pilot activation. */
export const NON_WAIVABLE_REQUIREMENTS = [
  'tenant_isolation_tests',
  'recent_successful_backup',
  'successful_restore_test',
  'production_secrets_configured',
  'fake_providers_disabled',
  'runtime_db_role_restricted',
  'rls_forced',
  'incident_contacts_configured',
  'support_access_policy_configured',
  'audit_logging_operational',
  'monitoring_operational',
] as const;

export function evaluatePilotReadiness(input: PilotReadinessInput): {
  status: PilotCheckStatus;
  blockers: string[];
  canActivate: boolean;
} {
  const blockers: string[] = [];
  for (const item of input.items) {
    const ready = item.status === 'READY' || item.status === 'READY_WITH_EXCEPTIONS';
    if (ready) continue;
    if (item.nonWaivable) {
      if (item.approvedException) {
        blockers.push(`${item.requirement}: non-waivable item cannot be waived`);
      } else {
        blockers.push(item.requirement);
      }
    } else if (!item.approvedException) {
      blockers.push(item.requirement);
    }
  }

  if (blockers.length === 0) {
    return { status: 'READY', blockers, canActivate: true };
  }
  const hasNonWaivable = input.items.some(
    (i) => i.nonWaivable && i.status !== 'READY' && i.status !== 'READY_WITH_EXCEPTIONS',
  );
  return {
    status: hasNonWaivable ? 'BLOCKED' : 'READY_WITH_EXCEPTIONS',
    blockers,
    canActivate:
      !hasNonWaivable && input.items.every((i) => i.approvedException || i.status === 'READY'),
  };
}

export function defaultPilotChecklist(): PilotReadinessItem[] {
  return NON_WAIVABLE_REQUIREMENTS.map((requirement) => ({
    requirement,
    status: 'NOT_STARTED' as const,
    nonWaivable: true,
  }));
}
