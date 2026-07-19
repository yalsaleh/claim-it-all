import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { Card, PageTitle, Shell } from '@/components/ui';
import { getSessionUser } from '@/server/auth/session';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/select-organization');
  }

  return (
    <Shell>
      <PageTitle
        title="Sign in"
        subtitle="Use your ContractRadar credentials. Sessions are cookie-based and organization context is selected after login."
      />
      <Card>
        <LoginForm />
      </Card>
    </Shell>
  );
}
