import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { listConnectorAccounts } from '@/server/services/connectors';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function ConnectorsPage() {
  let ctx;
  try {
    ctx = await requireTenantMembership();
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/select-organization');
  }

  if (!hasCapability(ctx.capabilities, 'connector_account.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const accounts = await listConnectorAccounts();
  const canCreate = hasCapability(ctx.capabilities, 'connector_account.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href="/projects">
          Projects
        </Link>
        <LogoutButton />
      </div>
      <PageTitle
        title="Connectors"
        subtitle="Import-only external sources — never auto-confirms events or sends notices."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />
      {canCreate ? (
        <div className="mb-4">
          <Link
            className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white"
            href={'/connectors/new' as Route}
          >
            New connector
          </Link>
        </div>
      ) : null}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Connector accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-700">No connector accounts configured.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {accounts.map((account) => (
              <li key={account.id} className="py-3">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`/connectors/${account.id}` as Route}
                >
                  {account.displayName}
                </Link>
                <p className="text-sm text-ink-700">
                  {account.provider} · {account.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
