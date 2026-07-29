import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { getPortfolioDashboard } from '@/server/services/operations';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  let ctx;
  try {
    ctx = await requireTenantMembership();
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/select-organization');
  }

  if (!hasCapability(ctx.capabilities, 'portfolio.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const portfolio = await getPortfolioDashboard();

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href="/projects">
          Projects
        </Link>
        <LogoutButton />
      </div>
      <PageTitle
        title="Portfolio"
        subtitle="Membership-scoped operational counts — no synthetic health scores."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />
      <Card>
        {portfolio.items.length === 0 ? (
          <p className="text-sm text-ink-700">No projects visible.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {portfolio.items.map(({ project, counts }) => (
              <li key={project.id} className="py-3">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`/projects/${project.id}/operations` as Route}
                >
                  {project.name}
                </Link>
                <p className="text-sm text-ink-700">
                  {project.code} · Alerts {counts.alertsOpen} · Overdue {counts.deadlinesOverdue} ·
                  Review queue {counts.noticesAwaitingReview}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
