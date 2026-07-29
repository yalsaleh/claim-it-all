import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  acknowledgeAlert,
  assignAlert,
  dismissAlert,
  evaluateAndUpsertAlerts,
  listAlerts,
  resolveAlert,
} from '@/server/services/operations';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const items = await listAlerts(projectId);
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { projectId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action;

    if (action === 'evaluate') {
      const items = await evaluateAndUpsertAlerts(projectId);
      return Response.json({ items });
    }

    const alertId = (body as { alertId?: string }).alertId;
    if (!alertId) {
      const items = await evaluateAndUpsertAlerts(projectId);
      return Response.json({ items });
    }

    switch (action) {
      case 'acknowledge':
        return Response.json(await acknowledgeAlert(alertId));
      case 'assign':
        return Response.json(await assignAlert(alertId, body));
      case 'dismiss':
        return Response.json(await dismissAlert(alertId, body));
      case 'resolve':
        return Response.json(await resolveAlert(alertId, body));
      default:
        return Response.json(await acknowledgeAlert(alertId));
    }
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
