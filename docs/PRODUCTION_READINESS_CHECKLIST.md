# Production Readiness Checklist

## Overview

This checklist covers all critical items that must be verified before deploying to production.

**Last Updated**: 2025-10-17
**Status**: Use this as a pre-deployment checklist

---

> **Compose overlay update**
> Run production commands with `docker-compose.production.yml` (which extends `docker-compose.base.yml`). Any references to `docker-compose.prod.yml` in this checklist should be updated accordingly.

---

## Critical Issues Fixed ✅

### 1. ✅ Docker Entrypoint Scripts Created
- ✅ `scripts/docker-entrypoint.sh` - API entrypoint (was missing, referenced by Dockerfile.prod:89)
- ✅ `scripts/celery-entrypoint.sh` - Celery entrypoint (was missing, referenced by Dockerfile.prod:142)
- **Status**: FIXED - Production images can now build

### 2. ✅ Configuration Directories Created
- ✅ `redis/redis.conf` - Production Redis config (was missing, referenced by docker-compose.production.yml:134)
- ✅ `database/init/01-init.sql` - PostgreSQL init (was missing, referenced by docker-compose.production.yml:115)
- ✅ `vault/policies/app-policy.hcl` - Vault policies (was missing, referenced by docker-compose.production.yml:174)
- **Status**: FIXED - Docker Compose can start

### 3. ✅ Makefile Scripts Created
- ✅ `scripts/run_integration_tests.sh` - Integration testing (was missing, Makefile:257)
- ✅ `scripts/check_infra.sh` - Infrastructure management (was missing, Makefile:261)
- ✅ `scripts/seed_data.py` - Database seeding (was missing, Makefile:279)
- **Status**: FIXED - Development workflows functional

### 4. ✅ Frontend TypeScript Checking Enabled
- ✅ `frontend/apps/base-app/package.json:12` - type-check script (was no-op echo)
- **Status**: FIXED - CI now catches type errors

### 5. ✅ Frontend Mock Data Safeguarded
- ✅ `frontend/apps/base-app/app/dashboard/network/faults/page.tsx:151` - Mock alarm fallback (was showing fake data)
- **Status**: FIXED - Production never shows fake alarms

---

## Backend Configuration Issues ⚠️

### Environment Variables Mapping

**Status**: ⚠️ **DOCUMENTED BUT NOT FIXED** - Requires manual update

| Issue | File | Line | Status |
|-------|------|------|--------|
| `DATABASE__NAME` should be `DATABASE__DATABASE` | docker-compose.production.yml | 19 | ⚠️ Not Fixed |
| `JWT_SECRET` should be `AUTH__JWT_SECRET_KEY` | docker-compose.production.yml | 33 | ⚠️ Not Fixed |
| Missing `VAULT__ENABLED: "true"` | docker-compose.production.yml | N/A | ⚠️ Not Fixed |

**Impact**: Production startup will fail with environment validation errors

**Fix Required**: Update `docker-compose.production.yml`:
```yaml
services:
  app:
    environment:
      # Fix database variable
      DATABASE__DATABASE: ${POSTGRES_DB:-dotmac_prod}  # ← Change from DATABASE__NAME

      # Fix JWT variable
      AUTH__JWT_SECRET_KEY: ${JWT_SECRET}  # ← Change from JWT_SECRET

      # Add Vault flag
      VAULT__ENABLED: "true"  # ← ADD THIS LINE
```

**Reference**: `docs/PRODUCTION_DEPLOYMENT_FIXES.md`

---

## Production Deployment Checklist

### Pre-Deployment Validation

**Infrastructure**:
- [ ] Docker images build successfully (`docker compose -f docker-compose.production.yml build`)
- [ ] All entrypoint scripts exist and are executable
- [ ] All configuration directories exist
- [ ] Environment variables correctly mapped

**Backend**:
- [ ] `poetry run mypy` passes (type checking)
- [ ] `poetry run pytest tests/` passes (all tests)
- [ ] `poetry run ruff check` passes (linting)
- [ ] Database migrations up to date (`python -m alembic upgrade head`)
- [ ] No hardcoded localhost URLs in production code

**Frontend**:
- [ ] `pnpm type-check` passes (TypeScript checking)
- [ ] `pnpm lint` passes (ESLint)
- [ ] `pnpm build` succeeds (production build)
- [ ] No mock data fallbacks in production code
- [ ] Environment variables set correctly

### Security Checklist

**Secrets Management**:
- [ ] `VAULT__ENABLED=true` in production environment
- [ ] Vault/OpenBao initialized and unsealed
- [ ] JWT secrets stored in Vault (not in environment variables)
- [ ] Database passwords rotated from defaults
- [ ] Redis password set (not default)
- [ ] MinIO credentials changed from defaults

**Environment Variables** (`.env.production`):
```bash
# Required secrets (generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))")
SECRET_KEY=<generated-secret>
JWT_SECRET=<generated-secret>
NEXTAUTH_SECRET=<generated-secret>

# Database
POSTGRES_PASSWORD=<strong-password>

# Redis
REDIS_PASSWORD=<strong-password>

# Vault
VAULT_ROOT_TOKEN=<vault-root-token>
VAULT__ENABLED=true

# MinIO
MINIO_SECRET_KEY=<generated-secret>

# Environment
ENVIRONMENT=production
```

**Network Security**:
- [ ] HTTPS enabled with valid SSL certificates
- [ ] CORS configured for production domains only
- [ ] Trusted hosts configured (not `["*"]`)
- [ ] Rate limiting enabled
- [ ] Firewall rules configured

### Database Checklist

**Configuration**:
- [ ] PostgreSQL 15+ running
- [ ] Extensions enabled (uuid-ossp, pg_trgm, btree_gin)
- [ ] Performance tuning applied (see `database/init/01-init.sql`)
- [ ] Connection pooling configured (max_connections=200)
- [ ] Backups configured and tested

**Migrations**:
- [ ] All migrations applied (`alembic upgrade head`)
- [ ] Migration history clean (no conflicting heads)
- [ ] Rollback plan documented
- [ ] Database backup taken before migration

### Redis Checklist

**Configuration**:
- [ ] Redis 7+ running
- [ ] AOF persistence enabled (`appendonly yes`)
- [ ] Max memory configured (`maxmemory 256mb`)
- [ ] Eviction policy set (`maxmemory-policy allkeys-lru`)
- [ ] Password configured
- [ ] Persistence directory mounted

**Verification**:
```bash
docker compose exec redis redis-cli ping
# Should return: PONG

docker compose exec redis redis-cli CONFIG GET appendonly
# Should return: 1) "appendonly" 2) "yes"
```

### Vault/OpenBao Checklist

**Initialization**:
- [ ] Vault initialized (`bao operator init`)
- [ ] Unseal keys stored securely (3 of 5 required)
- [ ] Root token stored securely
- [ ] Vault unsealed (requires 3 keys)
- [ ] KV secrets engine enabled (`bao secrets enable -path=secret kv-v2`)

**Secrets Stored**:
- [ ] JWT secret (`bao kv put secret/auth/jwt_secret value="..."`)
- [ ] Database credentials (`bao kv put secret/database/...`)
- [ ] API keys (`bao kv put secret/api/...`)
- [ ] Service credentials (`bao kv put secret/services/...`)

**Verification**:
```bash
# Check Vault status
docker compose exec openbao bao status

# Test secret read
docker compose exec openbao bao kv get secret/auth/jwt_secret
```

### Application Startup Checklist

**Service Health**:
- [ ] PostgreSQL healthy (`pg_isready`)
- [ ] Redis healthy (`redis-cli ping`)
- [ ] Vault unsealed and accessible
- [ ] MinIO accessible
- [ ] All containers running

**Application Startup**:
- [ ] Backend starts without errors
- [ ] Frontend builds successfully
- [ ] Celery workers start
- [ ] Celery beat starts
- [ ] No error logs on startup

**Health Endpoints**:
```bash
# Backend health
curl http://localhost:8000/health
# Should return: {"status": "healthy", "timestamp": "..."}

# Frontend health
curl http://localhost:3000
# Should return 200 OK
```

### Production Validation Checks

**Backend Validation** (`src/dotmac/platform/settings.py:634`):
- [ ] `ENVIRONMENT=production` set
- [ ] `VAULT__ENABLED=true` set
- [ ] `TRUSTED_HOSTS` configured (not `["*"]`)
- [ ] JWT secret loaded from Vault
- [ ] No validation errors on startup

**Frontend Validation**:
- [ ] `NODE_ENV=production` set
- [ ] `NEXT_PUBLIC_API_BASE_URL` points to production backend
- [ ] `NEXT_PUBLIC_USE_MOCK_DATA` NOT set
- [ ] No mock data visible in UI
- [ ] No console errors on page load

### Monitoring & Observability

**Logging**:
- [ ] Application logs configured
- [ ] Log aggregation enabled (if using)
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Log rotation configured

**Metrics**:
- [ ] Prometheus metrics enabled
- [ ] Grafana dashboards configured
- [ ] Alerts configured (critical services down)
- [ ] SLO/SLA monitoring enabled

**Tracing**:
- [ ] OpenTelemetry configured
- [ ] Jaeger/Tempo configured
- [ ] Traces visible in UI
- [ ] Span data captured

### CI/CD Integration

**GitHub Actions** (`.github/workflows/staging-deploy.yml`):
- [ ] Type checking enabled (`pnpm type-check`)
- [ ] Linting enabled (`pnpm lint`, `poetry run ruff`)
- [ ] Tests run (`poetry run pytest`, `pnpm test`)
- [ ] Build validation (`pnpm build`)
- [ ] E2E tests run (`pnpm test:e2e`)

**Deployment Pipeline**:
- [ ] Staging deployment automated
- [ ] Production deployment requires approval
- [ ] Rollback procedure documented
- [ ] Deployment notifications configured (Slack, etc.)

---

## Post-Deployment Verification

### Smoke Tests

**Critical Paths**:
- [ ] User can log in
- [ ] User can view dashboard
- [ ] API returns real data (not mocks)
- [ ] WebSocket connections work
- [ ] Background jobs execute
- [ ] Scheduled tasks run

**API Endpoints**:
```bash
# Authentication
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@dotmac.com", "password": "..."}'

# Health check
curl http://localhost:8000/health

# Example API endpoint
curl http://localhost:8000/api/v1/diagnostics/alarms \
  -H "Authorization: Bearer <token>"
```

**Expected Results**:
- [ ] Authentication returns valid token
- [ ] API returns real data (check alarm IDs are not ALM-001, ALM-002, etc.)
- [ ] No mock data visible
- [ ] Response times acceptable (<1s for most endpoints)

### Performance Validation

**Load Testing** (Optional but recommended):
```bash
# Install k6 or similar
brew install k6

# Run load test
k6 run load-test.js
```

**Benchmarks**:
- [ ] P50 response time < 200ms
- [ ] P95 response time < 1s
- [ ] P99 response time < 2s
- [ ] No timeouts under normal load
- [ ] No memory leaks over 24h

### Security Validation

**Penetration Testing** (Recommended):
- [ ] OWASP Top 10 checks
- [ ] SQL injection tests
- [ ] XSS vulnerability tests
- [ ] CSRF protection tests
- [ ] Authentication bypass tests

**Security Headers**:
```bash
curl -I https://your-domain.com
# Should include:
# - Strict-Transport-Security
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - Content-Security-Policy
```

---

## Rollback Plan

### Emergency Rollback Procedure

**If deployment fails**:
1. Identify issue from logs
2. Decide: Fix forward or rollback
3. If rollback needed:
   ```bash
   # Stop current deployment
   docker compose -f docker-compose.production.yml down

   # Restore database backup (if migrations ran)
   pg_restore -h localhost -U dotmac_user -d dotmac_prod backup.sql

   # Deploy previous version
   git checkout <previous-tag>
   docker compose -f docker-compose.production.yml up -d
   ```

**Rollback Checklist**:
- [ ] Database backup available
- [ ] Previous Docker images available
- [ ] Previous Git tag known
- [ ] Rollback tested in staging
- [ ] Downtime window communicated

---

## Known Issues & Workarounds

### 1. Environment Variable Mapping

**Issue**: `docker-compose.production.yml` uses wrong environment variable names

**Workaround**: Update file manually before deployment (see "Environment Variables Mapping" section above)

**Reference**: `docs/PRODUCTION_DEPLOYMENT_FIXES.md`

### 2. Notification Settings Uses Mock Data

**Issue**: Notification settings page uses mock preferences

**Impact**: Low (settings page, not operational data)

**Workaround**: None required for initial deployment

**Reference**: `docs/FRONTEND_PRODUCTION_FIXES.md`

---

## Documentation Reference

- **Production Deployment Fixes**: `docs/PRODUCTION_DEPLOYMENT_FIXES.md`
- **Frontend Production Fixes**: `docs/FRONTEND_PRODUCTION_FIXES.md`
- **Frontend Production Issues**: `docs/FRONTEND_PRODUCTION_ISSUES.md`
- **Makefile Scripts Fixes**: `docs/MAKEFILE_SCRIPTS_FIXES.md`
- **Operational Scripts**: `docs/OPERATIONAL_SCRIPTS.md`
- **Staging Deployment**: `docs/STAGING_DEPLOYMENT.md`
- **Quick Start Guide**: `QUICK_START_STAGING.md`

---

## Summary

**Critical Issues**: 5/5 Fixed ✅
**Medium Issues**: 1 Documented (manual fix required)
**Low Issues**: 1 Documented (can defer)

**Blockers for Production**:
- ⚠️ Update `docker-compose.production.yml` environment variables (manual fix required)
- ⚠️ Create `.env.production` with real secrets
- ⚠️ Initialize and unseal Vault
- ⚠️ Configure SSL certificates for HTTPS

**Ready for Staging**: ✅ Yes (all critical fixes applied)
**Ready for Production**: ⚠️ Almost (requires manual environment variable fixes)

---

**Deployment Approval**:
- [ ] Technical Lead Review
- [ ] Security Review
- [ ] QA Sign-off
- [ ] Stakeholder Approval

**Post-Deployment**:
- [ ] Monitor logs for 1 hour
- [ ] Run smoke tests
- [ ] Verify metrics/monitoring
- [ ] Update runbook with lessons learned

---

**Last Updated**: 2025-10-17
**Maintained By**: DotMac Platform Team
