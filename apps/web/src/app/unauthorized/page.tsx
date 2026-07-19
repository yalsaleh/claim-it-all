import Link from 'next/link';
import { Card, PageTitle, Shell } from '@/components/ui';

export default function UnauthorizedPage() {
  return (
    <Shell>
      <PageTitle
        title="Unavailable"
        subtitle="The requested resource is not available in your current organization context."
      />
      <Card>
        <p className="mb-4 text-ink-700">
          For security, ContractRadar does not confirm whether a resource exists in another
          organization.
        </p>
        <Link className="text-accent-700 underline" href="/projects">
          Return to projects
        </Link>
      </Card>
    </Shell>
  );
}
