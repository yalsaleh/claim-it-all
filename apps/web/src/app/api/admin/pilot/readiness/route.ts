import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { createPilotReadinessAssessment } from '@/server/services/platform';

export async function POST() {
  const correlationId = createCorrelationId();
  try {
    const assessment = await createPilotReadinessAssessment();
    return Response.json(assessment, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
