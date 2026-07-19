import { describe, expect, it } from 'vitest';
import { parseEvidenceReference } from './evidence';

describe('EvidenceReference', () => {
  it('accepts a complete reference', () => {
    const ref = parseEvidenceReference({
      schemaVersion: 1,
      tenantId: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      sourceDocumentId: '33333333-3333-3333-3333-333333333333',
      documentVersionId: '44444444-4444-4444-4444-444444444444',
      processingRunId: '55555555-5555-5555-5555-555555555555',
      evidenceSegmentId: '66666666-6666-6666-6666-666666666666',
      locator: { schemaVersion: 1, kind: 'page', pageNumber: 2 },
      selectedTextSha256: 'a'.repeat(64),
      quotedText: 'Notice shall be given within 28 days.',
    });
    expect(ref.locator?.pageNumber).toBe(2);
  });

  it('rejects oversized quotes', () => {
    expect(() =>
      parseEvidenceReference({
        schemaVersion: 1,
        tenantId: '11111111-1111-1111-1111-111111111111',
        projectId: '22222222-2222-2222-2222-222222222222',
        sourceDocumentId: '33333333-3333-3333-3333-333333333333',
        documentVersionId: '44444444-4444-4444-4444-444444444444',
        processingRunId: '55555555-5555-5555-5555-555555555555',
        quotedText: 'x'.repeat(2001),
      }),
    ).toThrow();
  });
});
