# syntax=docker/dockerfile:1.5

ARG PNPM_VERSION=9.12.3

FROM node:20-alpine AS builder
ARG PNPM_VERSION
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ARG NEXT_PUBLIC_PRODUCT_NAME="DotMac Platform Admin"
ARG NEXT_PUBLIC_PRODUCT_TAGLINE="Control plane for multi-tenant ISPs"
ARG NEXT_PUBLIC_FAVICON=/favicon.ico
ARG NEXT_PUBLIC_MOCK_API=false
ARG NEXT_PUBLIC_USE_MOCK_DATA=false
ARG NEXT_PUBLIC_APP_TYPE=platform-admin
ARG NEXT_PUBLIC_PORTAL_TYPE=admin
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-secret-not-used-in-production" \
    JWT_SECRET="build-time-jwt-secret-not-used-in-production" \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_PRODUCT_NAME=${NEXT_PUBLIC_PRODUCT_NAME} \
    NEXT_PUBLIC_PRODUCT_TAGLINE=${NEXT_PUBLIC_PRODUCT_TAGLINE} \
    NEXT_PUBLIC_FAVICON=${NEXT_PUBLIC_FAVICON} \
    NEXT_PUBLIC_MOCK_API=${NEXT_PUBLIC_MOCK_API} \
    NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA} \
    NEXT_PUBLIC_APP_TYPE=${NEXT_PUBLIC_APP_TYPE} \
    NEXT_PUBLIC_PORTAL_TYPE=${NEXT_PUBLIC_PORTAL_TYPE}

RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy minimal workspace manifests for dependency installation
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY .npmrc ./
COPY apps/platform-admin-app/package.json apps/platform-admin-app/
COPY shared/packages/analytics/package.json shared/packages/analytics/
COPY shared/packages/design-system/package.json shared/packages/design-system/
COPY shared/packages/eslint-config/package.json shared/packages/eslint-config/
COPY shared/packages/features/package.json shared/packages/features/
COPY shared/packages/graphql/package.json shared/packages/graphql/
COPY shared/packages/headless/package.json shared/packages/headless/
COPY shared/packages/http-client/package.json shared/packages/http-client/
COPY shared/packages/notifications/package.json shared/packages/notifications/
COPY shared/packages/primitives/package.json shared/packages/primitives/
COPY shared/packages/providers/package.json shared/packages/providers/
COPY shared/packages/rbac/package.json shared/packages/rbac/
COPY shared/packages/typescript-config/package.json shared/packages/typescript-config/
COPY shared/packages/ui/package.json shared/packages/ui/

# Install only what the Platform Admin app (and its workspace deps) need
RUN pnpm install --filter @dotmac/platform-admin-app... --frozen-lockfile

# Copy the rest of the workspace
COPY apps ./apps
COPY shared ./shared
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./

# Build the platform admin app from its directory
WORKDIR /app/apps/platform-admin-app
RUN pnpm build

# Reset workdir for runner stage
WORKDIR /app

FROM node:20-alpine AS runner
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_PRODUCT_NAME
ARG NEXT_PUBLIC_PRODUCT_TAGLINE
ARG NEXT_PUBLIC_FAVICON
ARG NEXT_PUBLIC_MOCK_API
ARG NEXT_PUBLIC_USE_MOCK_DATA
ARG NEXT_PUBLIC_APP_TYPE
ARG NEXT_PUBLIC_PORTAL_TYPE
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_PRODUCT_NAME=${NEXT_PUBLIC_PRODUCT_NAME} \
    NEXT_PUBLIC_PRODUCT_TAGLINE=${NEXT_PUBLIC_PRODUCT_TAGLINE} \
    NEXT_PUBLIC_FAVICON=${NEXT_PUBLIC_FAVICON} \
    NEXT_PUBLIC_MOCK_API=${NEXT_PUBLIC_MOCK_API} \
    NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA} \
    NEXT_PUBLIC_APP_TYPE=${NEXT_PUBLIC_APP_TYPE} \
    NEXT_PUBLIC_PORTAL_TYPE=${NEXT_PUBLIC_PORTAL_TYPE}

RUN addgroup -g 1001 nodejs && adduser -D -G nodejs nodejs

# Copy the standalone build output
COPY --from=builder /app/apps/platform-admin-app/.next/standalone ./
COPY --from=builder /app/apps/platform-admin-app/.next/static ./apps/platform-admin-app/.next/static
COPY --from=builder /app/apps/platform-admin-app/public ./apps/platform-admin-app/public

USER nodejs

EXPOSE 3000

CMD ["node", "apps/platform-admin-app/server.js"]
