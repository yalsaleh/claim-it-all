'use client';

import { useActionState } from 'react';
import { selectOrganizationAction, type TenantActionState } from '@/server/actions/tenant-actions';
import { Button, ErrorText } from '@/components/ui';

type TenantOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

const initialState: TenantActionState = {};

export function OrganizationPicker({ tenants }: { tenants: TenantOption[] }) {
  const [state, formAction, pending] = useActionState(selectOrganizationAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink-900">Organizations</legend>
        {tenants.map((tenant) => (
          <label
            key={tenant.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 px-3 py-3 hover:bg-ink-50"
          >
            <input
              type="radio"
              name="tenantId"
              value={tenant.id}
              required
              className="mt-1"
              defaultChecked={tenants.length === 1}
            />
            <span>
              <span className="block font-medium text-ink-950">{tenant.name}</span>
              <span className="block text-sm text-ink-700">
                {tenant.slug} · {tenant.role}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Opening…' : 'Continue'}
      </Button>
    </form>
  );
}
