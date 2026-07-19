import { createCorrelationId } from '@contractradar/shared';
import { getProject, updateProject } from '@/server/services/projects';
import { toErrorResponse } from '@/server/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const project = await getProject(projectId);
    return Response.json({ data: project, correlationId });
  } catch (error) {
    logger.error('get_project_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as unknown;
    const project = await updateProject(projectId, body);
    return Response.json({ data: project, correlationId });
  } catch (error) {
    logger.error('update_project_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}
