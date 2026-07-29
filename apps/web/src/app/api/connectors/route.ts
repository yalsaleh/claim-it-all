import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { createConnectorAccount, listConnectorAccounts } from '@/server/services/connectors';

export async function GET() {
  const correlationId = createCorrelationId();
  try {
    const items = await listConnectorAccounts();
    return Response.json({ items });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId();
  try {
    const body = await request.json();
    const created = await createConnectorAccount(body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
