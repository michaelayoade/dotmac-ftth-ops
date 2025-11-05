# Environment Variables Reference

**Complete mapping of backend and frontend environment variables for the DotMac Platform**

---

## Backend Environment Variables

**File:** `.env` (root directory)
**Settings:** `src/dotmac/platform/settings.py`

### Core Application

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `APP_NAME` | string | `dotmac-platform` | Application name |
| `APP_VERSION` | string | `1.0.0` | Application version |
| `ENVIRONMENT` | enum | `development` | Deployment environment (development/staging/production) |
| `DEBUG` | bool | `False` | Enable debug mode |
| `TESTING` | bool | `False` | Testing mode flag |

### Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HOST` | string | `0.0.0.0` | Server bind host |
| `PORT` | int | `8000` | Server port |
| `WORKERS` | int | `4` | Number of worker processes |
| `RELOAD` | bool | `False` | Auto-reload on code changes |

### Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECRET_KEY` | string | **(required in production)** | Secret key for JWT signing |
| `TRUSTED_HOSTS` | list | `[]` | Trusted host list (required in production) |
| `JWT_SECRET_KEY` | string | - | JWT signing key (falls back to SECRET_KEY) |
| `JWT_ALGORITHM` | string | `HS256` | JWT algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | int | `30` | Access token TTL |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | int | `7` | Refresh token TTL |

### Database

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE__URL` | PostgresDsn | - | Full database URL (overrides individual settings) |
| `DATABASE__HOST` | string | `localhost` | PostgreSQL host |
| `DATABASE__PORT` | int | `5432` | PostgreSQL port |
| `DATABASE__DATABASE` | string | `dotmac` | Database name |
| `DATABASE__USERNAME` | string | `dotmac_user` | Database username |
| `DATABASE__PASSWORD` | string | - | Database password |
| `DATABASE__POOL_SIZE` | int | `10` | Connection pool size |
| `DATABASE__MAX_OVERFLOW` | int | `20` | Max overflow connections |
| `DATABASE__POOL_TIMEOUT` | int | `30` | Pool timeout (seconds) |
| `DATABASE__POOL_RECYCLE` | int | `3600` | Connection recycle time (seconds) |
| `DATABASE__POOL_PRE_PING` | bool | `True` | Test connections before use |
| `DATABASE__ECHO` | bool | `False` | Echo SQL statements |

### Redis

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS__URL` | RedisDsn | - | Full Redis URL (overrides individual settings) |
| `REDIS__HOST` | string | `localhost` | Redis host |
| `REDIS__PORT` | int | `6379` | Redis port |
| `REDIS__PASSWORD` | string | - | Redis password |
| `REDIS__DB` | int | `0` | Redis database number |
| `REDIS__SSL` | bool | `False` | Enable SSL/TLS |
| `REDIS__MAX_CONNECTIONS` | int | `50` | Max connection pool size |

### Celery

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CELERY__BROKER_URL` | string | - | Celery broker URL (defaults to Redis URL) |
| `CELERY__RESULT_BACKEND` | string | - | Result backend URL (defaults to Redis URL) |
| `CELERY__TASK_ALWAYS_EAGER` | bool | `False` | Execute tasks synchronously (for testing) |

### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FEATURES__MFA_ENABLED` | bool | `False` | Enable MFA |
| `FEATURES__AUDIT_LOGGING` | bool | `True` | Enable audit logging |
| `FEATURES__EMAIL_ENABLED` | bool | `True` | Enable email |
| `FEATURES__COMMUNICATIONS_ENABLED` | bool | `True` | Enable communications |
| `FEATURES__SMS_ENABLED` | bool | `False` | Enable SMS |
| `FEATURES__STORAGE_ENABLED` | bool | `True` | Enable MinIO storage |
| `FEATURES__SEARCH_ENABLED` | bool | `True` | Enable MeiliSearch |
| `FEATURES__DATA_TRANSFER_ENABLED` | bool | `True` | Enable data import/export |
| `FEATURES__CELERY_ENABLED` | bool | `True` | Enable Celery tasks |
| `FEATURES__SECRETS_VAULT` | bool | `False` | Enable Vault/OpenBao |
| `FEATURES__GRAPHQL_ENABLED` | bool | `True` | Enable GraphQL API |
| `FEATURES__ANALYTICS_ENABLED` | bool | `True` | Enable analytics |
| `FEATURES__BANKING_ENABLED` | bool | `True` | Enable banking |
| `FEATURES__PAYMENTS_ENABLED` | bool | `True` | Enable payments |
| `FEATURES__RADIUS_ENABLED` | bool | `True` | Enable RADIUS |
| `FEATURES__NETWORK_ENABLED` | bool | `True` | Enable network mgmt |
| `FEATURES__AUTOMATION_ENABLED` | bool | `True` | Enable automation |
| `FEATURES__WIRELESS_ENABLED` | bool | `True` | Enable wireless |
| `FEATURES__FIBER_ENABLED` | bool | `True` | Enable fiber |
| `FEATURES__ORCHESTRATION_ENABLED` | bool | `True` | Enable orchestration |
| `FEATURES__DUNNING_ENABLED` | bool | `True` | Enable dunning |
| `FEATURES__TICKETING_ENABLED` | bool | `True` | Enable ticketing |
| `FEATURES__CRM_ENABLED` | bool | `True` | Enable CRM |
| `FEATURES__NOTIFICATION_ENABLED` | bool | `True` | Enable notifications |

### External Services

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MINIO__ENDPOINT` | string | `localhost:9000` | MinIO endpoint |
| `MINIO__ACCESS_KEY` | string | - | MinIO access key |
| `MINIO__SECRET_KEY` | string | - | MinIO secret key |
| `MINIO__SECURE` | bool | `False` | Use HTTPS |
| `MEILISEARCH__URL` | string | `http://localhost:7700` | MeiliSearch URL |
| `MEILISEARCH__API_KEY` | string | - | MeiliSearch API key |
| `VAULT__ADDR` | string | - | Vault/OpenBao address |
| `VAULT__TOKEN` | string | - | Vault token |
| `VAULT__NAMESPACE` | string | - | Vault namespace |

### OSS Integrations

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OSS__NETBOX__URL` | string | `http://localhost:8001` | NetBox URL |
| `OSS__NETBOX__TOKEN` | string | - | NetBox API token |
| `OSS__GENIEACS__URL` | string | `http://localhost:7547` | GenieACS URL |
| `OSS__GENIEACS__USERNAME` | string | - | GenieACS username |
| `OSS__GENIEACS__PASSWORD` | string | - | GenieACS password |
| `OSS__VOLTHA__URL` | string | `http://localhost:50057` | VOLTHA gRPC URL |
| `OSS__WIREGUARD__ENABLED` | bool | `True` | Enable WireGuard |

---

## Frontend Environment Variables

**Files:** `frontend/apps/isp-ops-app/.env.local`, `frontend/apps/platform-admin-app/.env.local`
**Config:** `frontend/apps/isp-ops-app/next.config.mjs`, `frontend/apps/platform-admin-app/next.config.mjs`

### API Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | string | `http://localhost:8000` | Full backend URL used for REST calls |
| `NEXT_PUBLIC_API_URL` | string | `/api/v1` | Legacy relative API prefix (falls back to `NEXT_PUBLIC_API_BASE_URL`) |
| `NEXT_PUBLIC_WS_URL` | string | `ws://localhost:8000` | WebSocket endpoint base |

### Application Metadata

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | string | `DotMac Platform` | App name (should match backend) |
| `NEXT_PUBLIC_APP_VERSION` | string | `1.0.0` | App version (should match backend) |
| `NEXT_PUBLIC_ENVIRONMENT` | string | `development` | Environment (should match backend) |

### Branding

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_COMPANY_NAME` | string | `DotMac` | Company name |
| `NEXT_PUBLIC_PRODUCT_NAME` | string | `DotMac Platform` | Product name |
| `NEXT_PUBLIC_PRODUCT_TAGLINE` | string | `Ready to Deploy` | Tagline |
| `NEXT_PUBLIC_LOGO_URL` | string | `/logo.svg` | Logo URL |
| `NEXT_PUBLIC_LOGO_LIGHT` | string | `/logo.svg` | Light theme logo |
| `NEXT_PUBLIC_LOGO_DARK` | string | - | Dark theme logo |
| `NEXT_PUBLIC_PRIMARY_COLOR` | string | `#3b82f6` | Primary color |
| `NEXT_PUBLIC_SECONDARY_COLOR` | string | `#8b5cf6` | Secondary color |

### Feature Flags (DEPRECATED - Use `/api/v1/platform/config` instead)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_ENABLE_GRAPHQL` | bool | `false` | Enable GraphQL (deprecated) |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | bool | `false` | Enable analytics (deprecated) |
| `NEXT_PUBLIC_ENABLE_BANKING` | bool | `false` | Enable banking (deprecated) |
| `NEXT_PUBLIC_ENABLE_PAYMENTS` | bool | `false` | Enable payments (deprecated) |
| `NEXT_PUBLIC_ENABLE_RADIUS` | bool | `true` | Enable RADIUS (deprecated) |
| `NEXT_PUBLIC_ENABLE_NETWORK` | bool | `true` | Enable network (deprecated) |
| `NEXT_PUBLIC_ENABLE_AUTOMATION` | bool | `true` | Enable automation (deprecated) |

**⚠️ Important:** Frontend feature flags are deprecated. The frontend should fetch feature flags from `/api/v1/platform/config` instead of using environment variables.

---

## Environment Variable Mapping

### Synchronized Variables (Must Match)

These variables must have the same value in both backend and frontend:

| Backend | Frontend | Purpose |
|---------|----------|---------|
| `APP_NAME` | `NEXT_PUBLIC_APP_NAME` | Application name |
| `APP_VERSION` | `NEXT_PUBLIC_APP_VERSION` | Version string |
| `ENVIRONMENT` | `NEXT_PUBLIC_ENVIRONMENT` | Deployment environment |

### Backend-Only Variables

These should NEVER be exposed to frontend:

- `SECRET_KEY`, `JWT_SECRET_KEY` - Cryptographic secrets
- `DATABASE__*` - Database credentials
- `REDIS__PASSWORD` - Redis password
- `MINIO__SECRET_KEY` - MinIO secret
- `VAULT__TOKEN` - Vault token
- `OSS__*__PASSWORD` - OSS passwords

### Frontend-Only Variables

These are only used by Next.js:

- `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_URL` - Backend API endpoint
- `NEXT_PUBLIC_WS_URL` - WebSocket endpoint
- `NEXT_PUBLIC_LOGO_*` - Branding assets
- `NEXT_PUBLIC_*_COLOR` - Theme colors

---

## Deployment Checklist

### Development

```bash
# Backend .env
APP_NAME=dotmac-platform
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=true
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__DATABASE=dotmac
DATABASE__USERNAME=dotmac_user
DATABASE__PASSWORD=change-me-in-production
REDIS__HOST=localhost
REDIS__PORT=6379

# Frontend .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=DotMac Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=development
```

### Staging

```bash
# Backend .env
APP_NAME=dotmac-platform
APP_VERSION=1.0.0
ENVIRONMENT=staging
DEBUG=false
SECRET_KEY=<64-char-random-string>
TRUSTED_HOSTS=["staging.dotmac.com"]
DATABASE__URL=postgresql://user:pass@db.staging.dotmac.com:5432/dotmac
REDIS__URL=redis://:pass@redis.staging.dotmac.com:6379/0
FEATURES__SECRETS_VAULT=true
VAULT__ADDR=https://vault.staging.dotmac.com
VAULT__TOKEN=<vault-token>

# Frontend .env.local
NEXT_PUBLIC_API_URL=https://api.staging.dotmac.com/api/v1
NEXT_PUBLIC_APP_NAME=DotMac Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=staging
```

### Production

```bash
# Backend .env
APP_NAME=dotmac-platform
APP_VERSION=1.0.0
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<load-from-vault>
TRUSTED_HOSTS=["dotmac.com","api.dotmac.com"]
DATABASE__URL=<load-from-vault>
REDIS__URL=<load-from-vault>
FEATURES__SECRETS_VAULT=true
VAULT__ADDR=https://vault.dotmac.com
VAULT__TOKEN=<vault-token>
FEATURES__AUDIT_LOGGING=true
FEATURES__MFA_ENABLED=true

# Frontend .env.local
NEXT_PUBLIC_API_URL=https://api.dotmac.com/api/v1
NEXT_PUBLIC_APP_NAME=DotMac Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=production
```

---

## Migration to Dynamic Config

### Current State (Environment Variables)

```typescript
// frontend/apps/isp-ops-app/lib/config.ts (mirrored in platform-admin)
export const platformConfig = {
  features: {
    enableGraphQL: process.env.NEXT_PUBLIC_ENABLE_GRAPHQL === "true",
    // ... hardcoded from env vars
  },
};
```

### Recommended State (Dynamic from Backend)

```typescript
// frontend/apps/isp-ops-app/lib/config.ts (mirrored in platform-admin)
let cachedConfig: PlatformConfig | null = null;

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;

  const response = await fetch("/api/v1/platform/config");
  cachedConfig = await response.json();
  return cachedConfig;
}

// Usage in components
const config = await getPlatformConfig();
if (config.features.graphql_enabled) {
  // Show GraphQL features
}
```

### Benefits

1. **Single source of truth** - Backend controls all feature flags
2. **Dynamic updates** - No frontend rebuild needed to change flags
3. **Environment consistency** - Same flags across dev/staging/prod
4. **Security** - Sensitive settings never exposed to frontend

---

## Validation Script

Create `scripts/validate-env.sh`:

```bash
#!/bin/bash
# Validate environment variables are set correctly

echo "Validating backend environment..."

# Required in production
if [ "$ENVIRONMENT" = "production" ]; then
  [ -z "$SECRET_KEY" ] && echo "ERROR: SECRET_KEY required in production" && exit 1
  [ ${#SECRET_KEY} -lt 32 ] && echo "ERROR: SECRET_KEY must be 32+ chars" && exit 1
  [ -z "$TRUSTED_HOSTS" ] && echo "ERROR: TRUSTED_HOSTS required in production" && exit 1
  [ "$DEBUG" = "true" ] && echo "WARNING: DEBUG should be false in production"
fi

# Database
[ -z "$DATABASE__URL" ] && [ -z "$DATABASE__PASSWORD" ] && echo "ERROR: Database config missing" && exit 1

# Redis
[ -z "$REDIS__URL" ] && [ -z "$REDIS__HOST" ] && echo "ERROR: Redis config missing" && exit 1

echo "✅ Backend environment valid"

echo "Validating frontend environment..."

# Check API URL
[ -z "$NEXT_PUBLIC_API_URL" ] && echo "WARNING: NEXT_PUBLIC_API_URL not set, using default"

# Check version sync
if [ "$APP_VERSION" != "$NEXT_PUBLIC_APP_VERSION" ]; then
  echo "WARNING: Version mismatch - Backend: $APP_VERSION, Frontend: $NEXT_PUBLIC_APP_VERSION"
fi

echo "✅ Frontend environment valid"
```

---

## Troubleshooting

### Issue: Feature flag mismatch

**Symptom:** Frontend shows features that backend doesn't support

**Solution:**
1. Check `/api/v1/platform/config` response
2. Update frontend to use dynamic config instead of env vars
3. Clear frontend build cache: `pnpm --filter @dotmac/isp-ops-app clean` (and/or `@dotmac/platform-admin-app`)

### Issue: Auth not working

**Symptom:** GraphQL queries return 401 Unauthorized

**Solution:**
1. Verify cookies are being sent: Check DevTools → Network → Request Headers
2. Check `credentials: 'include'` in Apollo client config
3. Verify backend middleware extracts cookie token: Check `src/dotmac/platform/audit/middleware.py:41`

### Issue: Real-time connections fail

**Symptom:** SSE/WebSocket connections immediately disconnect

**Solution:**
1. Check token is available: SSE config should have `token` OR cookies enabled
2. Verify backend real-time router accepts cookie auth
3. Check CORS settings allow credentials

---

## References

- Backend Settings: `src/dotmac/platform/settings.py`
- Frontend Config: `frontend/apps/isp-ops-app/lib/config.ts` (mirrored in the platform-admin app)
- Platform Config Endpoint: `src/dotmac/platform/config/router.py`
- Router Registration: `src/dotmac/platform/routers.py`
