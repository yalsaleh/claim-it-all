import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { EntityReviewActions } from '@/components/contracts/entity-review-actions';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { listPackageIssues } from '@/server/services/contracts';

export default async function ContractIssuesPage({
  params,
}: {
  params: Promise<{ projectId: string; contractPackageId: string }>;
}) {
  const { projectId, contractPackageId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'contract_package.read')) redirect('/unauthorized');
  const canManage = hasCapability(ctx.capabilities, 'contract_issue.manage');
  const items = await listPackageIssues(projectId, contractPackageId);

  return (
    <Shell>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title="Configuration issues"
        subtitle="Unresolved conflicts and missing contract information."
      />
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="text-sm font-medium">
              {item.severity} · {item.category} · {item.status}
            </div>
            <p className="mt-1 text-sm text-ink-700" dir="auto">
              {item.description}
            </p>
            {item.resolution ? (
              <p className="mt-2 text-xs text-ink-600">Resolution: {item.resolution}</p>
            ) : null}
            {canManage && item.status === 'OPEN' ? (
              <div className="mt-3">
                <EntityReviewActions
                  projectId={projectId}
                  contractPackageId={contractPackageId}
                  endpoint="issues"
                  idField="issueId"
                  entityId={item.id}
                  resolveMode
                />
              </div>
            ) : null}
          </Card>
        ))}
        {items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-700">No open or historical issues.</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
