import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listProjectDeadlines } from '@/server/services/deadlines';

export default async function ProjectDeadlinesPage({
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
  if (!hasCapability(ctx.capabilities, 'project_event.read')) {
    redirect('/unauthorized');
  }

  const items = await listProjectDeadlines(projectId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}`}
      >
        Back to project
      </Link>
      <PageTitle
        title="Tracked deadlines"
        subtitle="Deadlines derived from verified calculations — contractual dates are never altered by internal warnings."
      />
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-ink-700" dir="auto">
            No tracked deadlines yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((deadline) => (
              <li key={deadline.id} className="border-b border-ink-100 pb-3">
                <p className="font-medium text-ink-950" dir="auto">
                  {deadline.title}
                </p>
                <div className="mt-1 text-xs text-ink-600">
                  {deadline.status} · {deadline.deadlineType} · Due{' '}
                  {deadline.dueAt?.toISOString() ?? '—'} · Event {deadline.projectEvent.title}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
