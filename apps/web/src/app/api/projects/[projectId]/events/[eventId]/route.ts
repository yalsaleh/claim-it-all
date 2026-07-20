import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getProjectEvent } from '@/server/services/deadlines';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; eventId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId } = await context.params;
    const event = await getProjectEvent(projectId, eventId);
    return Response.json(event);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
