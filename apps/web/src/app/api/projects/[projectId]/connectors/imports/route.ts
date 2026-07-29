import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getExternalRecords, listSyncRuns } from '@/server/services/connectors';

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    if (view === 'sync-runs') {
      const scopeId = url.searchParams.get('scopeId') ?? undefined;
      const items = await listSyncRuns(projectId, scopeId);
      return Response.json({ items });
    }
    const items = await getExternalRecords(projectId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
