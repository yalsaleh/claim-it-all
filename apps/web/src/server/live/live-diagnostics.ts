import { AppError } from '@/server/errors';

function sanitizeMessage(message: string): string {
  return message
    .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/(password|secret|token|authorization)=[^\s&,;]+/gi, '$1=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer REDACTED')
    .slice(0, 800);
}

function sanitizeMeta(meta: unknown): unknown {
  if (meta == null || typeof meta !== 'object') return meta;
  try {
    return JSON.parse(sanitizeMessage(JSON.stringify(meta)));
  } catch {
    return undefined;
  }
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
        ? sanitizeMessage(error.stack.split('\n').slice(0, 8).join('\n'))
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

export type LiveStage =
  | 'fixture-user-created'
  | 'fixture-tenant-created'
  | 'fixture-tenant-membership-created'
  | 'fixture-project-created'
  | 'fixture-project-membership-created'
  | 'signed-active-tenant-context-created'
  | 'authenticated-user-resolved'
  | 'tenant-membership-resolved'
  | 'authorized-project-resolved'
  | 'document-capability-confirmed'
  | 'upload-session-created'
  | 'object-uploaded'
  | 'upload-completion-started'
  | 'completion-verified'
  | 'outbox-created'
  | 'job-dispatched'
  | 'malware-clean-or-infected'
  | 'object-promoted-or-quarantined'
  | 'extraction-finished'
  | 'evidence-created'
  | 'download-authorized'
  | 'fixture-created';

export class LiveStageTracker {
  private last: string = 'start';

  mark(stage: LiveStage | string): void {
    this.last = stage;
    console.info(`[live-stage] ${stage}: ok`);
  }

  get lastSuccessful(): string {
    return this.last;
  }
}

export async function atStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    const value = await operation();
    console.info(`[live-stage] ${stage}: ok`);
    return value;
  } catch (error) {
    console.error(`[live-stage] ${stage}: failed`, describeSafeError(error));
    throw error;
  }
}
