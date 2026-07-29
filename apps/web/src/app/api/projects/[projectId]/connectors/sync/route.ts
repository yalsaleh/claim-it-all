import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse, validationError } from '@/server/errors';
import { startManualSync } from '@/server/services/connectors';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    await context.params;
    const body = await request.json();
    const scopeId = body.scopeId as string | undefined;
    if (!scopeId) throw validationError('scopeId is required');
    const syncRun = await startManualSync(scopeId);
    return Response.json(syncRun, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
