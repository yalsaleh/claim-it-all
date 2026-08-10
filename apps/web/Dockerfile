# Minimal provider-neutral production web image (not a Kubernetes claim).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @contractradar/web...

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app /app
COPY . .
# Build-time placeholders only (builder stage). Runtime values are injected at container start.
# Required so Next.js page data collection does not fail env validation without a host .env.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    CONTRACTRADAR_ENV=CI \
    ALLOW_DEV_DEFAULTS=true \
    APP_URL=http://127.0.0.1:3000 \
    BETTER_AUTH_URL=http://127.0.0.1:3000 \
    BETTER_AUTH_SECRET=build-time-placeholder-secret-not-for-runtime \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    DOCUMENT_INTELLIGENCE_URL=http://127.0.0.1:8000 \
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=build-time-placeholder-token-32ch \
    REDIS_URL=redis://127.0.0.1:6379 \
    S3_ENDPOINT=http://127.0.0.1:9000 \
    S3_REGION=us-east-1 \
    S3_ACCESS_KEY_ID=build \
    S3_SECRET_ACCESS_KEY=build-secret \
    S3_BUCKET=build \
    S3_FORCE_PATH_STYLE=true \
    MALWARE_SCANNER=fake_test
# Build workspace dependencies then the web app (standalone).
RUN pnpm --filter @contractradar/web... build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# OpenSSL is required at runtime so Prisma can select debian-openssl-3.0.x engines.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser
COPY --from=builder --chown=appuser:appuser /app/apps/web/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=appuser:appuser /app/apps/web/public ./apps/web/public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
