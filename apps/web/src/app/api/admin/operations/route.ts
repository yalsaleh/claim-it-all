import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getPlatformOperationsDashboard } from '@/server/services/platform';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const dashboard = await getPlatformOperationsDashboard();
    return Response.json(dashboard);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
