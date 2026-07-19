import { Prisma } from '@prisma/client';
import { AppError } from '@/server/errors';

/** Safe Prisma / AppError formatting for CI — no SQL params, secrets, or document bodies. */
export function formatLiveError(error: unknown, stage: string): string {
  if (error instanceof AppError) {
    return `[${stage}] AppError code=${error.code} status=${error.status} message=${error.message}`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `[${stage}] PrismaClientKnownRequestError code=${error.code} message=${sanitizeMessage(error.message)}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return `[${stage}] PrismaClientValidationError message=${sanitizeMessage(error.message)}`;
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return `[${stage}] PrismaClientRustPanicError message=${sanitizeMessage(error.message)}`;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return `[${stage}] PrismaClientInitializationError message=${sanitizeMessage(error.message)}`;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return `[${stage}] PrismaClientUnknownRequestError message=${sanitizeMessage(error.message)}`;
  }
  if (error instanceof Error) {
    return `[${stage}] ${error.name}: ${sanitizeMessage(error.message)}`;
  }
  return `[${stage}] ${sanitizeMessage(String(error))}`;
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/(password|secret|token|authorization)=[^\s&,;]+/gi, '$1=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer REDACTED')
    .slice(0, 500);
}

export type LiveStage =
  | 'fixture-created'
  | 'authorized-project-resolved'
  | 'upload-session-created'
  | 'object-uploaded'
  | 'completion-verified'
  | 'outbox-created'
  | 'job-dispatched'
  | 'malware-clean-or-infected'
  | 'object-promoted-or-quarantined'
  | 'extraction-finished'
  | 'evidence-created'
  | 'download-authorized';

export class LiveStageTracker {
  private last: LiveStage | 'start' = 'start';

  mark(stage: LiveStage): void {
    this.last = stage;
    console.info(`[live-stage] ${stage}`);
  }

  get lastSuccessful(): string {
    return this.last;
  }
}
