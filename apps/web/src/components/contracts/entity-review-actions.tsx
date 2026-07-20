'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function EntityReviewActions(props: {
  projectId: string;
  contractPackageId: string;
  endpoint: 'obligations' | 'notice-rules' | 'issues';
  idField: 'obligationId' | 'noticeRuleId' | 'issueId';
  entityId: string;
  decisions?: Array<'VERIFIED' | 'APPROVED' | 'REJECTED'>;
  resolveMode?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const post = (body: Record<string, unknown>) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/${props.endpoint}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [props.idField]: props.entityId, ...body }),
        },
      );
      setMessage(res.ok ? 'Saved' : 'Failed');
      router.refresh();
    });
  };

  if (props.resolveMode) {
    return (
      <div className="space-y-2 text-sm">
        <textarea
          className="w-full rounded-md border border-ink-200 p-2 text-xs"
          rows={3}
          placeholder="Resolution notes"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
        />
        <button
          type="button"
          disabled={pending || !resolution.trim()}
          className="rounded-md border border-ink-300 px-2 py-1 disabled:opacity-50"
          onClick={() => post({ resolution, status: 'RESOLVED' })}
        >
          Resolve issue
        </button>
        {message ? <p className="text-xs text-ink-600">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {(props.decisions ?? ['VERIFIED', 'APPROVED', 'REJECTED']).map((decision) => (
        <button
          key={decision}
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-2 py-1 disabled:opacity-50"
          onClick={() => post({ decision })}
        >
          {decision}
        </button>
      ))}
      {message ? <p className="w-full text-xs text-ink-600">{message}</p> : null}
    </div>
  );
}
