import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { CalendarActions } from '@/components/deadlines/calendar-actions';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listProjectCalendars } from '@/server/services/deadlines';

export default async function ProjectCalendarsPage({
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

  const items = await listProjectCalendars(projectId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}`}
      >
        Back to project
      </Link>
      <PageTitle
        title="Project calendars"
        subtitle="Approved calendar revisions are immutable inputs for the deadline engine."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {items.length === 0 ? (
            <p className="text-sm text-ink-700">No calendars yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((cal) => (
                <li key={cal.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium text-ink-950">{cal.name}</span>
                  <span className="block text-ink-600">
                    {cal.status} · {cal.timezone}
                    {cal.currentRevision
                      ? ` · Rev ${cal.currentRevision.revisionNumber} (${cal.currentRevision.status})`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Manage</h2>
          <CalendarActions
            projectId={projectId}
            defaultTimezone={ctx.project.timezone}
            canManage={hasCapability(ctx.capabilities, 'project_calendar.manage')}
            canApprove={hasCapability(ctx.capabilities, 'project_calendar.approve')}
          />
        </Card>
      </div>
    </Shell>
  );
}
