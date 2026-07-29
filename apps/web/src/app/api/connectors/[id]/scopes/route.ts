import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse, validationError } from '@/server/errors';
import { createProjectScope, listConnectorScopes } from '@/server/services/connectors';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { id } = await context.params;
    const items = await listConnectorScopes(id);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { id } = await context.params;
    const body = await request.json();
    const projectId = body.projectId as string | undefined;
    if (!projectId) {
      throw validationError('projectId is required');
    }
    const created = await createProjectScope(id, projectId, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
