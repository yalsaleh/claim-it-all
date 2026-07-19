import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/server/errors';
import {
  atStage,
  describePrismaError,
  formatLiveError,
  formatTimeoutError,
  liveDiagnostic,
  LiveTestStageError,
  pollUntil,
} from './live-diagnostics';

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
    expect(formatLiveError(err, 'outbox-commit-write')).toMatch(/P2003/);
  });

  it('timeout errors include last observed state', () => {
    const err = formatTimeoutError({
      scenario: 'clean-pdf',
      expected: 'READY invariant',
      elapsedMs: 120000,
      malwareScanStatus: 'CLEAN',
      processingRunStatus: 'FAILED',
      outboxStatus: 'DISPATCHED',
      documentVersionId: '00000000-0000-4000-8000-000000000099',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Timed out waiting for READY invariant/);
    expect(err.message).toMatch(/DISPATCHED/);
    expect(err.message).toMatch(/FAILED/);
  });

  it('stage errors are real Error instances with cause', async () => {
    await expect(
      atStage('upload-completion-requested', async () => {
        throw new AppError('VALIDATION_ERROR', 'bad', 400, { code: 'SIGNATURE_UNKNOWN' });
      }),
    ).rejects.toBeInstanceOf(LiveTestStageError);
    try {
      await atStage('upload-completion-requested', async () => {
        throw new AppError('VALIDATION_ERROR', 'bad', 400, { code: 'SIGNATURE_UNKNOWN' });
      });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveTestStageError);
      expect((error as LiveTestStageError).stage).toBe('upload-completion-requested');
      expect((error as LiveTestStageError).cause).toBeInstanceOf(AppError);
      expect(String(error)).toMatch(/SIGNATURE_UNKNOWN/);
    }
  });

  it('redacts sensitive fields and signed URL material', () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    liveDiagnostic('probe', {
      password: 'super-secret',
      uploadUrl: 'https://example.com/?X-Amz-Signature=abc',
      token: 'abc',
      tenantId: '00000000-0000-4000-8000-000000000001',
    });
    spy.mockRestore();
    const line = writes.join('');
    expect(line).toMatch(/\[live-ingestion\] probe/);
    expect(line).toMatch(/REDACTED/);
    expect(line).not.toMatch(/super-secret/);
    expect(line).not.toMatch(/X-Amz-Signature=abc/);
    expect(line).toMatch(/00000000-0000-4000-8000-000000000001/);
  });

  it('writes diagnostics to stderr even if console is spied', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const writes: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    liveDiagnostic('despite-console-spy', { ok: true });
    consoleSpy.mockRestore();
    stderrSpy.mockRestore();
    expect(writes.join('')).toMatch(/despite-console-spy/);
  });

  it('pollUntil throws detailed timeout errors', async () => {
    await expect(
      pollUntil({
        scenario: 'clean-pdf',
        expected: 'outbox DISPATCHED',
        timeoutMs: 50,
        intervalMs: 10,
        observe: async () => ({
          done: false,
          state: { outboxStatus: 'PENDING', outboxAttempts: 0 },
        }),
      }),
    ).rejects.toThrow(/Timed out waiting for outbox DISPATCHED/);
  });

  it('invalid-media AppError retains stable code in diagnostics', () => {
    const err = new AppError('VALIDATION_ERROR', 'mismatch', 400, { code: 'SIGNATURE_MISMATCH' });
    const described = describePrismaError(err);
    expect(described.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(described.details)).toMatch(/SIGNATURE_MISMATCH/);
  });

  it('failure-snapshot style diagnostics never throw', () => {
    expect(() =>
      liveDiagnostic('failure-snapshot', {
        scenario: 'clean-pdf',
        lastSuccessfulStage: 'outbox-dispatched',
        password: 'must-not-appear',
        uploadUrl: 'https://example.com/?X-Amz-Signature=abc',
        tenantId: '00000000-0000-4000-8000-000000000001',
      }),
    ).not.toThrow();
  });
});
