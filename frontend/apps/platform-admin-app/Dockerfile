# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat && corepack enable pnpm

# Copy workspace manifests
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy source (frontend workspace)
COPY apps ./apps
COPY shared ./shared
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the platform admin app
RUN pnpm --filter @dotmac/platform-admin-app build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 nodejs && adduser -D -G nodejs nodejs

# Copy the standalone build output
COPY --from=builder /app/apps/platform-admin-app/.next/standalone ./
COPY --from=builder /app/apps/platform-admin-app/.next/static ./apps/platform-admin-app/.next/static
COPY --from=builder /app/apps/platform-admin-app/public ./apps/platform-admin-app/public

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
