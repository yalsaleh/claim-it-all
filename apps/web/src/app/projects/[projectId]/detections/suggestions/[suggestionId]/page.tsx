import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { SuggestionReviewActions } from '@/components/detections/suggestion-review-actions';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getSuggestion } from '@/server/services/detections';

export default async function DetectionSuggestionReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; suggestionId: string }>;
}) {
  const { projectId, suggestionId } = await params;
  let ctx;
  try {
    ctx = await requireProjectAccess(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/login');
    redirect('/unauthorized');
  }
  if (!hasCapability(ctx.capabilities, 'event_suggestion.read')) {
    redirect('/unauthorized');
  }

  const suggestion = await getSuggestion(projectId, suggestionId);
  const reviewable =
    suggestion.status === 'PENDING_REVIEW' || suggestion.status === 'NEEDS_MORE_EVIDENCE';

  return (
    <Shell>
      <div className="mb-4">
        <Link
          className="text-sm text-accent-700 underline"
          href={`/projects/${projectId}/detections` as Route}
        >
          Back to detections
        </Link>
      </div>
      <PageTitle
        title={suggestion.suggestedTitle}
        subtitle={`MACHINE SUGGESTION · ${suggestion.status} · ${suggestion.confidenceBand}`}
      />
      <p className="mb-6 text-sm text-amber-800">
        This is a machine suggestion only. It is not a confirmed entitlement, time-bar assessment,
        or money-at-risk figure.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Evidence (review first)</h2>
          {suggestion.evidenceLinks.length === 0 ? (
            <p className="text-sm text-ink-700">No evidence linked.</p>
          ) : (
            <ul className="space-y-3">
              {suggestion.evidenceLinks.map((ev) => (
                <li key={ev.id} className="rounded-md border border-ink-100 px-3 py-2 text-sm">
                  <div className="text-xs font-medium text-ink-800">{ev.evidenceRole}</div>
                  <blockquote
                    className="mt-1 border-l-2 border-ink-300 pl-2 text-ink-900"
                    dir="auto"
                  >
                    {ev.selectedQuote}
                  </blockquote>
                  {ev.relevanceExplanation ? (
                    <p className="mt-1 text-xs text-ink-600">{ev.relevanceExplanation}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Facts & gaps</h2>
          <dl className="space-y-2 text-sm text-ink-700" dir="auto">
            <div>
              <dt className="font-medium text-ink-950">Category</dt>
              <dd>
                {suggestion.eventCategory}
                {suggestion.eventSubcategory ? ` / ${suggestion.eventSubcategory}` : ''}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Facts</dt>
              <dd>{suggestion.factsSummary || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Confidence</dt>
              <dd>{suggestion.confidenceExplanation || suggestion.confidenceBand}</dd>
            </div>
          </dl>
          {suggestion.evidenceGaps.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {suggestion.evidenceGaps.map((gap) => (
                <li
                  key={gap.id}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <span className="font-medium">{gap.gapCode}</span>
                  <span className="block text-ink-700">{gap.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {suggestion.dateSuggestions.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Date candidates</h3>
              <ul className="space-y-1 text-xs text-ink-600">
                {suggestion.dateSuggestions.map((d) => (
                  <li key={d.id}>
                    {d.dateType} · {d.suggestedValue?.toISOString() ?? 'null'} · {d.precision} ·{' '}
                    {d.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {suggestion.ruleCandidates.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Advisory rule candidates</h3>
              <p className="mb-2 text-xs text-ink-600">
                Listed for human review only — not marked applicable; no deadlines calculated.
              </p>
              <ul className="space-y-1 text-xs text-ink-600">
                {suggestion.ruleCandidates.map((r) => (
                  <li key={r.id}>
                    {r.status} · {r.confidenceBand} · {r.approvedRuleSnapshotId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
        {reviewable ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Review actions</h2>
            <SuggestionReviewActions
              projectId={projectId}
              suggestionId={suggestionId}
              dateSuggestionIds={suggestion.dateSuggestions
                .filter((d) => d.precision === 'EXACT_DATE' || d.precision === 'EXACT_DATETIME')
                .map((d) => d.id)}
              canAccept={hasCapability(ctx.capabilities, 'event_suggestion.accept')}
              canReject={hasCapability(ctx.capabilities, 'event_suggestion.reject')}
              canRequestEvidence={hasCapability(
                ctx.capabilities,
                'event_suggestion.request_evidence',
              )}
            />
          </Card>
        ) : (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Review status</h2>
            <p className="text-sm text-ink-700">
              Suggestion is {suggestion.status}
              {suggestion.acceptedProjectEventId
                ? ` · linked event ${suggestion.acceptedProjectEventId}`
                : ''}
              .
            </p>
          </Card>
        )}
      </div>
    </Shell>
  );
}
