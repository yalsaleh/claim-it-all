import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { ConnectorActions } from '@/components/connectors/connector-actions';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { getConnectorAccount } from '@/server/services/connectors';
import { prisma } from '@/server/db';

export default async function ConnectorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const account = await getConnectorAccount(id);
  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={'/connectors' as Route}
      >
        Back to connectors
      </Link>
      <PageTitle
        title={account.displayName}
        subtitle={`Provider ${account.provider} · ${account.status}`}
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Details</h2>
          <dl className="space-y-2 text-sm text-ink-700">
            <div>
              <dt className="font-medium text-ink-950">Type</dt>
              <dd>{account.connectorType}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Secret reference</dt>
              <dd className="font-mono text-xs">{account.secretReference}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Last validated</dt>
              <dd>{account.lastValidatedAt?.toISOString() ?? '—'}</dd>
            </div>
          </dl>
          <ConnectorActions
            connectorId={account.id}
            status={account.status}
            canValidate={hasCapability(ctx.capabilities, 'connector_account.validate')}
            canApprove={hasCapability(ctx.capabilities, 'connector_account.approve')}
            canDisable={hasCapability(ctx.capabilities, 'connector_account.disable')}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Project scopes</h2>
          {account.scopes.length === 0 ? (
            <p className="text-sm text-ink-700">
              No scopes yet. Create one from a project workspace.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {account.scopes.map((scope) => (
                <li key={scope.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium">{scope.externalMailboxOrFolder}</span>
                  <span className="block text-ink-600">
                    Project {scope.projectId.slice(0, 8)}… · {scope.status}
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
