import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { createAuthorizedDownload, getProjectDocument } from '@/server/services/documents';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { documentVersionId?: string };
    const doc = await getProjectDocument(projectId, documentId);
    const versionId = body.documentVersionId ?? doc.versions[0]?.id;
    if (!versionId) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'No version' } },
        { status: 404 },
      );
    }
    const result = await createAuthorizedDownload(projectId, versionId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
