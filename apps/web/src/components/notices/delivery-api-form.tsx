'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

type Props = {
  action: string;
  method?: 'GET' | 'POST';
  children: ReactNode;
  submitLabel: string;
  className?: string;
};

export function DeliveryApiForm({
  action,
  method = 'POST',
  children,
  submitLabel,
  className,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key.endsWith('Reviewed') || key === 'deliveryRiskAcknowledged') {
        body[key] = value === 'on';
      } else if (value !== '') {
        body[key] = value;
      }
    });

    try {
      const res = await fetch(action, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
      }
      setSuccess('Saved successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={className} onSubmit={(e) => void onSubmit(e)}>
      {children}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-accent-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Working…' : submitLabel}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-green-800">{success}</p> : null}
    </form>
  );
}
