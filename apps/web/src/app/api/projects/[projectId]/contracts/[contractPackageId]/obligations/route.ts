import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listPackageObligations, reviewObligation } from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const items = await listPackageObligations(projectId, contractPackageId);
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
    const body = (await request.json()) as { obligationId?: string } & Record<string, unknown>;
    if (!body.obligationId) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'obligationId required' } },
        { status: 400 },
      );
    }
    const updated = await reviewObligation(projectId, contractPackageId, body.obligationId, body);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
