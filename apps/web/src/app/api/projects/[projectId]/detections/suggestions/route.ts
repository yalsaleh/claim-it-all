import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listSuggestions } from '@/server/services/detections';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? undefined;
    const detectionRunId = url.searchParams.get('detectionRunId') ?? undefined;
    const items = await listSuggestions(projectId, { status, detectionRunId });
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
