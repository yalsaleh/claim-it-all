import { describe, expect, it } from 'vitest';
import {
  assertImmutableImageRef,
  createReleaseManifestDraft,
  looksLikePlaceholderDigest,
  validateReleaseManifest,
} from './release-manifest';

const digest = `sha256:${'a'.repeat(64)}`;

describe('release manifest', () => {
  it('rejects floating latest tag', () => {
    expect(() => assertImmutableImageRef({ name: 'web', digest, tag: 'latest' })).toThrow(/latest/);
  });

  it('rejects non-digest image refs', () => {
    expect(() => assertImmutableImageRef({ name: 'web', digest: 'latest' })).toThrow(/sha256/);
  });

  it('rejects placeholder digests for cloud deploy', () => {
    expect(looksLikePlaceholderDigest('SYNTHETIC_MIGRATION_VERSION')).toBe(true);
    const result = validateReleaseManifest({
      schemaVersion: 1,
      releaseId: 'x',
      state: 'RELEASE_CANDIDATE',
      gitSha: 'abc1234',
      createdAt: new Date().toISOString(),
      migrationVersion: 'SYNTHETIC_MIGRATION_VERSION',
      images: [{ name: 'web', digest }],
      sbomDigest: digest,
      vulnerabilityPolicyDigest: digest,
    });
    expect(result.ok).toBe(false);
  });

  it('validates a complete draft schema', () => {
    const manifest = createReleaseManifestDraft({
      releaseId: 'rc-1',
      gitSha: 'abc1234',
      migrationVersion: '20260101000000',
      images: [{ name: 'web', digest, tag: 'rc-1' }],
      sbomDigest: digest,
      vulnerabilityPolicyDigest: digest,
    });
    expect(manifest.state).toBe('RELEASE_CANDIDATE');
    expect(validateReleaseManifest(manifest).ok).toBe(true);
  });

  it('fails validation when digests missing', () => {
    const result = validateReleaseManifest({
      schemaVersion: 1,
      releaseId: 'x',
      state: 'DRAFT',
      gitSha: 'abc1234',
      createdAt: new Date().toISOString(),
      migrationVersion: '1',
      images: [{ name: 'web', digest: 'not-a-digest' }],
      sbomDigest: 'x',
      vulnerabilityPolicyDigest: 'y',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
