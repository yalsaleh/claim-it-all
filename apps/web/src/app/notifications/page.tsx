import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { listInternalNotifications } from '@/server/services/operations';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  let ctx;
  try {
    ctx = await requireTenantMembership();
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/select-organization');
  }

  if (!hasCapability(ctx.capabilities, 'internal_notification.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const notifications = await listInternalNotifications();

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href="/projects">
          Projects
        </Link>
        <LogoutButton />
      </div>
      <PageTitle
        title="Notifications"
        subtitle="In-app notifications only — never used for contractual notice dispatch."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />
      <Card>
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-700">No notifications.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {notifications.map((n) => (
              <li key={n.id} className="py-3">
                <div className="font-medium text-ink-950">{n.title}</div>
                <p className="text-sm text-ink-700">{n.body.slice(0, 160)}</p>
                <p className="text-xs text-ink-600">{n.status}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
