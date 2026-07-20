import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ContractPackageActions } from '@/components/contracts/package-actions';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { getContractPackage } from '@/server/services/contracts';

export default async function ContractReviewPage({
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
        title="Configuration review"
        subtitle="Submit a revision, then a different authorized approver must approve when segregation of duties is enabled."
      />
      <Card>
        <p className="mb-3 text-sm text-ink-700">
          Current revision:{' '}
          {pkg.currentConfigurationRevision
            ? `#${pkg.currentConfigurationRevision.revisionNumber} (${pkg.currentConfigurationRevision.status})`
            : 'none approved'}
        </p>
        <ContractPackageActions
          projectId={projectId}
          contractPackageId={contractPackageId}
          canAttach={false}
          canAnalyze={false}
          canSubmit={hasCapability(ctx.capabilities, 'contract_configuration.submit')}
          canApprove={hasCapability(ctx.capabilities, 'contract_configuration.approve')}
        />
      </Card>
    </Shell>
  );
}
