import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { hasCapability } from '@contractradar/authz';
import { DeliveryApiForm } from '@/components/notices/delivery-api-form';
import { Card, PageTitle, Shell } from '@/components/ui';
import { AppError } from '@/server/errors';
import { requireProjectAccess } from '@/server/authz/context';
import { listDispatchAttempts } from '@/server/services/notice-delivery';

export default async function EvidencePage({
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
  if (!hasCapability(ctx.capabilities, 'dispatch_evidence.upload')) {
    redirect('/unauthorized');
  }

  const attempts = await listDispatchAttempts(projectId, noticePackageId);
  const latest = attempts[0];
  const base = `/projects/${projectId}/notices/${noticePackageId}/delivery`;
  const api = `/api/projects/${projectId}/notices/${noticePackageId}/delivery/evidence`;

  return (
    <Shell>
      <div className="mb-4">
        <Link className="text-sm text-accent-700 underline" href={base as Route}>
          Back to delivery
        </Link>
      </div>
      <PageTitle title="Upload dispatch evidence" subtitle="Proof of delivery or submission" />
      <Card>
        {!latest ? (
          <p className="text-sm text-ink-600">Create a dispatch attempt first.</p>
        ) : (
          <DeliveryApiForm action={api} submitLabel="Upload evidence">
            <input type="hidden" name="attemptId" value={latest.id} />
            <label className="mb-3 block text-sm">
              <span className="font-medium">Evidence type</span>
              <select
                name="evidenceType"
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
                defaultValue="EMAIL_DELIVERY_CONFIRMATION"
              >
                <option value="EMAIL_DELIVERY_CONFIRMATION">Email delivery confirmation</option>
                <option value="COURIER_RECEIPT">Courier receipt</option>
                <option value="HAND_DELIVERY_RECEIPT">Hand delivery receipt</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="mb-3 block text-sm">
              <span className="font-medium">Filename</span>
              <input
                name="filename"
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Checksum (SHA-256)</span>
              <input
                name="checksumSha256"
                required
                minLength={64}
                maxLength={64}
                className="mt-1 block w-full rounded border border-ink-300 px-2 py-1.5 font-mono text-xs"
                placeholder="64 hex characters"
              />
            </label>
          </DeliveryApiForm>
        )}
      </Card>
    </Shell>
  );
}
