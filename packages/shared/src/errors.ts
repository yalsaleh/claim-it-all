import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const StructuredErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string().optional(),
  }),
});

export type StructuredError = z.infer<typeof StructuredErrorSchema>;

export function structuredError(
  code: ErrorCode,
  message: string,
  options?: { details?: unknown; correlationId?: string },
): StructuredError {
  return {
    error: {
      code,
      message,
      ...(options?.details !== undefined ? { details: options.details } : {}),
      ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    },
  };
}
