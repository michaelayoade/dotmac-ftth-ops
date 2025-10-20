# Staging Deployment Validation Checklist

**Purpose**: Validate platform/tenant separation in staging environment
**Date**: 2025-10-19
**Status**: Ready for execution

---

## Pre-Deployment Checklist

### Environment Setup
- [ ] `.env.multi-tenant` configured with staging values
- [ ] `.env.single-tenant` configured for testing
- [ ] `.env.hybrid` configured for testing
- [ ] Database credentials updated
- [ ] Redis credentials updated
- [ ] MinIO/S3 credentials updated
- [ ] SMTP credentials configured
- [ ] CORS origins include staging domains
- [ ] Secret keys generated (64+ characters)
- [ ] JWT secret keys generated

### Infrastructure
- [ ] PostgreSQL 16+ running
- [ ] Redis 7+ running
- [ ] MinIO or S3 accessible
- [ ] SMTP server configured
- [ ] Docker and Docker Compose installed
- [ ] Sufficient disk space (10GB+)
- [ ] Sufficient memory (4GB+)

---

## Multi-Tenant Deployment Validation

### 1. Deploy Multi-Tenant Mode

```bash
# Copy environment file
cp .env.multi-tenant.example .env.multi-tenant

# Update values in .env.multi-tenant
vim .env.multi-tenant

# Deploy
./scripts/deploy-multi-tenant.sh
```

### 2. Backend Health Checks

```bash
# Main health check
curl http://localhost:8000/health
# Expected: {"status": "healthy", "version": "1.0.0", "environment": "staging"}

# Readiness check
curl http://localhost:8000/health/ready
# Expected: {"status": "ready", "healthy": true, ...}

# Liveness check
curl http://localhost:8000/health/live
# Expected: {"status": "alive", ...}
```

**Validation**:
- [ ] Main health check returns 200
- [ ] Readiness check shows all_healthy: true
- [ ] Liveness check returns 200

### 3. Platform App Routes

```bash
# Platform admin endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/platform/v1/tenant

# Platform licensing endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/platform/v1/licensing

# Platform audit endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/platform/v1/audit
```

**Validation**:
- [ ] Platform routes return 400 or 401 (not 404)
- [ ] Error message indicates authentication/tenant required
- [ ] Correct platform app is handling requests

### 4. Tenant App Routes

```bash
# Tenant customers endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/tenant/v1/customers

# Tenant billing endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/tenant/v1/billing

# Tenant RADIUS endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/tenant/v1/radius
```

**Validation**:
- [ ] Tenant routes return 400 or 401 (not 404)
- [ ] Error message indicates authentication/tenant required
- [ ] Correct tenant app is handling requests

### 5. Shared Routes

```bash
# Auth endpoint
curl http://localhost:8000/api/v1/auth

# Users endpoint
curl -H "X-Tenant-ID: test-tenant" \
     http://localhost:8000/api/v1/users
```

**Validation**:
- [ ] Shared routes accessible from both apps
- [ ] Auth endpoint returns expected response

### 6. Startup Logs Validation

```bash
# Check deployment mode in logs
docker-compose -f docker-compose.multi-tenant.yml logs dotmac-platform | grep "deployment_mode"

# Check app mounting logs
docker-compose -f docker-compose.multi-tenant.yml logs dotmac-platform | grep "mounting"

# Check router registration
docker-compose -f docker-compose.multi-tenant.yml logs dotmac-platform | grep "Router Registration"
```

**Expected Log Lines**:
- [ ] `mounting_applications deployment_mode=multi_tenant`
- [ ] `multi_tenant_mode.mounting_both_apps`
- [ ] `Platform App Registration Complete - ✅ Registered: 12 routers`
- [ ] `Tenant App Registration Complete - ✅ Registered: 43 routers`
- [ ] `Router Registration Complete - ✅ Registered: 88 routers`

### 7. Database Validation

```bash
# Connect to database
docker-compose -f docker-compose.multi-tenant.yml exec db \
  psql -U dotmac_user -d dotmac

# Check tables exist
\dt

# Check RBAC permissions seeded
SELECT COUNT(*) FROM permissions;
SELECT COUNT(*) FROM roles;
```

**Validation**:
- [ ] All tables created successfully
- [ ] RBAC permissions seeded
- [ ] ISP permissions exist

### 8. Integration Tests

**Create Test Tenant**:
```bash
# TODO: Add tenant creation endpoint test
```

**Create Test User**:
```bash
# TODO: Add user creation endpoint test
```

**Validate**:
- [ ] Tenant creation works
- [ ] User creation works
- [ ] Authentication works
- [ ] Authorization works

---

## Single-Tenant Deployment Validation

### 1. Deploy Single-Tenant Mode

```bash
# Copy environment file
cp .env.single-tenant.example .env.single-tenant

# Update values
vim .env.single-tenant

# Deploy
docker-compose -f docker-compose.single-tenant.yml up -d
```

### 2. Validate Routes

```bash
# Tenant routes at /api/v1
curl http://localhost:8000/api/v1/customers
curl http://localhost:8000/api/v1/billing
curl http://localhost:8000/api/v1/radius

# Verify platform routes NOT mounted
curl http://localhost:8000/api/platform/v1/tenant
# Expected: 404 or 400 (not accessible)
```

**Validation**:
- [ ] Tenant routes accessible at `/api/v1/*`
- [ ] Platform routes return 404
- [ ] Fixed tenant ID used automatically

### 3. Startup Logs Validation

```bash
docker-compose -f docker-compose.single-tenant.yml logs dotmac-isp | grep "mounting"
```

**Expected Log Lines**:
- [ ] `mounting_applications deployment_mode=single_tenant`
- [ ] `single_tenant_mode.mounting_tenant_app_only`
- [ ] `Tenant App Registration Complete`

---

## Hybrid Deployment Validation

### 1. Deploy Hybrid Mode

```bash
# Deploy full hybrid setup
docker-compose -f docker-compose.hybrid.yml up -d
```

### 2. Validate Control Plane

```bash
# Control plane health
curl http://localhost:8000/health

# Platform routes only
curl http://localhost:8000/api/platform/v1/tenant

# Verify tenant routes NOT mounted
curl http://localhost:8000/api/tenant/v1/customers
# Expected: 404
```

**Validation**:
- [ ] Control plane running on port 8000
- [ ] Platform routes accessible
- [ ] Tenant routes return 404

### 3. Validate Tenant Instance (US East)

```bash
# Tenant instance health
curl http://localhost:8001/health

# Tenant routes only
curl http://localhost:8001/api/tenant/v1/customers

# Verify platform routes NOT mounted
curl http://localhost:8001/api/platform/v1/tenant
# Expected: 404
```

**Validation**:
- [ ] US East instance running on port 8001
- [ ] Tenant routes accessible
- [ ] Platform routes return 404
- [ ] Separate database being used

### 4. Validate Tenant Instance (EU West)

```bash
# Tenant instance health
curl http://localhost:8002/health

# Tenant routes
curl http://localhost:8002/api/tenant/v1/customers
```

**Validation**:
- [ ] EU West instance running on port 8002
- [ ] Tenant routes accessible
- [ ] Separate database being used

### 5. Startup Logs Validation

```bash
# Control plane logs
docker-compose -f docker-compose.hybrid.yml logs dotmac-control-plane | grep "mounting"

# Tenant instance logs
docker-compose -f docker-compose.hybrid.yml logs dotmac-tenant-us-east | grep "mounting"
```

**Expected**:
- [ ] Control plane: `hybrid_mode.control_plane.mounting_platform_app`
- [ ] Tenant US: `hybrid_mode.tenant_instance.mounting_tenant_app`
- [ ] Tenant EU: `hybrid_mode.tenant_instance.mounting_tenant_app`

---

## Performance Testing

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test platform endpoint
ab -n 1000 -c 10 http://localhost:8000/health

# Test tenant endpoint
ab -n 1000 -c 10 http://localhost:8000/api/tenant/v1/customers
```

**Targets**:
- [ ] Health endpoint: < 50ms avg response time
- [ ] API endpoints: < 200ms avg response time
- [ ] No errors under moderate load

### Resource Usage

```bash
# Check container stats
docker stats dotmac-platform-multi-tenant
```

**Targets**:
- [ ] Memory usage < 500MB per container
- [ ] CPU usage < 50% under load
- [ ] Database connections < 20

---

## Security Validation

### 1. Authentication

```bash
# Attempt access without authentication
curl http://localhost:8000/api/tenant/v1/customers
# Expected: 401 Unauthorized

# Attempt access without tenant ID
curl -H "Authorization: Bearer fake-token" \
     http://localhost:8000/api/tenant/v1/customers
# Expected: 400 Bad Request (tenant required)
```

**Validation**:
- [ ] Unauthenticated requests rejected
- [ ] Missing tenant ID rejected
- [ ] Invalid tokens rejected

### 2. Authorization

**Validation**:
- [ ] Platform admin routes require platform:* scopes
- [ ] Tenant routes require tenant-specific scopes
- [ ] Cross-tenant access blocked

### 3. CORS

```bash
# Test CORS preflight
curl -X OPTIONS \
     -H "Origin: https://app.dotmac.io" \
     -H "Access-Control-Request-Method: POST" \
     http://localhost:8000/api/tenant/v1/customers
```

**Validation**:
- [ ] CORS headers present for allowed origins
- [ ] CORS headers absent for disallowed origins

---

## Monitoring & Observability

### Metrics

```bash
# Prometheus metrics endpoint
curl http://localhost:8000/metrics
```

**Validation**:
- [ ] Metrics endpoint accessible
- [ ] Deployment mode label present
- [ ] Request counts by endpoint
- [ ] Error rates tracked

### Logs

```bash
# Check structured logging
docker-compose logs dotmac-platform | grep "deployment_mode"
```

**Validation**:
- [ ] Structured logging working
- [ ] Deployment mode in logs
- [ ] Request/response logging
- [ ] Error logging with stack traces

### Tracing (Optional)

```bash
# Check OTEL collector
curl http://localhost:4317
```

**Validation**:
- [ ] OTEL collector receiving traces
- [ ] Traces include deployment mode

---

## Rollback Plan

### If Issues Found

1. **Stop deployment**:
   ```bash
   docker-compose down
   ```

2. **Check logs**:
   ```bash
   docker-compose logs > deployment-error.log
   ```

3. **Restore previous version**:
   ```bash
   git checkout previous-commit
   docker-compose up -d
   ```

4. **Document issues** in GitHub issue

---

## Sign-Off Checklist

### Multi-Tenant Mode
- [ ] All health checks passing
- [ ] Platform routes accessible
- [ ] Tenant routes accessible
- [ ] Shared routes accessible
- [ ] Logs show correct deployment mode
- [ ] Performance acceptable
- [ ] Security validations passed

### Single-Tenant Mode
- [ ] Tenant routes accessible at /api/v1
- [ ] Platform routes not accessible
- [ ] Fixed tenant ID working
- [ ] Logs show correct deployment mode

### Hybrid Mode
- [ ] Control plane working
- [ ] Tenant instances working
- [ ] Separate databases confirmed
- [ ] Regional routing working

### Final Approval
- [ ] All deployment modes validated
- [ ] No critical issues found
- [ ] Performance targets met
- [ ] Security requirements met
- [ ] Documentation updated
- [ ] Team notified of deployment

---

**Approved By**: _________________
**Date**: _________________
**Notes**: _________________

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
