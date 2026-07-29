import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { generateDeterministicDraft } from '@/server/services/notices';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const revision = await generateDeterministicDraft(projectId, noticePackageId);
    return Response.json(revision, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
