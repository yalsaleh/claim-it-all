import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { startDeterministicStructureAnalysis } from '@/server/services/contracts';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const result = await startDeterministicStructureAnalysis(projectId, contractPackageId);
    return Response.json(result, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
