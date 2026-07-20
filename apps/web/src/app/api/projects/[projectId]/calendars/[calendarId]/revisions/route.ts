import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { approveCalendarRevision, createCalendarRevision } from '@/server/services/deadlines';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; calendarId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, calendarId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      revisionId?: string;
      timezone?: string;
      weekendDays?: number[];
      holidays?: string[];
      specialWorkingDays?: string[];
    };

    if (body.action === 'approve') {
      if (!body.revisionId) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'revisionId required' } },
          { status: 400 },
        );
      }
      const approved = await approveCalendarRevision(projectId, calendarId, body.revisionId);
      return Response.json(approved);
    }

    const revision = await createCalendarRevision(projectId, calendarId, body);
    return Response.json(revision, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
