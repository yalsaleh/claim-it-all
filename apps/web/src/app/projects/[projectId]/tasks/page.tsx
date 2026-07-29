import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listTasks } from '@/server/services/operations';
import { prisma } from '@/server/db';

export default async function ProjectTasksPage({
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

  if (!hasCapability(ctx.capabilities, 'operations_dashboard.read')) {
    redirect('/unauthorized');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const tasks = await listTasks(projectId);

  return (
    <Shell>
      <Link
        className="mb-4 inline-block text-sm text-accent-700 underline"
        href={`/projects/${projectId}/operations` as Route}
      >
        Back to operations
      </Link>
      <PageTitle
        title="Operational tasks"
        subtitle="Tasks never mutate notice, deadline, or event legal state."
      />
      <ContextBanner
        organization={tenant?.name ?? ctx.tenantId}
        project={`${ctx.project.code} · ${ctx.project.name}`}
        role={ctx.projectRole ?? ctx.tenantRole}
      />
      <Card>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-700">No tasks.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {tasks.map((task) => (
              <li key={task.id} className="py-3">
                <div className="font-medium text-ink-950">
                  {task.title} · {task.priority}
                </div>
                <p className="text-xs text-ink-600">
                  {task.taskType} · {task.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
