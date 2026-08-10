/**
 * AWS Secrets Manager resolver for sm:// references.
 * Never logs secret values. Fails closed when AWS SDK/credentials unavailable.
 */

import { parseSecretReference } from './secrets';

export type AwsSecretsClient = {
  getSecretValue: (input: {
    SecretId: string;
    VersionStage?: string;
  }) => Promise<{ SecretString?: string; SecretBinary?: Uint8Array }>;
};

/** sm://aws/{region}/{secret-id} or sm://{secret-id} (default region from env). */
export function parseAwsSecretId(reference: string): { region?: string; secretId: string } {
  const parsed = parseSecretReference(reference);
  if (parsed.backend !== 'secrets_manager') {
    throw new Error(`Expected sm:// reference, got ${parsed.backend}`);
  }
  const path = reference.slice('sm://'.length);
  if (path.startsWith('aws/')) {
    const rest = path.slice('aws/'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) throw new Error('sm://aws/{region}/{secretId} required');
    return { region: rest.slice(0, slash), secretId: rest.slice(slash + 1) };
  }
  return { secretId: path };
}

export async function resolveAwsSecretReference(
  reference: string,
  client: AwsSecretsClient,
): Promise<string> {
  const { secretId } = parseAwsSecretId(reference);
  const result = await client.getSecretValue({ SecretId: secretId });
  if (result.SecretString && result.SecretString.length > 0) {
    return result.SecretString;
  }
  throw new Error(`Secret reference ${reference} resolved empty`);
}

const FAKE_MARKERS = [
  'minioadmin',
  'changeme',
  'password',
  'fake_test',
  'ci-test-secret',
  'dev-only',
  'replace-with',
];

export function assertPilotSecretValue(name: string, value: string): void {
  const lower = value.toLowerCase();
  for (const marker of FAKE_MARKERS) {
    if (lower.includes(marker)) {
      throw new Error(`PILOT rejects fake/test secret material for ${name}`);
    }
  }
  if (value.trim().length < 16) {
    throw new Error(`PILOT secret ${name} is too short`);
  }
}
