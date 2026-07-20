import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { EntityReviewActions } from '@/components/contracts/entity-review-actions';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { listPackageNoticeRules } from '@/server/services/contracts';

export default async function ContractNoticeRulesPage({
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
  const items = await listPackageNoticeRules(projectId, contractPackageId);

  return (
    <Shell>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title="Notice-rule review"
        subtitle="Structured rules are not active until an approved configuration revision exists."
      />
      <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-ink-800">
        Structured rules are not active until approved.
      </p>
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="text-sm font-medium">
              {item.durationValue != null ? String(item.durationValue) : '—'}{' '}
              {item.durationUnit ?? 'no numeric unit'}
            </div>
            <p className="text-xs text-ink-600">
              {item.reviewStatus} · {item.timeBarClassification} · {item.ambiguityStatus}
            </p>
            <p className="mt-2 text-xs text-ink-700" dir="auto">
              {item.obligation.actionDescription.slice(0, 400)}
            </p>
            {canReview ? (
              <div className="mt-3">
                <EntityReviewActions
                  projectId={projectId}
                  contractPackageId={contractPackageId}
                  endpoint="notice-rules"
                  idField="noticeRuleId"
                  entityId={item.id}
                />
              </div>
            ) : null}
          </Card>
        ))}
        {items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-700">No notice-rule candidates yet.</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
