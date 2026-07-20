'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function CalendarActions(props: {
  projectId: string;
  canManage: boolean;
  canApprove: boolean;
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [calendarId, setCalendarId] = useState('');
  const [revisionId, setRevisionId] = useState('');
  const [name, setName] = useState('Project working calendar');

  return (
    <div className="space-y-3 text-sm" dir="auto">
      {props.canManage ? (
        <div className="space-y-2 rounded-md border border-ink-100 p-3">
          <p className="font-medium text-ink-950">Create calendar</p>
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !name.trim()}
            className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(`/api/projects/${props.projectId}/calendars`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    name,
                    timezone: props.defaultTimezone,
                    weekendDays: [5, 6],
                  }),
                });
                const body = (await res.json().catch(() => null)) as {
                  id?: string;
                  error?: { message?: string };
                } | null;
                if (res.ok && body?.id) setCalendarId(body.id);
                setMessage(res.ok ? `Calendar created: ${body?.id}` : 'Create failed');
                router.refresh();
              });
            }}
          >
            Create calendar
          </button>
        </div>
      ) : null}

      {props.canManage ? (
        <div className="space-y-2 rounded-md border border-ink-100 p-3">
          <p className="font-medium text-ink-950">Create revision (Fri–Sat weekend)</p>
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Calendar UUID"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !calendarId}
            className="rounded-md border border-ink-300 px-3 py-1 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/calendars/${calendarId}/revisions`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      weekendDays: [5, 6],
                      holidays: [],
                      specialWorkingDays: [],
                    }),
                  },
                );
                const body = (await res.json().catch(() => null)) as {
                  id?: string;
                  error?: { message?: string };
                } | null;
                if (res.ok && body?.id) setRevisionId(body.id);
                setMessage(res.ok ? `Revision created: ${body?.id}` : 'Revision failed');
                router.refresh();
              });
            }}
          >
            Create revision
          </button>
        </div>
      ) : null}

      {props.canApprove ? (
        <div className="space-y-2 rounded-md border border-ink-100 p-3">
          <p className="font-medium text-ink-950">Approve revision</p>
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Calendar UUID"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-ink-200 px-2 py-1"
            placeholder="Revision UUID"
            value={revisionId}
            onChange={(e) => setRevisionId(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !calendarId || !revisionId}
            className="rounded-md bg-accent-700 px-3 py-1 text-white disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await fetch(
                  `/api/projects/${props.projectId}/calendars/${calendarId}/revisions`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'approve', revisionId }),
                  },
                );
                setMessage(res.ok ? 'Revision approved' : 'Approve failed');
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
