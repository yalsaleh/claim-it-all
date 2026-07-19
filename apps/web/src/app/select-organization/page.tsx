import { redirect } from 'next/navigation';
import { OrganizationPicker } from '@/components/organization-picker';
import { Card, ContextBanner, PageTitle, Shell } from '@/components/ui';
import { LogoutButton } from '@/components/logout-button';
import { requireAuthenticatedUser } from '@/server/authz/context';
import { listAuthorizedTenants } from '@/server/services/tenants';

export const dynamic = 'force-dynamic';

export default async function SelectOrganizationPage() {
  try {
    await requireAuthenticatedUser();
  } catch {
    redirect('/login');
  }

  const tenants = await listAuthorizedTenants();

  return (
    <Shell>
      <div className="mb-4 flex justify-end">
        <LogoutButton />
      </div>
      <PageTitle
        title="Select organization"
        subtitle="Tenant context is resolved from your memberships. Client-supplied tenant identifiers are never trusted for authorization."
      />
      <ContextBanner organization={null} project={null} />
      <Card>
        {tenants.length === 0 ? (
          <p className="text-ink-700">You are not a member of any active organization.</p>
        ) : (
          <OrganizationPicker
            tenants={tenants.map((tenant) => ({
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              role: tenant.memberships[0]?.role ?? 'VIEWER',
            }))}
          />
        )}
      </Card>
    </Shell>
  );
}
