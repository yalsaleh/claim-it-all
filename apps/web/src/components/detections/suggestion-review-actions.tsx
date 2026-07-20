'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SuggestionReviewActions({
  projectId,
  suggestionId,
  dateSuggestionIds,
  canAccept,
  canReject,
  canRequestEvidence,
}: {
  projectId: string;
  suggestionId: string;
  dateSuggestionIds: string[];
  canAccept: boolean;
  canReject: boolean;
  canRequestEvidence: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  async function post(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { message?: string };
        projectEvent?: { id: string };
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
      }
      router.refresh();
      if (path.endsWith('/accept') && payload?.projectEvent?.id) {
        router.push(`/projects/${projectId}/events/${payload.projectEvent.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {error ? <p className="text-red-700">{error}</p> : null}

      {canAccept ? (
        <div className="space-y-2 rounded-md border border-ink-200 p-3">
          <p className="font-medium text-ink-950">Accept into ProjectEvent</p>
          <p className="text-xs text-ink-600">
            Creates an UNCONFIRMED event. Does not confirm rule applicability or calculate
            deadlines.
          </p>
          {dateSuggestionIds.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-ink-800">Accept date candidates</legend>
              {dateSuggestionIds.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedDates.includes(id)}
                    onChange={(e) => {
                      setSelectedDates((prev) =>
                        e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                      );
                    }}
                  />
                  {id.slice(0, 8)}…
                </label>
              ))}
            </fieldset>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-accent-700 px-3 py-1.5 text-white disabled:opacity-50"
            onClick={() =>
              void post(
                `/api/projects/${projectId}/detections/suggestions/${suggestionId}/accept`,
                {
                  acceptedDateSuggestionIds: selectedDates,
                  rationale: 'Accepted after evidence review',
                },
              )
            }
          >
            Accept suggestion
          </button>
        </div>
      ) : null}

      {canReject ? (
        <div className="space-y-2 rounded-md border border-ink-200 p-3">
          <label className="block font-medium text-ink-950">
            Reject
            <textarea
              className="mt-1 w-full rounded-md border border-ink-300 px-2 py-1 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
            />
          </label>
          <button
            type="button"
            disabled={busy || reason.trim().length === 0}
            className="rounded-md border border-ink-400 px-3 py-1.5 disabled:opacity-50"
            onClick={() =>
              void post(
                `/api/projects/${projectId}/detections/suggestions/${suggestionId}/reject`,
                {
                  reason,
                },
              )
            }
          >
            Reject suggestion
          </button>
        </div>
      ) : null}

      {canRequestEvidence ? (
        <div className="space-y-2 rounded-md border border-ink-200 p-3">
          <label className="block font-medium text-ink-950">
            Request more evidence
            <textarea
              className="mt-1 w-full rounded-md border border-ink-300 px-2 py-1 text-sm"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What evidence is missing?"
            />
          </label>
          <button
            type="button"
            disabled={busy || note.trim().length === 0}
            className="rounded-md border border-ink-400 px-3 py-1.5 disabled:opacity-50"
            onClick={() =>
              void post(
                `/api/projects/${projectId}/detections/suggestions/${suggestionId}/request-evidence`,
                { note },
              )
            }
          >
            Request evidence
          </button>
        </div>
      ) : null}
    </div>
  );
}
