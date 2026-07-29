import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import { processConnectorWebhook } from '@/server/services/connectors';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const correlationId = createCorrelationId();
  try {
    const { provider } = await context.params;
    const rawBody = Buffer.from(await request.arrayBuffer());
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const result = await processConnectorWebhook(provider, headers, rawBody);
    return Response.json(result, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
