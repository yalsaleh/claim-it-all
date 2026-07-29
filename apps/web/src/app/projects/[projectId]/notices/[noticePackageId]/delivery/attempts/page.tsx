import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listDispatchAttempts } from '@/server/services/notice-delivery';

export default async function AttemptsListPage({
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
  if (!hasCapability(ctx.capabilities, 'notice_dispatch.read')) {
    redirect('/unauthorized');
  }

  const attempts = await listDispatchAttempts(projectId, noticePackageId);
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={base as Route}>
          Back to delivery
        </Link>
      </div>
      <PageTitle title="Dispatch attempts" subtitle="Provider accepted → sent → delivered" />
      <Card>
        {attempts.length === 0 ? (
          <p className="text-sm text-ink-600">No attempts recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="border-b border-ink-200 pb-3">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`${base}/attempts/${a.id}` as Route}
                >
                  Attempt #{a.attemptNumber}
                </Link>
                <div className="mt-1 text-ink-700">
                  Status: {a.status} · Channel: {a.channel} · Provider: {a.provider}
                </div>
                {a.providerMessageId ? (
                  <div className="text-xs text-ink-600">Message ID: {a.providerMessageId}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
