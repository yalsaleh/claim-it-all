import { createCorrelationId } from '@contractradar/shared';
import { addProjectMember, listProjectMembers } from '@/server/services/projects';
import { toErrorResponse } from '@/server/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const members = await listProjectMembers(projectId);
    return Response.json({ data: members, correlationId });
  } catch (error) {
    logger.error('list_members_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as unknown;
    const member = await addProjectMember(projectId, body);
    return Response.json({ data: member, correlationId }, { status: 201 });
  } catch (error) {
    logger.error('add_member_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}
