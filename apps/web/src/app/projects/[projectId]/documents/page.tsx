import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listProjectDocuments } from '@/server/services/documents';

export default async function ProjectDocumentsPage({
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

  if (!hasCapability(ctx.capabilities, 'document.read')) {
    redirect('/unauthorized');
  }

  const { items } = await listProjectDocuments(projectId, { limit: 50 });
  const canUpload = hasCapability(ctx.capabilities, 'document.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href={`/projects/${projectId}`}>
          Back to project
        </Link>
        {canUpload ? (
          <Link
            className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white"
            href={`/projects/${projectId}/documents/upload` as Route}
          >
            Upload document
          </Link>
        ) : null}
      </div>
      <PageTitle
        title="Project documents"
        subtitle="Immutable source evidence with processing provenance. No entitlement conclusions are drawn here."
      />
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-ink-700">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-ink-600">
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Malware</th>
                  <th className="py-2 pr-3 font-medium">Processing</th>
                  <th className="py-2 font-medium">Language</th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <tr key={doc.id} className="border-b border-ink-100">
                    <td className="py-3 pr-3">
                      <Link
                        className="font-medium text-accent-700 underline"
                        href={`/projects/${projectId}/documents/${doc.id}` as Route}
                      >
                        {doc.title}
                      </Link>
                      {doc.documentNumber ? (
                        <div className="text-xs text-ink-600">{doc.documentNumber}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">{doc.documentType}</td>
                    <td className="py-3 pr-3">{doc.status}</td>
                    <td className="py-3 pr-3">{doc.currentVersion?.malwareScanStatus ?? '—'}</td>
                    <td className="py-3 pr-3">{doc.currentVersion?.processingStatus ?? '—'}</td>
                    <td className="py-3">{doc.language}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
