import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getNoticePackage } from '@/server/services/notices';
import { listDispatchAttempts } from '@/server/services/notice-delivery';

export default async function DeliveryOverviewPage({
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

  const pkg = await getNoticePackage(projectId, noticePackageId);
  const attempts = await listDispatchAttempts(projectId, noticePackageId);
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;

  const links = [
    { href: `${base}/prepare`, label: 'Prepare dispatch snapshot', cap: 'notice_dispatch.prepare' },
    {
      href: `${base}/authorization`,
      label: 'Authorization checklist',
      cap: 'notice_dispatch.authorize',
    },
    { href: `${base}/attempts`, label: 'Dispatch attempts', cap: 'notice_dispatch.read' },
    { href: `${base}/evidence`, label: 'Upload evidence', cap: 'dispatch_evidence.upload' },
    { href: `${base}/receipt`, label: 'Receipt assessment', cap: 'notice_receipt.assess' },
  ].filter((l) => hasCapability(ctx.capabilities, l.cap as never));

  return (
    <Shell>
      <div className="mb-4">
        <Link
          className="text-sm text-accent-700 underline"
          href={`/projects/${projectId}/notices/${noticePackageId}` as Route}
        >
          Back to notice
        </Link>
      </div>
      <PageTitle
        title="Controlled delivery"
        subtitle={`${pkg.title} · ${pkg.status.replace(/_/g, ' ').toLowerCase()}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Workflow</h2>
          <ul className="space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link className="text-accent-700 underline" href={l.href as Route}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-600">
            Sending requires human authorization. No autonomous resend.
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Recent attempts</h2>
          {attempts.length === 0 ? (
            <p className="text-sm text-ink-600">No dispatch attempts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attempts.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    className="text-accent-700 underline"
                    href={`${base}/attempts/${a.id}` as Route}
                  >
                    Attempt #{a.attemptNumber} — {a.status} ({a.channel})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
