import { createCorrelationId } from '@contractradar/shared';
import { selectActiveTenant } from '@/server/services/tenants';
import { toErrorResponse } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = (await request.json()) as unknown;
    const result = await selectActiveTenant(body);
    return Response.json({ data: result, correlationId });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
