import { describe, expect, it } from 'vitest';
import { EntityIdSchema, parseProjectId, parseTenantId } from './ids';

describe('EntityIdSchema', () => {
  it('accepts uuids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(EntityIdSchema.parse(id)).toBe(id);
  });

  it('rejects non-uuids', () => {
    expect(() => parseTenantId('not-a-uuid')).toThrow();
    expect(() => parseProjectId('abc')).toThrow();
  });
});
