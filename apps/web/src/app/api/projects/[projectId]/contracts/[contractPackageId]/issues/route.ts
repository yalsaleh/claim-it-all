import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listPackageIssues, resolveConfigurationIssue } from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const items = await listPackageIssues(projectId, contractPackageId);
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
    const body = (await request.json()) as { issueId?: string } & Record<string, unknown>;
    if (!body.issueId) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'issueId required' } },
        { status: 400 },
      );
    }
    const updated = await resolveConfigurationIssue(
      projectId,
      contractPackageId,
      body.issueId,
      body,
    );
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
