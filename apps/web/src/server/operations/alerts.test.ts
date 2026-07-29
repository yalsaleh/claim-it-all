import { describe, expect, it } from 'vitest';
import { evaluateOperationalAlerts, dedupeKey } from '@contractradar/operations';

describe('evaluateAndUpsert alert candidates', () => {
  it('dedupes deadline approaching alerts by entity', () => {
    const key = dedupeKey('DEADLINE_APPROACHING', 'deadline', 'd-1');
    const candidates = evaluateOperationalAlerts({
      now: new Date('2026-07-29T12:00:00.000Z'),
      deadlines: [
        {
          id: 'd-1',
          title: 'Submit notice',
          dueAt: '2026-07-29T20:00:00.000Z',
          status: 'OPEN',
          projectId: 'p-1',
        },
      ],
      notices: [],
      syncFailures: [],
      reviewQueueDepth: 0,
      existingAlerts: [
        {
          alertType: 'DEADLINE_APPROACHING',
          entityType: 'deadline',
          entityId: 'd-1',
          status: 'ACKNOWLEDGED',
          severity: 'MEDIUM',
          acknowledgedAt: '2026-07-29T10:00:00.000Z',
          suppressedUntil: null,
          dedupeKey: key,
        },
      ],
      suppressAcknowledgedHours: 24,
    });
    expect(candidates).toHaveLength(0);
  });

  it('emits sync failure alert for failed connector', () => {
    const candidates = evaluateOperationalAlerts({
      now: new Date('2026-07-29T12:00:00.000Z'),
      deadlines: [],
      notices: [],
      syncFailures: [
        {
          connectorId: 'conn-1',
          failedAt: '2026-07-29T11:00:00.000Z',
          lastSuccessAt: '2026-07-27T11:00:00.000Z',
        },
      ],
      reviewQueueDepth: 0,
    });
    expect(candidates.some((c) => c.alertType === 'SYNC_FAILURE')).toBe(true);
    expect(candidates.some((c) => c.alertType === 'SYNC_STALE')).toBe(true);
  });

  it('emits review queue backlog when threshold exceeded', () => {
    const candidates = evaluateOperationalAlerts({
      now: new Date('2026-07-29T12:00:00.000Z'),
      deadlines: [],
      notices: [],
      syncFailures: [],
      reviewQueueDepth: 30,
      reviewQueueThreshold: 25,
    });
    expect(candidates.some((c) => c.alertType === 'REVIEW_QUEUE_BACKLOG')).toBe(true);
  });
});
