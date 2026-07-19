'use client';

import { useActionState } from 'react';
import { addProjectMemberAction, type ProjectActionState } from '@/server/actions/project-actions';
import { Button, ErrorText, Label, TextInput } from '@/components/ui';

const initialState: ProjectActionState = {};

export function AddMemberForm({ projectId }: { projectId: string }) {
  const action = addProjectMemberAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 border-t border-ink-100 pt-4">
      <h3 className="text-sm font-semibold text-ink-950">Add member</h3>
      <div>
        <Label htmlFor="userId">User ID</Label>
        <TextInput id="userId" name="userId" required />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
          defaultValue="VIEWER"
        >
          <option value="PROJECT_ADMIN">PROJECT_ADMIN</option>
          <option value="COMMERCIAL_LEAD">COMMERCIAL_LEAD</option>
          <option value="CONTRACTS_LEAD">CONTRACTS_LEAD</option>
          <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
          <option value="REVIEWER">REVIEWER</option>
          <option value="CONTRIBUTOR">CONTRIBUTOR</option>
          <option value="VIEWER">VIEWER</option>
        </select>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.success ? <p className="text-sm text-accent-700">{state.success}</p> : null}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Adding…' : 'Add member'}
      </Button>
    </form>
  );
}
