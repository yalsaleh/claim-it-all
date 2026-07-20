import { DateTime } from 'luxon';
import { z } from 'zod';

export const EngineDurationUnitSchema = z.enum([
  'CALENDAR_DAY',
  'BUSINESS_DAY',
  'WEEK',
  'MONTH',
  'IMMEDIATE',
  'PROMPT',
  'REASONABLE_TIME',
  'CUSTOM',
]);
export type EngineDurationUnit = z.infer<typeof EngineDurationUnitSchema>;

export const EngineCountingSchema = z.enum(['INCLUSIVE', 'EXCLUSIVE', 'UNSPECIFIED']);
export const EngineTimeBarSchema = z.enum([
  'EXPRESS_CONDITION_PRECEDENT',
  'EXPRESS_TIME_BAR',
  'PROCEDURAL_DEADLINE',
  'RECOMMENDED_INTERNAL_DEADLINE',
  'UNCERTAIN',
  'NOT_A_TIME_BAR',
]);

const NON_NUMERIC = new Set<EngineDurationUnit>(['IMMEDIATE', 'PROMPT', 'REASONABLE_TIME']);

export const TraceOperationSchema = z.enum([
  'SELECT_TRIGGER_DATE',
  'NORMALIZE_TIMEZONE',
  'APPLY_START_DAY_RULE',
  'ADD_CALENDAR_DAYS',
  'ADD_BUSINESS_DAYS',
  'ADD_WEEKS',
  'ADD_MONTHS',
  'APPLY_END_DAY_RULE',
  'APPLY_WEEKEND_ADJUSTMENT',
  'APPLY_HOLIDAY_ADJUSTMENT',
  'APPLY_INTERNAL_BUFFER',
  'BLOCK_AMBIGUOUS_RULE',
  'HANDLE_IMMEDIATE',
]);
export type TraceOperation = z.infer<typeof TraceOperationSchema>;

export const CalculationTraceStepSchema = z.object({
  sequence: z.number().int().positive(),
  operation: TraceOperationSchema,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  explanation: z.string(),
  assumption: z.boolean().default(false),
  warning: z.boolean().default(false),
});
export type CalculationTraceStep = z.infer<typeof CalculationTraceStepSchema>;

export const StartDateConventionSchema = z.enum(['EXCLUDE_TRIGGER_DAY', 'INCLUDE_TRIGGER_DAY']);
export type StartDateConvention = z.infer<typeof StartDateConventionSchema>;

export const EndDateConventionSchema = z.enum(['END_OF_DAY', 'START_OF_DAY', 'EXACT_TIMESTAMP']);
export type EndDateConvention = z.infer<typeof EndDateConventionSchema>;

export const NonWorkingAdjustmentSchema = z.enum(['FORWARD', 'BACKWARD', 'NONE']);
export type NonWorkingAdjustment = z.infer<typeof NonWorkingAdjustmentSchema>;

export const TriggerPrecisionSchema = z.enum(['EXACT_DATETIME', 'EXACT_DATE']);
export type TriggerPrecision = z.infer<typeof TriggerPrecisionSchema>;

export const ExecutableRuleInputSchema = z.object({
  durationUnit: EngineDurationUnitSchema,
  durationValue: z.number().finite().nullable(),
  counting: EngineCountingSchema,
  startDateConvention: StartDateConventionSchema,
  endDateConvention: EndDateConventionSchema,
  nonWorkingAdjustment: NonWorkingAdjustmentSchema,
  timeBarClassification: EngineTimeBarSchema,
  ambiguityNotes: z.array(z.string()).default([]),
  humanApproved: z.boolean(),
  requiredRecipientsApproved: z.boolean().default(true),
  monthRollBehavior: z
    .enum(['SAME_DAY_OR_LAST', 'BLOCK_IF_AMBIGUOUS'])
    .default('BLOCK_IF_AMBIGUOUS'),
});
export type ExecutableRuleInput = z.infer<typeof ExecutableRuleInputSchema>;

export const CalendarRevisionInputSchema = z.object({
  timezone: z.string().min(1),
  weekendDays: z.array(z.number().int().min(1).max(7)).default([6, 7]),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  specialWorkingDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});
export type CalendarRevisionInput = z.infer<typeof CalendarRevisionInputSchema>;

export const CalculateDeadlineInputSchema = z.object({
  rule: ExecutableRuleInputSchema,
  triggerDateIso: z.string().min(1),
  triggerPrecision: TriggerPrecisionSchema,
  calendar: CalendarRevisionInputSchema,
  internalWarningOffsetsDays: z.array(z.number().int().positive()).default([14, 7, 3, 1]),
});
export type CalculateDeadlineInput = z.infer<typeof CalculateDeadlineInputSchema>;

export type InternalMilestone = {
  kind: 'INTERNAL';
  label: string;
  dueAtIso: string;
  offsetDaysBeforeDeadline: number;
};

export type CalculateDeadlineResult = {
  status: 'CALCULATED' | 'BLOCKED';
  blockedReasons: string[];
  contractualDeadlineAt: string | null;
  contractualDeadlineDate: string | null;
  deadlineTimezone: string;
  trace: CalculationTraceStep[];
  internalMilestones: InternalMilestone[];
  immediate: boolean;
};

function pushStep(
  trace: CalculationTraceStep[],
  operation: TraceOperation,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  explanation: string,
  flags?: { assumption?: boolean; warning?: boolean },
) {
  trace.push({
    sequence: trace.length + 1,
    operation,
    input,
    output,
    explanation,
    assumption: flags?.assumption ?? false,
    warning: flags?.warning ?? false,
  });
}

function dateKey(dt: DateTime): string {
  return dt.toISODate() ?? '';
}

function isBusinessDay(dt: DateTime, calendar: CalendarRevisionInput): boolean {
  const holidays = new Set(calendar.holidays);
  const special = new Set(calendar.specialWorkingDays);
  const key = dateKey(dt);
  if (special.has(key)) return true;
  if (calendar.weekendDays.includes(dt.weekday)) return false;
  if (holidays.has(key)) return false;
  return true;
}

function adjustNonWorking(
  dt: DateTime,
  calendar: CalendarRevisionInput,
  adjustment: NonWorkingAdjustment,
): DateTime {
  if (adjustment === 'NONE') return dt;
  let cursor = dt;
  let guard = 0;
  while (!isBusinessDay(cursor, calendar) && guard < 370) {
    cursor = adjustment === 'FORWARD' ? cursor.plus({ days: 1 }) : cursor.minus({ days: 1 });
    guard += 1;
  }
  return cursor;
}

export function validateExecutableRule(rule: unknown): {
  ok: boolean;
  reasons: string[];
  value?: ExecutableRuleInput;
} {
  const parsed = ExecutableRuleInputSchema.safeParse(rule);
  if (!parsed.success) {
    return { ok: false, reasons: parsed.error.issues.map((i) => i.message) };
  }
  const value = parsed.data;
  const reasons: string[] = [];
  if (!value.humanApproved) {
    reasons.push('Rule is not human-approved in an active configuration snapshot');
  }
  if (value.ambiguityNotes.length > 0) reasons.push('Ambiguity notes remain unresolved');
  if (value.timeBarClassification === 'UNCERTAIN') {
    reasons.push('Time-bar classification is UNCERTAIN');
  }
  if (!value.requiredRecipientsApproved) reasons.push('Required recipients are not approved');
  if (value.durationUnit === 'PROMPT' || value.durationUnit === 'REASONABLE_TIME') {
    reasons.push(`${value.durationUnit} cannot produce a definitive contractual deadline`);
  }
  if (value.durationUnit === 'CUSTOM') reasons.push('CUSTOM duration units are not executable');
  if (value.counting === 'UNSPECIFIED') reasons.push('Counting convention is UNSPECIFIED');
  if (!NON_NUMERIC.has(value.durationUnit)) {
    if (value.durationValue == null) reasons.push('Numeric duration requires a value');
    else if (value.durationValue < 0) reasons.push('Duration value must not be negative');
  } else if (value.durationUnit === 'IMMEDIATE' && value.durationValue != null) {
    reasons.push('IMMEDIATE must remain non-numeric');
  }
  return { ok: reasons.length === 0, reasons, value };
}

export function validateTriggerDate(input: {
  triggerDateIso: string;
  triggerPrecision: TriggerPrecision;
  timezone: string;
}): { ok: boolean; reasons: string[]; at?: DateTime } {
  const zone = DateTime.fromISO(input.triggerDateIso, { setZone: true });
  if (!zone.isValid) {
    return { ok: false, reasons: [`Invalid trigger date: ${zone.invalidReason}`] };
  }
  const at = zone.setZone(input.timezone);
  if (!at.isValid) {
    return { ok: false, reasons: [`Invalid timezone: ${input.timezone}`] };
  }
  return { ok: true, reasons: [], at };
}

export function validateCalendarRevision(calendar: unknown): {
  ok: boolean;
  reasons: string[];
  value?: CalendarRevisionInput;
} {
  const parsed = CalendarRevisionInputSchema.safeParse(calendar);
  if (!parsed.success) {
    return { ok: false, reasons: parsed.error.issues.map((i) => i.message) };
  }
  const probe = DateTime.now().setZone(parsed.data.timezone);
  if (!probe.isValid) {
    return { ok: false, reasons: [`Invalid calendar timezone: ${parsed.data.timezone}`] };
  }
  return { ok: true, reasons: [], value: parsed.data };
}

function addBusinessDays(start: DateTime, days: number, calendar: CalendarRevisionInput): DateTime {
  let cursor = start;
  let remaining = days;
  let guard = 0;
  while (remaining > 0 && guard < 5000) {
    cursor = cursor.plus({ days: 1 });
    if (isBusinessDay(cursor, calendar)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

export function calculateDeadline(rawInput: unknown): CalculateDeadlineResult {
  const parsed = CalculateDeadlineInputSchema.safeParse(rawInput);
  const trace: CalculationTraceStep[] = [];
  if (!parsed.success) {
    return {
      status: 'BLOCKED',
      blockedReasons: parsed.error.issues.map((i) => i.message),
      contractualDeadlineAt: null,
      contractualDeadlineDate: null,
      deadlineTimezone: 'UTC',
      trace: [
        {
          sequence: 1,
          operation: 'BLOCK_AMBIGUOUS_RULE',
          input: {},
          output: {},
          explanation: 'Input schema validation failed',
          assumption: false,
          warning: true,
        },
      ],
      internalMilestones: [],
      immediate: false,
    };
  }

  const input = parsed.data;
  const ruleCheck = validateExecutableRule(input.rule);
  const calCheck = validateCalendarRevision(input.calendar);
  const blockedReasons = [...(ruleCheck.reasons ?? []), ...(calCheck.reasons ?? [])];

  if (!ruleCheck.ok || !calCheck.ok || !calCheck.value) {
    pushStep(
      trace,
      'BLOCK_AMBIGUOUS_RULE',
      { ruleOk: ruleCheck.ok, calendarOk: calCheck.ok },
      { blockedReasons },
      'Rule or calendar is not executable',
      { warning: true },
    );
    return {
      status: 'BLOCKED',
      blockedReasons,
      contractualDeadlineAt: null,
      contractualDeadlineDate: null,
      deadlineTimezone: input.calendar.timezone,
      trace,
      internalMilestones: [],
      immediate: false,
    };
  }

  const trigger = validateTriggerDate({
    triggerDateIso: input.triggerDateIso,
    triggerPrecision: input.triggerPrecision,
    timezone: input.calendar.timezone,
  });
  if (!trigger.ok || !trigger.at) {
    pushStep(
      trace,
      'BLOCK_AMBIGUOUS_RULE',
      { triggerDateIso: input.triggerDateIso },
      { reasons: trigger.reasons },
      'Trigger date is invalid or insufficiently precise',
      { warning: true },
    );
    return {
      status: 'BLOCKED',
      blockedReasons: trigger.reasons,
      contractualDeadlineAt: null,
      contractualDeadlineDate: null,
      deadlineTimezone: input.calendar.timezone,
      trace,
      internalMilestones: [],
      immediate: false,
    };
  }

  const rule = ruleCheck.value!;
  const calendar = calCheck.value;
  let cursor = trigger.at;
  pushStep(
    trace,
    'SELECT_TRIGGER_DATE',
    { triggerDateIso: input.triggerDateIso, precision: input.triggerPrecision },
    { selected: cursor.toISO() },
    'Selected verified trigger date',
  );
  pushStep(
    trace,
    'NORMALIZE_TIMEZONE',
    { from: trigger.at.zoneName },
    { to: calendar.timezone, at: cursor.toISO() },
    `Normalized to calendar timezone ${calendar.timezone}`,
  );

  if (rule.durationUnit === 'IMMEDIATE') {
    pushStep(
      trace,
      'HANDLE_IMMEDIATE',
      { trigger: cursor.toISO() },
      { contractualDeadlineAt: cursor.toISO() },
      'Immediate requirement: contractual deadline equals trigger time; no numeric grace period',
    );
    return {
      status: 'CALCULATED',
      blockedReasons: [],
      contractualDeadlineAt: cursor.toISO(),
      contractualDeadlineDate: dateKey(cursor),
      deadlineTimezone: calendar.timezone,
      trace,
      internalMilestones: [],
      immediate: true,
    };
  }

  pushStep(
    trace,
    'APPLY_START_DAY_RULE',
    { convention: rule.startDateConvention, counting: rule.counting },
    {},
    `Applied ${rule.startDateConvention} with counting ${rule.counting}`,
  );

  const rawDays = rule.durationValue ?? 0;
  let daysToAdd = rawDays;
  if (rule.startDateConvention === 'INCLUDE_TRIGGER_DAY' && rawDays >= 1) {
    daysToAdd = rawDays - 1;
  }
  if (
    rule.counting === 'INCLUSIVE' &&
    rule.startDateConvention === 'EXCLUDE_TRIGGER_DAY' &&
    rawDays >= 1
  ) {
    daysToAdd = rawDays - 1;
  }

  if (rule.durationUnit === 'CALENDAR_DAY') {
    cursor = cursor.plus({ days: daysToAdd });
    pushStep(
      trace,
      'ADD_CALENDAR_DAYS',
      { daysToAdd, rawDays },
      { at: cursor.toISO() },
      `Added ${daysToAdd} calendar day(s)`,
    );
  } else if (rule.durationUnit === 'BUSINESS_DAY') {
    cursor = addBusinessDays(cursor, daysToAdd, calendar);
    pushStep(
      trace,
      'ADD_BUSINESS_DAYS',
      { daysToAdd, rawDays, weekendDays: calendar.weekendDays },
      { at: cursor.toISO() },
      `Added ${daysToAdd} business day(s)`,
    );
  } else if (rule.durationUnit === 'WEEK') {
    cursor = cursor.plus({ weeks: rule.durationValue ?? 0 });
    pushStep(
      trace,
      'ADD_WEEKS',
      { weeks: rule.durationValue },
      { at: cursor.toISO() },
      `Added ${rule.durationValue} week(s)`,
    );
  } else if (rule.durationUnit === 'MONTH') {
    if (rule.monthRollBehavior !== 'SAME_DAY_OR_LAST') {
      pushStep(
        trace,
        'BLOCK_AMBIGUOUS_RULE',
        { monthRollBehavior: rule.monthRollBehavior },
        {},
        'Month-end semantics are not approved',
        { warning: true },
      );
      return {
        status: 'BLOCKED',
        blockedReasons: ['Month-end semantics are not approved'],
        contractualDeadlineAt: null,
        contractualDeadlineDate: null,
        deadlineTimezone: calendar.timezone,
        trace,
        internalMilestones: [],
        immediate: false,
      };
    }
    cursor = cursor.plus({ months: rule.durationValue ?? 0 });
    pushStep(
      trace,
      'ADD_MONTHS',
      { months: rule.durationValue, behavior: rule.monthRollBehavior },
      { at: cursor.toISO() },
      `Added ${rule.durationValue} month(s) with SAME_DAY_OR_LAST`,
    );
  }

  if (
    rule.durationUnit === 'CALENDAR_DAY' ||
    rule.durationUnit === 'WEEK' ||
    rule.durationUnit === 'MONTH'
  ) {
    const beforeAdjust = cursor;
    cursor = adjustNonWorking(cursor, calendar, rule.nonWorkingAdjustment);
    if (!beforeAdjust.hasSame(cursor, 'day')) {
      pushStep(
        trace,
        'APPLY_WEEKEND_ADJUSTMENT',
        { from: beforeAdjust.toISO(), adjustment: rule.nonWorkingAdjustment },
        { to: cursor.toISO() },
        `Applied non-working day adjustment (${rule.nonWorkingAdjustment})`,
      );
    }
  }

  if (rule.endDateConvention === 'END_OF_DAY') {
    cursor = cursor.endOf('day');
    pushStep(
      trace,
      'APPLY_END_DAY_RULE',
      { convention: 'END_OF_DAY' },
      { at: cursor.toISO() },
      'Deadline expires at end of final day',
    );
  } else if (rule.endDateConvention === 'START_OF_DAY') {
    cursor = cursor.startOf('day');
    pushStep(
      trace,
      'APPLY_END_DAY_RULE',
      { convention: 'START_OF_DAY' },
      { at: cursor.toISO() },
      'Deadline expires at start of final day',
    );
  } else {
    pushStep(
      trace,
      'APPLY_END_DAY_RULE',
      { convention: 'EXACT_TIMESTAMP' },
      { at: cursor.toISO() },
      'Deadline keeps exact timestamp from arithmetic',
    );
  }

  const deadlineAt = cursor.toISO();
  const deadlineDate = dateKey(cursor);
  const internalMilestones: InternalMilestone[] = [];
  for (const offset of input.internalWarningOffsetsDays) {
    const warnAt = cursor.minus({ days: offset });
    if (warnAt <= trigger.at) continue;
    const due = warnAt.toISO();
    if (!due) continue;
    internalMilestones.push({
      kind: 'INTERNAL',
      label: `${offset} days remaining (internal)`,
      dueAtIso: due,
      offsetDaysBeforeDeadline: offset,
    });
    pushStep(
      trace,
      'APPLY_INTERNAL_BUFFER',
      { offsetDays: offset },
      { dueAt: due },
      `Internal warning ${offset} days before contractual deadline`,
      { assumption: true },
    );
  }

  return {
    status: 'CALCULATED',
    blockedReasons: [],
    contractualDeadlineAt: deadlineAt,
    contractualDeadlineDate: deadlineDate,
    deadlineTimezone: calendar.timezone,
    trace,
    internalMilestones,
    immediate: false,
  };
}

export function compareCalculationResults(
  a: CalculateDeadlineResult,
  b: CalculateDeadlineResult,
): { equal: boolean; differences: string[] } {
  const differences: string[] = [];
  if (a.status !== b.status) differences.push(`status: ${a.status} vs ${b.status}`);
  if (a.contractualDeadlineAt !== b.contractualDeadlineAt) {
    differences.push(`deadlineAt: ${a.contractualDeadlineAt} vs ${b.contractualDeadlineAt}`);
  }
  if (a.trace.length !== b.trace.length) {
    differences.push(`trace length: ${a.trace.length} vs ${b.trace.length}`);
  }
  return { equal: differences.length === 0, differences };
}
