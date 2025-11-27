# syntax=docker/dockerfile:1.5

FROM node:20-alpine AS builder
WORKDIR /app

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
# Internal API URL for server-side rewrites (container-to-container)
ARG INTERNAL_API_URL=http://isp-backend:8000

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    JWT_SECRET="build-time-jwt-secret-not-used-in-production" \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    INTERNAL_API_URL=${INTERNAL_API_URL}

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
