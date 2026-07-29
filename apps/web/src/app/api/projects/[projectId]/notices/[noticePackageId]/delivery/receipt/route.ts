import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { assessReceipt, confirmContractualService } from '@/server/services/notice-delivery';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as { action?: string; [key: string]: unknown };

    if (body.action === 'confirm') {
      const rest = { ...body };
      delete rest.action;
      const result = await confirmContractualService(projectId, noticePackageId, rest);
      return Response.json(result);
    }

    const result = await assessReceipt(projectId, noticePackageId, body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
