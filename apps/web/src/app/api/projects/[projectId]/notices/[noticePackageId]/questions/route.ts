import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  answerReviewQuestion,
  createReviewQuestion,
  verifyQuestionAnswer,
} from '@/server/services/notices';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; noticePackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, noticePackageId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      questionId?: string;
      [key: string]: unknown;
    };

    if (body.action === 'answer' && body.questionId) {
      const rest = { ...body };
      delete rest.action;
      delete rest.questionId;
      const updated = await answerReviewQuestion(projectId, noticePackageId, body.questionId, rest);
      return Response.json(updated);
    }

    if (body.action === 'verify' && body.questionId) {
      const updated = await verifyQuestionAnswer(projectId, noticePackageId, body.questionId);
      return Response.json(updated);
    }

    const created = await createReviewQuestion(projectId, noticePackageId, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
