# Critical Fixes Deployment Checklist

## Pre-Deployment

### Workflow Backfill Decision

Choose ONE strategy:

**Option A: Strict Isolation (Recommended for production)**
```bash
# Before running migration, set the default tenant ID
export WORKFLOW_DEFAULT_TENANT_ID="your-primary-tenant-id"
alembic upgrade head
```

**Option B: Keep Global Templates**
```bash
# Run migration without backfill - existing workflows remain global
alembic upgrade head

# Then manually identify workflows that should be tenant-specific:
# SELECT id, name, tenant_id FROM workflows WHERE tenant_id IS NULL;
# UPDATE workflows SET tenant_id = 'tenant-id' WHERE id IN (...);
```

---

## Deployment Steps

### Step 1: Set Environment Variables (if backfilling)
```bash
export WORKFLOW_DEFAULT_TENANT_ID=your-tenant-id  # Optional
```

### Step 2: Run Database Migration
```bash
alembic upgrade head
```

### Step 3: Deploy Application
```bash
# Your standard deployment process
docker-compose up -d
# or
kubectl apply -f ...
```

---

## Post-Deployment Verification

### Smoke Test Checklist

#### 1. Auth Endpoints
```bash
# Platform auth login
curl -X POST http://localhost:8000/api/platform/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test"}'

# ISP auth login
curl -X POST http://localhost:8000/api/isp/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test"}'
```

#### 2. API Path Verification
```bash
# Verify paths are accessible WITHOUT /admin prefix
curl http://localhost:8000/api/platform/v1/health
curl http://localhost:8000/api/isp/v1/health
```

#### 3. Workflow Tenant Isolation
```bash
# Get token for a specific tenant
TOKEN=$(curl -s -X POST http://localhost:8000/api/isp/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tenant-user@example.com", "password": "test"}' | jq -r '.access_token')

# List workflows - should only show tenant's workflows
curl http://localhost:8000/api/isp/v1/workflows \
  -H "Authorization: Bearer $TOKEN"

# Verify no cross-tenant data leakage
# Workflows with NULL tenant_id should NOT appear unless include_global=true
```

---

## Rollback Plan

If issues occur:

### API Path Issues
```bash
# Revert platform_main.py and isp_main.py
git checkout HEAD~1 -- src/dotmac/platform/platform_main.py
git checkout HEAD~1 -- src/dotmac/platform/isp_main.py
```

### Workflow Tenant Issues
```bash
# Migration cannot be easily rolled back without data loss
# If needed, manually set tenant_id back to NULL for affected records:
# UPDATE workflows SET tenant_id = NULL WHERE tenant_id = 'backfilled-tenant';
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/dotmac/platform/platform_main.py` | Removed `default_base_prefix="/admin"` |
| `src/dotmac/platform/isp_main.py` | Removed `default_base_prefix="/admin"` |
| `src/dotmac/platform/workflows/service.py` | Added `include_global` parameter for strict isolation |
| `alembic/versions/2025_11_30_1200_*.py` | Added optional backfill during migration |
