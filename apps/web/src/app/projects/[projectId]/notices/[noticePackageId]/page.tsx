import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { NoticeWorkflowButtons } from '@/components/notices/notice-workflow-buttons';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getNoticePackage } from '@/server/services/notices';

function statusLabel(status: string): string {
  if (status === 'APPROVED' || status === 'EXPORTED') return 'Approved for export';
  return status.replace(/_/g, ' ').toLowerCase();
}

export default async function NoticePackagePage({
  params,
}: {
  params: Promise<{ projectId: string; noticePackageId: string }>;
}) {
  const { projectId, noticePackageId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'notice_package.read')) {
    redirect('/unauthorized');
  }

  const pkg = await getNoticePackage(projectId, noticePackageId);
  const latestRevision = pkg.draftRevisions[0];
  const assessment = pkg.completenessAssessments[0];
  const previewSections = (
    pkg.activeApprovedRevision?.sections?.length
      ? pkg.activeApprovedRevision.sections
      : (latestRevision?.sections ?? [])
  )
    .filter((s) => !s.internalOnly)
    .slice(0, 5);

  return (
    <Shell>
      <div className="mb-4">
        <Link
          className="text-sm text-accent-700 underline"
          href={`/projects/${projectId}/notices` as Route}
        >
          Back to notices
        </Link>
      </div>
      <PageTitle
        title={pkg.title}
        subtitle={`${pkg.noticeType} · ${statusLabel(pkg.status)} · Controlled delivery available`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Overview</h2>
          <dl className="space-y-2 text-sm text-ink-700">
            <div>
              <dt className="font-medium text-ink-950">Status</dt>
              <dd>{statusLabel(pkg.status)}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Language</dt>
              <dd>
                {pkg.language}
                {pkg.secondaryLanguage ? ` / ${pkg.secondaryLanguage}` : ''}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Evidence completeness</dt>
              <dd>{assessment?.completenessStatus ?? 'NOT_ASSESSED'}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Latest draft revision</dt>
              <dd>
                {latestRevision
                  ? `#${latestRevision.revisionNumber} (${latestRevision.status})`
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Approved revision</dt>
              <dd>{pkg.activeApprovedRevisionId ? 'Yes — approved for export' : 'None'}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Workflow</h2>
          <NoticeWorkflowButtons
            projectId={projectId}
            noticePackageId={noticePackageId}
            revisionId={latestRevision?.id}
            canAssess={hasCapability(ctx.capabilities, 'notice_evidence.assess')}
            canGenerate={hasCapability(ctx.capabilities, 'notice_draft.generate')}
            canSubmit={hasCapability(ctx.capabilities, 'notice_draft.submit')}
            canApprove={hasCapability(ctx.capabilities, 'notice_draft.approve')}
            canExport={hasCapability(ctx.capabilities, 'notice_export.generate')}
          />
          {hasCapability(ctx.capabilities, 'notice_dispatch.read') ? (
            <p className="mt-4">
              <Link
                className="text-sm text-accent-700 underline"
                href={`/projects/${projectId}/notices/${noticePackageId}/delivery` as Route}
              >
                Open controlled delivery
              </Link>
            </p>
          ) : null}
          <p className="mt-4 text-xs text-ink-600">
            Exports exclude internal comments and provider metadata. Sending requires human
            authorization in the delivery workflow.
          </p>
        </Card>
      </div>
      {previewSections.length > 0 ? (
        <div className="mt-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Draft sections (preview)</h2>
            <ul className="space-y-4 text-sm">
              {previewSections.map((s) => (
                <li key={s.id}>
                  <div className="font-medium text-ink-950">{s.heading}</div>
                  <p className="mt-1 whitespace-pre-wrap text-ink-700">{s.body.slice(0, 400)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </Shell>
  );
}
