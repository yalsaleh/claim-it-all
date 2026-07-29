export const OPERATIONS_RULESET_VERSION = 'operations-ruleset-v1';

export const ALERT_TYPES = [
  'DEADLINE_APPROACHING',
  'DEADLINE_PASSED',
  'SYNC_FAILURE',
  'SYNC_STALE',
  'CONNECTOR_ERROR',
  'REVIEW_QUEUE_BACKLOG',
  'NOTICE_AWAITING_REVIEW',
  'NOTICE_EXPORT_STALE',
  'ESCALATION_DUE',
  'TASK_OVERDUE',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'SUPPRESSED', 'RESOLVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const TASK_TYPES = [
  'REVIEW_CANDIDATE',
  'CONFIRM_DEADLINE',
  'RESOLVE_SYNC_ERROR',
  'APPROVE_NOTICE',
  'FOLLOW_UP',
  'ESCALATION_RESPONSE',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ESCALATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS'] as const;
export type EscalationChannel = (typeof ESCALATION_CHANNELS)[number];

export type EscalationPolicyStep = {
  stepNumber: number;
  afterMinutes: number;
  channel: EscalationChannel;
  notifyRoles: string[];
};

export type AlertCandidate = {
  alertType: AlertType;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  dedupeKey: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type ExistingAlert = {
  alertType: AlertType;
  entityType: string;
  entityId: string;
  status: AlertStatus;
  severity: AlertSeverity;
  acknowledgedAt: string | null;
  suppressedUntil: string | null;
  dedupeKey: string;
};

export type DeadlineSnapshot = {
  id: string;
  title: string;
  dueAt: string;
  status: 'OPEN' | 'CONFIRMED' | 'MISSED' | 'CLOSED';
  projectId: string;
};

export type NoticeSnapshot = {
  id: string;
  status: string;
  updatedAt: string;
  projectId: string;
};

export type AlertSnapshot = {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  entityType: string;
  entityId: string;
};

export type OperationalEvaluationInput = {
  now?: Date;
  deadlines: DeadlineSnapshot[];
  notices: NoticeSnapshot[];
  syncFailures: Array<{ connectorId: string; failedAt: string; lastSuccessAt: string | null }>;
  reviewQueueDepth: number;
  reviewQueueThreshold?: number;
  existingAlerts?: ExistingAlert[];
  suppressAcknowledgedHours?: number;
};

export type DashboardCounts = {
  deadlinesOpen: number;
  deadlinesDueWithin24h: number;
  deadlinesOverdue: number;
  noticesAwaitingReview: number;
  alertsOpen: number;
  alertsBySeverity: Record<AlertSeverity, number>;
};
