import Link from 'next/link';
import type { Route } from 'next';
import { CreateContractPackageForm } from '@/components/contracts/create-package-form';
import { Shell, PageTitle } from '@/components/ui';

export default async function NewContractPackagePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/contracts` as Route}
      >
        Back to contracts
      </Link>
      <PageTitle
        title="Create contract package"
        subtitle="A package groups governing documents for human configuration. No entitlement detection runs here."
      />
      <CreateContractPackageForm projectId={projectId} />
    </Shell>
  );
}
