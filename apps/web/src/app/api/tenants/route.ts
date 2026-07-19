import { createCorrelationId } from '@contractradar/shared';
import { listAuthorizedTenants } from '@/server/services/tenants';
import { toErrorResponse } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const tenants = await listAuthorizedTenants();
    return Response.json({ data: tenants, correlationId });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
