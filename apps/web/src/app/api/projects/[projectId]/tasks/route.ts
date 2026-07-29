import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  assignTask,
  completeTask,
  createTaskFromAlert,
  listTasks,
} from '@/server/services/operations';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const items = await listTasks(projectId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const action = (body as { action?: string }).action;
    const taskId = (body as { taskId?: string }).taskId;

    if (action === 'assign' && taskId) {
      return Response.json(await assignTask(taskId, body));
    }
    if (action === 'complete' && taskId) {
      return Response.json(await completeTask(taskId, body));
    }

    const created = await createTaskFromAlert(projectId, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
