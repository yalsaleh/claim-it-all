import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listContractPackages } from '@/server/services/contracts';

export default async function ProjectContractsPage({
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
  if (!hasCapability(ctx.capabilities, 'contract_package.read')) {
    redirect('/unauthorized');
  }

  const items = await listContractPackages(projectId);
  const canCreate = hasCapability(ctx.capabilities, 'contract_package.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href={`/projects/${projectId}`}>
          Back to project
        </Link>
        {canCreate ? (
          <Link
            className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white"
            href={`/projects/${projectId}/contracts/new` as Route}
          >
            New contract package
          </Link>
        ) : null}
      </div>
      <PageTitle
        title="Contract packages"
        subtitle="Human-reviewed contract configuration. Structured rules are not active until approved."
      />
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-ink-700">No contract packages yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((pkg) => (
              <li key={pkg.id} className="border-b border-ink-100 pb-3">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`/projects/${projectId}/contracts/${pkg.id}` as Route}
                >
                  {pkg.name}
                </Link>
                <div className="mt-1 text-xs text-ink-600">
                  Status {pkg.status} · Documents {pkg._count.documents} · Clauses{' '}
                  {pkg._count.clauses} · Issues {pkg._count.configurationIssues}
                  {pkg.currentConfigurationRevision
                    ? ` · Approved rev ${pkg.currentConfigurationRevision.revisionNumber}`
                    : ' · No approved revision'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
