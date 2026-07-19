'use server';

import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/server/auth/auth';
import { clearActiveTenantId } from '@/server/auth/active-tenant';
import { consumeLoginRateLimit } from '@/server/auth/rate-limit';
import { writeAuditLog } from '@/server/audit';
import { withBypassRls } from '@/server/db/tenant-context';
import { logger } from '@/lib/logger';

export type AuthActionState = {
  error?: string;
};

function clientIp(headerList: Headers): string {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headerList.get('x-real-ip') ?? 'unknown';
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const headerList = await headers();
  const ip = clientIp(headerList);
  const rate = await consumeLoginRateLimit({ ip, email });
  if (!rate.allowed) {
    return { error: 'Too many login attempts. Please try again later.' };
  }

  try {
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: headerList,
    });

    // Login success audit is global (no tenant); use bypass for RLS insert.
    await withBypassRls(async (tx) => {
      await writeAuditLog(
        {
          actorUserId: null,
          action: 'auth.login.success',
          entityType: 'user',
          entityId: email,
          metadata: { email },
        },
        tx,
      );
    });
  } catch (error) {
    await withBypassRls(async (tx) => {
      await writeAuditLog(
        {
          action: 'auth.login.failure',
          entityType: 'user',
          entityId: email,
          metadata: {
            email,
            reason: error instanceof APIError ? 'auth_failed' : 'unknown',
          },
        },
        tx,
      );
    });
    logger.warn('login_failed', { email });
    // Generic message: do not reveal whether the email exists.
    return { error: 'Invalid email or password.' };
  }

  redirect('/select-organization');
}

export async function logoutAction(): Promise<void> {
  try {
    await getAuth().api.signOut({
      headers: await headers(),
    });
  } finally {
    await clearActiveTenantId();
  }
  redirect('/login');
}
