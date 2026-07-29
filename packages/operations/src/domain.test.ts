import { describe, expect, it } from 'vitest';
import {
  compareSeverity,
  dedupeKey,
  evaluateOperationalAlerts,
  maxSeverity,
  shouldSuppress,
} from './alerts';
import { computeDashboardCounts, countOverdueDeadlines } from './dashboard';
import { elapsedEscalationMinutes, nextEscalationStep } from './escalation';
import type { ExistingAlert } from './types';

describe('alerts', () => {
  it('ranks severities', () => {
    expect(compareSeverity('CRITICAL', 'LOW')).toBeGreaterThan(0);
    expect(maxSeverity('MEDIUM', 'HIGH')).toBe('HIGH');
  });

  it('builds stable dedupe keys', () => {
    const a = dedupeKey('DEADLINE_PASSED', 'deadline', 'd-1');
    const b = dedupeKey('DEADLINE_PASSED', 'deadline', 'd-1');
    expect(a).toBe(b);
  });

  it('suppresses acknowledged alerts within window', () => {
    const existing: ExistingAlert = {
      alertType: 'DEADLINE_APPROACHING',
      entityType: 'deadline',
      entityId: 'd-1',
      status: 'ACKNOWLEDGED',
      severity: 'MEDIUM',
      acknowledgedAt: new Date().toISOString(),
      suppressedUntil: null,
      dedupeKey: dedupeKey('DEADLINE_APPROACHING', 'deadline', 'd-1'),
    };
    expect(shouldSuppress(existing, new Date(), 24)).toBe(true);
  });

  it('evaluates deadline and sync alerts', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    const alerts = evaluateOperationalAlerts({
      now,
      deadlines: [
        {
          id: 'd-overdue',
          title: 'Submittal due',
          dueAt: '2026-07-28T12:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
        {
          id: 'd-soon',
          title: 'Notice window',
          dueAt: '2026-07-29T20:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
      ],
      notices: [{ id: 'n1', status: 'IN_REVIEW', updatedAt: now.toISOString(), projectId: 'p1' }],
      syncFailures: [
        {
          connectorId: 'c1',
          failedAt: '2026-07-29T11:00:00.000Z',
          lastSuccessAt: '2026-07-27T11:00:00.000Z',
        },
      ],
      reviewQueueDepth: 30,
      reviewQueueThreshold: 20,
    });

    const types = alerts.map((a) => a.alertType);
    expect(types).toContain('DEADLINE_PASSED');
    expect(types).toContain('DEADLINE_APPROACHING');
    expect(types).toContain('NOTICE_AWAITING_REVIEW');
    expect(types).toContain('SYNC_FAILURE');
    expect(types).toContain('SYNC_STALE');
    expect(types).toContain('REVIEW_QUEUE_BACKLOG');
    expect(alerts[0]?.severity).toBe('CRITICAL');
  });

  it('respects suppression from existing alerts', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    const key = dedupeKey('DEADLINE_PASSED', 'deadline', 'd-overdue');
    const alerts = evaluateOperationalAlerts({
      now,
      deadlines: [
        {
          id: 'd-overdue',
          title: 'Submittal due',
          dueAt: '2026-07-28T12:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
      ],
      notices: [],
      syncFailures: [],
      reviewQueueDepth: 0,
      existingAlerts: [
        {
          alertType: 'DEADLINE_PASSED',
          entityType: 'deadline',
          entityId: 'd-overdue',
          status: 'ACKNOWLEDGED',
          severity: 'CRITICAL',
          acknowledgedAt: now.toISOString(),
          suppressedUntil: null,
          dedupeKey: key,
        },
      ],
    });
    expect(alerts.find((a) => a.dedupeKey === key)).toBeUndefined();
  });
});

describe('escalation', () => {
  const steps = [
    { stepNumber: 1, afterMinutes: 60, channel: 'IN_APP' as const, notifyRoles: ['PM'] },
    {
      stepNumber: 2,
      afterMinutes: 240,
      channel: 'EMAIL' as const,
      notifyRoles: ['PM', 'DIRECTOR'],
    },
    { stepNumber: 3, afterMinutes: 480, channel: 'SMS' as const, notifyRoles: ['DIRECTOR'] },
  ];

  it('returns first step before elapsed threshold', () => {
    const next = nextEscalationStep(steps, 30);
    expect(next?.stepNumber).toBe(1);
    expect(next?.due).toBe(false);
    expect(next?.minutesUntilDue).toBe(30);
  });

  it('advances to due step after elapsed time', () => {
    const next = nextEscalationStep(steps, 300);
    expect(next?.stepNumber).toBe(3);
    expect(next?.channel).toBe('SMS');
    expect(next?.due).toBe(false);
    expect(next?.minutesUntilDue).toBe(180);
  });

  it('marks final step due when elapsed exceeds all thresholds', () => {
    const next = nextEscalationStep(steps, 500);
    expect(next?.stepNumber).toBe(3);
    expect(next?.due).toBe(true);
    expect(next?.minutesUntilDue).toBe(0);
  });

  it('computes elapsed minutes', () => {
    const mins = elapsedEscalationMinutes(
      '2026-07-29T10:00:00.000Z',
      new Date('2026-07-29T12:30:00.000Z'),
    );
    expect(mins).toBe(150);
  });
});

describe('dashboard', () => {
  it('computes counts without synthetic scores', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    const counts = computeDashboardCounts({
      now,
      deadlines: [
        {
          id: 'd1',
          title: 'A',
          dueAt: '2026-07-28T00:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
        {
          id: 'd2',
          title: 'B',
          dueAt: '2026-07-30T00:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
        {
          id: 'd3',
          title: 'C',
          dueAt: '2026-07-31T00:00:00.000Z',
          status: 'CLOSED',
          projectId: 'p1',
        },
      ],
      notices: [
        { id: 'n1', status: 'IN_REVIEW', updatedAt: now.toISOString(), projectId: 'p1' },
        { id: 'n2', status: 'EXPORTED', updatedAt: now.toISOString(), projectId: 'p1' },
      ],
      alerts: [
        {
          id: 'a1',
          alertType: 'DEADLINE_PASSED',
          severity: 'CRITICAL',
          status: 'OPEN',
          entityType: 'deadline',
          entityId: 'd1',
        },
        {
          id: 'a2',
          alertType: 'SYNC_STALE',
          severity: 'MEDIUM',
          status: 'ACKNOWLEDGED',
          entityType: 'connector',
          entityId: 'c1',
        },
      ],
    });

    expect(counts.deadlinesOpen).toBe(2);
    expect(counts.deadlinesOverdue).toBe(1);
    expect(counts.deadlinesDueWithin24h).toBe(1);
    expect(counts.noticesAwaitingReview).toBe(1);
    expect(counts.alertsOpen).toBe(1);
    expect(counts.alertsBySeverity.CRITICAL).toBe(1);
    expect(counts.alertsBySeverity.MEDIUM).toBe(1);
  });

  it('counts overdue deadlines directly', () => {
    const overdue = countOverdueDeadlines(
      [
        {
          id: 'd1',
          title: 'X',
          dueAt: '2020-01-01T00:00:00.000Z',
          status: 'OPEN',
          projectId: 'p1',
        },
      ],
      new Date('2026-07-29T12:00:00.000Z'),
    );
    expect(overdue).toBe(1);
  });
});
