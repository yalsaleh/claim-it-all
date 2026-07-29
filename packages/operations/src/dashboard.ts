import type {
  AlertSeverity,
  AlertSnapshot,
  AlertStatus,
  DashboardCounts,
  DeadlineSnapshot,
  NoticeSnapshot,
} from './types';
import { ALERT_SEVERITIES } from './types';

export function countDeadlinesByStatus(
  deadlines: DeadlineSnapshot[],
): Record<DeadlineSnapshot['status'], number> {
  const counts: Record<DeadlineSnapshot['status'], number> = {
    OPEN: 0,
    CONFIRMED: 0,
    MISSED: 0,
    CLOSED: 0,
  };
  for (const d of deadlines) {
    counts[d.status] += 1;
  }
  return counts;
}

export function countOverdueDeadlines(deadlines: DeadlineSnapshot[], now?: Date): number {
  const current = now ?? new Date();
  return deadlines.filter(
    (d) =>
      (d.status === 'OPEN' || d.status === 'CONFIRMED') && Date.parse(d.dueAt) < current.getTime(),
  ).length;
}

export function countDeadlinesDueWithinHours(
  deadlines: DeadlineSnapshot[],
  hours: number,
  now?: Date,
): number {
  const current = now ?? new Date();
  const horizon = current.getTime() + hours * 3_600_000;
  return deadlines.filter((d) => {
    if (d.status !== 'OPEN' && d.status !== 'CONFIRMED') return false;
    const due = Date.parse(d.dueAt);
    return due >= current.getTime() && due <= horizon;
  }).length;
}

export function countNoticesByStatus(notices: NoticeSnapshot[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of notices) {
    counts[n.status] = (counts[n.status] ?? 0) + 1;
  }
  return counts;
}

export function countNoticesAwaitingReview(notices: NoticeSnapshot[]): number {
  return notices.filter((n) => n.status === 'DRAFT' || n.status === 'IN_REVIEW').length;
}

export function countAlertsByStatus(alerts: AlertSnapshot[]): Record<AlertStatus, number> {
  const counts: Record<AlertStatus, number> = {
    OPEN: 0,
    ACKNOWLEDGED: 0,
    SUPPRESSED: 0,
    RESOLVED: 0,
  };
  for (const a of alerts) {
    counts[a.status] += 1;
  }
  return counts;
}

export function countAlertsBySeverity(alerts: AlertSnapshot[]): Record<AlertSeverity, number> {
  const counts = Object.fromEntries(ALERT_SEVERITIES.map((s) => [s, 0])) as Record<
    AlertSeverity,
    number
  >;
  for (const a of alerts) {
    if (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED') {
      counts[a.severity] += 1;
    }
  }
  return counts;
}

export function computeDashboardCounts(input: {
  deadlines: DeadlineSnapshot[];
  notices: NoticeSnapshot[];
  alerts: AlertSnapshot[];
  now?: Date;
}): DashboardCounts {
  const deadlineCounts = countDeadlinesByStatus(input.deadlines);
  const alertStatusCounts = countAlertsByStatus(input.alerts);
  return {
    deadlinesOpen: deadlineCounts.OPEN + deadlineCounts.CONFIRMED,
    deadlinesDueWithin24h: countDeadlinesDueWithinHours(input.deadlines, 24, input.now),
    deadlinesOverdue: countOverdueDeadlines(input.deadlines, input.now),
    noticesAwaitingReview: countNoticesAwaitingReview(input.notices),
    alertsOpen: alertStatusCounts.OPEN,
    alertsBySeverity: countAlertsBySeverity(input.alerts),
  };
}
