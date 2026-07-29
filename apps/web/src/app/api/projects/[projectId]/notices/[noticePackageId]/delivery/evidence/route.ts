import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { uploadDispatchEvidence, verifyDispatchEvidence } from '@/server/services/notice-delivery';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as { action?: string; [key: string]: unknown };

    if (body.action === 'verify') {
      const rest = { ...body };
      delete rest.action;
      const result = await verifyDispatchEvidence(projectId, noticePackageId, rest);
      return Response.json(result);
    }

    const result = await uploadDispatchEvidence(projectId, noticePackageId, body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
