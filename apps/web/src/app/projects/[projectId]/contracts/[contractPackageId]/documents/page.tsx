import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { ContractPackageNav } from '@/components/contracts/package-nav';
import { Card, PageTitle, Shell } from '@/components/ui';
import { requireProjectAccess } from '@/server/authz/context';
import { AppError } from '@/server/errors';
import { getContractPackage } from '@/server/services/contracts';

export default async function ContractDocumentsPage({
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
        title="Contract documents"
        subtitle="Attachments are not legally operative until reviewed. Precedence is candidate until approved."
      />
      <Card>
        {pkg.documents.length === 0 ? (
          <p className="text-sm text-ink-700">
            No documents attached.{' '}
            <Link className="underline" href={`/projects/${projectId}/documents` as Route}>
              Ingest documents first
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {pkg.documents.map((doc) => (
              <li key={doc.id} className="border-b border-ink-100 pb-2">
                <div className="font-medium">{doc.title}</div>
                <div className="text-xs text-ink-600">
                  {doc.contractDocumentType} · {doc.language} · {doc.status}
                  {doc.precedenceRank != null ? ` · precedence rank ${doc.precedenceRank}` : ''}
                  {doc.isExecuted ? ' · executed' : ' · not marked executed'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
