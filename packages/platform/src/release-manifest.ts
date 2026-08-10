export const RELEASE_STATES = [
  'DRAFT',
  'CANDIDATE',
  'APPROVED',
  'DEPLOYING',
  'DEPLOYED',
  'ROLLED_BACK',
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
  notes?: string;
};

const DIGEST_RE = /^sha256:[a-f0-9]{64}$/i;
const SHA_RE = /^[a-f0-9]{7,64}$/i;

export function isImmutableDigest(digest: string): boolean {
  return DIGEST_RE.test(digest.trim());
}

export function assertImmutableImageRef(ref: ImageDigestRef): void {
  if (!ref.name?.trim()) throw new Error('Image name required');
  if (!isImmutableDigest(ref.digest)) {
    throw new Error(`Image digest must be sha256:<64 hex>, got "${ref.digest}"`);
  }
  if (ref.tag && ref.tag.trim().toLowerCase() === 'latest') {
    throw new Error('Floating tag "latest" is rejected; pin an immutable digest');
  }
}

export function validateReleaseManifest(input: unknown): {
  ok: boolean;
  manifest?: ReleaseManifest;
  errors: string[];
} {
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
  if (!m.createdAt || Number.isNaN(Date.parse(m.createdAt))) {
    errors.push('createdAt must be an ISO timestamp');
  }
  if (!m.migrationVersion || typeof m.migrationVersion !== 'string') {
    errors.push('migrationVersion required');
  }
  if (!Array.isArray(m.images) || m.images.length === 0) {
    errors.push('images must be a non-empty array');
  } else {
    for (const img of m.images) {
      try {
        assertImmutableImageRef(img);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (!m.sbomDigest || !isImmutableDigest(m.sbomDigest)) {
    errors.push('sbomDigest must be sha256:<64 hex>');
  }
  if (!m.vulnerabilityPolicyDigest || !isImmutableDigest(m.vulnerabilityPolicyDigest)) {
    errors.push('vulnerabilityPolicyDigest must be sha256:<64 hex>');
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
  notes?: string;
}): ReleaseManifest {
  const draft: ReleaseManifest = {
    schemaVersion: 1,
    releaseId: input.releaseId,
    state: 'DRAFT',
    gitSha: input.gitSha,
    createdAt: new Date().toISOString(),
    migrationVersion: input.migrationVersion,
    images: input.images,
    sbomDigest: input.sbomDigest,
    vulnerabilityPolicyDigest: input.vulnerabilityPolicyDigest,
    notes: input.notes,
  };
  const validated = validateReleaseManifest(draft);
  if (!validated.ok || !validated.manifest) {
    throw new Error(`Invalid release manifest: ${validated.errors.join('; ')}`);
  }
  return validated.manifest;
}
