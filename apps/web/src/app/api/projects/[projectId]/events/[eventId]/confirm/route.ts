import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { confirmProjectEvent } from '@/server/services/deadlines';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; eventId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId } = await context.params;
    const body = await request.json();
    const updated = await confirmProjectEvent(projectId, eventId, body);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
