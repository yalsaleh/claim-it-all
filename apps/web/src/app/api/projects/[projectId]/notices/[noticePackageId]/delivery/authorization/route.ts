import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  authorizeDispatch,
  rejectDispatchAuthorization,
  requestDispatchAuthorization,
  revokeDispatchAuthorization,
} from '@/server/services/notice-delivery';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      snapshotId?: string;
      authorizationId?: string;
      [key: string]: unknown;
    };

    const action = body.action ?? 'request';
    const rest = { ...body };
    delete rest.action;

    if (action === 'request') {
      if (!body.snapshotId) throw new Error('snapshotId required');
      const result = await requestDispatchAuthorization(
        projectId,
        noticePackageId,
        body.snapshotId,
        rest,
      );
      return Response.json(result, { status: 201 });
    }
    if (!body.authorizationId) throw new Error('authorizationId required');

    if (action === 'authorize') {
      const result = await authorizeDispatch(
        projectId,
        noticePackageId,
        body.authorizationId,
        rest,
      );
      return Response.json(result);
    }
    if (action === 'reject') {
      const result = await rejectDispatchAuthorization(
        projectId,
        noticePackageId,
        body.authorizationId,
        rest,
      );
      return Response.json(result);
    }
    if (action === 'revoke') {
      const result = await revokeDispatchAuthorization(
        projectId,
        noticePackageId,
        body.authorizationId,
        rest,
      );
      return Response.json(result);
    }

    return Response.json({ error: { message: 'Unknown action' } }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
