import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  createInternalNotification,
  listInternalNotifications,
  markNotificationRead,
} from '@/server/services/operations';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const items = await listInternalNotifications();
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = await request.json();
    const action = (body as { action?: string }).action;

    if (action === 'mark_read') {
      const notificationId = (body as { notificationId?: string }).notificationId;
      if (!notificationId) {
        return Response.json({ error: 'notificationId required' }, { status: 400 });
      }
      return Response.json(await markNotificationRead(notificationId));
    }

    const created = await createInternalNotification(body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
