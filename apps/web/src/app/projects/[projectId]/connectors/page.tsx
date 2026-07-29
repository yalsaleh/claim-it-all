import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getExternalRecords, listProjectConnectorScopes } from '@/server/services/connectors';
import { prisma } from '@/server/db';

export default async function ProjectConnectorsPage({
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

  if (!hasCapability(ctx.capabilities, 'connector_account.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const scopes = await listProjectConnectorScopes(projectId);
  const imports = hasCapability(ctx.capabilities, 'connector_sync.read')
    ? await getExternalRecords(projectId)
    : [];

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}`}
      >
        Back to project
      </Link>
      <PageTitle
        title="Project connectors"
        subtitle="Import-only scopes and external record imports."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={`${ctx.project.code} · ${ctx.project.name}`}
        role={ctx.projectRole ?? ctx.tenantRole}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Active scopes</h2>
          {scopes.length === 0 ? (
            <p className="text-sm text-ink-700">No connector scopes for this project.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scopes.map((scope) => (
                <li key={scope.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium">{scope.connectorAccount.displayName}</span>
                  <span className="block text-ink-600">
                    {scope.externalMailboxOrFolder} · {scope.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Imported records</h2>
          {imports.length === 0 ? (
            <p className="text-sm text-ink-700">No external records imported yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {imports.slice(0, 20).map((record) => (
                <li key={record.id} className="border-b border-ink-100 pb-2">
                  <span className="font-medium">
                    {record.subjectOrTitle ?? record.externalRecordId}
                  </span>
                  <span className="block text-xs text-ink-600">
                    {record.importStatus} · {record.recordType}
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
