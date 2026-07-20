import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { rejectSuggestion } from '@/server/services/detections';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; suggestionId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, suggestionId } = await context.params;
    const body = await request.json();
    const result = await rejectSuggestion(projectId, suggestionId, body);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
