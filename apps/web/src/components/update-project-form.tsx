'use client';

import { useActionState } from 'react';
import { updateProjectAction, type ProjectActionState } from '@/server/actions/project-actions';
import { Button, ErrorText, Label, TextInput } from '@/components/ui';

const initialState: ProjectActionState = {};

export function UpdateProjectForm({
  projectId,
  defaultName,
  defaultDescription,
  defaultStatus,
}: {
  projectId: string;
  defaultName: string;
  defaultDescription: string;
  defaultStatus: string;
}) {
  const action = updateProjectAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <TextInput id="name" name="name" defaultValue={defaultName} required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <TextInput id="description" name="description" defaultValue={defaultDescription} />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={defaultStatus}
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.success ? <p className="text-sm text-accent-700">{state.success}</p> : null}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
