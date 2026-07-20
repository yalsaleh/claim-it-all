import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { getContractPackage } from '@/server/services/contracts';

export default async function ContractStructurePage({
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
  const pkg = await getContractPackage(projectId, contractPackageId);

  return (
    <Shell>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title="Structure analysis"
        subtitle="Deterministic extraction first. AI suggestions (if configured) never auto-approve."
      />
      <Card>
        <dl className="space-y-1 text-sm text-ink-700">
          <div>Package status: {pkg.status}</div>
          <div>Documents: {pkg.documents.length}</div>
          <div>Clauses: {pkg._count.clauses}</div>
          <div>Obligations: {pkg._count.obligations}</div>
          <div>Notice rules: {pkg._count.noticeRules}</div>
          <div>Issues: {pkg._count.configurationIssues}</div>
          <div>Analysis runs: {pkg._count.analysisRuns}</div>
        </dl>
        <p className="mt-3 text-xs text-ink-600">
          Start analysis from the package overview. Counts reflect persisted suggestions and
          MACHINE_SUGGESTED entities — not completion percentages.
        </p>
      </Card>
    </Shell>
  );
}
