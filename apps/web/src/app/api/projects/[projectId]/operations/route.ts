import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getProjectOperationsDashboard, listTimeline } from '@/server/services/operations';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.get('view') === 'timeline') {
      const items = await listTimeline(projectId);
      return Response.json({ items });
    }
    const dashboard = await getProjectOperationsDashboard(projectId);
    return Response.json(dashboard);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
