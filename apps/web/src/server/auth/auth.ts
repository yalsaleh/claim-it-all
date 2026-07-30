import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { getServerEnv } from '@/lib/env';
import { prisma } from '@/server/db';

function createAuth() {
  const env = getServerEnv();

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
      cookiePrefix: 'cr',
    },
    user: {
      additionalFields: {
        status: {
          type: 'string',
          required: false,
          defaultValue: 'ACTIVE',
          input: false,
        },
      },
    },
    plugins: [nextCookies()],
  });
}

// better-auth@1.6+ types reference zod/v4; keep a portable surface for Next/tsc --noEmit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthInstance = any;

let authSingleton: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!authSingleton) {
    authSingleton = createAuth();
  }
  return authSingleton;
}

export type Auth = AuthInstance;

export const auth = {
  get handler() {
    return getAuth().handler;
  },
  get api() {
    return getAuth().api;
  },
};
