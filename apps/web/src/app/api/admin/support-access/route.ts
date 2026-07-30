import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { requestSupportAccess } from '@/server/services/platform';

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = await request.json();
    const row = await requestSupportAccess(body);
    return Response.json(row, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
