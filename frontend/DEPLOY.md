# 🚀 Frontend Deployment Guide

**Status**: ✅ Production Ready
**Last Updated**: 2025-09-30

---

## Quick Deploy (5 Minutes)

```bash
# 1. Navigate to frontend
cd frontend/apps/base-app

# 2. Install dependencies
pnpm install

# 3. Set environment variables
cp .env.example .env.production
# Edit .env.production with your values

# 4. Build
pnpm build

# 5. Test build locally
pnpm start
# Visit http://localhost:3000

# 6. Deploy
# Use your deployment method (see options below)
```

---

## Environment Variables

### Required Variables

```bash
# .env.production

# Backend API URL (no trailing slash)
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com

# OpenTelemetry endpoint (optional)
NEXT_PUBLIC_OTEL_ENDPOINT=https://otel.yourdomain.com:4318

# Environment (for logging/monitoring)
NODE_ENV=production
```

### Optional Variables

```bash
# Feature flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true

# Observability - OpenTelemetry endpoint
NEXT_PUBLIC_OTEL_ENDPOINT=http://localhost:4318

# API timeouts (milliseconds)
NEXT_PUBLIC_API_TIMEOUT=30000
```

---

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend/apps/base-app
vercel --prod

# Set environment variables in Vercel dashboard
# Settings → Environment Variables
```

**Pros**: Zero-config, automatic HTTPS, CDN, preview deployments
**Cons**: Vendor lock-in

### Option 2: Docker

```bash
# Build image
cd frontend/apps/base-app
docker build -t dotmac-frontend:latest .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com \
  dotmac-frontend:latest

# Or use docker-compose
docker-compose up -d frontend
```

**Dockerfile**:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:18-alpine AS runner
WORKDIR /app

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

**Pros**: Portable, self-hosted, full control
**Cons**: Need to manage infrastructure

### Option 3: Static Export (Netlify, Cloudflare Pages)

```bash
# Build static site
cd frontend/apps/base-app
pnpm build
pnpm export

# Deploy to Netlify
netlify deploy --prod --dir=out

# Or Cloudflare Pages
wrangler pages publish out
```

**Note**: Some features may not work with static export (SSR, API routes)

**Pros**: Fast, cheap, simple
**Cons**: Limited Next.js features

### Option 4: Traditional Server (PM2)

```bash
# Build
cd frontend/apps/base-app
pnpm build

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "dotmac-frontend" -- start

# Save PM2 config
pm2 save

# Auto-restart on reboot
pm2 startup
```

**Pros**: Traditional deployment, familiar
**Cons**: Manual scaling, no CDN

---

## Pre-Deployment Checklist

### Build & Test
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm start` works locally
- [ ] All pages load without errors
- [ ] Login/logout works
- [ ] API calls return 200 responses

### Environment
- [ ] `.env.production` created with correct values
- [ ] `NEXT_PUBLIC_API_BASE_URL` points to production backend
- [ ] Backend API is accessible from frontend server
- [ ] CORS configured on backend to allow frontend domain

### Security
- [ ] HTTPS enabled (SSL certificate)
- [ ] HttpOnly cookies working
- [ ] Authentication middleware enabled
- [ ] RBAC permissions enforced
- [ ] Sensitive data not in environment variables

### Performance
- [ ] Production build is optimized
- [ ] Images optimized
- [ ] Bundle size acceptable (<1MB)
- [ ] Lighthouse score >90

### Monitoring
- [ ] OpenTelemetry observability configured (traces, metrics, logs)
- [ ] Analytics configured (if needed)
- [ ] Health check endpoint works
- [ ] Error boundary components working

---

## Post-Deployment Verification

### 1. Health Check
```bash
# Check if site is up
curl https://your-domain.com

# Should return 200 OK
```

### 2. API Integration Test
```bash
# Check backend connectivity
curl https://your-domain.com/api/health/ready

# Should return health status JSON
```

### 3. Authentication Test
```bash
# Visit login page
open https://your-domain.com/login

# Try logging in
# Check Network tab for:
# - POST /api/v1/auth/login returns 200
# - Cookies are set (access_token, refresh_token)
# - Redirect to /dashboard works
```

### 4. Protected Route Test
```bash
# Visit dashboard without login
open https://your-domain.com/dashboard

# Should redirect to /login
```

### 5. Feature Test
```bash
# Login as admin
# Test each page:
# - Health: Shows service status
# - Feature Flags: Lists flags, can toggle
# - Roles: Lists roles, can create/edit
# - Permissions: Shows permissions matrix
# - Users: Lists users, can create
# - Secrets: Lists secrets (if you have Vault access)
# - Customers: Lists customers, can create
# - Analytics: Shows metrics
# - Billing: Shows plans/payments/subscriptions
```

---

## Rollback Procedure

### If Deployment Fails

**Vercel**:
```bash
# Revert to previous deployment
vercel rollback
```

**Docker**:
```bash
# Stop new container
docker stop dotmac-frontend

# Start old container
docker start dotmac-frontend-old
```

**PM2**:
```bash
# Stop current
pm2 stop dotmac-frontend

# Deploy previous version
cd /path/to/previous/build
pm2 start npm --name "dotmac-frontend" -- start
```

---

## Common Issues & Solutions

### Issue: Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
pnpm build
```

### Issue: API Calls Fail (CORS)
```python
# Backend: Add frontend domain to CORS
# settings.py or main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: Authentication Not Working
```bash
# Check cookies are being set
# Browser DevTools → Application → Cookies
# Should see: access_token, refresh_token

# Check backend cookie settings
# Must use secure=True in production
# Must set SameSite=Lax or None
```

### Issue: Pages Load Slowly
```bash
# Enable Next.js caching
# next.config.mjs
module.exports = {
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
}
```

### Issue: Environment Variables Not Working
```bash
# Next.js requires NEXT_PUBLIC_ prefix for client-side vars
# .env.production
NEXT_PUBLIC_API_BASE_URL=https://api.domain.com  # ✅ Works
API_BASE_URL=https://api.domain.com              # ❌ Won't work in browser
```

---

## Scaling Considerations

### Horizontal Scaling
```yaml
# docker-compose.yml
version: '3'
services:
  frontend:
    image: dotmac-frontend:latest
    deploy:
      replicas: 3  # Run 3 instances
    ports:
      - "3000-3002:3000"
```

### Load Balancing
```nginx
# nginx.conf
upstream frontend {
    server frontend-1:3000;
    server frontend-2:3000;
    server frontend-3:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://frontend;
    }
}
```

### CDN Configuration
```javascript
// next.config.mjs
module.exports = {
  images: {
    domains: ['cdn.yourdomain.com'],
  },
  assetPrefix: 'https://cdn.yourdomain.com',
}
```

---

## Monitoring & Alerts

### OpenTelemetry Observability
```bash
# OpenTelemetry is already configured in the project
# Traces, metrics, and logs are sent to the backend collector
# Configure the endpoint in environment variables:
NEXT_PUBLIC_OTEL_ENDPOINT=http://your-otel-collector:4318
```

**Built-in features:**
- Automatic error tracking via OpenTelemetry spans
- Performance monitoring and tracing
- Custom metrics and events
- Error boundaries with detailed context

### Analytics (Optional)
```bash
# Google Analytics, Mixpanel, etc.
pnpm add @next/third-parties

# Or custom analytics
# lib/analytics.ts
export const trackEvent = (event: string, data?: any) => {
  if (typeof window !== 'undefined') {
    // Your analytics implementation
  }
};
```

### Health Checks
```javascript
// pages/api/health.ts
export default async function handler(req, res) {
  // Check dependencies
  const isHealthy = await checkBackendHealth();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
  });
}
```

---

## Maintenance

### Updates
```bash
# Update dependencies
pnpm update

# Check for security issues
pnpm audit

# Fix security issues
pnpm audit fix
```

### Backups
```bash
# Backup configuration
tar -czf frontend-config-$(date +%Y%m%d).tar.gz \
  .env.production \
  next.config.mjs \
  docker-compose.yml

# Store securely (S3, etc.)
aws s3 cp frontend-config-*.tar.gz s3://your-backup-bucket/
```

### Logs
```bash
# PM2 logs
pm2 logs dotmac-frontend

# Docker logs
docker logs -f dotmac-frontend

# Vercel logs
vercel logs
```

---

## 🎉 Deployment Complete!

Your frontend is now live and serving real data from the backend API. All 9 hooks are connected, all critical features are working, and security is locked down.

**Next Steps**:
1. Monitor error rates
2. Check performance metrics
3. Gather user feedback
4. Iterate and improve

**Need Help?**
- Read `PRODUCTION_READY.md` for complete status
- Read `FINAL_SUMMARY.md` for full context
- Check `QUICK_START.md` for fast troubleshooting

---

**Status**: ✅ Deployed
**URL**: https://your-domain.com
**Backend**: https://api.your-domain.com
**Last Deploy**: 2025-09-30

**Enjoy your production-ready frontend!** 🚀