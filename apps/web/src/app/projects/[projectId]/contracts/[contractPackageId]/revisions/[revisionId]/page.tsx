import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { getApprovedConfiguration } from '@/server/services/contracts';

export default async function ContractRevisionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; contractPackageId: string; revisionId: string }>;
}) {
  const { projectId, contractPackageId, revisionId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'contract_package.read')) redirect('/unauthorized');

  let approved: Awaited<ReturnType<typeof getApprovedConfiguration>> | null = null;
  try {
    approved = await getApprovedConfiguration(projectId, contractPackageId);
  } catch {
    approved = null;
  }

  const isThis =
    approved && (approved.revision.id === revisionId || String(approved.revision.revisionNumber));

  return (
    <Shell>
      <ContractPackageNav projectId={projectId} contractPackageId={contractPackageId} />
      <PageTitle
        title={`Revision ${revisionId.slice(0, 8)}…`}
        subtitle="Approved revisions are immutable. Later edits require supersession and a new revision."
      />
      <Card>
        {!approved || approved.revision.id !== revisionId ? (
          <p className="text-sm text-ink-700">
            Only the active approved configuration is exposed read-only here
            {isThis ? '' : ''}. Requested revision may be draft/in-review — use Review to submit or
            approve.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div>
              Revision #{approved.revision.revisionNumber} · {approved.revision.status} · read-only
            </div>
            <div>Verified/corrected clauses: {approved.clauses.length}</div>
            <div>Obligations snapshot count: {approved.obligations.length}</div>
            <div>Notice rules snapshot count: {approved.noticeRules.length}</div>
            <div>Documents: {approved.documents.length}</div>
          </div>
        )}
      </Card>
    </Shell>
  );
}
