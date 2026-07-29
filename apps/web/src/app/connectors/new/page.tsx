import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { CreateConnectorForm } from '@/components/connectors/create-connector-form';
import { AppError } from '@/server/errors';
import { requireTenantMembership } from '@/server/authz/context';
import { prisma } from '@/server/db';

export default async function NewConnectorPage() {
  let ctx;
  try {
    ctx = await requireTenantMembership();
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/select-organization');
  }

  if (!hasCapability(ctx.capabilities, 'connector_account.create')) {
    redirect('/unauthorized');
  }

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
      <PageTitle title="New connector" subtitle="Configure an import-only connector account." />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={null}
        role={ctx.tenantRole}
      />
      <Card>
        <CreateConnectorForm />
      </Card>
    </Shell>
  );
}
