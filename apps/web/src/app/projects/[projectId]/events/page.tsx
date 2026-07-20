import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listProjectEvents } from '@/server/services/deadlines';

export default async function ProjectEventsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
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

  const items = await listProjectEvents(projectId);
  const canCreate = hasCapability(ctx.capabilities, 'project_event.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href={`/projects/${projectId}`}>
          Back to project
        </Link>
        {canCreate ? (
          <Link
            className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white"
            href={`/projects/${projectId}/events/new` as Route}
          >
            New event
          </Link>
        ) : null}
      </div>
      <PageTitle
        title="Project events"
        subtitle="Human-confirmed factual events — not AI-detected entitlements."
      />
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-ink-700" dir="auto">
            No project events yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((event) => (
              <li key={event.id} className="border-b border-ink-100 pb-3">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`/projects/${projectId}/events/${event.id}` as Route}
                  dir="auto"
                >
                  {event.title}
                </Link>
                <div className="mt-1 text-xs text-ink-600">
                  {event.eventCategory} · {event.eventStatus} · {event.confirmationStatus} · Dates{' '}
                  {event._count.dates} · Calculations {event._count.deadlineCalculations}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
