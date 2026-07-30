/**
 * Provider-neutral secret references. Values are never stored in Prisma or returned by APIs.
 * Formats: env://NAME | file:///path | vault://path | sm://project/secret
 */

export type SecretBackend = 'env' | 'file' | 'vault' | 'secrets_manager' | 'unknown';

export type SecretReference = {
  reference: string;
  backend: SecretBackend;
  /** Non-sensitive version label for rotation without storing secret material. */
  versionHint?: string;
};

const REFERENCE_PATTERN = /^(env|file|vault|sm):\/\/[A-Za-z0-9_./:@-]{1,512}$/;

export function parseSecretReference(raw: string): SecretReference {
  const trimmed = raw.trim();
  if (!REFERENCE_PATTERN.test(trimmed)) {
    throw new Error('Invalid secret reference format');
  }
  const backendRaw = trimmed.split('://')[0]!;
  const backend: SecretBackend =
    backendRaw === 'env'
      ? 'env'
      : backendRaw === 'file'
        ? 'file'
        : backendRaw === 'vault'
          ? 'vault'
          : backendRaw === 'sm'
            ? 'secrets_manager'
            : 'unknown';
  return { reference: trimmed, backend };
}

export function isSecretReference(raw: string): boolean {
  try {
    parseSecretReference(raw);
    return true;
  } catch {
    return false;
  }
}

/** Resolve env:// secrets only. Other backends require external integration. */
export function resolveSecretReference(ref: string, env: NodeJS.ProcessEnv = process.env): string {
  const parsed = parseSecretReference(ref);
  if (parsed.backend === 'env') {
    const key = parsed.reference.slice('env://'.length);
    const value = env[key];
    if (!value) {
      throw new Error(`Secret reference ${parsed.reference} could not be resolved`);
    }
    return value;
  }
  throw new Error(
    `Secret backend "${parsed.backend}" is not resolved in-process; mount or inject before startup`,
  );
}

export function redactSecretLike(value: unknown): unknown {
  if (typeof value === 'string') {
    if (
      value.length >= 16 &&
      (/secret|token|password|bearer|sk-|AKIA/i.test(value) ||
        /^[A-Za-z0-9+/=_-]{32,}$/.test(value))
    ) {
      return '[redacted]';
    }
    if (REFERENCE_PATTERN.test(value)) return value;
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSecretLike);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (/(password|secret|token|authorization|cookie|credential|signed.?url)/i.test(k)) {
          return [k, '[redacted]'];
        }
        return [k, redactSecretLike(v)];
      }),
    );
  }
  return value;
}
