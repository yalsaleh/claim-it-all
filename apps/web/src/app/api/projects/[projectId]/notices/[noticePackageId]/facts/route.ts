import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { createNoticeFact, verifyNoticeFact } from '@/server/services/notices';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      factId?: string;
      [key: string]: unknown;
    };

    if (body.action === 'verify' && body.factId) {
      const rest = { ...body };
      delete rest.action;
      delete rest.factId;
      const updated = await verifyNoticeFact(projectId, noticePackageId, body.factId, rest);
      return Response.json(updated);
    }

    const created = await createNoticeFact(projectId, noticePackageId, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
