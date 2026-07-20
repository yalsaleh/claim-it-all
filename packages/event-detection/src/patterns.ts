import type { DetectionCategory } from './types';

export type PhrasePattern = {
  id: string;
  category: DetectionCategory;
  subcategory: string | null;
  language: 'EN' | 'AR' | 'BOTH';
  /** Case-insensitive; applied to segment text. */
  pattern: RegExp;
  signal: string;
  /** If matched, treat as contradiction / negation / clear negative for this category. */
  polarity: 'POSITIVE' | 'NEGATION' | 'CONTRADICTION' | 'DISCLOSED' | 'CONTRACTOR_CAUSED';
};

/**
 * Versioned phrase dictionaries — organized by category, not a flat keyword dump.
 * Patterns are intentionally conservative to reduce false positives.
 */
export const PHRASE_PATTERNS: PhrasePattern[] = [
  // Late drawing / approval
  {
    id: 'late.en.awaiting-approval',
    category: 'LATE_DRAWING_OR_APPROVAL',
    subcategory: 'APPROVAL_OVERDUE',
    language: 'EN',
    pattern:
      /\b(awaiting|waiting for|still pending)\b.{0,40}\b(approval|drawing|revised drawing|shop drawing)\b/i,
    signal: 'awaiting_approval_or_drawing',
    polarity: 'POSITIVE',
  },
  {
    id: 'late.en.overdue-response',
    category: 'LATE_DRAWING_OR_APPROVAL',
    subcategory: 'CONSULTANT_DELAY',
    language: 'EN',
    pattern:
      /\b(overdue|delayed|not yet (issued|received|approved))\b.{0,40}\b(drawing|approval|RFI response|consultant)\b/i,
    signal: 'overdue_drawing_or_approval',
    polarity: 'POSITIVE',
  },
  {
    id: 'late.en.due-date',
    category: 'LATE_DRAWING_OR_APPROVAL',
    subcategory: 'DUE_DATE_MISSED',
    language: 'EN',
    pattern:
      /\b(due|required|promised)\b.{0,30}\b(by|on|before)\b.{0,40}\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
    signal: 'explicit_due_date',
    polarity: 'POSITIVE',
  },
  {
    id: 'late.en.issued-on-time',
    category: 'LATE_DRAWING_OR_APPROVAL',
    subcategory: null,
    language: 'EN',
    pattern: /\b(issued|approved)\b.{0,30}\b(on time|within the required|as scheduled)\b/i,
    signal: 'issued_on_time',
    polarity: 'NEGATION',
  },
  {
    id: 'late.ar.awaiting',
    category: 'LATE_DRAWING_OR_APPROVAL',
    subcategory: 'APPROVAL_OVERDUE',
    language: 'AR',
    pattern: /(بانتظار|في انتظار).{0,30}(الموافقة|الرسم|المخطط)/,
    signal: 'ar_awaiting_approval',
    polarity: 'POSITIVE',
  },

  // Suspension / access
  {
    id: 'access.en.stop-work',
    category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
    subcategory: 'SUSPENSION',
    language: 'EN',
    pattern: /\b(stop[\s-]?work|suspend(ed|sion)?|cease work|demobilize)\b/i,
    signal: 'stop_work_or_suspension',
    polarity: 'POSITIVE',
  },
  {
    id: 'access.en.restricted',
    category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
    subcategory: 'RESTRICTED_ACCESS',
    language: 'EN',
    pattern:
      /\b(access (denied|restricted|not available)|area unavailable|site not handed over|work front unavailable)\b/i,
    signal: 'restricted_access',
    polarity: 'POSITIVE',
  },
  {
    id: 'access.en.safety',
    category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
    subcategory: 'SAFETY_STOPPAGE',
    language: 'EN',
    pattern: /\b(safety stop|stop for safety|unsafe to proceed)\b/i,
    signal: 'safety_stoppage',
    polarity: 'CONTRACTOR_CAUSED',
  },
  {
    id: 'access.en.internal',
    category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
    subcategory: 'INTERNAL',
    language: 'EN',
    pattern:
      /\b(we (have )?decided to pause|internal (decision|stoppage)|our own demobilisation)\b/i,
    signal: 'internal_contractor_stop',
    polarity: 'CONTRACTOR_CAUSED',
  },
  {
    id: 'access.ar.stop',
    category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
    subcategory: 'SUSPENSION',
    language: 'AR',
    pattern: /(إيقاف العمل|وقف العمل|تعليق الأعمال)/,
    signal: 'ar_stop_work',
    polarity: 'POSITIVE',
  },

  // Scope / additional work
  {
    id: 'scope.en.additional',
    category: 'SCOPE_CHANGE_OR_ADDITIONAL_WORK',
    subcategory: 'ADDITIONAL_WORK',
    language: 'EN',
    pattern:
      /\b(additional work|extra work|variation instruction|proceed and price|work outside (the )?BOQ|omitted item reinstated)\b/i,
    signal: 'additional_or_variation_work',
    polarity: 'POSITIVE',
  },
  {
    id: 'scope.en.clarification',
    category: 'SCOPE_CHANGE_OR_ADDITIONAL_WORK',
    subcategory: 'CLARIFICATION',
    language: 'EN',
    pattern: /\b(for clarification (only)?|clarifies that|this does not change the scope)\b/i,
    signal: 'clarification_not_variation',
    polarity: 'NEGATION',
  },
  {
    id: 'scope.en.contractor-error',
    category: 'SCOPE_CHANGE_OR_ADDITIONAL_WORK',
    subcategory: 'CONTRACTOR_ERROR',
    language: 'EN',
    pattern: /\b(correct(ion|ing) (your|contractor) (error|mistake)|rework due to contractor)\b/i,
    signal: 'contractor_error_correction',
    polarity: 'CONTRACTOR_CAUSED',
  },
  {
    id: 'scope.ar.additional',
    category: 'SCOPE_CHANGE_OR_ADDITIONAL_WORK',
    subcategory: 'ADDITIONAL_WORK',
    language: 'AR',
    pattern: /(أعمال إضافية|أمر تغيير|تغيير في النطاق)/,
    signal: 'ar_additional_work',
    polarity: 'POSITIVE',
  },

  // Delayed payment
  {
    id: 'pay.en.overdue',
    category: 'DELAYED_PAYMENT',
    subcategory: 'OVERDUE_CERTIFIED',
    language: 'EN',
    pattern:
      /\b(unpaid|overdue|payment (is )?due|certified amount).{0,40}\b(not (yet )?paid|outstanding|past due)\b/i,
    signal: 'unpaid_or_overdue',
    polarity: 'POSITIVE',
  },
  {
    id: 'pay.en.due-date',
    category: 'DELAYED_PAYMENT',
    subcategory: 'DUE_DATE',
    language: 'EN',
    pattern: /\b(payment due|due date|pay by)\b.{0,40}\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
    signal: 'payment_due_date',
    polarity: 'POSITIVE',
  },
  {
    id: 'pay.en.not-yet-due',
    category: 'DELAYED_PAYMENT',
    subcategory: null,
    language: 'EN',
    pattern:
      /\b(not yet due|payment (is )?not (yet )?contractually due|application (is )?awaiting certification)\b/i,
    signal: 'payment_not_yet_due',
    polarity: 'NEGATION',
  },
  {
    id: 'pay.ar.overdue',
    category: 'DELAYED_PAYMENT',
    subcategory: 'OVERDUE_CERTIFIED',
    language: 'AR',
    pattern: /(مستحق الدفع|لم يتم السداد|تأخر الدفع|مبلغ معتمد غير مدفوع)/,
    signal: 'ar_payment_overdue',
    polarity: 'POSITIVE',
  },

  // Unforeseen site condition
  {
    id: 'site.en.unexpected',
    category: 'UNFORESEEN_SITE_CONDITION',
    subcategory: 'HIDDEN_CONDITION',
    language: 'EN',
    pattern:
      /\b(unforeseen|unexpected|differing)\b.{0,40}\b(ground|soil|condition|utility|obstruction|contamination|groundwater|rock)\b/i,
    signal: 'unexpected_physical_condition',
    polarity: 'POSITIVE',
  },
  {
    id: 'site.en.disclosed',
    category: 'UNFORESEEN_SITE_CONDITION',
    subcategory: null,
    language: 'EN',
    pattern:
      /\b(as shown in (the )?tender|disclosed in (the )?(tender|site investigation)|already identified in)\b/i,
    signal: 'condition_already_disclosed',
    polarity: 'DISCLOSED',
  },
  {
    id: 'site.en.weather',
    category: 'UNFORESEEN_SITE_CONDITION',
    subcategory: 'WEATHER',
    language: 'EN',
    pattern: /\b(due to (heavy )?rain|weather delay|storm)\b/i,
    signal: 'weather_not_site_condition',
    polarity: 'NEGATION',
  },
  {
    id: 'site.ar.unexpected',
    category: 'UNFORESEEN_SITE_CONDITION',
    subcategory: 'HIDDEN_CONDITION',
    language: 'AR',
    pattern: /(ظرف غير متوقع|تربة مختلفة|مرفق تحت الأرض غير ظاهر|عائق غير متوقع)/,
    signal: 'ar_unforeseen_condition',
    polarity: 'POSITIVE',
  },
];
