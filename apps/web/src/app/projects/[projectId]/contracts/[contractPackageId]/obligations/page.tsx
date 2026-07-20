import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { EntityReviewActions } from '@/components/contracts/entity-review-actions';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { listPackageObligations } from '@/server/services/contracts';

export default async function ContractObligationsPage({
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
  const canReview = hasCapability(ctx.capabilities, 'contract_structure.review');
  const items = await listPackageObligations(projectId, contractPackageId);

  return (
    <Shell>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title="Obligation review"
        subtitle="Machine interpretation stays distinct from human-approved interpretation."
      />
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="text-sm font-medium">
              {item.obligationType} · clause{' '}
              {item.sourceClause.clauseNumber ?? item.sourceClause.id}
            </div>
            <p className="mt-1 text-xs text-ink-600">
              {item.reviewStatus}
              {item.timingExpression ? ` · timing: ${item.timingExpression}` : ''}
              {item.isConditionPrecedentCandidate ? ' · CP candidate' : ''}
              {item.isTimeBarredCandidate ? ' · time-bar candidate' : ''}
            </p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs" dir="auto">
              {item.actionDescription}
            </pre>
            {item.machineInterpretation ? (
              <p className="mt-2 text-xs text-ink-600">Machine: {item.machineInterpretation}</p>
            ) : null}
            {canReview ? (
              <div className="mt-3">
                <EntityReviewActions
                  projectId={projectId}
                  contractPackageId={contractPackageId}
                  endpoint="obligations"
                  idField="obligationId"
                  entityId={item.id}
                />
              </div>
            ) : null}
          </Card>
        ))}
        {items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-700">No obligation suggestions yet.</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
