import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ClauseReviewActions } from '@/components/contracts/clause-review-actions';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { listPackageClauses } from '@/server/services/contracts';

export default async function ContractClausesPage({
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
  if (!hasCapability(ctx.capabilities, 'contract_package.read')) {
    redirect('/unauthorized');
  }
  const canReview = hasCapability(ctx.capabilities, 'contract_structure.review');
  const clauses = await listPackageClauses(projectId, contractPackageId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/contracts/${contractPackageId}` as Route}
      >
        Back to package
      </Link>
      <PageTitle
        title="Clause review"
        subtitle="Source text is immutable. Corrections create revisions and never overwrite extraction."
      />
      <div className="space-y-4">
        {clauses.map((clause) => (
          <Card key={clause.id}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {clause.normalizedClauseNumber ?? clause.clauseNumber ?? 'Unnumbered'}
                </h2>
                <p className="text-xs text-ink-600">
                  {clause.reviewStatus} · checksum {clause.textChecksum.slice(0, 12)}…
                </p>
                <pre
                  className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-ink-50 p-2 text-xs"
                  dir="auto"
                >
                  {clause.sourceText}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs text-ink-600">
                  Normalized / corrected text (if any): {clause.normalizedText ? 'present' : 'none'}
                </p>
                {canReview ? (
                  <ClauseReviewActions
                    projectId={projectId}
                    contractPackageId={contractPackageId}
                    clauseId={clause.id}
                  />
                ) : (
                  <p className="text-sm text-ink-700">Read-only</p>
                )}
              </div>
            </div>
          </Card>
        ))}
        {clauses.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-700">No clauses yet.</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
