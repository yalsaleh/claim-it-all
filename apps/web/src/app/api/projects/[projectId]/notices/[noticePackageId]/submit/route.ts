import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { submitDraftForReview } from '@/server/services/notices';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await submitDraftForReview(projectId, noticePackageId, body);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
