'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Card } from '@/components/ui';

export function CreateContractPackageForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch(`/api/projects/${projectId}/contracts`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as {
                error?: { message?: string };
              } | null;
              setError(body?.error?.message ?? 'Failed to create package');
              return;
            }
            const created = (await res.json()) as { id: string };
            router.push(`/projects/${projectId}/contracts/${created.id}` as Route);
            router.refresh();
          });
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-ink-700">Package name</span>
          <input
            className="w-full rounded-md border border-ink-200 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create package'}
        </button>
      </form>
    </Card>
  );
}
