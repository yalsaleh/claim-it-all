import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { approveSupportAccess } from '@/server/services/platform';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { id } = await context.params;
    const row = await approveSupportAccess(id);
    return Response.json(row);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
