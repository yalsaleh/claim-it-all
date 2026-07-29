import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { CreateProjectForm } from '@/components/create-project-form';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { listProjectsForActiveTenant } from '@/server/services/projects';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  let ctx;
  try {
    ctx = await requireTenantMembership();
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      redirect('/login');
    }
    redirect('/select-organization');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const projects = await listProjectsForActiveTenant();
  const canCreate = hasCapability(ctx.capabilities, 'project.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href="/select-organization">
          Switch organization
        </Link>
        <LogoutButton />
      </div>
      <PageTitle
        title="Projects"
        subtitle="Authorized projects for the selected organization. This view intentionally excludes entitlement analytics."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {hasCapability(ctx.capabilities, 'portfolio.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium"
            href={'/portfolio' as Route}
          >
            Portfolio
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'connector_account.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium"
            href={'/connectors' as Route}
          >
            Connectors
          </Link>
        ) : null}
        {hasCapability(ctx.capabilities, 'internal_notification.read') ? (
          <Link
            className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium"
            href={'/notifications' as Route}
          >
            Notifications
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Project list</h2>
          {projects.length === 0 ? (
            <p className="text-ink-700">No projects are visible with your current access.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {projects.map((project) => (
                <li key={project.id} className="py-3">
                  <Link
                    className="font-medium text-accent-700 hover:underline"
                    href={`/projects/${project.id}`}
                  >
                    {project.name}
                  </Link>
                  <p className="text-sm text-ink-700">
                    {project.code} · {project.status} · {project.countryCode} ·{' '}
                    {project.defaultCurrency}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Create project</h2>
          {canCreate ? (
            <CreateProjectForm />
          ) : (
            <p className="text-ink-700">You do not have permission to create projects.</p>
          )}
        </Card>
      </div>
    </Shell>
  );
}
