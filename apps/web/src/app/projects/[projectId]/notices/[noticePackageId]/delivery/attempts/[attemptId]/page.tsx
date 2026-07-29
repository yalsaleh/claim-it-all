import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getDispatchAttempt } from '@/server/services/notice-delivery';

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; noticePackageId: string; attemptId: string }>;
}) {
  const { projectId, noticePackageId, attemptId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'notice_dispatch.read')) {
    redirect('/unauthorized');
  }

  const attempt = await getDispatchAttempt(projectId, noticePackageId, attemptId);
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={`${base}/attempts` as Route}>
          Back to attempts
        </Link>
      </div>
      <PageTitle
        title={`Attempt #${attempt.attemptNumber}`}
        subtitle={`${attempt.status} · ${attempt.channel}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Attempt</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Provider outcome</dt>
              <dd>{attempt.status}</dd>
            </div>
            <div>
              <dt className="font-medium">Provider</dt>
              <dd>{attempt.provider}</dd>
            </div>
            {attempt.providerMessageId ? (
              <div>
                <dt className="font-medium">Provider message ID</dt>
                <dd className="break-all">{attempt.providerMessageId}</dd>
              </div>
            ) : null}
            {attempt.manualDispatchRecord ? (
              <div>
                <dt className="font-medium">Manual record</dt>
                <dd>
                  {attempt.manualDispatchRecord.method} at{' '}
                  {attempt.manualDispatchRecord.dispatchAt.toISOString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Recipients</h2>
          <ul className="space-y-3 text-sm">
            {attempt.recipients.map((r) => (
              <li key={r.id}>
                <div className="font-medium">{r.displayName}</div>
                <div className="text-ink-700">
                  {r.status}
                  {r.sentAt ? ` · sent ${r.sentAt.toISOString()}` : ''}
                  {r.deliveredAt ? ` · delivered ${r.deliveredAt.toISOString()}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {attempt.receiptAssessments.length > 0 ? (
        <div className="mt-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Receipt assessments</h2>
            <ul className="space-y-2 text-sm">
              {attempt.receiptAssessments.map((ra) => (
                <li key={ra.id}>
                  {ra.receiptStatus} · contractual: {ra.contractualServiceStatus}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </Shell>
  );
}
