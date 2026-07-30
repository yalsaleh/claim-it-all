export const ERROR_CATEGORIES = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'TENANT_CONTEXT',
  'VALIDATION',
  'RATE_LIMIT',
  'DATABASE',
  'RLS',
  'REDIS',
  'OBJECT_STORAGE',
  'MALWARE_SCAN',
  'EXTRACTION',
  'OUTBOX',
  'WORKER',
  'CONNECTOR',
  'PROVIDER',
  'DELIVERY',
  'WEBHOOK',
  'BACKUP',
  'RESTORE',
  'CONFIGURATION',
  'MIGRATION',
  'LIMIT_EXCEEDED',
  'SUPPORT_ACCESS',
  'UNKNOWN',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export type SafeError = {
  category: ErrorCategory;
  code: string;
  message: string;
  correlationId?: string;
  retryable?: boolean;
};

export function safeError(
  category: ErrorCategory,
  code: string,
  message: string,
  opts?: { correlationId?: string; retryable?: boolean },
): SafeError {
  return {
    category,
    code,
    message,
    correlationId: opts?.correlationId,
    retryable: opts?.retryable ?? false,
  };
}
