'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  connectorId: string;
  status: string;
  canValidate: boolean;
  canApprove: boolean;
  canDisable: boolean;
};

export function ConnectorActions({
  connectorId,
  status,
  canValidate,
  canApprove,
  canDisable,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function callAction(path: string, label: string) {
    setPending(label);
    setMessage(null);
    const res = await fetch(path, { method: 'POST' });
    setPending(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(body?.message ?? `${label} failed`);
      return;
    }
    setMessage(`${label} succeeded`);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
      {canValidate && status !== 'VALIDATED' && status !== 'APPROVED' ? (
        <button
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => callAction(`/api/connectors/${connectorId}/validate`, 'Validate')}
          type="button"
        >
          Validate
        </button>
      ) : null}
      {canApprove && status === 'VALIDATED' ? (
        <button
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => callAction(`/api/connectors/${connectorId}/approve`, 'Approve')}
          type="button"
        >
          Approve
        </button>
      ) : null}
      {canDisable && status !== 'DISABLED' ? (
        <button
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => callAction(`/api/connectors/${connectorId}/disable`, 'Disable')}
          type="button"
        >
          Disable
        </button>
      ) : null}
      {message ? <p className="w-full text-sm text-ink-700">{message}</p> : null}
    </div>
  );
}
