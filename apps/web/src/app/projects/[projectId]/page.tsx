import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { UpdateProjectForm } from '@/components/update-project-form';
import { AddMemberForm } from '@/components/add-member-form';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listProjectMembers } from '@/server/services/projects';
import { prisma } from '@/server/db';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      redirect('/login');
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      redirect('/select-organization');
    }
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const members = hasCapability(ctx.capabilities, 'project.members.read')
    ? await listProjectMembers(projectId)
    : [];

  const canUpdate = hasCapability(ctx.capabilities, 'project.update');
  const canManageMembers = hasCapability(ctx.capabilities, 'project.members.manage');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href="/projects">
          Back to projects
        </Link>
        <LogoutButton />
      </div>
      <PageTitle
        title={ctx.project.name}
        subtitle="Project workspace — upload immutable evidence and inspect processing provenance."
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white"
          href={`/projects/${projectId}/documents` as Route}
        >
          Project documents
        </Link>
        {hasCapability(ctx.capabilities, 'contract_package.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
            href={`/projects/${projectId}/contracts` as Route}
          >
            Contract packages
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'project_event.read') ? (
          <>
            <Link
              className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
              href={`/projects/${projectId}/events` as Route}
            >
              Project events
            </Link>
            <Link
              className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
              href={`/projects/${projectId}/deadlines` as Route}
            >
              Deadlines
            </Link>
            <Link
              className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
              href={`/projects/${projectId}/calendars` as Route}
            >
              Calendars
            </Link>
          </>
        ) : null}
        {hasCapability(ctx.capabilities, 'detection_run.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
            href={`/projects/${projectId}/detections` as Route}
          >
            Event detections
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'notice_package.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
            href={`/projects/${projectId}/notices` as Route}
          >
            Notices
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'operations_dashboard.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
            href={`/projects/${projectId}/operations` as Route}
          >
            Operations
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'connector_account.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-900"
            href={`/projects/${projectId}/connectors` as Route}
          >
            Connectors
          </Link>
        ) : null}
      </div>
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={`${ctx.project.code} · ${ctx.project.name}`}
        role={ctx.projectRole ?? ctx.tenantRole}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Details</h2>
          <dl className="space-y-2 text-sm text-ink-700">
            <div>
              <dt className="font-medium text-ink-950">Status</dt>
              <dd>{ctx.project.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Country / currency</dt>
              <dd>
                {ctx.project.countryCode} / {ctx.project.defaultCurrency}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Timezone</dt>
              <dd>{ctx.project.timezone}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Description</dt>
              <dd>{ctx.project.description || '—'}</dd>
            </div>
          </dl>
          {canUpdate ? (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <UpdateProjectForm
                projectId={ctx.project.id}
                defaultName={ctx.project.name}
                defaultDescription={ctx.project.description ?? ''}
                defaultStatus={ctx.project.status}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-700">Read-only access for this project.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Members</h2>
          {members.length === 0 ? (
            <p className="text-sm text-ink-700">No members to display.</p>
          ) : (
            <ul className="mb-4 space-y-2 text-sm">
              {members.map((member) => (
                <li key={member.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium text-ink-950">{member.user.name}</span>
                  <span className="block text-ink-700">
                    {member.user.email} · {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManageMembers ? <AddMemberForm projectId={ctx.project.id} /> : null}
        </Card>
      </div>
    </Shell>
  );
}
