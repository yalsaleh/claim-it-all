import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { attachContractDocument } from '@/server/services/contracts';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const body = await request.json();
    const attached = await attachContractDocument(projectId, contractPackageId, body);
    return Response.json(attached, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
