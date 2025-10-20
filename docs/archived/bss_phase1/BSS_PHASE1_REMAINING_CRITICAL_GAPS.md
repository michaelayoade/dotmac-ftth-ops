# BSS Phase 1 - REMAINING CRITICAL GAPS

**Date**: 2025-01-15
**Status**: ❌ **STILL NOT PRODUCTION READY**

## Executive Summary

While I implemented fixes for 3 issues (Subscriber model, CoA client, NetBox sync logic), **YOU ARE CORRECT** - there are **4 ADDITIONAL CRITICAL GAPS** that make the system non-functional:

1. ❌ **RADIUS Tables Migration Missing** - Models exist, but no Alembic migration creates the tables
2. ❌ **RBAC/Permissions Not Integrated** - No permission checks on ISP endpoints
3. ❌ **Tenant Configuration Missing** - No way to configure external service credentials per tenant
4. ❌ **VOLTHA/GenieACS Clients Lack Robustness** - Basic error handling, no retries, connection pooling, or tenant auth

---

## ❌ Critical Gap #1: RADIUS Tables Migration Missing

### Verification

```bash
# Search for RADIUS table migrations
$ grep -r "radcheck\|radreply\|radacct\|radpostauth\|nas" alembic/versions/
# NO RESULTS

# Search for any RADIUS migration files
$ find alembic/versions -name "*radius*"
# NO RESULTS
```

### Current State

**Models Defined**: `src/dotmac/platform/radius/models.py`
- `RadCheck` - Authentication attributes
- `RadReply` - Authorization attributes
- `RadAcct` - Session accounting
- `RadPostAuth` - Auth logging
- `NAS` - Network Access Servers
- `RadiusBandwidthProfile` - QoS profiles

**Migration Status**: ❌ **NONE EXIST**

### Impact

```python
# This will FAIL with "relation 'radcheck' does not exist"
await radius_service.create_subscriber(
    RADIUSSubscriberCreate(username="test@isp.com", password="secret")
)

# Database query fails
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedTable)
relation "radcheck" does not exist
```

### What's Needed

Create migration: `alembic/versions/2025_01_15_1500-add_radius_tables.py`

```python
def upgrade() -> None:
    # Create radcheck table
    op.create_table(
        "radcheck",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tenant_id", sa.String(255), ForeignKey("tenants.id")),
        sa.Column("subscriber_id", sa.String(255), ForeignKey("subscribers.id")),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("attribute", sa.String(64), nullable=False),
        sa.Column("op", sa.String(2), server_default=":="),
        sa.Column("value", sa.String(253), nullable=False),
        # ... timestamps, indexes
    )

    # Create radreply, radacct, radpostauth, nas, radius_bandwidth_profiles
    # ...
```

---

## ❌ Critical Gap #2: RBAC/Permissions Not Integrated

### Verification

```bash
# Check if RADIUS endpoints use permission decorators
$ grep -r "require_.*permission\|@require\|Permission" src/dotmac/platform/radius/router.py
# NO RESULTS
```

### Current State

**RADIUS Router**: `src/dotmac/platform/radius/router.py`

```python
# All endpoints only check authentication, NOT permissions
@router.get("/subscribers")
async def list_subscribers(
    current_user: UserInfo = Depends(get_current_user),  # ← Only checks login
):
    # ANY authenticated user can list ALL subscribers across ALL tenants
    # NO permission check for "radius:subscribers:read"
    # NO tenant isolation enforcement
```

**Comparison with Other Modules**:

```python
# billing/router.py DOES have permissions:
@router.get("/invoices")
@require_permission("billing:invoices:read")  # ✅ Permission enforced
async def list_invoices(...):

# user_management/router.py DOES have RBAC:
@router.post("/users")
@require_admin  # ✅ Role-based restriction
async def create_user(...):
```

### Impact

- ❌ No role-based access control for ISP modules
- ❌ NOC engineers can access billing data
- ❌ Billing staff can disconnect subscriber sessions
- ❌ Support agents can provision ONUs
- ❌ No audit trail of WHO performed sensitive operations

### What's Needed

1. **Define Permission Scopes** in `src/dotmac/platform/auth/permissions.py`:

```python
# ISP Permission Scopes
ISP_PERMISSIONS = [
    # RADIUS
    "radius:subscribers:read",
    "radius:subscribers:write",
    "radius:subscribers:delete",
    "radius:sessions:read",
    "radius:sessions:disconnect",  # Critical: who can kill sessions?
    "radius:nas:manage",

    # NetBox IPAM
    "netbox:ipam:read",
    "netbox:ipam:allocate",  # IP allocation
    "netbox:dcim:read",

    # VOLTHA PON
    "voltha:olt:read",
    "voltha:onu:provision",  # Critical: who can activate ONUs?
    "voltha:onu:delete",

    # GenieACS CPE
    "genieacs:cpe:read",
    "genieacs:cpe:configure",  # Critical: who can push configs?
    "genieacs:cpe:reboot",

    # Ansible Automation
    "ansible:workflows:read",
    "ansible:workflows:execute",  # Critical: who can run playbooks?
]
```

2. **Apply Decorators** to all ISP endpoints:

```python
from dotmac.platform.auth.permissions import require_permission

@router.post("/sessions/disconnect")
@require_permission("radius:sessions:disconnect")  # ← ADD THIS
async def disconnect_session(...):
    # Only users with explicit permission can disconnect
```

3. **Create Default Roles**:

```python
# In seed data / tenant setup
NOC_ENGINEER_ROLE = {
    "name": "NOC Engineer",
    "permissions": [
        "radius:subscribers:read",
        "radius:sessions:read",
        "radius:sessions:disconnect",
        "voltha:olt:read",
        "voltha:onu:provision",
        "netbox:ipam:read",
    ]
}

SUPPORT_AGENT_ROLE = {
    "name": "Support Agent",
    "permissions": [
        "radius:subscribers:read",
        "radius:sessions:read",
        # NO disconnect, NO provisioning
    ]
}

BILLING_STAFF_ROLE = {
    "name": "Billing Staff",
    "permissions": [
        "billing:invoices:read",
        "billing:payments:write",
        # NO network access
    ]
}
```

---

## ❌ Critical Gap #3: Tenant Configuration & Secrets Missing

### Verification

```bash
# Check if settings.py has OSS configs
$ grep -i "VOLTHA\|GENIEACS\|NETBOX\|AWX" src/dotmac/platform/settings.py
# NO RESULTS
```

### Current State

**Hardcoded in Clients**:

```python
# src/dotmac/platform/voltha/client.py
self.base_url = os.getenv("VOLTHA_URL", "http://localhost:8881")
# ← Single global URL, no per-tenant config

# src/dotmac/platform/netbox/client.py
self.api_token = os.getenv("NETBOX_API_TOKEN", "")
# ← Single token for ALL tenants - security issue!
```

### Problem

**Scenario**: Multi-tenant ISP platform with 3 customers:

```
Tenant A (ISP-West):
  - VOLTHA: voltha-west.internal:8881
  - NetBox: netbox-west.internal:8080 + token_A
  - GenieACS: genieacs-west.internal:7557 + credentials_A

Tenant B (ISP-East):
  - VOLTHA: voltha-east.internal:8881
  - NetBox: netbox-east.internal:8080 + token_B
  - GenieACS: genieacs-east.internal:7557 + credentials_B

Tenant C (ISP-Central):
  - Shares same VOLTHA but different tenant ID
  - Separate NetBox instance
```

**Current Code Cannot Support This** - only one global URL/token.

### Impact

- ❌ Cannot support multi-tenant deployments
- ❌ All tenants share same NetBox token (security breach)
- ❌ Cannot route API calls to tenant-specific infrastructure
- ❌ Secrets stored in environment variables (not rotatable)

### What's Needed

1. **Create TenantConfiguration Model**:

```python
# src/dotmac/platform/tenant/models.py

class TenantOSSConfiguration(Base, TimestampMixin, TenantMixin):
    """Per-tenant OSS/BSS integration configuration"""

    __tablename__ = "tenant_oss_configurations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # VOLTHA Configuration
    voltha_enabled: Mapped[bool] = mapped_column(default=False)
    voltha_url: Mapped[str | None] = mapped_column(String(255))
    voltha_grpc_port: Mapped[int | None] = mapped_column(default=50057)
    voltha_tenant_id: Mapped[str | None] = mapped_column(String(100))

    # NetBox Configuration
    netbox_enabled: Mapped[bool] = mapped_column(default=False)
    netbox_url: Mapped[str | None] = mapped_column(String(255))
    netbox_api_token_secret: Mapped[str | None] = mapped_column(String(255))  # Vault path
    netbox_tenant_id: Mapped[int | None]

    # GenieACS Configuration
    genieacs_enabled: Mapped[bool] = mapped_column(default=False)
    genieacs_url: Mapped[str | None] = mapped_column(String(255))
    genieacs_username_secret: Mapped[str | None]  # Vault path
    genieacs_password_secret: Mapped[str | None]  # Vault path

    # Ansible AWX Configuration
    awx_enabled: Mapped[bool] = mapped_column(default=False)
    awx_url: Mapped[str | None] = mapped_column(String(255))
    awx_token_secret: Mapped[str | None]  # Vault path
    awx_organization_id: Mapped[int | None]

    # FreeRADIUS Configuration
    radius_enabled: Mapped[bool] = mapped_column(default=False)
    radius_server_host: Mapped[str | None] = mapped_column(String(255))
    radius_coa_port: Mapped[int] = mapped_column(default=3799)
    radius_secret_vault_path: Mapped[str | None]  # Vault path
```

2. **Integration with Vault/OpenBao**:

```python
# src/dotmac/platform/secrets/tenant_secrets.py

async def get_tenant_netbox_token(tenant_id: str) -> str:
    """Fetch NetBox API token from Vault for tenant"""
    config = await get_tenant_oss_config(tenant_id)
    if not config.netbox_api_token_secret:
        raise ValueError(f"NetBox not configured for tenant {tenant_id}")

    # Fetch from Vault
    secret_path = config.netbox_api_token_secret  # e.g., "tenants/isp-west/netbox/api-token"
    token = await vault_client.read_secret(secret_path)
    return token["api_token"]
```

3. **Update Clients to Use Tenant Config**:

```python
# src/dotmac/platform/netbox/service.py

class NetBoxService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

        # Fetch tenant-specific config
        config = await get_tenant_oss_config(tenant_id)
        if not config.netbox_enabled:
            raise ValueError(f"NetBox not enabled for tenant {tenant_id}")

        # Get token from Vault
        api_token = await get_tenant_netbox_token(tenant_id)

        # Initialize client with tenant-specific settings
        self.client = NetBoxClient(
            base_url=config.netbox_url,
            api_token=api_token,
        )
```

4. **Admin UI for Configuration**:

```typescript
// frontend: /dashboard/settings/integrations
<Card title="NetBox IPAM">
  <Toggle enabled={config.netbox_enabled} />
  <Input label="NetBox URL" value={config.netbox_url} />
  <SecretInput label="API Token" vaultPath={config.netbox_api_token_secret} />
  <Input label="Tenant ID" value={config.netbox_tenant_id} />
</Card>
```

---

## ❌ Critical Gap #4: VOLTHA/GenieACS Clients Lack Robustness

### Verification

```python
# src/dotmac/platform/voltha/client.py:80
async def _request(...):
    async with httpx.AsyncClient(verify=self.verify_ssl) as client:
        response = await client.request(
            method=method,
            url=url,
            headers=self.headers,
            params=params,
            json=json,
            timeout=30.0,  # ← Fixed 30s timeout
        )

        response.raise_for_status()  # ← Raises on 4xx/5xx, no retry
        return response.json()
```

### Problems

1. **No Connection Pooling**:
   - Creates new `httpx.AsyncClient` for EVERY request
   - Wastes resources establishing TCP connections
   - No connection reuse

2. **No Retry Logic**:
   ```python
   response.raise_for_status()  # ← Fails immediately on timeout or 5xx
   # Should retry on:
   # - Network errors (ConnectionError)
   # - Timeout errors
   # - 503 Service Unavailable
   # - 429 Rate Limit
   ```

3. **No Circuit Breaker**:
   - If VOLTHA goes down, EVERY request waits 30 seconds before failing
   - Can exhaust thread pool / event loop
   - No fail-fast mechanism

4. **No Tenant Isolation in Errors**:
   ```python
   logger.error("voltha.error", error=str(e))
   # ← Doesn't log tenant_id, so can't trace which tenant's call failed
   ```

5. **Fixed Timeout**:
   - 30s for all operations (too long for health checks, too short for bulk provisioning)
   - Should be configurable per endpoint

### What's Needed

1. **Connection Pooling** with `httpx.AsyncClient` singleton:

```python
class VOLTHAClient:
    _client_pool: dict[str, httpx.AsyncClient] = {}  # Keyed by tenant_id

    def __init__(self, tenant_id: str, base_url: str):
        self.tenant_id = tenant_id
        if tenant_id not in self._client_pool:
            self._client_pool[tenant_id] = httpx.AsyncClient(
                base_url=base_url,
                timeout=httpx.Timeout(30.0, connect=5.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        self.client = self._client_pool[tenant_id]
```

2. **Retry Logic** with `tenacity`:

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
)
async def _request_with_retry(self, method: str, endpoint: str, ...):
    try:
        response = await self.client.request(...)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (503, 429):  # Retry on server errors
            raise  # Triggers retry
        else:
            logger.error("voltha.api_error", tenant_id=self.tenant_id, status=e.response.status_code)
            raise
```

3. **Circuit Breaker** with `pybreaker`:

```python
from pybreaker import CircuitBreaker

voltha_breaker = CircuitBreaker(
    fail_max=5,  # Open circuit after 5 failures
    reset_timeout=60,  # Try again after 60s
    name="voltha-api",
)

@voltha_breaker
async def _request(self, ...):
    # Will raise CircuitBreakerError if circuit is open (fail-fast)
    return await self._request_with_retry(...)
```

4. **Tenant-Aware Logging**:

```python
logger.bind(tenant_id=self.tenant_id).info(
    "voltha.request",
    method=method,
    endpoint=endpoint,
)
```

5. **Configurable Timeouts**:

```python
class VOLTHAClient:
    TIMEOUTS = {
        "health_check": 2.0,
        "list_olts": 10.0,
        "provision_onu": 60.0,  # Longer for provisioning
    }

    async def provision_onu(self, ...):
        return await self._request(
            "POST",
            "devices",
            json=onu_data,
            timeout=self.TIMEOUTS["provision_onu"],
        )
```

---

## Summary Table

| Issue | Status | Blocks | Fix Effort |
|-------|--------|--------|-----------|
| 1. RADIUS Tables Migration | ❌ MISSING | All RADIUS operations | 2-4 hours |
| 2. RBAC/Permissions | ❌ MISSING | Secure multi-user access | 1-2 days |
| 3. Tenant Configuration | ❌ MISSING | Multi-tenant deployments | 2-3 days |
| 4. Client Robustness | ⚠️ BASIC | Production reliability | 1-2 days |

**TOTAL FIX EFFORT**: 1-2 weeks additional work

---

## Updated Remediation Roadmap

### Phase 1: Database Schema (CRITICAL - 1 day)
1. ✅ Create Subscriber model (DONE)
2. ✅ Create subscribers migration (DONE)
3. ❌ **Create RADIUS tables migration** (URGENT)
4. ❌ **Create tenant_oss_configurations migration** (URGENT)

### Phase 2: Security & RBAC (CRITICAL - 2 days)
1. ❌ Define ISP permission scopes
2. ❌ Apply `@require_permission` decorators to all ISP endpoints
3. ❌ Create default ISP roles (NOC, Support, Billing)
4. ❌ Add RBAC tests

### Phase 3: Tenant Configuration (CRITICAL - 2 days)
1. ❌ Create TenantOSSConfiguration model
2. ❌ Integrate Vault/OpenBao for secrets
3. ❌ Update all clients to use tenant configs
4. ❌ Build admin UI for configuration

### Phase 4: Client Robustness (IMPORTANT - 2 days)
1. ❌ Add connection pooling to VOLTHA/GenieACS/NetBox clients
2. ❌ Implement retry logic with tenacity
3. ❌ Add circuit breakers with pybreaker
4. ❌ Add tenant-aware logging
5. ❌ Make timeouts configurable

### Phase 5: Integration & Testing (1 week)
1. ❌ End-to-end subscriber provisioning test
2. ❌ RBAC enforcement tests
3. ❌ Multi-tenant isolation tests
4. ❌ Load testing with circuit breakers

---

## Recommendation

**DO NOT DEPLOY** until Phases 1-3 are complete.

The system will:
- ❌ Crash on startup (missing RADIUS tables)
- ❌ Allow unauthorized access (no RBAC)
- ❌ Fail in multi-tenant scenarios (no tenant configs)
- ⚠️ Be unreliable under load (no retries/circuit breakers)

**Realistic Timeline**: 2-3 weeks to production-ready

---

**Generated**: 2025-01-15
**Status**: DRAFT - Awaiting review and prioritization
