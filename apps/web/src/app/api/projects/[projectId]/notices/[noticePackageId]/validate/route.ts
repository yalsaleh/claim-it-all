import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { runDraftValidation } from '@/server/services/notices';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { revisionId?: string };
    const result = await runDraftValidation(projectId, noticePackageId, body.revisionId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
