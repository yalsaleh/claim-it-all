import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { validateConnectorAccount } from '@/server/services/connectors';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { id } = await context.params;
    const updated = await validateConnectorAccount(id);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
