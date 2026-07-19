'use client';

import { useActionState } from 'react';
import { loginAction, type AuthActionState } from '@/server/actions/auth-actions';
import { Button, ErrorText, Label, TextInput } from '@/components/ui';

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-required="true"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-required="true"
          minLength={12}
        />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
