import { createCorrelationId } from '@contractradar/shared';
import { AppError, toErrorResponse } from '@/server/errors';
import { initiateDocumentUpload, listProjectDocuments } from '@/server/services/documents';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const result = await listProjectDocuments(projectId, {
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await initiateDocumentUpload({ ...body, projectId });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return toErrorResponse(error, correlationId);
    return toErrorResponse(error, correlationId);
  }
}
