import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getDispatchAttempt } from '@/server/services/notice-delivery';

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ projectId: string; noticePackageId: string; attemptId: string }>;
  },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId, attemptId } = await context.params;
    const attempt = await getDispatchAttempt(projectId, noticePackageId, attemptId);
    return Response.json(attempt);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
