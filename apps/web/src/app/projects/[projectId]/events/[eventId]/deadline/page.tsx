import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import {
  getProjectEvent,
  listProjectCalendars,
  listEventCalculations,
} from '@/server/services/deadlines';

export default async function ProjectEventDeadlinePage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'project_event.read')) {
    redirect('/unauthorized');
  }

  const event = await getProjectEvent(projectId, eventId);
  const calendars = await listProjectCalendars(projectId);
  const calculations = await listEventCalculations(projectId, eventId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/events/${eventId}` as Route}
      >
        Back to event
      </Link>
      <PageTitle
        title="Deadline analysis"
        subtitle="Deterministic calculation from approved rules, verified dates, and approved calendar."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Workflow status</h2>
          <dl className="space-y-2 text-sm text-ink-700" dir="auto">
            <div>
              <dt className="font-medium text-ink-950">Event confirmation</dt>
              <dd>{event.confirmationStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Verified trigger dates</dt>
              <dd>
                {
                  event.dates.filter(
                    (d) =>
                      d.verificationStatus === 'VERIFIED' &&
                      (d.precision === 'EXACT_DATE' || d.precision === 'EXACT_DATETIME'),
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Approved calendars</dt>
              <dd>{calendars.filter((c) => c.status === 'APPROVED').length}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Calculations</h2>
          {calculations.length === 0 ? (
            <p className="text-sm text-ink-700">No calculations yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {calculations.map((calc) => (
                <li key={calc.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium text-ink-950">{calc.calculationStatus}</span>
                  <span className="block text-ink-600">
                    Deadline {calc.calculatedDeadlineDate ?? '—'} · v{calc.calculationVersion}
                  </span>
                  {calc.milestones.length > 0 ? (
                    <ul className="mt-2 text-xs text-ink-600">
                      {calc.milestones.map((m) => (
                        <li key={m.id}>
                          {m.classification}: {m.label} ({m.dueDate ?? '—'})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
