import { describe, expect, it } from 'vitest';
import { satisfiesReadyInvariant } from './ready-invariant';

const valid = {
  documentStatus: 'READY',
  uploadStatus: 'ACCEPTED',
  malwareScanStatus: 'CLEAN',
  storageKey: 'tenants/t/projects/p/originals/v/abc',
  processingRunStatus: 'SUCCEEDED',
  hasDerivedArtifact: true,
};

describe('READY invariant', () => {
  it('accepts a fully consistent ready document', () => {
    expect(satisfiesReadyInvariant(valid)).toBe(true);
  });

  it('rejects quarantine storage keys', () => {
    expect(
      satisfiesReadyInvariant({
        ...valid,
        storageKey: 'tenants/t/projects/p/quarantine/v/abc',
      }),
    ).toBe(false);
  });

  it('rejects non-clean malware status', () => {
    expect(satisfiesReadyInvariant({ ...valid, malwareScanStatus: 'INFECTED' })).toBe(false);
  });

  it('rejects missing derived artifacts', () => {
    expect(satisfiesReadyInvariant({ ...valid, hasDerivedArtifact: false })).toBe(false);
  });

  it('rejects failed processing runs', () => {
    expect(satisfiesReadyInvariant({ ...valid, processingRunStatus: 'FAILED' })).toBe(false);
  });
});
