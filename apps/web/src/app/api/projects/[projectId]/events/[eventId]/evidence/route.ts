import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { linkProjectEventEvidence } from '@/server/services/deadlines';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; eventId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId } = await context.params;
    const body = await request.json();
    const linked = await linkProjectEventEvidence(projectId, eventId, body);
    return Response.json(linked, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
