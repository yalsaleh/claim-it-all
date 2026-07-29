import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listDispatchAttempts } from '@/server/services/notice-delivery';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const attempts = await listDispatchAttempts(projectId, noticePackageId);
    return Response.json({ attempts });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
