import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { DownloadButton } from '@/components/document-download-button';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import {
  getDocumentProcessing,
  getProjectDocument,
  listEvidenceSegments,
  listIngestionTimeline,
} from '@/server/services/documents';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'document.read')) redirect('/unauthorized');

  const doc = await getProjectDocument(projectId, documentId);
  const canViewProcessing = hasCapability(ctx.capabilities, 'document.processing.view');
  const canDownload = hasCapability(ctx.capabilities, 'document.download');
  const current = doc.versions[0];
  const clean = current?.malwareScanStatus === 'CLEAN' && current.uploadStatus === 'ACCEPTED';

  const processing = canViewProcessing ? await getDocumentProcessing(projectId, documentId) : null;
  const timeline = canViewProcessing ? await listIngestionTimeline(projectId, documentId) : [];
  let segments: Awaited<ReturnType<typeof listEvidenceSegments>> = [];
  if (canViewProcessing && clean) {
    try {
      segments = await listEvidenceSegments(projectId, documentId);
    } catch {
      segments = [];
    }
  }

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/documents` as Route}
      >
        Back to documents
      </Link>
      <PageTitle title={doc.title} subtitle={`${doc.documentType} · ${doc.status}`} />

      <div className="grid gap-6">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Source record</h2>
          <dl className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink-950">Document number</dt>
              <dd>{doc.documentNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Language</dt>
              <dd>{doc.language}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Confidentiality</dt>
              <dd>{doc.confidentiality}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Created by</dt>
              <dd>{doc.createdBy.name}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Immutable file versions</h2>
          <ul className="space-y-3 text-sm">
            {doc.versions.map((version) => (
              <li key={version.id} className="rounded-md border border-ink-100 p-3">
                <div className="font-medium text-ink-950">
                  v{version.versionNumber} · {version.originalFilename}
                </div>
                <div className="mt-1 text-ink-700">
                  {version.mediaType} · {version.sizeBytes} bytes · SHA-256 {version.sha256}
                </div>
                <div className="mt-1 text-ink-700">
                  Upload {version.uploadStatus} · Malware {version.malwareScanStatus} · Processing{' '}
                  {version.processingStatus}
                </div>
                {canDownload &&
                version.uploadStatus === 'ACCEPTED' &&
                version.malwareScanStatus === 'CLEAN' ? (
                  <div className="mt-2">
                    <DownloadButton
                      projectId={projectId}
                      documentId={documentId}
                      versionId={version.id}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-600">
                    Download unavailable until the version is accepted and scanned clean.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {processing ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Processing runs</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              {processing.runs.map((run) => (
                <li key={run.id}>
                  {run.status} · attempt {run.attemptNumber} · {run.processorName}{' '}
                  {run.processorVersion}
                  {run.failureMessageSafe ? ` · ${run.failureMessageSafe}` : ''}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {canViewProcessing ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Evidence segments</h2>
            {!clean ? (
              <p className="text-sm text-ink-700">
                Segments are hidden for unscanned or non-clean files.
              </p>
            ) : segments.length === 0 ? (
              <p className="text-sm text-ink-700">
                No segments yet (processing may still be running).
              </p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {segments.slice(0, 100).map((segment) => (
                  <li key={segment.id} className="border-b border-ink-100 pb-2">
                    <div className="font-medium text-ink-950">
                      {segment.kind}
                      {segment.label ? ` · ${segment.label}` : ''}
                    </div>
                    {segment.textContent ? (
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-ink-700">
                        {segment.textContent.slice(0, 500)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {canViewProcessing ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Ingestion timeline</h2>
            <ol className="space-y-2 text-sm text-ink-700">
              {timeline.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.createdAt.toISOString()}>
                    {event.createdAt.toISOString()}
                  </time>
                  {' · '}
                  {event.eventType}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
