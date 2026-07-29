import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getPortfolioDashboard } from '@/server/services/operations';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const dashboard = await getPortfolioDashboard();
    return Response.json(dashboard);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
