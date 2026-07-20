'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function ContractPackageActions(props: {
  projectId: string;
  contractPackageId: string;
  canAttach: boolean;
  canAnalyze: boolean;
  canSubmit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [revisionId, setRevisionId] = useState('');

  return (
    <div className="space-y-3 text-sm">
      {props.canAttach ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Source document UUID"
            value={sourceDocumentId}
            onChange={(e) => setSourceDocumentId(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !sourceDocumentId}
            className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/documents`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      sourceDocumentId,
                      contractDocumentType: 'CONDITIONS_OF_CONTRACT',
                      title: 'Attached contract document',
                    }),
                  },
                );
                setMessage(res.ok ? 'Document attached' : 'Attach failed');
                router.refresh();
              });
            }}
          >
            Attach document
          </button>
        </div>
      ) : null}
      {props.canAnalyze ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/analyze`,
                { method: 'POST' },
              );
              const body = (await res.json().catch(() => null)) as {
                clauseCount?: number;
                error?: { message?: string };
              } | null;
              setMessage(
                res.ok
                  ? `Analysis complete: ${body?.clauseCount ?? 0} clauses`
                  : (body?.error?.message ?? 'Analysis failed'),
              );
              router.refresh();
            });
          }}
        >
          Run deterministic structure analysis
        </button>
      ) : null}
      {props.canSubmit ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/revisions`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'submit', summary: 'Review submission' }),
                },
              );
              const body = (await res.json().catch(() => null)) as {
                id?: string;
                error?: { message?: string };
              } | null;
              if (res.ok && body?.id) setRevisionId(body.id);
              setMessage(
                res.ok
                  ? `Revision submitted: ${body?.id}`
                  : (body?.error?.message ?? 'Submit failed'),
              );
              router.refresh();
            });
          }}
        >
          Submit configuration revision
        </button>
      ) : null}
      {props.canApprove ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Revision UUID to approve"
            value={revisionId}
            onChange={(e) => setRevisionId(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !revisionId}
            className="rounded-md bg-accent-700 px-3 py-1 text-white disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/contracts/${props.contractPackageId}/revisions`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'approve', revisionId }),
                  },
                );
                const body = (await res.json().catch(() => null)) as {
                  error?: { message?: string };
                } | null;
                setMessage(
                  res.ok ? 'Revision approved' : (body?.error?.message ?? 'Approve failed'),
                );
                router.refresh();
              });
            }}
          >
            Approve revision
          </button>
        </div>
      ) : null}
      {message ? <p className="text-xs text-ink-700">{message}</p> : null}
    </div>
  );
}
