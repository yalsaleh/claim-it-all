'use client';

import { logoutAction } from '@/server/actions/auth-actions';
import { SecondaryButton } from '@/components/ui';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SecondaryButton type="submit">Sign out</SecondaryButton>
    </form>
  );
}
