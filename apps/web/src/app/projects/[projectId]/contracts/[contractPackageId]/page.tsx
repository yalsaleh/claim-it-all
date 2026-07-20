import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ContractPackageActions } from '@/components/contracts/package-actions';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { getContractPackage, listPackageClauses } from '@/server/services/contracts';

export default async function ContractPackageDetailPage({
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

  const pkg = await getContractPackage(projectId, contractPackageId);
  const clauses = await listPackageClauses(projectId, contractPackageId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/contracts` as Route}
      >
        Back to contracts
      </Link>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title={pkg.name}
        subtitle={`Status ${pkg.status}. Structured rules are not active until an authorized approver confirms a revision.`}
      />
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink-900">Overview</h2>
          <dl className="space-y-1 text-sm text-ink-700">
            <div>Documents: {pkg.documents.length}</div>
            <div>Clauses: {pkg._count.clauses}</div>
            <div>Obligations: {pkg._count.obligations}</div>
            <div>Notice rules: {pkg._count.noticeRules}</div>
            <div>Open issues: {pkg._count.configurationIssues}</div>
            <div>Analysis runs: {pkg._count.analysisRuns}</div>
            <div>
              Current revision:{' '}
              {pkg.currentConfigurationRevision
                ? `#${pkg.currentConfigurationRevision.revisionNumber} (${pkg.currentConfigurationRevision.status})`
                : 'none'}
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink-900">Actions</h2>
          <ContractPackageActions
            projectId={projectId}
            contractPackageId={contractPackageId}
            canAttach={hasCapability(ctx.capabilities, 'contract_document.attach')}
            canAnalyze={hasCapability(ctx.capabilities, 'contract_structure.run')}
            canSubmit={hasCapability(ctx.capabilities, 'contract_configuration.submit')}
            canApprove={hasCapability(ctx.capabilities, 'contract_configuration.approve')}
          />
        </Card>
      </div>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Attached documents</h2>
        {pkg.documents.length === 0 ? (
          <p className="text-sm text-ink-700">No documents attached yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pkg.documents.map((doc) => (
              <li key={doc.id}>
                {doc.title} · {doc.contractDocumentType} · {doc.status}
                {doc.precedenceRank != null ? ` · rank ${doc.precedenceRank}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Recent clauses</h2>
        {clauses.length === 0 ? (
          <p className="text-sm text-ink-700">No clause suggestions yet. Run structure analysis.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {clauses.slice(0, 20).map((clause) => (
              <li key={clause.id} className="border-b border-ink-100 pb-2">
                <div className="font-medium">
                  {clause.normalizedClauseNumber ?? clause.clauseNumber ?? 'Unnumbered'}{' '}
                  {clause.heading ? `— ${clause.heading}` : ''}
                </div>
                <div className="text-xs text-ink-600">
                  {clause.reviewStatus} · {clause.extractionMethod}
                </div>
                <pre
                  className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-ink-800"
                  dir="auto"
                >
                  {clause.sourceText.slice(0, 400)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
