import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { confirmRuleApplicability, listCandidateRuleSnapshots } from '@/server/services/deadlines';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; eventId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId } = await context.params;
    const items = await listCandidateRuleSnapshots(projectId, eventId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; eventId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, eventId } = await context.params;
    const body = await request.json();
    const assessment = await confirmRuleApplicability(projectId, eventId, body);
    return Response.json(assessment, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
