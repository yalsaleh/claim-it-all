import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getConnectorAccount } from '@/server/services/connectors';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { id } = await context.params;
    const account = await getConnectorAccount(id);
    return Response.json(account);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
