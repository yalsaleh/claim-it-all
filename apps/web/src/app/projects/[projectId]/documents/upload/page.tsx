import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { DocumentUploadForm } from '@/components/document-upload-form';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';

export default async function DocumentUploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'document.create')) {
    redirect('/unauthorized');
  }

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/documents` as Route}
      >
        Back to documents
      </Link>
      <PageTitle
        title="Upload project evidence"
        subtitle="Files upload directly to private object storage. Acceptance requires server-side verification; malware status stays explicit."
      />
      <Card>
        <DocumentUploadForm projectId={projectId} />
      </Card>
    </Shell>
  );
}
