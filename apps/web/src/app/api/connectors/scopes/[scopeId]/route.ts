import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { approveProjectScope, previewScope, startManualSync } from '@/server/services/connectors';

export async function GET(_request: Request, context: { params: Promise<{ scopeId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { scopeId } = await context.params;
    const preview = await previewScope(scopeId);
    return Response.json(preview);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ scopeId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { scopeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action ?? 'approve';

    if (action === 'sync') {
      const syncRun = await startManualSync(scopeId);
      return Response.json(syncRun, { status: 201 });
    }

    const updated = await approveProjectScope(scopeId);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
