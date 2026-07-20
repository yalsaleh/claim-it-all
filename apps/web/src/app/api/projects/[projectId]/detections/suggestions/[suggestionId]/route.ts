import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getSuggestion } from '@/server/services/detections';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; suggestionId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, suggestionId } = await context.params;
    const suggestion = await getSuggestion(projectId, suggestionId);
    return Response.json(suggestion);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
