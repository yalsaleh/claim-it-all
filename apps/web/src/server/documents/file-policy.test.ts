import { describe, expect, it } from 'vitest';
import { assertMagicMatchesPolicy, validateDeclaredUpload } from './file-policy';
import { assertSafeFilename, normalizeFilename } from './filename';
import { buildQuarantineObjectKey } from './storage-keys';
import { canTransitionUploadSession } from './status-transitions';

describe('filename normalization', () => {
  it('strips path traversal', () => {
    expect(normalizeFilename('../../etc/passwd')).toBe('passwd');
    expect(() => assertSafeFilename('../secret.exe')).toThrow(/EXECUTABLE|UNSAFE/);
  });
});

describe('file policy', () => {
  it('accepts pdf declarations', () => {
    const result = validateDeclaredUpload({
      filename: 'notice.pdf',
      declaredMediaType: 'application/pdf',
      declaredSizeBytes: 1024,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects zero-byte and msg', () => {
    expect(
      validateDeclaredUpload({
        filename: 'a.pdf',
        declaredMediaType: 'application/pdf',
        declaredSizeBytes: 0,
      }).ok,
    ).toBe(false);
    expect(
      validateDeclaredUpload({
        filename: 'mail.msg',
        declaredMediaType: 'application/octet-stream',
        declaredSizeBytes: 10,
      }).ok,
    ).toBe(false);
  });

  it('detects pdf magic', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n%');
    const result = assertMagicMatchesPolicy({
      bytes,
      extension: 'pdf',
      expectedMediaType: 'application/pdf',
    });
    expect(result.ok).toBe(true);
  });
});

describe('storage keys', () => {
  it('partitions quarantine keys without filenames', () => {
    const key = buildQuarantineObjectKey({
      tenantId: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      uploadSessionId: '33333333-3333-3333-3333-333333333333',
    });
    expect(key.includes('quarantine')).toBe(true);
    expect(key.includes('notice')).toBe(false);
  });
});

describe('status transitions', () => {
  it('allows authorized upload completion path', () => {
    expect(canTransitionUploadSession('UPLOAD_AUTHORIZED', 'UPLOADED')).toBe(true);
    expect(canTransitionUploadSession('ACCEPTED', 'UPLOADED')).toBe(false);
  });
});
