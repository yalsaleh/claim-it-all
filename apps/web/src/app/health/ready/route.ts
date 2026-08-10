import { evaluateWebReadiness } from '@/server/health/readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Application readiness — redacted public codes only; never throws. */
export async function GET() {
  try {
    const result = await evaluateWebReadiness();
    return Response.json(
      {
        status: result.status,
        checks: result.checks,
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    console.error('web_readiness_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json(
      {
        status: 'not_ready',
        checks: { configuration: { status: 'error', code: 'internal' } },
      },
      { status: 503 },
    );
  }
}
