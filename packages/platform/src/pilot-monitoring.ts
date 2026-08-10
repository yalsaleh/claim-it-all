/**
 * Pilot monitoring alert definitions + local/fake capture interfaces.
 * No real paging vendor is wired here.
 */

export type PilotAlertSeverity = 'info' | 'warning' | 'critical';

export type PilotAlertDefinition = {
  id: string;
  title: string;
  severity: PilotAlertSeverity;
  /** Deduplication key template (stable identity). */
  dedupeKey: string;
  description: string;
};

export const PILOT_ALERT_DEFINITIONS: PilotAlertDefinition[] = [
  {
    id: 'pilot.web.not_ready',
    title: 'Web readiness failing',
    severity: 'critical',
    dedupeKey: 'pilot.web.not_ready',
    description: '/health/ready returns non-200 while pilot is active',
  },
  {
    id: 'pilot.worker.outage',
    title: 'Worker outage',
    severity: 'critical',
    dedupeKey: 'pilot.worker.outage',
    description: 'ARQ / outbox worker heartbeat missing',
  },
  {
    id: 'pilot.db.unavailable',
    title: 'Database unavailable',
    severity: 'critical',
    dedupeKey: 'pilot.db.unavailable',
    description: 'Primary Postgres probe failing',
  },
  {
    id: 'pilot.vuln.active_blocker',
    title: 'Vulnerability blocker during pilot',
    severity: 'critical',
    dedupeKey: 'pilot.vuln.active_blocker',
    description: 'FIX_BEFORE_PILOT or expired exception detected while pilot active',
  },
];

export type CapturedAlert = {
  definitionId: string;
  dedupeKey: string;
  severity: PilotAlertSeverity;
  message: string;
  capturedAt: string;
  fingerprint: string;
};

export interface AlertCaptureSink {
  capture(alert: CapturedAlert): void;
  list(): CapturedAlert[];
}

export interface AlertRouter {
  route(alert: CapturedAlert): void;
}

/** In-memory capture for local/CI — not a production pager. */
export class LocalAlertCapture implements AlertCaptureSink {
  private readonly items: CapturedAlert[] = [];

  capture(alert: CapturedAlert): void {
    this.items.push(alert);
  }

  list(): CapturedAlert[] {
    return [...this.items];
  }
}

/** Fake router that records routed alerts without external I/O. */
export class FakeAlertRouter implements AlertRouter {
  readonly routed: CapturedAlert[] = [];

  route(alert: CapturedAlert): void {
    this.routed.push(alert);
  }
}

export function fingerprintAlert(definitionId: string, dedupeKey: string): string {
  return `${definitionId}::${dedupeKey}`;
}

/**
 * Dedupe window: identical fingerprint within windowMs is suppressed.
 */
export class DedupingAlertPipeline {
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly sink: AlertCaptureSink,
    private readonly router: AlertRouter,
    private readonly windowMs = 60_000,
  ) {}

  emit(input: {
    definitionId: string;
    dedupeKey: string;
    severity: PilotAlertSeverity;
    message: string;
    now?: number;
  }): { emitted: boolean; alert?: CapturedAlert } {
    const now = input.now ?? Date.now();
    const fingerprint = fingerprintAlert(input.definitionId, input.dedupeKey);
    const prev = this.lastSent.get(fingerprint);
    if (prev !== undefined && now - prev < this.windowMs) {
      return { emitted: false };
    }
    const alert: CapturedAlert = {
      definitionId: input.definitionId,
      dedupeKey: input.dedupeKey,
      severity: input.severity,
      message: input.message,
      capturedAt: new Date(now).toISOString(),
      fingerprint,
    };
    this.sink.capture(alert);
    this.router.route(alert);
    this.lastSent.set(fingerprint, now);
    return { emitted: true, alert };
  }
}
