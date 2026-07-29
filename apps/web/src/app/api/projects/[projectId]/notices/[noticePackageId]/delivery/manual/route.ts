import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { recordManualDispatch } from '@/server/services/notice-delivery';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as { authorizationId?: string; [key: string]: unknown };
    if (!body.authorizationId) {
      return Response.json({ error: { message: 'authorizationId required' } }, { status: 400 });
    }
    const { authorizationId, ...rest } = body;
    const result = await recordManualDispatch(projectId, noticePackageId, authorizationId, rest);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
