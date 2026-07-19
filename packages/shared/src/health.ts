import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded', 'error']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z
    .record(
      z.object({
        status: HealthStatusSchema,
        detail: z.string().optional(),
      }),
    )
    .optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export function healthOk(service: string, version: string): HealthResponse {
  return {
    status: 'ok',
    service,
    version,
    timestamp: new Date().toISOString(),
  };
}
