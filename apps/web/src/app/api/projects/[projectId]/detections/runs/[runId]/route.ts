import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getDetectionRun } from '@/server/services/detections';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; runId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, runId } = await context.params;
    const run = await getDetectionRun(projectId, runId);
    return Response.json(run);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
