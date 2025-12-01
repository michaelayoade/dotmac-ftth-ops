# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./

# Copy shared packages
COPY shared/packages/ ./shared/packages/
COPY shared/runtime/ ./shared/runtime/

# Copy app
COPY apps/platform-tenant/ ./apps/platform-tenant/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm -r --filter "./shared/packages/**" run build

# Build the app
RUN pnpm --filter @dotmac/platform-tenant build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets from the standalone output
COPY --from=builder /app/apps/platform-tenant/.next/standalone ./
COPY --from=builder /app/apps/platform-tenant/.next/static ./apps/platform-tenant/.next/static
COPY --from=builder /app/apps/platform-tenant/public ./apps/platform-tenant/public

USER nextjs

EXPOSE 3003

ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/platform-tenant/server.js"]
