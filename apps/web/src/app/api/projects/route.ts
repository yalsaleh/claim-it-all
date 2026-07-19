import { createCorrelationId } from '@contractradar/shared';
import { createProject, listProjectsForActiveTenant } from '@/server/services/projects';
import { toErrorResponse } from '@/server/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const projects = await listProjectsForActiveTenant();
    return Response.json({ data: projects, correlationId });
  } catch (error) {
    logger.error('list_projects_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = (await request.json()) as unknown;
    const project = await createProject(body);
    return Response.json({ data: project, correlationId }, { status: 201 });
  } catch (error) {
    logger.error('create_project_failed', { correlationId });
    return toErrorResponse(error, correlationId);
  }
}
