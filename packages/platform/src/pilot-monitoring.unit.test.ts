import { describe, expect, it } from 'vitest';
import {
  DedupingAlertPipeline,
  FakeAlertRouter,
  LocalAlertCapture,
  PILOT_ALERT_DEFINITIONS,
} from './pilot-monitoring';

describe('pilot monitoring', () => {
  it('exposes alert definitions', () => {
    expect(PILOT_ALERT_DEFINITIONS.length).toBeGreaterThan(0);
    expect(PILOT_ALERT_DEFINITIONS.every((d) => d.dedupeKey)).toBe(true);
  });

  it('dedupes identical fingerprints within the window', () => {
    const sink = new LocalAlertCapture();
    const router = new FakeAlertRouter();
    const pipeline = new DedupingAlertPipeline(sink, router, 60_000);
    const t0 = 1_700_000_000_000;
    const first = pipeline.emit({
      definitionId: 'pilot.web.not_ready',
      dedupeKey: 'pilot.web.not_ready',
      severity: 'critical',
      message: 'ready 503',
      now: t0,
    });
    const second = pipeline.emit({
      definitionId: 'pilot.web.not_ready',
      dedupeKey: 'pilot.web.not_ready',
      severity: 'critical',
      message: 'ready 503 again',
      now: t0 + 1_000,
    });
    const third = pipeline.emit({
      definitionId: 'pilot.web.not_ready',
      dedupeKey: 'pilot.web.not_ready',
      severity: 'critical',
      message: 'ready 503 later',
      now: t0 + 61_000,
    });
    expect(first.emitted).toBe(true);
    expect(second.emitted).toBe(false);
    expect(third.emitted).toBe(true);
    expect(sink.list()).toHaveLength(2);
    expect(router.routed).toHaveLength(2);
  });
});
