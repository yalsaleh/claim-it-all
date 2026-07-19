import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  archiveDocument,
  getProjectDocument,
  updateDocumentMetadata,
} from '@/server/services/documents';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    const result = await getProjectDocument(projectId, documentId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    const body = await request.json();
    const result = await updateDocumentMetadata(projectId, documentId, body);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, documentId } = await context.params;
    const result = await archiveDocument(projectId, documentId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
