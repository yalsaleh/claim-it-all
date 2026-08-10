export const BURNDOWN_CLASSES = [
  'FIX_NOW',
  'FIX_BEFORE_PILOT',
  'DEV_ONLY_ACCEPT_TEMPORARILY',
  'UPSTREAM_BLOCKED',
] as const;

export type BurndownClass = (typeof BURNDOWN_CLASSES)[number];

export type VulnerabilityExceptionRecord = {
  id: string;
  advisoryId: string;
  package: string;
  severity: string;
  classification: string;
  status: 'active' | 'resolved' | 'expired' | string;
  expiresAt: string;
  burndownClass?: BurndownClass | string;
  pilotDecisionRequired?: string;
  pilotDecisionStatus?: string;
};

export type PilotBurndownResult = {
  status: 'PASS' | 'BLOCKED' | 'PASS_WITH_APPROVED_EXCEPTIONS';
  blockers: string[];
  notes: string[];
  activeExceptions: string[];
};

export type PilotBurndownOptions = {
  now?: Date;
  /** CI/local scaffolding only — never use for real pilot go-live. */
  synthetic?: boolean;
};

function isActive(ex: VulnerabilityExceptionRecord): boolean {
  return ex.status === 'active';
}

export function evaluatePilotBurndown(
  exceptions: VulnerabilityExceptionRecord[],
  options: PilotBurndownOptions = {},
): PilotBurndownResult {
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const blockers: string[] = [];
  const notes: string[] = [];
  const active = exceptions.filter(isActive);
  const activeIds = active.map((e) => e.id);

  for (const ex of active) {
    const burndown = String(ex.burndownClass ?? '');
    if (ex.expiresAt < today) {
      blockers.push(`${ex.id}: expired on ${ex.expiresAt}`);
    }
    if (burndown === 'FIX_NOW' || burndown === 'FIX_BEFORE_PILOT') {
      blockers.push(`${ex.id}: burndownClass ${burndown} blocks pilot`);
    }
    if (ex.severity === 'critical' && ex.classification === 'runtime') {
      blockers.push(`${ex.id}: critical runtime exception is active`);
    }
    if (burndown === 'UPSTREAM_BLOCKED') {
      const decision = ex.pilotDecisionStatus ?? 'PENDING';
      if (decision === 'PILOT_APPROVED_EXCEPTION') {
        notes.push(`${ex.id}: UPSTREAM_BLOCKED with PILOT_APPROVED_EXCEPTION`);
      } else if (options.synthetic) {
        notes.push(
          `${ex.id}: UPSTREAM_BLOCKED pending decision — accepted only in synthetic preflight`,
        );
      } else {
        blockers.push(
          `${ex.id}: UPSTREAM_BLOCKED requires pilotDecisionStatus=PILOT_APPROVED_EXCEPTION`,
        );
      }
    }
    if (burndown === 'DEV_ONLY_ACCEPT_TEMPORARILY') {
      notes.push(`${ex.id}: DEV_ONLY_ACCEPT_TEMPORARILY (not a pilot runtime path)`);
    }
  }

  if (blockers.length > 0) {
    return { status: 'BLOCKED', blockers, notes, activeExceptions: activeIds };
  }
  if (notes.length > 0 || active.length > 0) {
    return {
      status: 'PASS_WITH_APPROVED_EXCEPTIONS',
      blockers,
      notes,
      activeExceptions: activeIds,
    };
  }
  return { status: 'PASS', blockers, notes, activeExceptions: activeIds };
}

export function loadExceptionsFromDocument(doc: {
  exceptions?: VulnerabilityExceptionRecord[];
}): VulnerabilityExceptionRecord[] {
  if (!doc || !Array.isArray(doc.exceptions)) {
    throw new Error('vulnerability exceptions document missing exceptions[]');
  }
  return doc.exceptions;
}
