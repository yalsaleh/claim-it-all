'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  projectId: string;
  noticePackageId: string;
  revisionId?: string;
  canAssess?: boolean;
  canGenerate?: boolean;
  canSubmit?: boolean;
  canApprove?: boolean;
  canExport?: boolean;
};

export function NoticeWorkflowButtons({
  projectId,
  noticePackageId,
  revisionId,
  canAssess = true,
  canGenerate = true,
  canSubmit = true,
  canApprove = true,
  canExport = true,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/projects/${projectId}/notices/${noticePackageId}`;

  async function post(path: string, label: string, body?: unknown) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `${label} failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canAssess ? (
        <button
          type="button"
          disabled={busy !== null}
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void post('/assess', 'assess')}
        >
          {busy === 'assess' ? 'Assessing…' : 'Assess evidence'}
        </button>
      ) : null}
      {canGenerate ? (
        <button
          type="button"
          disabled={busy !== null}
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void post('/draft', 'draft')}
        >
          {busy === 'draft' ? 'Generating…' : 'Generate draft'}
        </button>
      ) : null}
      {canSubmit ? (
        <button
          type="button"
          disabled={busy !== null}
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void post('/submit', 'submit', { draftRevisionId: revisionId })}
        >
          {busy === 'submit' ? 'Submitting…' : 'Submit for review'}
        </button>
      ) : null}
      {canApprove ? (
        <button
          type="button"
          disabled={busy !== null}
          className="rounded-md bg-accent-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          onClick={() => void post('/approve', 'approve', { draftRevisionId: revisionId })}
        >
          {busy === 'approve' ? 'Approving…' : 'Approve draft'}
        </button>
      ) : null}
      {canExport ? (
        <button
          type="button"
          disabled={busy !== null}
          className="rounded-md border border-accent-700 px-3 py-1.5 text-sm text-accent-800 disabled:opacity-50"
          onClick={() => void post('/export', 'export')}
        >
          {busy === 'export' ? 'Exporting…' : 'Generate export'}
        </button>
      ) : null}
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
