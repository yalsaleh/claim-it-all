import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { CreateProjectEventForm } from '@/components/deadlines/create-event-form';
import { Shell, PageTitle } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { hasCapability } from '@contractradar/authz';

export default async function NewProjectEventPage({
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
  if (!hasCapability(ctx.capabilities, 'project_event.create')) {
    redirect('/unauthorized');
  }

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/events` as Route}
      >
        Back to events
      </Link>
      <PageTitle
        title="Create project event"
        subtitle="Record a human-confirmed factual event for deadline analysis."
      />
      <CreateProjectEventForm projectId={projectId} defaultTimezone={ctx.project.timezone} />
    </Shell>
  );
}
