'use server';

import { redirect } from 'next/navigation';
import { selectActiveTenant } from '@/server/services/tenants';
import { AppError } from '@/server/errors';

export type TenantActionState = {
  error?: string;
};

export async function selectOrganizationAction(
  _prev: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  try {
    await selectActiveTenant({
      tenantId: String(formData.get('tenantId') ?? ''),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: 'Unable to select organization.' };
  }

  redirect('/projects');
}
