import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getDeliveryRisk } from '@/server/services/notice-delivery';

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const url = new URL(request.url);
    const authorizationId = url.searchParams.get('authorizationId') ?? undefined;
    const result = await getDeliveryRisk(projectId, noticePackageId, authorizationId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
