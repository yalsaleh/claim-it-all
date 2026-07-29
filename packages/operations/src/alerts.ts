import { createHash } from 'node:crypto';
import type {
  AlertCandidate,
  AlertSeverity,
  AlertType,
  ExistingAlert,
  OperationalEvaluationInput,
} from './types';

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity];
}

export function compareSeverity(a: AlertSeverity, b: AlertSeverity): number {
  return severityRank(a) - severityRank(b);
}

export function maxSeverity(a: AlertSeverity, b: AlertSeverity): AlertSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export function dedupeKey(alertType: AlertType, entityType: string, entityId: string): string {
  return createHash('sha256').update(`${alertType}|${entityType}|${entityId}`).digest('hex');
}

export function shouldSuppress(
  existing: ExistingAlert,
  now: Date,
  suppressAcknowledgedHours = 24,
): boolean {
  if (existing.status === 'SUPPRESSED') {
    if (existing.suppressedUntil) {
      return Date.parse(existing.suppressedUntil) > now.getTime();
    }
    return true;
  }
  if (existing.status === 'RESOLVED') return true;
  if (existing.status === 'ACKNOWLEDGED' && existing.acknowledgedAt) {
    const until = Date.parse(existing.acknowledgedAt) + suppressAcknowledgedHours * 3_600_000;
    return until > now.getTime();
  }
  return false;
}

function hoursUntil(dueAt: string, now: Date): number {
  return (Date.parse(dueAt) - now.getTime()) / 3_600_000;
}

export function evaluateOperationalAlerts(input: OperationalEvaluationInput): AlertCandidate[] {
  const now = input.now ?? new Date();
  const candidates: AlertCandidate[] = [];
  const existingByKey = new Map((input.existingAlerts ?? []).map((a) => [a.dedupeKey, a]));
  const suppressHours = input.suppressAcknowledgedHours ?? 24;
  const reviewThreshold = input.reviewQueueThreshold ?? 25;

  const maybePush = (candidate: Omit<AlertCandidate, 'dedupeKey'> & { dedupeKey?: string }) => {
    const key =
      candidate.dedupeKey ??
      dedupeKey(candidate.alertType, candidate.entityType, candidate.entityId);
    const existing = existingByKey.get(key);
    if (existing && shouldSuppress(existing, now, suppressHours)) return;
    candidates.push({ ...candidate, dedupeKey: key });
  };

  for (const deadline of input.deadlines) {
    if (deadline.status === 'CLOSED' || deadline.status === 'MISSED') continue;
    const hours = hoursUntil(deadline.dueAt, now);
    if (hours < 0) {
      maybePush({
        alertType: 'DEADLINE_PASSED',
        severity: 'CRITICAL',
        entityType: 'deadline',
        entityId: deadline.id,
        title: `Deadline passed: ${deadline.title}`,
        message: `Deadline "${deadline.title}" passed ${Math.abs(Math.round(hours))} hours ago.`,
        occurredAt: now.toISOString(),
        metadata: { projectId: deadline.projectId, hoursOverdue: Math.abs(hours) },
      });
    } else if (hours <= 24) {
      maybePush({
        alertType: 'DEADLINE_APPROACHING',
        severity: hours <= 4 ? 'HIGH' : 'MEDIUM',
        entityType: 'deadline',
        entityId: deadline.id,
        title: `Deadline approaching: ${deadline.title}`,
        message: `Deadline "${deadline.title}" is due within ${Math.ceil(hours)} hours.`,
        occurredAt: now.toISOString(),
        metadata: { projectId: deadline.projectId, hoursRemaining: hours },
      });
    }
  }

  for (const notice of input.notices) {
    if (notice.status === 'DRAFT' || notice.status === 'IN_REVIEW') {
      maybePush({
        alertType: 'NOTICE_AWAITING_REVIEW',
        severity: 'MEDIUM',
        entityType: 'notice',
        entityId: notice.id,
        title: 'Notice awaiting review',
        message: `Notice ${notice.id} is in ${notice.status} status.`,
        occurredAt: notice.updatedAt,
        metadata: { projectId: notice.projectId, status: notice.status },
      });
    }
    if (notice.status === 'EXPORTED') {
      const staleHours = (now.getTime() - Date.parse(notice.updatedAt)) / 3_600_000;
      if (staleHours >= 72) {
        maybePush({
          alertType: 'NOTICE_EXPORT_STALE',
          severity: 'LOW',
          entityType: 'notice',
          entityId: notice.id,
          title: 'Exported notice stale',
          message: `Notice ${notice.id} has been exported for ${Math.round(staleHours)} hours without follow-up.`,
          occurredAt: notice.updatedAt,
          metadata: { projectId: notice.projectId, staleHours },
        });
      }
    }
  }

  for (const sync of input.syncFailures) {
    maybePush({
      alertType: 'SYNC_FAILURE',
      severity: 'HIGH',
      entityType: 'connector',
      entityId: sync.connectorId,
      title: 'Connector sync failure',
      message: `Connector ${sync.connectorId} failed at ${sync.failedAt}.`,
      occurredAt: sync.failedAt,
      metadata: { lastSuccessAt: sync.lastSuccessAt },
    });
    if (sync.lastSuccessAt) {
      const staleHours = (now.getTime() - Date.parse(sync.lastSuccessAt)) / 3_600_000;
      if (staleHours >= 24) {
        maybePush({
          alertType: 'SYNC_STALE',
          severity: 'MEDIUM',
          entityType: 'connector',
          entityId: sync.connectorId,
          title: 'Connector sync stale',
          message: `Connector ${sync.connectorId} has not synced successfully for ${Math.round(staleHours)} hours.`,
          occurredAt: sync.lastSuccessAt,
          metadata: { staleHours },
        });
      }
    }
  }

  if (input.reviewQueueDepth >= reviewThreshold) {
    maybePush({
      alertType: 'REVIEW_QUEUE_BACKLOG',
      severity: input.reviewQueueDepth >= reviewThreshold * 2 ? 'HIGH' : 'MEDIUM',
      entityType: 'queue',
      entityId: 'review',
      title: 'Review queue backlog',
      message: `${input.reviewQueueDepth} items waiting for review (threshold ${reviewThreshold}).`,
      occurredAt: now.toISOString(),
      metadata: { depth: input.reviewQueueDepth, threshold: reviewThreshold },
    });
  }

  return candidates.sort((a, b) => compareSeverity(b.severity, a.severity));
}
