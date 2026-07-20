import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  createTrackedDeadline,
  getDeadlineCalculation,
  recalculateDeadline,
  verifyDeadlineCalculation,
} from '@/server/services/deadlines';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; calculationId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, calculationId } = await context.params;
    const calculation = await getDeadlineCalculation(projectId, calculationId);
    return Response.json(calculation);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; calculationId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, calculationId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      triggerDateId?: string;
      calendarRevisionId?: string;
      reason?: string;
    };

    if (body.action === 'verify') {
      const verified = await verifyDeadlineCalculation(projectId, calculationId);
      return Response.json(verified);
    }
    if (body.action === 'track') {
      const deadline = await createTrackedDeadline(projectId, calculationId);
      return Response.json(deadline, { status: 201 });
    }
    if (body.action === 'recalculate') {
      if (!body.reason) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'reason required' } },
          { status: 400 },
        );
      }
      const recalculated = await recalculateDeadline(projectId, calculationId, {
        triggerDateId: body.triggerDateId,
        calendarRevisionId: body.calendarRevisionId,
        reason: body.reason,
      });
      return Response.json(recalculated, { status: 201 });
    }

    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'action must be verify, track, or recalculate',
        },
      },
      { status: 400 },
    );
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
