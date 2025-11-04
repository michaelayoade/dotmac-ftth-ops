# Alertmanager Setup - Complete

**Date**: 2025-11-04  
**Status**: ✅ Enabled and Running

---

## What Was Done

### 1. Created Configuration

**Directory**: `monitoring/alertmanager/`  
**File**: `alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'tenant_id']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'dev-null'

receivers:
  - name: 'dev-null'
    # No notifications in local dev
```

### 2. Started Container

```bash
docker run -d --name alertmanager \
  -p 9093:9093 \
  -v $(pwd)/monitoring/alertmanager:/etc/alertmanager \
  prom/alertmanager:latest \
  --config.file=/etc/alertmanager/alertmanager.yml
```

### 3. Updated Environment

**File**: `.env.local`

```bash
# Before
export OBSERVABILITY__ALERTMANAGER_BASE_URL=

# After
export OBSERVABILITY__ALERTMANAGER_BASE_URL=http://localhost:9093
```

---

## Verification

```bash
# Check container
docker ps --filter name=alertmanager

# Test endpoint
curl http://localhost:9093/-/ready
# Expected: OK

# Web UI
open http://localhost:9093
```

---

## Impact on Backend Startup

### Before
```
Required services unavailable: alertmanager ❌
Running in degraded mode
```

### After (Next Restart)
```
✅ All services healthy
NO degraded mode warning
```

---

## Files Created

- `monitoring/alertmanager/alertmanager.yml` - Configuration
- `.env.local` - Updated with Alertmanager URL
- `ALERTMANAGER_SETUP.md` - This doc

---

## Next Steps

**Restart backend to apply changes:**

```bash
# Stop current backend (Ctrl+C)
./scripts/quick-backend-start.sh
```

**Expected result**: No more warnings! All health checks pass.

---

**Status**: ✅ Ready for backend restart
