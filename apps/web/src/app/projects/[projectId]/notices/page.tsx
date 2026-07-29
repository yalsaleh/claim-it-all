import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listNoticePackages } from '@/server/services/notices';

export default async function ProjectNoticesPage({
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
  if (!hasCapability(ctx.capabilities, 'notice_package.read')) {
    redirect('/unauthorized');
  }

  const packages = await listNoticePackages(projectId);

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={`/projects/${projectId}`}>
          Back to project
        </Link>
      </div>
      <PageTitle
        title="Notice packages"
        subtitle="Draft, review, and export notices — export-only in this slice; no automatic sending."
      />
      <Card>
        {packages.length === 0 ? (
          <p className="text-sm text-ink-700">
            No notice packages yet. Create one from a verified deadline.
          </p>
        ) : (
          <ul className="space-y-3">
            {packages.map((pkg) => (
              <li key={pkg.id} className="border-b border-ink-100 pb-3 text-sm">
                <Link
                  className="font-medium text-accent-700 underline"
                  href={`/projects/${projectId}/notices/${pkg.id}` as Route}
                >
                  {pkg.title}
                </Link>
                <div className="mt-1 text-xs text-ink-600">
                  {pkg.noticeType} · {pkg.status} · {pkg.language}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
