import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, PageTitle, Shell } from '@/components/ui';
import { getSessionUser } from '@/server/auth/session';
import { readActiveTenantId } from '@/server/auth/active-tenant';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    const tenantId = await readActiveTenantId();
    redirect(tenantId ? '/projects' : '/select-organization');
  }

  return (
    <Shell>
      <PageTitle
        title="Platform foundation"
        subtitle="Secure multi-tenant access for GCC construction entitlement monitoring. Entitlement detection and notice drafting are not enabled in this slice."
      />
      <Card>
        <p className="mb-4 text-ink-700">
          Sign in to select an organization and manage projects. No commercial analytics or AI
          conclusions are presented here.
        </p>
        <Link
          className="inline-flex rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
          href="/login"
        >
          Continue to login
        </Link>
      </Card>
    </Shell>
  );
}
