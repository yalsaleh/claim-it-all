export const RELEASE_STATES = [
  'DEVELOPMENT',
  'RELEASE_CANDIDATE',
  'PILOT_APPROVED',
  'PILOT_ACTIVE',
  'PILOT_PAUSED',
  'SUPERSEDED',
  'ROLLED_BACK',
  // Back-compat aliases used by Slice 10 scaffolding:
  'DRAFT',
  'CANDIDATE',
  'APPROVED',
  'DEPLOYING',
  'DEPLOYED',
  'REJECTED',
] as const;

export type ReleaseState = (typeof RELEASE_STATES)[number];

export type ImageDigestRef = {
  name: string;
  /** Immutable digest, e.g. sha256:... — never a floating tag like "latest". */
  digest: string;
  tag?: string;
};

export type ReleaseManifest = {
  schemaVersion: 1;
  releaseId: string;
  state: ReleaseState;
  gitSha: string;
  createdAt: string;
  migrationVersion: string;
  images: ImageDigestRef[];
  sbomDigest: string;
  vulnerabilityPolicyDigest: string;
  infrastructureRevision?: string;
  environmentPolicyVersion?: string;
  backupVerificationId?: string;
  restoreVerificationId?: string;
  pilotPreflightId?: string;
  notes?: string;
  honesty?: string;
};

const DIGEST_RE = /^sha256:[a-f0-9]{64}$/i;
const SHA_RE = /^[a-f0-9]{7,64}$/i;
const PLACEHOLDER_MARKERS = ['placeholder:', 'SYNTHETIC_', '0000000', 'scaffolding'];

export function isImmutableDigest(digest: string): boolean {
  return DIGEST_RE.test(digest.trim());
}

export function looksLikePlaceholderDigest(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => v.includes(m.toLowerCase()));
}

export function assertImmutableImageRef(ref: ImageDigestRef): void {
  if (!ref.name?.trim()) throw new Error('Image name required');
  if (!isImmutableDigest(ref.digest)) {
    throw new Error(`Image digest must be sha256:<64 hex>, got "${ref.digest}"`);
  }
  if (looksLikePlaceholderDigest(ref.digest)) {
    throw new Error(`Image digest for ${ref.name} looks like a placeholder`);
  }
  if (ref.tag && ref.tag.trim().toLowerCase() === 'latest') {
    throw new Error('Floating tag "latest" is rejected; pin an immutable digest');
  }
}

export function validateReleaseManifest(
  input: unknown,
  options: { requireNonPlaceholder?: boolean } = {},
): {
  ok: boolean;
  manifest?: ReleaseManifest;
  errors: string[];
} {
  const requireNonPlaceholder = options.requireNonPlaceholder ?? true;
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  const m = input as Partial<ReleaseManifest>;
  if (m.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!m.releaseId || typeof m.releaseId !== 'string') errors.push('releaseId required');
  if (!m.state || !(RELEASE_STATES as readonly string[]).includes(m.state)) {
    errors.push(`state must be one of ${RELEASE_STATES.join(', ')}`);
  }
  if (!m.gitSha || !SHA_RE.test(m.gitSha)) errors.push('gitSha must be a hex commit sha');
  if (m.gitSha === '0000000') errors.push('gitSha placeholder rejected');
  if (!m.createdAt || Number.isNaN(Date.parse(m.createdAt))) {
    errors.push('createdAt must be an ISO timestamp');
  }
  if (!m.migrationVersion || typeof m.migrationVersion !== 'string') {
    errors.push('migrationVersion required');
  }
  if (requireNonPlaceholder && looksLikePlaceholderDigest(String(m.migrationVersion))) {
    errors.push('migrationVersion must not be a synthetic placeholder for cloud deploy');
  }
  if (!Array.isArray(m.images) || m.images.length === 0) {
    errors.push('images must be a non-empty array');
  } else {
    for (const img of m.images) {
      try {
        if (requireNonPlaceholder) assertImmutableImageRef(img);
        else {
          if (!isImmutableDigest(img.digest)) {
            errors.push(`Image digest must be sha256:<64 hex>, got "${img.digest}"`);
          }
          if (img.tag?.toLowerCase() === 'latest') errors.push('latest tag rejected');
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (!m.sbomDigest || !isImmutableDigest(m.sbomDigest)) {
    errors.push('sbomDigest must be sha256:<64 hex>');
  } else if (requireNonPlaceholder && looksLikePlaceholderDigest(m.sbomDigest)) {
    errors.push('sbomDigest placeholder rejected');
  }
  if (!m.vulnerabilityPolicyDigest || !isImmutableDigest(m.vulnerabilityPolicyDigest)) {
    errors.push('vulnerabilityPolicyDigest must be sha256:<64 hex>');
  } else if (requireNonPlaceholder && looksLikePlaceholderDigest(m.vulnerabilityPolicyDigest)) {
    // digest of content may coincidentally contain markers — only reject known generator prefix
    if (m.notes?.includes('placeholders') || m.honesty?.includes('Scaffolding')) {
      errors.push('vulnerabilityPolicyDigest from scaffolding generator rejected for cloud deploy');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: m as ReleaseManifest, errors: [] };
}

export function createReleaseManifestDraft(input: {
  releaseId: string;
  gitSha: string;
  migrationVersion: string;
  images: ImageDigestRef[];
  sbomDigest: string;
  vulnerabilityPolicyDigest: string;
  state?: ReleaseState;
  infrastructureRevision?: string;
  environmentPolicyVersion?: string;
  backupVerificationId?: string;
  restoreVerificationId?: string;
  pilotPreflightId?: string;
  notes?: string;
}): ReleaseManifest {
  const manifest: ReleaseManifest = {
    schemaVersion: 1,
    releaseId: input.releaseId,
    state: input.state ?? 'RELEASE_CANDIDATE',
    gitSha: input.gitSha,
    createdAt: new Date().toISOString(),
    migrationVersion: input.migrationVersion,
    images: input.images,
    sbomDigest: input.sbomDigest,
    vulnerabilityPolicyDigest: input.vulnerabilityPolicyDigest,
    infrastructureRevision: input.infrastructureRevision,
    environmentPolicyVersion: input.environmentPolicyVersion,
    backupVerificationId: input.backupVerificationId,
    restoreVerificationId: input.restoreVerificationId,
    pilotPreflightId: input.pilotPreflightId,
    notes: input.notes,
  };
  const validated = validateReleaseManifest(manifest, { requireNonPlaceholder: true });
  if (!validated.ok) {
    throw new Error(`Invalid release manifest: ${validated.errors.join('; ')}`);
  }
  return validated.manifest!;
}
