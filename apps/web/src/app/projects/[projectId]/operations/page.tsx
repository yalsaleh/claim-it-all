import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getProjectOperationsDashboard, listTimeline } from '@/server/services/operations';
import { prisma } from '@/server/db';

export default async function ProjectOperationsPage({
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

  if (!hasCapability(ctx.capabilities, 'operations_dashboard.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const dashboard = await getProjectOperationsDashboard(projectId);
  const timeline = await listTimeline(projectId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}`}
      >
        Back to project
      </Link>
      <PageTitle
        title="Operations dashboard"
        subtitle="Authoritative counts only — no composite health scores or predicted outcomes."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={`${ctx.project.code} · ${ctx.project.name}`}
        role={ctx.projectRole ?? ctx.tenantRole}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm"
          href={`/projects/${projectId}/alerts` as Route}
        >
          Alerts
        </Link>
        <Link
          className="rounded-md border border-ink-300 px-3 py-1.5 text-sm"
          href={`/projects/${projectId}/tasks` as Route}
        >
          Tasks
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Counts</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-600">Open alerts</dt>
              <dd className="text-2xl font-semibold">{dashboard.counts.alertsOpen}</dd>
            </div>
            <div>
              <dt className="text-ink-600">Deadlines overdue</dt>
              <dd className="text-2xl font-semibold">{dashboard.counts.deadlinesOverdue}</dd>
            </div>
            <div>
              <dt className="text-ink-600">Due within 24h</dt>
              <dd className="text-2xl font-semibold">{dashboard.counts.deadlinesDueWithin24h}</dd>
            </div>
            <div>
              <dt className="text-ink-600">Notices awaiting review</dt>
              <dd className="text-2xl font-semibold">{dashboard.counts.noticesAwaitingReview}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-600">
            Last sync: {dashboard.lastSuccessfulSyncAt ?? 'none recorded'}
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-ink-700">No timeline events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {timeline.slice(0, 8).map((event) => (
                <li key={event.id} className="border-b border-ink-100 pb-2">
                  <span className="font-medium">{event.summary}</span>
                  <span className="block text-xs text-ink-600">
                    {event.occurredAt.toISOString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
