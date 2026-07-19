import { headers } from 'next/headers';
import { getAuth } from '@/server/auth/auth';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  status: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    status: (session.user as { status?: string }).status ?? 'ACTIVE',
  };
}
