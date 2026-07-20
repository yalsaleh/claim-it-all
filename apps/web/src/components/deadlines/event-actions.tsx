'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function ProjectEventActions(props: {
  projectId: string;
  eventId: string;
  canUpdate: boolean;
  canConfirm: boolean;
  canAssess: boolean;
  canCalculate: boolean;
  candidateSnapshotId?: string;
  assessmentId?: string;
  calendarRevisionId?: string;
  triggerDateId?: string;
  calculationId?: string;
  canVerify: boolean;
  canTrack: boolean;
  unverifiedDateId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dateType, setDateType] = useState('INSTRUCTION_DATE');
  const [dateValue, setDateValue] = useState('');
  const [snapshotId, setSnapshotId] = useState(props.candidateSnapshotId ?? '');

  return (
    <div className="space-y-3 text-sm" dir="auto">
      {props.canUpdate ? (
        <div className="space-y-2 rounded-md border border-ink-100 p-3">
          <p className="font-medium text-ink-950">Add trigger date</p>
          <select
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            value={dateType}
            onChange={(e) => setDateType(e.target.value)}
          >
            <option value="INSTRUCTION_DATE">Instruction date</option>
            <option value="RECEIPT_DATE">Receipt date</option>
            <option value="AWARENESS_DATE">Awareness date</option>
          </select>
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            type="datetime-local"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !dateValue}
            className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/events/${props.eventId}/dates`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      dateType,
                      dateValue: new Date(dateValue).toISOString(),
                      timezone: 'Asia/Dubai',
                      precision: 'EXACT_DATETIME',
                    }),
                  },
                );
                const body = (await res.json().catch(() => null)) as {
                  id?: string;
                  error?: { message?: string };
                } | null;
                setMessage(
                  res.ok ? `Date added: ${body?.id}` : (body?.error?.message ?? 'Add date failed'),
                );
                router.refresh();
              });
            }}
          >
            Add date
          </button>
        </div>
      ) : null}

      {props.canConfirm && props.unverifiedDateId ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/events/${props.eventId}/dates/${props.unverifiedDateId}/verify`,
                { method: 'POST' },
              );
              setMessage(res.ok ? 'Date verified' : 'Verify date failed');
              router.refresh();
            });
          }}
        >
          Verify latest date
        </button>
      ) : null}

      {props.canConfirm ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/events/${props.eventId}/confirm`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    confirmationStatus: 'CONFIRMED_FOR_DEADLINE_ANALYSIS',
                  }),
                },
              );
              setMessage(res.ok ? 'Event confirmed for deadline analysis' : 'Confirm failed');
              router.refresh();
            });
          }}
        >
          Confirm for deadline analysis
        </button>
      ) : null}

      {props.canAssess ? (
        <div className="space-y-2 rounded-md border border-ink-100 p-3">
          <p className="font-medium text-ink-950">Confirm rule applicability</p>
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Approved rule snapshot UUID"
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !snapshotId}
            className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/events/${props.eventId}/rule-assessments`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      approvedRuleSnapshotId: snapshotId,
                      rationale: 'Human confirmed applicable notice rule',
                    }),
                  },
                );
                setMessage(res.ok ? 'Rule applicability confirmed' : 'Assessment failed');
                router.refresh();
              });
            }}
          >
            Confirm applicability
          </button>
        </div>
      ) : null}

      {props.canCalculate &&
      props.assessmentId &&
      props.calendarRevisionId &&
      props.triggerDateId ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-accent-700 px-3 py-1 text-white disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/events/${props.eventId}/calculate`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    assessmentId: props.assessmentId,
                    calendarRevisionId: props.calendarRevisionId,
                    triggerDateId: props.triggerDateId,
                  }),
                },
              );
              const body = (await res.json().catch(() => null)) as {
                id?: string;
                calculatedDeadlineDate?: string;
                error?: { message?: string };
              } | null;
              setMessage(
                res.ok
                  ? `Calculated deadline: ${body?.calculatedDeadlineDate ?? body?.id}`
                  : (body?.error?.message ?? 'Calculate failed'),
              );
              router.refresh();
            });
          }}
        >
          Calculate deadline
        </button>
      ) : null}

      {props.canVerify && props.calculationId ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/deadlines/calculations/${props.calculationId}`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'verify' }),
                },
              );
              setMessage(res.ok ? 'Calculation verified' : 'Verify failed');
              router.refresh();
            });
          }}
        >
          Verify calculation
        </button>
      ) : null}

      {props.canTrack && props.calculationId ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await fetch(
                `/api/projects/${props.projectId}/deadlines/calculations/${props.calculationId}`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'track' }),
                },
              );
              setMessage(res.ok ? 'Deadline tracked' : 'Track failed');
              router.refresh();
            });
          }}
        >
          Track deadline
        </button>
      ) : null}

      {message ? <p className="text-xs text-ink-700">{message}</p> : null}
    </div>
  );
}
