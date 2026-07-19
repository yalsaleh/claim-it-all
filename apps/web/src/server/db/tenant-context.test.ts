import { describe, expect, it, vi } from 'vitest';

/**
 * Unit-level contract: setRlsContext must be invoked on the same client that
 * runs the protected query (transaction callback argument), never a separate
 * global Prisma handle inside the callback.
 */
describe('tenant transaction boundary contract', () => {
  it('documents that SET LOCAL and queries share the transaction client', async () => {
    const calls: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => {
        calls.push('set_config');
        return 1;
      }),
      project: {
        findFirst: vi.fn(async () => {
          calls.push('query');
          return { id: 'p1' };
        }),
      },
    };

    const { setRlsContext } = await import('./tenant-context');
    await setRlsContext(tx as never, {
      tenantId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      bypass: false,
    });
    await tx.project.findFirst();

    expect(calls).toEqual(['set_config', 'set_config', 'set_config', 'query']);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
  });
});
