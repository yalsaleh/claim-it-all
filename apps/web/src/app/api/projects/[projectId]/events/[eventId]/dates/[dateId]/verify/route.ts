import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { verifyProjectEventDate } from '@/server/services/deadlines';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; eventId: string; dateId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId, dateId } = await context.params;
    const updated = await verifyProjectEventDate(projectId, eventId, dateId);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
