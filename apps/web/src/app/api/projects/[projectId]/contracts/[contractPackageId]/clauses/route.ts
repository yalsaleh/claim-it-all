import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listPackageClauses, reviewClause } from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const items = await listPackageClauses(projectId, contractPackageId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const body = (await request.json()) as { clauseId?: string } & Record<string, unknown>;
    if (!body.clauseId || typeof body.clauseId !== 'string') {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'clauseId required' } },
        { status: 400 },
      );
    }
    const updated = await reviewClause(projectId, contractPackageId, body.clauseId, body);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
