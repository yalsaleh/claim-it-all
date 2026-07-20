'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function ClauseReviewActions(props: {
  projectId: string;
  contractPackageId: string;
  clauseId: string;
}) {
  const router = useRouter();
  const [correctedText, setCorrectedText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function decide(decision: 'VERIFIED' | 'CORRECTED' | 'REJECTED') {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/clauses`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            clauseId: props.clauseId,
            decision,
            correctedText: decision === 'CORRECTED' ? correctedText : undefined,
          }),
        },
      );
      setMessage(res.ok ? `Marked ${decision}` : 'Review failed');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 text-sm">
      <textarea
        className="h-24 w-full rounded-md border border-ink-200 p-2 text-xs"
        placeholder="Optional corrected / normalized text"
        value={correctedText}
        onChange={(e) => setCorrectedText(e.target.value)}
        dir="auto"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-2 py-1"
          onClick={() => void decide('VERIFIED')}
        >
          Verify
        </button>
        <button
          type="button"
          disabled={pending || !correctedText.trim()}
          className="rounded-md border border-ink-300 px-2 py-1 disabled:opacity-50"
          onClick={() => void decide('CORRECTED')}
        >
          Correct
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-2 py-1"
          onClick={() => void decide('REJECTED')}
        >
          Reject
        </button>
      </div>
      {message ? <p className="text-xs text-ink-700">{message}</p> : null}
    </div>
  );
}
