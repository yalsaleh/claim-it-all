import { z } from 'zod';
import {
  isPilotOrProduction,
  parseAppEnvironment,
  policyForEnvironment,
} from '@contractradar/platform';

const WEAK_SECRETS = [
  'replace-with-a-long-random-secret',
  'dev-only-secret-change-me',
  'ci-test-secret-with-sufficient-length-32',
];

const WEAK_STORAGE = new Set(['minioadmin', 'changeme', 'password', 'secret']);
const FAKE_PROVIDERS = new Set(['fake', 'fake_test', 'local_fixture', 'local_capture']);

const serverSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
    CONTRACTRADAR_ENV: z.enum(['LOCAL', 'TEST', 'CI', 'STAGING', 'PILOT', 'PRODUCTION']).optional(),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url().optional(),
    DOCUMENT_INTELLIGENCE_URL: z.string().url(),
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN: z.string().min(16),
    REDIS_URL: z.string().min(1),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(52_428_800),
    UPLOAD_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    MAX_ACTIVE_UPLOADS_PER_USER: z.coerce.number().int().positive().default(10),
    MAX_ACTIVE_UPLOADS_PER_PROJECT: z.coerce.number().int().positive().default(50),
    /** clamav = real scanner; fake_test = tests only; disabled_reject_all = refuse CLEAN */
    MALWARE_SCANNER: z.enum(['clamav', 'fake_test', 'disabled_reject_all']).default('clamav'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    ALLOW_DEV_DEFAULTS: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    CONNECTOR_PROVIDER: z.string().optional(),
    NOTICE_DELIVERY_PROVIDER: z.string().optional(),
    CONTRACT_AI_PROVIDER: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const nextPhase = process.env.NEXT_PHASE;
    const isNextBuild = nextPhase === 'phase-production-build';
    const appEnv = env.APP_ENV ?? env.NODE_ENV;
    let classified;
    try {
      classified = parseAppEnvironment(env.CONTRACTRADAR_ENV ?? env.APP_ENV ?? env.NODE_ENV);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Invalid CONTRACTRADAR_ENV',
        path: ['CONTRACTRADAR_ENV'],
      });
      return;
    }
    const policy = policyForEnvironment(classified);
    const isProdLike =
      !isNextBuild &&
      (env.NODE_ENV === 'production' ||
        appEnv === 'production' ||
        appEnv === 'staging' ||
        isPilotOrProduction(classified));
    const isTest =
      env.NODE_ENV === 'test' || appEnv === 'test' || classified === 'TEST' || classified === 'CI';

    if (!policy.allowFakeProviders) {
      for (const [key, value] of [
        ['CONNECTOR_PROVIDER', env.CONNECTOR_PROVIDER],
        ['NOTICE_DELIVERY_PROVIDER', env.NOTICE_DELIVERY_PROVIDER],
        ['CONTRACT_AI_PROVIDER', env.CONTRACT_AI_PROVIDER],
      ] as const) {
        if (value && FAKE_PROVIDERS.has(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key}=${value} is forbidden in ${classified}`,
            path: [key],
          });
        }
      }
    }

    if (env.MALWARE_SCANNER === 'fake_test' && !isTest) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MALWARE_SCANNER=fake_test is only allowed when NODE_ENV/APP_ENV is test',
        path: ['MALWARE_SCANNER'],
      });
    }

    if (isProdLike && env.MALWARE_SCANNER !== 'clamav') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production/staging require MALWARE_SCANNER=clamav',
        path: ['MALWARE_SCANNER'],
      });
    }

    if (env.DOWNLOAD_URL_TTL_SECONDS > 3600) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DOWNLOAD_URL_TTL_SECONDS must be <= 3600',
        path: ['DOWNLOAD_URL_TTL_SECONDS'],
      });
    }

    if (env.UPLOAD_SESSION_TTL_SECONDS > 7200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'UPLOAD_SESSION_TTL_SECONDS must be <= 7200',
        path: ['UPLOAD_SESSION_TTL_SECONDS'],
      });
    }

    if (isProdLike) {
      if (env.ALLOW_DEV_DEFAULTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ALLOW_DEV_DEFAULTS cannot be enabled in production/staging',
          path: ['ALLOW_DEV_DEFAULTS'],
        });
      }
      if (WEAK_SECRETS.some((weak) => env.BETTER_AUTH_SECRET.includes(weak))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BETTER_AUTH_SECRET must not use a development placeholder',
          path: ['BETTER_AUTH_SECRET'],
        });
      }
      if (
        WEAK_STORAGE.has(env.S3_ACCESS_KEY_ID) ||
        WEAK_STORAGE.has(env.S3_SECRET_ACCESS_KEY) ||
        env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN.includes('dev-internal') ||
        env.DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN.includes('change-me')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Production/staging must not use example storage or service credentials',
          path: ['S3_ACCESS_KEY_ID'],
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached;
  }

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = null;
}

export function validateEnvForTests(env: Record<string, string | undefined>): ServerEnv {
  return serverSchema.parse(env);
}
