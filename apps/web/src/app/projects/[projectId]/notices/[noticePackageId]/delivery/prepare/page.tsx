import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { DeliveryApiForm } from '@/components/notices/delivery-api-form';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';

export default async function PrepareDispatchPage({
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
  if (!hasCapability(ctx.capabilities, 'notice_dispatch.prepare')) {
    redirect('/unauthorized');
  }

  const api = `/api/projects/${projectId}/notices/${noticePackageId}/delivery`;
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={base as Route}>
          Back to delivery
        </Link>
      </div>
      <PageTitle title="Prepare dispatch snapshot" subtitle="Immutable package for authorization" />
      <Card>
        <DeliveryApiForm action={api} submitLabel="Create dispatch snapshot">
          <label className="mb-3 block text-sm">
            <span className="font-medium">Channel</span>
            <select
              name="channel"
              defaultValue="CONTROLLED_EMAIL"
              className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
            >
              <option value="CONTROLLED_EMAIL">Controlled email</option>
              <option value="MANUAL_EMAIL">Manual email</option>
              <option value="MANUAL_HAND_DELIVERY">Manual hand delivery</option>
            </select>
          </label>
          <label className="mb-3 block text-sm">
            <span className="font-medium">Subject</span>
            <input
              name="subject"
              required
              className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
              defaultValue="Formal notice — please acknowledge receipt"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Cover message (plain text)</span>
            <textarea
              name="plainText"
              required
              rows={6}
              className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
              defaultValue="Please find attached the approved notice package. Kindly confirm receipt."
            />
          </label>
        </DeliveryApiForm>
      </Card>
    </Shell>
  );
}
