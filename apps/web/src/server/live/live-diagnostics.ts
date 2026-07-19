import { AppError } from '@/server/errors';

const SENSITIVE_KEY =
  /^(password|secret|token|authorization|cookie|uploadUrl|downloadUrl|signed|credential|eicar|body|content|bytes)$/i;

function sanitizeMessage(message: string): string {
  return message
    .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/(password|secret|token|authorization)=[^\s&,;]+/gi, '$1=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer REDACTED')
    .replace(/https?:\/\/[^\s"]*X-Amz-[^\s"]*/gi, 'REDACTED_SIGNED_URL')
    .replace(/X5O!P%@AP[\s\S]{0,80}/g, 'REDACTED_EICAR')
    .slice(0, 800);
}

function sanitizeMeta(meta: unknown): unknown {
  if (meta == null || typeof meta !== 'object') return meta;
  if (Array.isArray(meta)) return meta.map((v) => sanitizeMeta(v));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = 'REDACTED';
      continue;
    }
    if (typeof value === 'string') {
      out[key] = sanitizeMessage(value);
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeMeta(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Unconditional CI-visible diagnostics (bypass console spies / Vitest log filters). */
export function liveDiagnostic(message: string, details?: Record<string, unknown>): void {
  const safe = details ? ` ${JSON.stringify(sanitizeMeta(details))}` : '';
  process.stderr.write(`[live-ingestion] ${message}${safe}\n`);
}

/** Duck-typed Prisma/AppError diagnostics — never rely on instanceof across package copies. */
export function describePrismaError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      type: 'AppError',
      name: error.name,
      code: error.code,
      status: error.status,
      message: sanitizeMessage(error.message),
      details: sanitizeMeta(error.details),
    };
  }
  if (error instanceof Error) {
    const record = error as Error & { code?: unknown; meta?: unknown; clientVersion?: unknown };
    return {
      type: error.constructor?.name ?? 'Error',
      name: error.name,
      message: sanitizeMessage(error.message || '(empty message)'),
      code: record.code != null ? String(record.code) : undefined,
      meta: sanitizeMeta(record.meta),
      clientVersion: record.clientVersion != null ? String(record.clientVersion) : undefined,
      cause: error.cause !== undefined ? describePrismaError(error.cause) : undefined,
      stack: error.stack
        ? sanitizeMessage(error.stack.split('\n').slice(0, 12).join('\n'))
        : undefined,
    };
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      type: record.constructor && (record.constructor as { name?: string }).name,
      name: record.name,
      message:
        typeof record.message === 'string'
          ? sanitizeMessage(record.message)
          : sanitizeMessage(String(error)),
      code: record.code != null ? String(record.code) : undefined,
      meta: sanitizeMeta(record.meta),
      clientVersion: record.clientVersion != null ? String(record.clientVersion) : undefined,
    };
  }
  return { type: typeof error, value: sanitizeMessage(String(error)) };
}

export function formatLiveError(error: unknown, stage: string): string {
  return JSON.stringify({ stage, ...describePrismaError(error) });
}

export function describeSafeError(error: unknown): Record<string, unknown> {
  return describePrismaError(error);
}

export class LiveTestStageError extends Error {
  readonly stage: string;
  override readonly cause: unknown;

  constructor(stage: string, causeValue: unknown) {
    super(`${stage}: ${JSON.stringify(describeSafeError(causeValue))}`);
    this.name = 'LiveTestStageError';
    this.stage = stage;
    this.cause = causeValue;
  }
}

export type LivePipelineState = {
  scenario: string;
  elapsedMs: number;
  expected: string;
  uploadSessionStatus?: string | null;
  documentStatus?: string | null;
  versionUploadStatus?: string | null;
  malwareScanStatus?: string | null;
  versionProcessingStatus?: string | null;
  processingRunStatus?: string | null;
  outboxStatus?: string | null;
  outboxAttempts?: number | null;
  lastIngestionEventTypes?: string[];
  uploadSessionId?: string | null;
  sourceDocumentId?: string | null;
  documentVersionId?: string | null;
  processingRunId?: string | null;
  correlationId?: string | null;
  outboxId?: string | null;
  lastSuccessfulStage?: string;
};

export function formatTimeoutError(state: LivePipelineState): Error {
  return new Error(
    `Timed out waiting for ${state.expected} after ${state.elapsedMs}ms. ` +
      `Last state: ${JSON.stringify(sanitizeMeta(state))}`,
  );
}

export class LiveStageTracker {
  private last: string = 'start';

  mark(stage: string, details?: Record<string, unknown>): void {
    if (stage === this.last) return;
    this.last = stage;
    liveDiagnostic(`${stage}: ok`, details);
  }

  get lastSuccessful(): string {
    return this.last;
  }
}

export async function atStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    const value = await operation();
    liveDiagnostic(`${stage}: ok`);
    return value;
  } catch (error) {
    liveDiagnostic(`${stage}: failed`, describeSafeError(error));
    throw new LiveTestStageError(stage, error);
  }
}

export type PollObserveFn = () => Promise<{
  done: boolean;
  value?: unknown;
  state: Omit<LivePipelineState, 'scenario' | 'elapsedMs' | 'expected'>;
}>;

export async function pollUntil<T>(opts: {
  scenario: string;
  expected: string;
  timeoutMs: number;
  intervalMs?: number;
  observe: () => Promise<{ done: boolean; value?: T; state: Record<string, unknown> }>;
}): Promise<T> {
  const intervalMs = opts.intervalMs ?? 1_500;
  const started = Date.now();
  let lastFingerprint = '';
  while (Date.now() - started < opts.timeoutMs) {
    const observed = await opts.observe();
    const fingerprint = JSON.stringify(observed.state);
    if (fingerprint !== lastFingerprint) {
      lastFingerprint = fingerprint;
      liveDiagnostic(`${opts.scenario}: state-change`, {
        expected: opts.expected,
        elapsedMs: Date.now() - started,
        ...observed.state,
      });
    }
    if (observed.done) {
      return observed.value as T;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const final = await opts.observe();
  throw formatTimeoutError({
    scenario: opts.scenario,
    expected: opts.expected,
    elapsedMs: Date.now() - started,
    ...final.state,
  } as LivePipelineState);
}
