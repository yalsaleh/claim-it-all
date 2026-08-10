# Minimal provider-neutral production web image (not a Kubernetes claim).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @contractradar/web...

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
# Build workspace dependencies then the web app (standalone).
RUN pnpm --filter @contractradar/web... build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser
COPY --from=builder --chown=appuser:appuser /app/apps/web/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=appuser:appuser /app/apps/web/public ./apps/web/public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
