import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { StartDetectionRunButton } from '@/components/detections/start-detection-run-button';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listDetectionRuns, listSuggestions } from '@/server/services/detections';

export default async function ProjectDetectionsPage({
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
  if (!hasCapability(ctx.capabilities, 'detection_run.read')) {
    redirect('/unauthorized');
  }

  const runs = await listDetectionRuns(projectId);
  const suggestions = hasCapability(ctx.capabilities, 'event_suggestion.read')
    ? await listSuggestions(projectId)
    : [];
  const canCreate = hasCapability(ctx.capabilities, 'detection_run.create');

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-accent-700 underline" href={`/projects/${projectId}`}>
          Back to project
        </Link>
        {canCreate ? <StartDetectionRunButton projectId={projectId} /> : null}
      </div>
      <PageTitle
        title="Event detections"
        subtitle="MACHINE SUGGESTION only — evidence-backed candidates, not entitlements or money-at-risk."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Detection runs</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-ink-700">No detection runs yet.</p>
          ) : (
            <ul className="space-y-3">
              {runs.map((run) => (
                <li key={run.id} className="border-b border-ink-100 pb-3 text-sm">
                  <div className="font-medium text-ink-950">
                    {run.runType} · {run.status}
                  </div>
                  <div className="text-xs text-ink-600">
                    Suggestions {run.suggestionsCreated} · Documents {run.documentsConsidered} ·{' '}
                    {run.rulesetVersion}
                  </div>
                  {hasCapability(ctx.capabilities, 'event_suggestion.read') ? (
                    <Link
                      className="mt-1 inline-block text-xs text-accent-700 underline"
                      href={`/projects/${projectId}/detections?run=${run.id}` as Route}
                    >
                      View suggestions ({run.suggestionsCreated})
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Suggestions pending review</h2>
          {suggestions.length === 0 ? (
            <p className="text-sm text-ink-700">No suggestions.</p>
          ) : (
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <li key={s.id} className="border-b border-ink-100 pb-3">
                  <Link
                    className="font-medium text-accent-700 underline"
                    href={`/projects/${projectId}/detections/suggestions/${s.id}` as Route}
                    dir="auto"
                  >
                    {s.suggestedTitle}
                  </Link>
                  <div className="mt-1 text-xs text-ink-600">
                    MACHINE SUGGESTION · {s.status} · {s.confidenceBand} · Evidence{' '}
                    {s._count.evidenceLinks}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
