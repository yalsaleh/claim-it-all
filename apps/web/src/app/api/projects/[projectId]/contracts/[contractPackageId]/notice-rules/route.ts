import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { listPackageNoticeRules, reviewNoticeRule } from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const items = await listPackageNoticeRules(projectId, contractPackageId);
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
    const body = (await request.json()) as { noticeRuleId?: string } & Record<string, unknown>;
    if (!body.noticeRuleId) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'noticeRuleId required' } },
        { status: 400 },
      );
    }
    const updated = await reviewNoticeRule(projectId, contractPackageId, body.noticeRuleId, body);
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
