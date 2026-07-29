'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';

export function CreateConnectorForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectorType: form.get('connectorType'),
        displayName: form.get('displayName'),
        provider: form.get('provider'),
        secretReference: form.get('secretReference'),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? 'Failed to create connector');
      return;
    }
    const created = (await res.json()) as { id: string };
    router.push(`/connectors/${created.id}` as Route);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-ink-950">Display name</span>
        <input
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2"
          name="displayName"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-950">Connector type</span>
        <input
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2"
          name="connectorType"
          defaultValue="email_import"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-950">Provider</span>
        <select
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2"
          name="provider"
          defaultValue="fake"
        >
          <option value="fake">fake (test only)</option>
          <option value="local_fixture">local_fixture</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-950">Secret reference</span>
        <input
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2"
          name="secretReference"
          placeholder="vault://connectors/example"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Creating…' : 'Create connector'}
      </button>
    </form>
  );
}
