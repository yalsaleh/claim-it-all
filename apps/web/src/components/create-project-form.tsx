'use client';

import { useActionState } from 'react';
import { createProjectAction, type ProjectActionState } from '@/server/actions/project-actions';
import { Button, ErrorText, Label, TextInput } from '@/components/ui';

const initialState: ProjectActionState = {};

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <TextInput id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="code">Code</Label>
        <TextInput id="code" name="code" required placeholder="GCI-01" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <TextInput id="description" name="description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="countryCode">Country</Label>
          <TextInput id="countryCode" name="countryCode" required placeholder="KW" />
        </div>
        <div>
          <Label htmlFor="defaultCurrency">Currency</Label>
          <TextInput id="defaultCurrency" name="defaultCurrency" required placeholder="KWD" />
        </div>
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <TextInput id="timezone" name="timezone" required placeholder="Asia/Kuwait" />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}
