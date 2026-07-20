'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Card } from '@/components/ui';

export function CreateProjectEventForm({
  projectId,
  defaultTimezone,
}: {
  projectId: string;
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [eventCategory, setEventCategory] = useState('INSTRUCTION');
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <form
        className="space-y-4"
        dir="auto"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch(`/api/projects/${projectId}/events`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title, eventCategory, timezone }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as {
                error?: { message?: string };
              } | null;
              setError(body?.error?.message ?? 'Failed to create event');
              return;
            }
            const created = (await res.json()) as { id: string };
            router.push(`/projects/${projectId}/events/${created.id}` as Route);
            router.refresh();
          });
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-ink-700">Title</span>
          <input
            className="w-full rounded-md border border-ink-200 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-700">Category</span>
          <select
            className="w-full rounded-md border border-ink-200 px-3 py-2"
            value={eventCategory}
            onChange={(e) => setEventCategory(e.target.value)}
          >
            <option value="INSTRUCTION">Instruction</option>
            <option value="SCOPE_CHANGE">Scope change</option>
            <option value="DELAYED_PAYMENT">Delayed payment</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-700">Timezone</span>
          <input
            className="w-full rounded-md border border-ink-200 px-3 py-2"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </Card>
  );
}
