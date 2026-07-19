/**
 * Gate for live infrastructure tests.
 * - Without LIVE_INGESTION_TESTS: skip (local default when Docker is absent).
 * - With REQUIRE_LIVE_INGESTION_TESTS: fail instead of skip (CI).
 */
export function requireLiveServices(serviceName: string, healthy: boolean): void {
  const requireLive =
    process.env.REQUIRE_LIVE_INGESTION_TESTS === 'true' ||
    process.env.REQUIRE_LIVE_INGESTION_TESTS === '1';
  const liveEnabled =
    process.env.LIVE_INGESTION_TESTS === 'true' ||
    process.env.LIVE_INGESTION_TESTS === '1' ||
    requireLive;

  if (!liveEnabled) {
    // vitest skip via thrown special — callers use vitest skip
    throw new LiveSkipError(`${serviceName}: LIVE_INGESTION_TESTS not enabled`);
  }
  if (!healthy) {
    if (requireLive) {
      throw new Error(`${serviceName}: required live service is unhealthy`);
    }
    throw new LiveSkipError(`${serviceName}: live service unreachable`);
  }
}

export class LiveSkipError extends Error {
  readonly isLiveSkip = true;
}

export function isLiveSkip(error: unknown): error is LiveSkipError {
  return error instanceof LiveSkipError;
}
