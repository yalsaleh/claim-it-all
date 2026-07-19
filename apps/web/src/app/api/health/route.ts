import { healthOk } from '@contractradar/shared';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ...healthOk('contractradar-web', '0.1.0'),
      checks: {
        database: { status: 'ok' },
      },
    });
  } catch {
    return Response.json(
      {
        status: 'error',
        service: 'contractradar-web',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', detail: 'unreachable' },
        },
      },
      { status: 503 },
    );
  }
}
