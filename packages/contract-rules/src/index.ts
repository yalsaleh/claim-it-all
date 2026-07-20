import { z } from 'zod';

export const DurationUnitSchema = z.enum([
  'CALENDAR_DAY',
  'BUSINESS_DAY',
  'WEEK',
  'MONTH',
  'IMMEDIATE',
  'PROMPT',
  'REASONABLE_TIME',
  'CUSTOM',
]);
export type DurationUnit = z.infer<typeof DurationUnitSchema>;

export const CalendarBasisSchema = z.enum(['CALENDAR_DAYS', 'BUSINESS_DAYS', 'CONTRACT_DEFINED']);
export type CalendarBasis = z.infer<typeof CalendarBasisSchema>;

export const TriggerDateBasisSchema = z.enum([
  'EVENT_OCCURRENCE',
  'BECAME_AWARE',
  'INSTRUCTION_RECEIVED',
  'NOTICE_RECEIVED',
  'CUSTOM',
]);
export type TriggerDateBasis = z.infer<typeof TriggerDateBasisSchema>;

export const CountingConventionSchema = z.enum(['INCLUSIVE', 'EXCLUSIVE', 'UNSPECIFIED']);
export type CountingConvention = z.infer<typeof CountingConventionSchema>;

export const TimeBarClassificationSchema = z.enum([
  'EXPRESS_CONDITION_PRECEDENT',
  'EXPRESS_TIME_BAR',
  'PROCEDURAL_DEADLINE',
  'RECOMMENDED_INTERNAL_DEADLINE',
  'UNCERTAIN',
  'NOT_A_TIME_BAR',
]);
export type TimeBarClassification = z.infer<typeof TimeBarClassificationSchema>;

export const DurationExpressionSchema = z.object({
  unit: DurationUnitSchema,
  value: z.number().finite().nullable(),
  rawText: z.string().min(1).max(2000),
  calendarBasis: CalendarBasisSchema.optional(),
  counting: CountingConventionSchema.default('UNSPECIFIED'),
});
export type DurationExpression = z.infer<typeof DurationExpressionSchema>;

export const NoticeRuleDraftSchema = z.object({
  duration: DurationExpressionSchema,
  triggerDateBasis: TriggerDateBasisSchema,
  timeBarClassification: TimeBarClassificationSchema,
  requiredRecipients: z.array(z.string().min(1)).default([]),
  deliveryMethods: z.array(z.string().min(1)).default([]),
  ambiguityNotes: z.array(z.string()).default([]),
  humanApproved: z.boolean().default(false),
});
export type NoticeRuleDraft = z.infer<typeof NoticeRuleDraftSchema>;

const NON_NUMERIC_UNITS = new Set<DurationUnit>(['IMMEDIATE', 'PROMPT', 'REASONABLE_TIME']);

export function isNumericDurationUnit(unit: DurationUnit): boolean {
  return !NON_NUMERIC_UNITS.has(unit);
}

export function validateDurationExpression(input: unknown):
  | {
      ok: true;
      value: DurationExpression;
    }
  | {
      ok: false;
      errors: string[];
    } {
  const parsed = DurationExpressionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const value = parsed.data;
  const errors: string[] = [];
  if (isNumericDurationUnit(value.unit)) {
    if (value.value == null) {
      errors.push('Numeric duration units require a value');
    } else if (value.value < 0) {
      errors.push('Duration value must not be negative');
    }
  } else if (value.value != null) {
    errors.push(`${value.unit} must remain non-numeric (value must be null)`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value };
}

export function isRuleExecutable(rule: NoticeRuleDraft): {
  executable: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!rule.humanApproved) {
    reasons.push('Rule is not human-approved');
  }
  const duration = validateDurationExpression(rule.duration);
  if (!duration.ok) {
    reasons.push(...duration.errors);
  } else if (!isNumericDurationUnit(duration.value.unit)) {
    reasons.push(`Duration unit ${duration.value.unit} is not deterministically executable`);
  }
  if (rule.timeBarClassification === 'UNCERTAIN') {
    reasons.push('Time-bar classification is UNCERTAIN');
  }
  if (rule.requiredRecipients.length === 0) {
    reasons.push('At least one required recipient must be approved');
  }
  if (rule.ambiguityNotes.length > 0) {
    reasons.push('Ambiguity notes remain unresolved');
  }
  return { executable: reasons.length === 0, reasons };
}

export function normalizeArabicIndicDigits(input: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
  };
  return [...input].map((ch) => map[ch] ?? ch).join('');
}

export function normalizeClauseNumber(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = normalizeArabicIndicDigits(raw).trim();
  if (!trimmed) return null;
  // Do not invent numbers — only normalize whitespace and digit forms.
  return trimmed.replace(/\s+/g, ' ');
}

export function parseCrossReferenceCandidate(raw: string): {
  rawReferenceText: string;
  normalizedTargetIdentifier: string | null;
  ambiguous: boolean;
} {
  const text = normalizeArabicIndicDigits(raw).trim();
  const match = text.match(
    /(?:Sub-?Clause|Clause|Article|Appendix|Schedule)\s+([0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))*)/i,
  );
  if (!match) {
    return { rawReferenceText: text, normalizedTargetIdentifier: null, ambiguous: true };
  }
  return {
    rawReferenceText: text,
    normalizedTargetIdentifier: match[1] ?? null,
    ambiguous: false,
  };
}

export {
  calculateDeadline,
  compareCalculationResults,
  validateExecutableRule,
  validateTriggerDate,
  validateCalendarRevision,
  ExecutableRuleInputSchema,
  CalendarRevisionInputSchema,
  CalculateDeadlineInputSchema,
  CalculationTraceStepSchema,
  StartDateConventionSchema,
  EndDateConventionSchema,
  NonWorkingAdjustmentSchema,
  TriggerPrecisionSchema,
} from './deadline-engine';
export type {
  ExecutableRuleInput,
  CalendarRevisionInput,
  CalculateDeadlineInput,
  CalculateDeadlineResult,
  CalculationTraceStep,
  InternalMilestone,
  StartDateConvention,
  EndDateConvention,
  NonWorkingAdjustment,
  TriggerPrecision,
} from './deadline-engine';
