import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { setKillSwitch } from '@/server/services/platform';

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = await request.json();
    const row = await setKillSwitch(body);
    return Response.json(row);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
