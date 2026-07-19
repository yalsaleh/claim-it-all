import { describe, expect, it } from 'vitest';
import { AppError } from '@/server/errors';
import { describePrismaError, formatLiveError } from './live-diagnostics';

describe('live diagnostics', () => {
  it('formats AppError safely', () => {
    const err = new AppError('NOT_FOUND', 'Resource not found', 404);
    expect(describePrismaError(err)).toMatchObject({
      type: 'AppError',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('duck-types Prisma-like errors without instanceof', () => {
    const err = Object.assign(
      new Error('Foreign key constraint failed on the field: `projectId`'),
      {
        name: 'PrismaClientKnownRequestError',
        code: 'P2003',
        meta: { field_name: 'projectId' },
        clientVersion: '6.1.0',
      },
    );
    Object.defineProperty(err, 'constructor', { value: { name: 'PrismaClientKnownRequestError' } });
    const described = describePrismaError(err);
    expect(described.code).toBe('P2003');
    expect(String(described.message)).toMatch(/Foreign key|projectId/i);
    expect(formatLiveError(err, 'outbox-commit-write')).toMatch(/P2003/);
    expect(formatLiveError(err, 'outbox-commit-write')).toMatch(/outbox-commit-write/);
  });

  it('does not drop empty-message objects that only expose clientVersion', () => {
    const err = { clientVersion: '6.1.0', batchRequestIdx: undefined };
    const described = describePrismaError(err);
    expect(described.clientVersion).toBe('6.1.0');
    expect(described.message).toBeTruthy();
  });
});
