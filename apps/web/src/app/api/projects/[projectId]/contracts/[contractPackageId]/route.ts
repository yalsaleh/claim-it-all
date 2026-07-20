import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { getContractPackage } from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const pkg = await getContractPackage(projectId, contractPackageId);
    return Response.json(pkg);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
