import { z } from 'zod';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const CorrelationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Invalid correlation id');

export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

export function createCorrelationId(): CorrelationId {
  return crypto.randomUUID();
}

export function resolveCorrelationId(headerValue: string | null | undefined): CorrelationId {
  if (!headerValue) {
    return createCorrelationId();
  }
  const parsed = CorrelationIdSchema.safeParse(headerValue);
  return parsed.success ? parsed.data : createCorrelationId();
}
