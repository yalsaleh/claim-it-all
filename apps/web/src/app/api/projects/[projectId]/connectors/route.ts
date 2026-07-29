import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listProjectConnectorScopes } from '@/server/services/connectors';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const items = await listProjectConnectorScopes(projectId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
