import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listDetectionRuns, startDetectionRun } from '@/server/services/detections';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const items = await listDetectionRuns(projectId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const created = await startDetectionRun(projectId, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
