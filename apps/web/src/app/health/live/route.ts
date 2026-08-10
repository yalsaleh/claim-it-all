import { livePayload } from '@/server/health/readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Process liveness — no external dependencies, no secrets. */
export async function GET() {
  return Response.json(livePayload());
}
