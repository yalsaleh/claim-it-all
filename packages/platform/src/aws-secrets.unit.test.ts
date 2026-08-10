import { describe, expect, it } from 'vitest';
import { assertPilotSecretValue, parseAwsSecretId, resolveAwsSecretReference } from './aws-secrets';

describe('aws secrets', () => {
  it('parses sm://aws/region/id', () => {
    expect(parseAwsSecretId('sm://aws/eu-west-2/contractradar/pilot/db')).toEqual({
      region: 'eu-west-2',
      secretId: 'contractradar/pilot/db',
    });
  });

  it('parses sm://secret-id', () => {
    expect(parseAwsSecretId('sm://contractradar/pilot/auth')).toEqual({
      secretId: 'contractradar/pilot/auth',
    });
  });

  it('resolves via client without logging', async () => {
    const value = await resolveAwsSecretReference('sm://pilot/db', {
      getSecretValue: async () => ({ SecretString: 'super-strong-pilot-secret-value' }),
    });
    expect(value).toBe('super-strong-pilot-secret-value');
  });

  it('rejects fake secret markers in PILOT', () => {
    expect(() =>
      assertPilotSecretValue('BETTER_AUTH_SECRET', 'ci-test-secret-with-sufficient-length-32'),
    ).toThrow(/fake\/test/);
  });
});
