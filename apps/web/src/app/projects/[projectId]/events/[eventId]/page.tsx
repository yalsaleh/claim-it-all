import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { Card, PageTitle, Shell } from '@/components/ui';
import { ProjectEventActions } from '@/components/deadlines/event-actions';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import {
  getProjectEvent,
  listCandidateRuleSnapshots,
  listProjectCalendars,
  getLatestEventCalculation,
} from '@/server/services/deadlines';

export default async function ProjectEventDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
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

  const event = await getProjectEvent(projectId, eventId);
  const candidates = hasCapability(ctx.capabilities, 'deadline_rule.assess')
    ? await listCandidateRuleSnapshots(projectId, eventId)
    : [];
  const calendars = await listProjectCalendars(projectId);
  const approvedCalendar = calendars.find((c) => c.currentRevision?.status === 'APPROVED');
  const latestAssessment = event.eventRuleAssessments.find(
    (a) => a.applicabilityStatus === 'APPLICABLE',
  );
  const unverifiedDate = event.dates.find(
    (d) =>
      d.verificationStatus !== 'VERIFIED' &&
      (d.precision === 'EXACT_DATE' || d.precision === 'EXACT_DATETIME'),
  );
  const verifiedDate = event.dates.find(
    (d) =>
      d.verificationStatus === 'VERIFIED' &&
      (d.precision === 'EXACT_DATE' || d.precision === 'EXACT_DATETIME'),
  );
  const latestCalculation = await getLatestEventCalculation(projectId, eventId);

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          className="text-sm text-accent-700 underline"
          href={`/projects/${projectId}/events` as Route}
        >
          Back to events
        </Link>
        <Link
          className="text-sm text-accent-700 underline"
          href={`/projects/${projectId}/events/${eventId}/deadline` as Route}
        >
          Deadline workflow
        </Link>
      </div>
      <PageTitle title={event.title} subtitle={`${event.eventCategory} · ${event.eventStatus}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Event details</h2>
          <dl className="space-y-2 text-sm text-ink-700" dir="auto">
            <div>
              <dt className="font-medium text-ink-950">Confirmation</dt>
              <dd>{event.confirmationStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Timezone</dt>
              <dd>{event.timezone}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-950">Description</dt>
              <dd>{event.description || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Dates</h2>
          {event.dates.length === 0 ? (
            <p className="text-sm text-ink-700">No dates recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {event.dates.map((date) => (
                <li key={date.id} className="rounded-md border border-ink-100 px-3 py-2">
                  <span className="font-medium">{date.dateType}</span>
                  <span className="block text-ink-600">
                    {date.dateValue.toISOString()} · {date.precision} · {date.verificationStatus}
                  </span>
                  {date.verificationStatus !== 'VERIFIED' ? (
                    <span className="mt-1 block text-xs text-amber-700">Awaiting verification</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Candidate rule snapshots</h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-ink-700">No approved rule snapshots for this project.</p>
          ) : (
            <ul className="space-y-2 text-xs text-ink-600">
              {candidates.map((snap) => (
                <li key={snap.id} className="rounded-md border border-ink-100 px-3 py-2">
                  {snap.noticeCategory ?? 'NOTICE'} · rev{' '}
                  {snap.configurationRevision.revisionNumber} · {snap.id}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Actions</h2>
          <ProjectEventActions
            projectId={projectId}
            eventId={eventId}
            canUpdate={hasCapability(ctx.capabilities, 'project_event.update')}
            canConfirm={hasCapability(ctx.capabilities, 'project_event.confirm')}
            canAssess={hasCapability(ctx.capabilities, 'deadline_rule.assess')}
            canCalculate={hasCapability(ctx.capabilities, 'deadline.calculate')}
            candidateSnapshotId={candidates[0]?.id}
            assessmentId={latestAssessment?.id}
            calendarRevisionId={approvedCalendar?.currentRevision?.id}
            triggerDateId={verifiedDate?.id}
            calculationId={latestCalculation?.id}
            canVerify={hasCapability(ctx.capabilities, 'deadline.verify')}
            canTrack={hasCapability(ctx.capabilities, 'deadline.track')}
            unverifiedDateId={unverifiedDate?.id}
          />
        </Card>
      </div>
    </Shell>
  );
}
