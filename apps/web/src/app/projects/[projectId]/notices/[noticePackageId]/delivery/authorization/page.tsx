import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { DeliveryApiForm } from '@/components/notices/delivery-api-form';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { withTenantTransaction } from '@/server/db/tenant-context';

async function loadLatestSnapshot(
  projectId: string,
  noticePackageId: string,
  tenantId: string,
  userId: string,
) {
  return withTenantTransaction({ tenantId, userId }, async (tx) =>
    tx.noticeDispatchPackageSnapshot.findFirst({
      where: { projectId, noticePackageId, tenantId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

async function loadLatestAuth(
  projectId: string,
  noticePackageId: string,
  tenantId: string,
  userId: string,
) {
  return withTenantTransaction({ tenantId, userId }, async (tx) =>
    tx.noticeDispatchAuthorization.findFirst({
      where: { projectId, noticePackageId, tenantId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export default async function AuthorizationPage({
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

  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;
  const api = `/api/projects/${projectId}/notices/${noticePackageId}/delivery/authorization`;
  const sendApi = `/api/projects/${projectId}/notices/${noticePackageId}/delivery/send`;
  const manualApi = `/api/projects/${projectId}/notices/${noticePackageId}/delivery/manual`;

  const snapshot = hasCapability(ctx.capabilities, 'notice_dispatch.read')
    ? await loadLatestSnapshot(projectId, noticePackageId, ctx.tenantId, ctx.user.id)
    : null;
  const auth = hasCapability(ctx.capabilities, 'notice_dispatch.read')
    ? await loadLatestAuth(projectId, noticePackageId, ctx.tenantId, ctx.user.id)
    : null;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={base as Route}>
          Back to delivery
        </Link>
      </div>
      <PageTitle title="Dispatch authorization" subtitle="Human review required before send" />

      {hasCapability(ctx.capabilities, 'notice_dispatch.request_authorization') && snapshot ? (
        <div className="mb-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Request authorization</h2>
            <DeliveryApiForm action={api} submitLabel="Request authorization">
              <input type="hidden" name="action" value="request" />
              <input type="hidden" name="snapshotId" value={snapshot.id} />
              <label className="block text-sm">
                <span className="font-medium">Rationale (optional)</span>
                <textarea
                  name="rationale"
                  rows={3}
                  className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
                />
              </label>
            </DeliveryApiForm>
            <p className="mt-2 text-xs text-ink-600">Snapshot: {snapshot.id.slice(0, 8)}…</p>
          </Card>
        </div>
      ) : null}

      {hasCapability(ctx.capabilities, 'notice_dispatch.authorize') && auth ? (
        <div className="mb-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Authorize dispatch</h2>
            <p className="mb-3 text-sm text-ink-600">Status: {auth.status}</p>
            <DeliveryApiForm action={api} submitLabel="Authorize for dispatch">
              <input type="hidden" name="action" value="authorize" />
              <input type="hidden" name="authorizationId" value={auth.id} />
              {(
                [
                  ['recipientsReviewed', 'Recipients reviewed'],
                  ['methodReviewed', 'Delivery method reviewed'],
                  ['attachmentsReviewed', 'Attachments reviewed'],
                  ['deadlineReviewed', 'Deadline reviewed'],
                  ['scopeReviewed', 'Scope reviewed'],
                  ['deliveryRiskAcknowledged', 'Delivery risks acknowledged'],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="mb-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name={name} />
                  {label}
                </label>
              ))}
            </DeliveryApiForm>
          </Card>
        </div>
      ) : null}

      {hasCapability(ctx.capabilities, 'notice_dispatch.send') && auth?.status === 'AUTHORIZED' ? (
        <div className="mb-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Send (controlled email)</h2>
            <DeliveryApiForm action={sendApi} submitLabel="Send approved notice">
              <input type="hidden" name="authorizationId" value={auth.id} />
            </DeliveryApiForm>
          </Card>
        </div>
      ) : null}

      {hasCapability(ctx.capabilities, 'notice_dispatch.record_manual') &&
      auth?.status === 'AUTHORIZED' &&
      auth.selectedChannel.startsWith('MANUAL_') ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Manual dispatch</h2>
          <DeliveryApiForm action={manualApi} submitLabel="Record manual dispatch">
            <input type="hidden" name="authorizationId" value={auth.id} />
            <input type="hidden" name="method" value={auth.selectedChannel} />
            <label className="mb-3 block text-sm">
              <span className="font-medium">Dispatch time (ISO)</span>
              <input
                name="dispatchAt"
                required
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
                defaultValue={new Date().toISOString()}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Notes</span>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
              />
            </label>
          </DeliveryApiForm>
        </Card>
      ) : null}
    </Shell>
  );
}
