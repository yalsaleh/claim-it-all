import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getDocumentProcessing, retryDocumentProcessing } from '@/server/services/documents';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    return Response.json(await getDocumentProcessing(projectId, documentId));
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    return Response.json(await retryDocumentProcessing(projectId, documentId));
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
