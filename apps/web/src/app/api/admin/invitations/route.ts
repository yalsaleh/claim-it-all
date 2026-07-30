import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { inviteTenantUser } from '@/server/services/platform';

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = await request.json();
    const result = await inviteTenantUser(body);
    // Never echo full token in production logs; response is intentional one-time delivery.
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
