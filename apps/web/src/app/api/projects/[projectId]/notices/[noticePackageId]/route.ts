import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getNoticePackage } from '@/server/services/notices';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const pkg = await getNoticePackage(projectId, noticePackageId);
    return Response.json(pkg);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
