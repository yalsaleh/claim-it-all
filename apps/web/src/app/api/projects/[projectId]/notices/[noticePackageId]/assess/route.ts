import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { assessEvidenceCompleteness } from '@/server/services/notices';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const result = await assessEvidenceCompleteness(projectId, noticePackageId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
