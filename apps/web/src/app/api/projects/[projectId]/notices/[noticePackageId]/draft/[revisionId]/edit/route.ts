import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { editDraftSection } from '@/server/services/notices';

export async function POST(
  request: Request,
  context: {
    params: Promise<{ projectId: string; noticePackageId: string; revisionId: string }>;
  },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId, revisionId } = await context.params;
    const body = await request.json();
    const sectionId = body.sectionId as string;
    if (!sectionId) {
      return Response.json({ error: { message: 'sectionId required' } }, { status: 400 });
    }
    const updated = await editDraftSection(projectId, noticePackageId, revisionId, sectionId, body);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
