import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { DeliveryApiForm } from '@/components/notices/delivery-api-form';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { getDispatchAttempt, listDispatchAttempts } from '@/server/services/notice-delivery';

export default async function ReceiptPage({
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

  const attempts = await listDispatchAttempts(projectId, noticePackageId);
  const latest = attempts[0];
  const latestDetail = latest
    ? await getDispatchAttempt(projectId, noticePackageId, latest.id)
    : null;
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;
  const api = `/api/projects/${projectId}/notices/${noticePackageId}/delivery/receipt`;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={base as Route}>
          Back to delivery
        </Link>
      </div>
      <PageTitle
        title="Receipt & contractual service"
        subtitle="Distinguish provider accepted, sent, delivered, human-confirmed"
      />

      {hasCapability(ctx.capabilities, 'notice_receipt.assess') && latest ? (
        <div className="mb-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Assess receipt</h2>
            <DeliveryApiForm action={api} submitLabel="Assess receipt">
              <input type="hidden" name="attemptId" value={latest.id} />
              <label className="mb-3 block text-sm">
                <span className="font-medium">Receipt status</span>
                <select
                  name="receiptStatus"
                  className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
                  defaultValue="DELIVERED"
                >
                  <option value="PROVIDER_ACCEPTED">Provider accepted</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="MANUALLY_CONFIRMED">Manually confirmed</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Rationale</span>
                <textarea
                  name="rationale"
                  rows={3}
                  className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
                />
              </label>
            </DeliveryApiForm>
          </Card>
        </div>
      ) : null}
      {hasCapability(ctx.capabilities, 'notice_receipt.confirm') &&
      latestDetail?.receiptAssessments?.[0] ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Confirm contractual service</h2>
          <DeliveryApiForm action={api} submitLabel="Confirm contractual service (human)">
            <input type="hidden" name="action" value="confirm" />
            <input
              type="hidden"
              name="assessmentId"
              value={latestDetail.receiptAssessments[0].id}
            />
            <input type="hidden" name="contractualServiceStatus" value="HUMAN_CONFIRMED" />
            <label className="block text-sm">
              <span className="font-medium">Confirmation rationale</span>
              <textarea
                name="rationale"
                rows={3}
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
              />
            </label>
          </DeliveryApiForm>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-600">
            Assess receipt first, then a separate user may confirm contractual service.
          </p>
        </Card>
      )}
    </Shell>
  );
}
