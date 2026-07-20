'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function StartDetectionRunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/detections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          runType: 'MANUAL_HISTORICAL_SCAN',
          analysisProfile: 'DETERMINISTIC_ONLY',
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => void start()}
      >
        {busy ? 'Running…' : 'Start historical scan'}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
