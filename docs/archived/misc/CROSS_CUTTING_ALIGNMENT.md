# Cross-Cutting Alignment Report

**Date:** 2025-10-16
**Status:** 🔴 Critical Alignment Issues Detected

## Executive Summary

Analysis of backend (FastAPI) and frontend (Next.js) revealed **3 critical cross-cutting concerns** requiring immediate alignment:

1. **Feature Toggle Drift** - Backend has 20+ flags, frontend has 6
2. **JWT Authentication Inconsistency** - Mixed localStorage/cookie usage
3. **Real-time Auth Token Misalignment** - SSE/WS clients may use wrong token source

---

## 1. Feature Toggles Alignment

### Current State

| Backend Feature Flag | Frontend Equivalent | Status |
|---------------------|-------------------|--------|
| `features.mfa_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.audit_logging` | ❌ Missing | 🔴 Not exposed |
| `features.email_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.communications_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.sms_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.storage_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.search_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.data_transfer_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.celery_enabled` | ❌ Missing | 🔴 Not exposed |
| `features.secrets_vault` | ❌ Missing | 🔴 Not exposed |
| ❌ No backend flag | `enableGraphQL` | 🟡 Frontend-only |
| ❌ No backend flag | `enableAnalytics` | 🟡 Frontend-only |
| ❌ No backend flag | `enableBanking` | 🟡 Frontend-only |
| ❌ No backend flag | `enablePayments` | 🟡 Frontend-only |
| ❌ No backend flag | `enableRadius` | 🟡 Frontend-only |
| ❌ No backend flag | `enableNetwork` | 🟡 Frontend-only |
| ❌ No backend flag | `enableAutomation` | 🟡 Frontend-only |

### Backend Feature Flags
**File:** `src/dotmac/platform/settings.py:1236`

```python
class FeatureFlags(BaseModel):
    # Core features
    mfa_enabled: bool = False
    audit_logging: bool = True

    # Communications
    email_enabled: bool = True
    communications_enabled: bool = True
    sms_enabled: bool = False

    # Storage - MinIO only
    storage_enabled: bool = True

    # Search functionality (MeiliSearch)
    search_enabled: bool = True

    # Data handling
    data_transfer_enabled: bool = True
    data_transfer_excel: bool = True
    data_transfer_compression: bool = True
    data_transfer_streaming: bool = True

    # File processing
    file_processing_enabled: bool = True
    file_processing_pdf: bool = True
    file_processing_images: bool = True
    file_processing_office: bool = True

    # Background tasks
    celery_enabled: bool = True
    celery_redis: bool = True

    # Encryption and secrets
    encryption_fernet: bool = True
    secrets_vault: bool = False

    # Database
    db_migrations: bool = True
    db_postgresql: bool = True
    db_sqlite: bool = True
```

### Frontend Feature Flags
**File:** `frontend/apps/base-app/lib/config.ts:22`

```typescript
features: {
  enableGraphQL: process.env.NEXT_PUBLIC_ENABLE_GRAPHQL === 'true',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableBanking: process.env.NEXT_PUBLIC_ENABLE_BANKING === 'true',
  enablePayments: process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === 'true',
  enableRadius: process.env.NEXT_PUBLIC_ENABLE_RADIUS !== 'false',
  enableNetwork: process.env.NEXT_PUBLIC_ENABLE_NETWORK !== 'false',
  enableAutomation: process.env.NEXT_PUBLIC_ENABLE_AUTOMATION !== 'false',
}
```

### Recommendations

1. **Backend:** Add missing domain flags
   ```python
   # OSS/BSS Domain Features
   graphql_enabled: bool = True
   analytics_enabled: bool = True
   banking_enabled: bool = True
   payments_enabled: bool = True
   radius_enabled: bool = True
   network_enabled: bool = True
   automation_enabled: bool = True
   wireless_enabled: bool = True
   fiber_enabled: bool = True
   orchestration_enabled: bool = True
   ```

2. **Frontend:** Sync all backend flags via `/api/v1/platform/config` endpoint
3. **Create unified source of truth:** Backend exposes all flags, frontend consumes dynamically

---

## 2. JWT Authentication Consolidation

### Current Architecture (Problematic)

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                             │
│                                                          │
│  ┌─────────────────┐        ┌──────────────────────┐   │
│  │  Apollo Client  │        │   REST API Client    │   │
│  │                 │        │                      │   │
│  │  - Reads from   │        │  - Uses HttpOnly     │   │
│  │    localStorage │        │    cookies           │   │
│  │  - Sets Bearer  │        │  - credentials:      │   │
│  │    header       │        │    'include'         │   │
│  └─────────────────┘        └──────────────────────┘   │
│           │                             │               │
└───────────┼─────────────────────────────┼───────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                     Backend                              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         AuditContextMiddleware                    │  │
│  │                                                   │  │
│  │  - Expects Authorization: Bearer <token>         │  │
│  │  - Extracts JWT claims (user_id, tenant_id)     │  │
│  │  - Sets request.state for audit logging         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Issues

1. **Apollo uses localStorage token** (`client.ts:22`)
   ```typescript
   const token = typeof window !== 'undefined'
     ? localStorage.getItem('token')
     : null;
   ```

2. **REST client uses cookies** (`client.ts:16`)
   ```typescript
   credentials: 'include', // Include cookies
   ```

3. **Audit middleware expects JWT from Bearer header** (`middleware.py:40`)
   ```python
   if auth_header and auth_header.startswith("Bearer "):
       token = auth_header.split(" ")[1]
       claims = jwt_service.verify_token(token)
   ```

4. **No cookie JWT extraction in middleware** - Only checks `Authorization` header

### Root Cause

**Token storage is inconsistent:**
- Login flow likely stores token in **both** localStorage AND HttpOnly cookie
- Apollo reads from localStorage
- REST API relies on cookie
- Middleware only checks header, not cookie

### Recommended Fix: Cookie-First Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                             │
│                                                          │
│  ┌─────────────────┐        ┌──────────────────────┐   │
│  │  Apollo Client  │        │   REST API Client    │   │
│  │                 │        │                      │   │
│  │  - credentials: │        │  - credentials:      │   │
│  │    'include'    │        │    'include'         │   │
│  │  - NO localStorage       │  - NO localStorage   │   │
│  │  - Cookies only │        │  - Cookies only      │   │
│  └─────────────────┘        └──────────────────────┘   │
│           │                             │               │
└───────────┼─────────────────────────────┼───────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                     Backend                              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         AuditContextMiddleware                    │  │
│  │                                                   │  │
│  │  1. Check Authorization header (Bearer token)    │  │
│  │  2. Fall back to cookie (access_token)           │  │
│  │  3. Extract JWT claims from either source        │  │
│  │  4. Set request.state for audit logging          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Changes Required

**Backend (`src/dotmac/platform/audit/middleware.py:37`):**
```python
# Try Authorization header first
auth_header = request.headers.get("Authorization")
token = None

if auth_header and auth_header.startswith("Bearer "):
    token = auth_header.split(" ")[1]
else:
    # Fall back to cookie
    token = request.cookies.get("access_token")

if token:
    try:
        claims = jwt_service.verify_token(token)
        request.state.user_id = claims.get("sub")
        # ... rest of claims extraction
    except Exception as e:
        logger.debug("Failed to extract user from JWT", error=str(e))
```

**Frontend (`frontend/apps/base-app/lib/graphql/client.ts:20`):**
```typescript
// REMOVE localStorage token logic
const authLink = setContext((_, { headers }) => {
  // Cookies are automatically included via credentials: 'include'
  // No need to manually add Authorization header
  return {
    headers: {
      ...headers,
      // Remove: authorization: token ? `Bearer ${token}` : '',
    },
  };
});
```

**Frontend Auth Hook (`frontend/apps/base-app/hooks/useAuth.tsx`):**
```typescript
// REMOVE localStorage.setItem('token', ...)
// Rely on backend setting HttpOnly cookie
```

---

## 3. Real-Time Auth Alignment

### Current Implementation

**SSE Client (`frontend/apps/base-app/lib/realtime/sse-client.ts:50`):**
```typescript
const url = new URL(this.config.endpoint, window.location.origin);
url.searchParams.set('token', this.config.token);
```

**WebSocket Client (`frontend/apps/base-app/lib/realtime/websocket-client.ts:120`):**
```typescript
const url = new URL(wsUrl, window.location.origin);
url.searchParams.set('token', this.config.token);
```

### Issues

1. **Token source undefined** - Where does `this.config.token` come from?
2. **Query param tokens** - Not ideal for security (logged in server logs)
3. **No cookie fallback** - Should try cookies first

### Recommended Fix

**Option 1: Cookie-Only (Preferred)**
```typescript
// SSE already supports cookies automatically
const eventSource = new EventSource(url.toString(), {
  withCredentials: true  // Send cookies
});

// WebSocket needs custom header (not supported by browser WebSocket API)
// Must use query param OR upgrade to Socket.IO which supports custom headers
```

**Option 2: Hybrid (Backward Compatible)**
```typescript
// Try cookie first, fall back to query param
const token = this.config.token || getCookieToken();
if (token) {
  url.searchParams.set('token', token);
}
```

**Backend Real-time Router:**
```python
# Accept both cookie and query param
token = request.query_params.get("token") or request.cookies.get("access_token")
if token:
    claims = jwt_service.verify_token(token)
```

---

## 4. Environment Variables Mapping

### Backend Settings
**File:** `src/dotmac/platform/settings.py:402-500`

```python
class Settings(BaseSettings):
    # Core
    app_name: str = "dotmac-platform"
    app_version: str = "1.0.0"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4

    # Database
    database: DatabaseSettings
    database.url: PostgresDsn | None
    database.host: str = "localhost"
    database.port: int = 5432
    database.database: str = "dotmac"
    database.username: str = "dotmac"
    database.password: str = ""

    # Redis
    redis: RedisSettings
    redis.url: RedisDsn | None
    redis.host: str = "localhost"
    redis.port: int = 6379
    redis.password: str = ""
    redis.db: int = 0
```

### Frontend Config
**File:** `frontend/apps/base-app/lib/config.ts:10-87`

```typescript
export const platformConfig = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    timeout: 30000,
  },

  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'DotMac Platform',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  },

  branding: {
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'DotMac',
    productName: process.env.NEXT_PUBLIC_PRODUCT_NAME || 'DotMac Platform',
  },
}
```

### Environment Variable Map

| Backend Env Var | Frontend Env Var | Purpose |
|----------------|-----------------|---------|
| `APP_NAME` | `NEXT_PUBLIC_APP_NAME` | Application name |
| `APP_VERSION` | `NEXT_PUBLIC_APP_VERSION` | Version display |
| `ENVIRONMENT` | `NEXT_PUBLIC_ENVIRONMENT` | deployment env |
| `DATABASE_URL` | ❌ Not exposed | Backend-only |
| `REDIS_URL` | ❌ Not exposed | Backend-only |
| ❌ No backend var | `NEXT_PUBLIC_API_URL` | Frontend API endpoint |
| ❌ No backend var | `NEXT_PUBLIC_ENABLE_GRAPHQL` | Frontend feature |
| ❌ No backend var | `NEXT_PUBLIC_ENABLE_BANKING` | Frontend feature |

### Recommendation: Unified Config Endpoint

**Create `/api/v1/platform/config` endpoint:**

```python
@router.get("/config")
async def get_platform_config(
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict:
    """Return public platform configuration for frontend."""
    return {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment.value,
        },
        "features": {
            "graphql_enabled": settings.features.graphql_enabled,
            "analytics_enabled": settings.features.analytics_enabled,
            "banking_enabled": settings.features.banking_enabled,
            # ... all feature flags
        },
        "api": {
            "graphql_url": "/api/v1/graphql",
            "rest_url": "/api/v1",
        },
    }
```

**Frontend loads on app init:**
```typescript
const platformConfig = await fetch('/api/v1/platform/config').then(r => r.json());
```

---

## 5. Celery Lifecycle + Frontend Sync

### Backend Lifecycle Tasks
**File:** `src/dotmac/platform/services/lifecycle/tasks.py:36`

```python
async def _execute_provisioning_workflow(
    service_instance_id: str,
    tenant_id: str
) -> dict[str, Any]:
    """Execute multi-step provisioning workflow."""

    # Steps:
    # 1. Validate service configuration
    # 2. Allocate network resources (IP, VLAN)
    # 3. Configure network equipment (ONT, router)
    # 4. Activate service in provisioning systems (RADIUS)
    # 5. Test connectivity and performance
    # 6. Complete provisioning
```

### Frontend Lifecycle Hook
**File:** `frontend/apps/base-app/hooks/useServiceLifecycle.ts:36`

```typescript
export function useServiceStatistics(): UseQueryResult<ServiceStatistics, Error> {
  return useQuery({
    queryKey: ['services', 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ServiceStatistics>(
        '/api/v1/services/lifecycle/statistics'
      );
      return extractDataOrThrow(response);
    },
    staleTime: 60_000,
  });
}
```

### Alignment Issues

1. **Polling vs Push** - Frontend polls every 60s, should use SSE/WebSocket for real-time
2. **Event schema mismatch** - Backend emits workflow events, frontend expects statistics
3. **No workflow progress tracking** - Frontend can't show step-by-step provisioning status

### Recommended Real-Time Integration

**Backend: Emit lifecycle events**
```python
# In provisioning workflow
await publish_event(
    event_type="service.provisioning.progress",
    data={
        "service_instance_id": str(service_id),
        "status": "validating",
        "step": 1,
        "total_steps": 6,
        "message": "Validating service configuration",
    },
    tenant_id=tenant_id,
)
```

**Frontend: Subscribe to lifecycle events**
```typescript
export function useServiceWorkflowProgress(serviceId: string) {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const sse = createSSEClient({
      endpoint: `/api/v1/realtime/service-lifecycle/${serviceId}`,
      token: getAuthToken(),
    });

    const unsubscribe = sse.subscribe('service.provisioning.progress', (event) => {
      setProgress(event.data);
    });

    return () => {
      unsubscribe();
      sse.close();
    };
  }, [serviceId]);

  return progress;
}
```

---

## Action Items

### Priority 1: Critical (Do Immediately)

- [ ] **JWT Consolidation**
  - [ ] Update `AuditContextMiddleware` to check cookies (middleware.py:37)
  - [ ] Remove localStorage token from Apollo client (client.ts:22)
  - [ ] Test GraphQL queries use cookie auth
  - [ ] Test audit logs capture user context

- [ ] **Real-time Auth Fix**
  - [ ] Update SSE/WS clients to use cookie token (sse-client.ts:50, websocket-client.ts:120)
  - [ ] Update backend real-time routers to accept cookie auth
  - [ ] Test real-time connections with cookie-only auth

### Priority 2: High (This Sprint)

- [ ] **Feature Flags Sync**
  - [ ] Add missing domain flags to backend FeatureFlags (settings.py:1236)
  - [ ] Create `/api/v1/platform/config` endpoint
  - [ ] Update frontend to fetch flags from backend
  - [ ] Remove hardcoded frontend feature flags

- [ ] **Environment Variables**
  - [ ] Document all env vars in `.env.example`
  - [ ] Map backend → frontend env vars
  - [ ] Create deployment checklist

### Priority 3: Medium (Next Sprint)

- [ ] **Lifecycle Real-time Integration**
  - [ ] Add SSE event publishing to lifecycle tasks
  - [ ] Create `useServiceWorkflowProgress` hook
  - [ ] Update NOC dashboard to show real-time provisioning

- [ ] **GraphQL E2E Test**
  - [ ] Write test script for GraphQL with cookie auth
  - [ ] Verify tenant isolation in GraphQL queries
  - [ ] Test Apollo subscriptions

---

## Testing Strategy

### 1. JWT Cookie Auth Test
```bash
# Login and get cookie
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c cookies.txt

# Test GraphQL with cookie
curl -X POST http://localhost:8000/api/v1/graphql \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"query":"{ subscribers { id username } }"}'
```

### 2. Feature Flags Test
```bash
# Get backend config
curl http://localhost:8000/api/v1/platform/config

# Verify frontend loads config
# Check browser DevTools → Network → config response
```

### 3. Real-time Auth Test
```bash
# Test SSE with cookie
curl http://localhost:8000/api/v1/realtime/onu-status \
  -H "Accept: text/event-stream" \
  -b cookies.txt

# Test WebSocket (use wscat)
wscat -c "ws://localhost:8000/api/v1/realtime/ws/sessions" \
  --header "Cookie: access_token=..."
```

### 4. Lifecycle Integration Test
```python
# Trigger provisioning workflow
response = await client.post(
    "/api/v1/services/lifecycle/provision",
    json={"service_instance_id": "..."},
)

# Subscribe to SSE for progress
async with aiohttp.ClientSession() as session:
    async with session.get(
        "http://localhost:8000/api/v1/realtime/service-lifecycle/..."
    ) as resp:
        async for line in resp.content:
            event = json.loads(line)
            print(event)  # Should see step-by-step progress
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Breaking changes to auth flow** | High - Users logged out | Deploy with backward compatibility window |
| **Real-time connections fail** | Medium - Loss of live updates | Add fallback to polling |
| **Feature flags mismatch** | Low - UI shows disabled features | Gate with feature checks |
| **Env var deployment errors** | High - Service won't start | Comprehensive .env.example + validation |

---

## Success Criteria

- ✅ Single source of truth for JWT (HttpOnly cookies)
- ✅ Feature flags synced backend → frontend
- ✅ Real-time clients use consistent auth
- ✅ Environment variables documented and mapped
- ✅ GraphQL + REST use same auth mechanism
- ✅ Audit logging works for all request types
- ✅ Lifecycle events flow to frontend real-time

---

## References

- Backend Settings: `src/dotmac/platform/settings.py`
- Frontend Config: `frontend/apps/base-app/lib/config.ts`
- Apollo Client: `frontend/apps/base-app/lib/graphql/client.ts`
- Audit Middleware: `src/dotmac/platform/audit/middleware.py`
- SSE Client: `frontend/apps/base-app/lib/realtime/sse-client.ts`
- WebSocket Client: `frontend/apps/base-app/lib/realtime/websocket-client.ts`
- Lifecycle Tasks: `src/dotmac/platform/services/lifecycle/tasks.py`
- Service Hooks: `frontend/apps/base-app/hooks/useServiceLifecycle.ts`
