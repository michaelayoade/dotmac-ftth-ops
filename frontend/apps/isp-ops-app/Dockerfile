# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-secret-not-used-in-production" \
    JWT_SECRET="build-time-jwt-secret-not-used-in-production"

RUN apk add --no-cache libc6-compat && corepack enable pnpm

# Copy workspace manifests
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc ./

# Copy source (frontend workspace)
COPY apps ./apps
COPY shared ./shared
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build workspace packages that isp-ops-app depends on
RUN pnpm --filter @dotmac/isp-ops-app^... build

# Build the ISP operations app
RUN pnpm --filter @dotmac/isp-ops-app build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 nodejs && adduser -D -G nodejs nodejs

# Copy the standalone build output
COPY --from=builder /app/apps/isp-ops-app/.next/standalone ./
COPY --from=builder /app/apps/isp-ops-app/.next/static ./apps/isp-ops-app/.next/static
COPY --from=builder /app/apps/isp-ops-app/public ./apps/isp-ops-app/public

USER nodejs

EXPOSE 3000

CMD ["node", "apps/isp-ops-app/server.js"]
