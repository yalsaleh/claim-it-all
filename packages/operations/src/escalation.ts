import type { EscalationChannel, EscalationPolicyStep } from './types';

export type EscalationStepResult = {
  stepNumber: number;
  channel: EscalationChannel;
  notifyRoles: string[];
  due: boolean;
  minutesUntilDue: number;
} | null;

export function nextEscalationStep(
  steps: EscalationPolicyStep[],
  elapsedMinutes: number,
): EscalationStepResult {
  if (steps.length === 0) return null;
  const ordered = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
  let active: EscalationPolicyStep | null = null;
  for (const step of ordered) {
    if (elapsedMinutes >= step.afterMinutes) {
      active = step;
    } else {
      break;
    }
  }
  if (!active) {
    const first = ordered[0]!;
    return {
      stepNumber: first.stepNumber,
      channel: first.channel,
      notifyRoles: first.notifyRoles,
      due: false,
      minutesUntilDue: first.afterMinutes - elapsedMinutes,
    };
  }
  const next = ordered.find((s) => s.stepNumber > active!.stepNumber);
  if (!next) {
    return {
      stepNumber: active.stepNumber,
      channel: active.channel,
      notifyRoles: active.notifyRoles,
      due: true,
      minutesUntilDue: 0,
    };
  }
  return {
    stepNumber: next.stepNumber,
    channel: next.channel,
    notifyRoles: next.notifyRoles,
    due: elapsedMinutes >= next.afterMinutes,
    minutesUntilDue: Math.max(0, next.afterMinutes - elapsedMinutes),
  };
}

export function elapsedEscalationMinutes(startedAt: string | Date, now?: Date): number {
  const start = typeof startedAt === 'string' ? Date.parse(startedAt) : startedAt.getTime();
  const current = (now ?? new Date()).getTime();
  return Math.max(0, (current - start) / 60_000);
}
