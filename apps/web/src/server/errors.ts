import type { ErrorCode } from '@contractradar/shared';
import { structuredError } from '@contractradar/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError('UNAUTHENTICATED', message, 401);
}

export function forbidden(message = 'You do not have permission to perform this action'): AppError {
  return new AppError('FORBIDDEN', message, 403);
}

/** Intentionally identical messaging for cross-tenant misses to avoid existence leaks. */
export function notFound(message = 'Resource not found'): AppError {
  return new AppError('NOT_FOUND', message, 404);
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError('VALIDATION_ERROR', message, 400, details);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError('CONFLICT', message, 409, details);
}

export function tooManyRequests(message = 'Too many requests'): AppError {
  return new AppError('RATE_LIMITED', message, 429);
}

export function toErrorResponse(error: unknown, correlationId?: string): Response {
  if (error instanceof AppError) {
    return Response.json(
      structuredError(error.code, error.message, {
        details: error.details,
        correlationId,
      }),
      { status: error.status },
    );
  }

  return Response.json(
    structuredError('INTERNAL_ERROR', 'An unexpected error occurred', { correlationId }),
    { status: 500 },
  );
}
