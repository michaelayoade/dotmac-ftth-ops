# WireGuard VPN Management - Implementation Blueprint

## 🎯 Overview

This document provides the complete implementation blueprint for the WireGuard VPN Management module for the dotmac ISP platform.

---

## ✅ COMPLETED: Database Models (100%)

**File:** `src/dotmac/platform/wireguard/models.py`

### WireGuardServer Model
Complete PostgreSQL/SQLite compatible model with:
- ✅ Multi-tenant isolation
- ✅ Soft delete support
- ✅ Audit trail (created_by, updated_by)
- ✅ Server identification (name, description)
- ✅ Network configuration (endpoint, ports, IPs)
- ✅ WireGuard keys (public_key, encrypted private_key)
- ✅ Server status enum (ACTIVE, INACTIVE, DEGRADED, MAINTENANCE)
- ✅ Peer capacity management (max_peers, current_peers, next_ip_offset)
- ✅ DNS and routing configuration
- ✅ Location and metadata
- ✅ Traffic statistics (rx/tx bytes, last_stats_update)
- ✅ Relationships to peers

**Key Properties:**
- `is_active` - Check if server is operational
- `has_capacity` - Check if server can accept more peers
- `utilization_percent` - Calculate server load

### WireGuardPeer Model
Complete peer/client model with:
- ✅ Multi-tenant isolation
- ✅ Soft delete support
- ✅ Audit trail
- ✅ Server relationship (FK to wireguard_servers)
- ✅ Customer/Subscriber relationships
- ✅ Peer identification (name, description)
- ✅ WireGuard keys (public_key, optional preshared_key)
- ✅ IP allocation (IPv4/IPv6)
- ✅ Peer status enum (ACTIVE, INACTIVE, DISABLED, EXPIRED)
- ✅ Connection tracking (last_handshake, endpoint)
- ✅ Traffic statistics (rx/tx bytes)
- ✅ Expiration support (expires_at)
- ✅ Config file storage

**Key Properties:**
- `is_active` - Check if peer is enabled
- `is_expired` - Check expiration status
- `is_online` - Check if handshake is recent (<3 minutes)
- `total_bytes` - Total traffic

---

## 📋 REQUIRED: Pydantic Schemas

**File:** `src/dotmac/platform/wireguard/schemas.py` (**TO BE CREATED**)

### Server Schemas
```python
# Request schemas
class WireGuardServerCreate(BaseModel):
    name: str
    description: str | None = None
    public_endpoint: str
    listen_port: int = 51820
    server_ipv4: str
    server_ipv6: str | None = None
    dns_servers: list[str] = ["1.1.1.1", "8.8.8.8"]
    allowed_ips: list[str] = ["0.0.0.0/0", "::/0"]
    max_peers: int = 1000
    location: str | None = None

class WireGuardServerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: WireGuardServerStatus | None = None
    dns_servers: list[str] | None = None
    max_peers: int | None = None

# Response schemas
class WireGuardServerResponse(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    description: str | None
    public_endpoint: str
    listen_port: int
    server_ipv4: str
    public_key: str  # PUBLIC KEY ONLY (never return private key)
    status: WireGuardServerStatus
    current_peers: int
    max_peers: int
    utilization_percent: float
    total_rx_bytes: int
    total_tx_bytes: int
    created_at: datetime
    updated_at: datetime

class WireGuardServerStats(BaseModel):
    total_peers: int
    active_peers: int
    online_peers: int
    total_rx_bytes: int
    total_tx_bytes: int
    uptime_seconds: int
```

### Peer Schemas
```python
# Request schemas
class WireGuardPeerCreate(BaseModel):
    server_id: UUID
    customer_id: UUID | None = None
    subscriber_id: str | None = None
    name: str
    description: str | None = None
    public_key: str
    use_preshared_key: bool = False
    allowed_ips: list[str] | None = None
    expires_at: datetime | None = None

class WireGuardPeerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: WireGuardPeerStatus | None = None
    enabled: bool | None = None
    expires_at: datetime | None = None

# Response schemas
class WireGuardPeerResponse(BaseModel):
    id: UUID
    tenant_id: str
    server_id: UUID
    customer_id: UUID | None
    subscriber_id: str | None
    name: str
    description: str | None
    public_key: str
    peer_ipv4: str
    peer_ipv6: str | None
    status: WireGuardPeerStatus
    enabled: bool
    is_online: bool
    last_handshake: datetime | None
    endpoint: str | None
    rx_bytes: int
    tx_bytes: int
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

class WireGuardPeerConfig(BaseModel):
    """Generated WireGuard config file for peer"""
    config: str  # Full .conf file content
    qr_code: str | None  # Base64-encoded QR code for mobile apps
```

---

## 📋 REQUIRED: WireGuard Client

**File:** `src/dotmac/platform/wireguard/client.py` (**TO BE CREATED**)

This client communicates with WireGuard management API (e.g., wg-easy, firezone, or custom solution).

```python
class WireGuardClient:
    """
    Client for WireGuard management API.

    Supports:
    - wg-easy (Docker-based WireGuard management)
    - Firezone (Enterprise WireGuard platform)
    - Custom REST API
    """

    def __init__(
        self,
        base_url: str,
        api_token: str,
        verify_ssl: bool = True,
        timeout_seconds: int = 30,
    ):
        self.base_url = base_url
        self.api_token = api_token
        self.verify_ssl = verify_ssl
        self.timeout = timeout_seconds
        self.session = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_token}"},
            verify=verify_ssl,
            timeout=timeout_seconds,
        )

    # Server operations
    async def get_server_status(self) -> dict:
        """Get WireGuard server status"""
        ...

    async def get_server_config(self) -> dict:
        """Get server configuration"""
        ...

    async def update_server_config(self, config: dict) -> dict:
        """Update server configuration"""
        ...

    # Peer operations
    async def create_peer(self, public_key: str, allowed_ips: list[str]) -> dict:
        """Add peer to WireGuard"""
        ...

    async def get_peer(self, public_key: str) -> dict:
        """Get peer details"""
        ...

    async def update_peer(self, public_key: str, updates: dict) -> dict:
        """Update peer configuration"""
        ...

    async def delete_peer(self, public_key: str) -> bool:
        """Remove peer from WireGuard"""
        ...

    async def list_peers(self) -> list[dict]:
        """List all peers"""
        ...

    # Statistics
    async def get_peer_stats(self, public_key: str) -> dict:
        """Get peer traffic statistics"""
        ...

    async def get_server_stats(self) -> dict:
        """Get server traffic statistics"""
        ...

    # Key generation
    async def generate_keys(self) -> dict:
        """Generate WireGuard public/private key pair"""
        ...

    async def generate_preshared_key(self) -> str:
        """Generate preshared key"""
        ...

    # Configuration generation
    async def generate_peer_config(
        self,
        peer_public_key: str,
        peer_private_key: str,
        peer_ip: str,
        server_public_key: str,
        server_endpoint: str,
        dns_servers: list[str],
        allowed_ips: list[str],
    ) -> str:
        """Generate WireGuard config file for peer"""
        ...
```

---

## 📋 REQUIRED: WireGuard Service

**File:** `src/dotmac/platform/wireguard/service.py` (**TO BE CREATED**)

```python
class WireGuardService:
    """Service layer for WireGuard VPN operations"""

    def __init__(self, db: AsyncSession, client: WireGuardClient):
        self.db = db
        self.client = client

    # Server management
    async def create_server(
        self,
        tenant_id: str,
        data: WireGuardServerCreate,
        created_by: UUID,
    ) -> WireGuardServerResponse:
        """
        Create WireGuard VPN server.

        Steps:
        1. Generate server keys via client
        2. Create database record
        3. Configure WireGuard via client
        4. Return server details
        """
        ...

    async def get_server(
        self,
        tenant_id: str,
        server_id: UUID,
    ) -> WireGuardServerResponse | None:
        """Get server by ID"""
        ...

    async def list_servers(
        self,
        tenant_id: str,
        status: WireGuardServerStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WireGuardServerResponse]:
        """List servers with filtering"""
        ...

    async def update_server(
        self,
        tenant_id: str,
        server_id: UUID,
        data: WireGuardServerUpdate,
        updated_by: UUID,
    ) -> WireGuardServerResponse:
        """Update server configuration"""
        ...

    async def delete_server(
        self,
        tenant_id: str,
        server_id: UUID,
    ) -> bool:
        """Delete server (soft delete)"""
        ...

    # Peer management
    async def create_peer(
        self,
        tenant_id: str,
        data: WireGuardPeerCreate,
        created_by: UUID,
    ) -> tuple[WireGuardPeerResponse, WireGuardPeerConfig]:
        """
        Create VPN peer for subscriber.

        Steps:
        1. Generate peer keys
        2. Allocate IP from server pool
        3. Create database record
        4. Add peer to WireGuard via client
        5. Generate config file
        6. Generate QR code
        7. Update server peer count
        8. Return peer details and config
        """
        ...

    async def get_peer(
        self,
        tenant_id: str,
        peer_id: UUID,
    ) -> WireGuardPeerResponse | None:
        """Get peer by ID"""
        ...

    async def get_peer_config(
        self,
        tenant_id: str,
        peer_id: UUID,
    ) -> WireGuardPeerConfig:
        """Get peer config file and QR code"""
        ...

    async def list_peers(
        self,
        tenant_id: str,
        server_id: UUID | None = None,
        customer_id: UUID | None = None,
        status: WireGuardPeerStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WireGuardPeerResponse]:
        """List peers with filtering"""
        ...

    async def update_peer(
        self,
        tenant_id: str,
        peer_id: UUID,
        data: WireGuardPeerUpdate,
        updated_by: UUID,
    ) -> WireGuardPeerResponse:
        """Update peer"""
        ...

    async def disable_peer(
        self,
        tenant_id: str,
        peer_id: UUID,
    ) -> WireGuardPeerResponse:
        """Disable peer (suspend access)"""
        ...

    async def enable_peer(
        self,
        tenant_id: str,
        peer_id: UUID,
    ) -> WireGuardPeerResponse:
        """Enable peer (restore access)"""
        ...

    async def delete_peer(
        self,
        tenant_id: str,
        peer_id: UUID,
    ) -> bool:
        """Delete peer"""
        ...

    # Statistics
    async def get_server_stats(
        self,
        tenant_id: str,
        server_id: UUID,
    ) -> WireGuardServerStats:
        """Get server statistics"""
        ...

    async def sync_peer_stats(
        self,
        tenant_id: str,
        server_id: UUID,
    ) -> dict:
        """
        Sync peer statistics from WireGuard.

        Updates database with latest traffic stats
        and connection status from WireGuard.
        """
        ...
```

---

## 📋 REQUIRED: API Router

**File:** `src/dotmac/platform/wireguard/router.py` (**TO BE CREATED**)

### Endpoints (20+ total)

#### Server Endpoints (7)
- `GET /api/v1/wireguard/servers` - List VPN servers
- `POST /api/v1/wireguard/servers` - Create VPN server
- `GET /api/v1/wireguard/servers/{server_id}` - Get server details
- `PATCH /api/v1/wireguard/servers/{server_id}` - Update server
- `DELETE /api/v1/wireguard/servers/{server_id}` - Delete server
- `GET /api/v1/wireguard/servers/{server_id}/stats` - Get server statistics
- `POST /api/v1/wireguard/servers/{server_id}/sync-stats` - Sync stats from WireGuard

#### Peer Endpoints (11)
- `GET /api/v1/wireguard/peers` - List peers (with filters)
- `POST /api/v1/wireguard/peers` - Create peer
- `GET /api/v1/wireguard/peers/{peer_id}` - Get peer details
- `PATCH /api/v1/wireguard/peers/{peer_id}` - Update peer
- `DELETE /api/v1/wireguard/peers/{peer_id}` - Delete peer
- `POST /api/v1/wireguard/peers/{peer_id}/enable` - Enable peer
- `POST /api/v1/wireguard/peers/{peer_id}/disable` - Disable peer
- `GET /api/v1/wireguard/peers/{peer_id}/config` - Get config file
- `GET /api/v1/wireguard/peers/{peer_id}/qr-code` - Get QR code
- `GET /api/v1/wireguard/peers/{peer_id}/stats` - Get peer statistics
- `GET /api/v1/wireguard/peers/by-customer/{customer_id}` - Get customer's peers

#### Health & Monitoring (2)
- `GET /api/v1/wireguard/health` - Check WireGuard system health
- `GET /api/v1/wireguard/dashboard` - Dashboard statistics

---

## 📋 REQUIRED: Database Migration

**File:** `alembic/versions/YYYY_MM_DD_HHMM-<hash>_add_wireguard_tables.py` (**TO BE CREATED**)

```python
"""add wireguard vpn tables

Revision ID: <generated>
Revises: <previous>
Create Date: <timestamp>
"""

def upgrade() -> None:
    # Create wireguard_servers table
    op.create_table(
        'wireguard_servers',
        # ... all columns from model
    )

    # Create wireguard_peers table
    op.create_table(
        'wireguard_peers',
        # ... all columns from model
    )

    # Create indexes
    op.create_index(...)

def downgrade() -> None:
    op.drop_table('wireguard_peers')
    op.drop_table('wireguard_servers')
```

---

## 📋 REQUIRED: Integration Tests

**File:** `tests/wireguard/test_wireguard_integration.py` (**TO BE CREATED**)

Test cases:
- ✅ Server creation and configuration
- ✅ Peer provisioning workflow
- ✅ Config file generation
- ✅ QR code generation
- ✅ Peer enable/disable
- ✅ Statistics sync
- ✅ IP allocation logic
- ✅ Expiration handling
- ✅ Multi-tenant isolation

---

## 🎯 Integration Points

### 1. Service Lifecycle Integration
Add VPN provisioning to `OrchestrationService`:
```python
async def provision_subscriber_with_vpn(
    self,
    tenant_id: str,
    customer_id: UUID,
    vpn_server_id: UUID,
    ...
) -> dict:
    """
    Provision subscriber with VPN access.

    Workflow:
    1. Create subscriber (existing)
    2. Provision RADIUS (existing)
    3. **NEW:** Create WireGuard peer
    4. Send config to customer
    """
    ...
```

### 2. Customer Portal Integration
- Display VPN status
- Download config files
- Show QR codes
- View traffic statistics

### 3. Dunning Integration
Suspend VPN on non-payment:
```python
async def suspend_for_nonpayment(customer_id: UUID):
    # Suspend RADIUS
    # Suspend VPN peers
    ...
```

---

## 🚀 Deployment Requirements

### WireGuard Server Options

**Option 1: wg-easy (Recommended for MVP)**
- Docker-based WireGuard with web UI
- REST API available
- QR code generation built-in
- Easy to deploy
- GitHub: https://github.com/wg-easy/wg-easy

**Option 2: Firezone (Enterprise)**
- Self-hosted WireGuard platform
- SAML/OIDC support
- Multi-tenant
- REST API
- GitHub: https://github.com/firezone/firezone

**Option 3: Custom (wg command-line)**
- Direct `wg` command execution
- Full control
- Requires custom API wrapper

### Docker Compose Example (wg-easy)
```yaml
services:
  wireguard:
    image: ghcr.io/wg-easy/wg-easy
    container_name: wg-easy
    environment:
      - WG_HOST=vpn.yourisp.com
      - PASSWORD=secure_password
      - WG_PORT=51820
    volumes:
      - ./wireguard-data:/etc/wireguard
    ports:
      - "51820:51820/udp"  # WireGuard
      - "51821:51821/tcp"  # Web UI/API
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
    restart: unless-stopped
```

---

## 📈 Success Metrics

Once implemented, this module will provide:
- ✅ Complete VPN server lifecycle management
- ✅ Automated peer provisioning
- ✅ Customer self-service config download
- ✅ Traffic monitoring and analytics
- ✅ Integration with billing (suspend on non-payment)
- ✅ Multi-server support for geographic distribution
- ✅ Mobile-friendly QR codes
- ✅ Enterprise-grade security (WireGuard + preshared keys)

---

## 📊 Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| **Database Models** | ✅ Complete | models.py |
| **Pydantic Schemas** | ⚠️ Documented | Blueprint only |
| **WireGuard Client** | ⚠️ Documented | Blueprint only |
| **Service Layer** | ⚠️ Documented | Blueprint only |
| **API Router** | ⚠️ Documented | Blueprint only |
| **Database Migration** | ⚠️ Documented | Blueprint only |
| **Integration Tests** | ⚠️ Documented | Blueprint only |
| **Documentation** | ✅ Complete | This file |

**Estimated Implementation Time:** 8-12 hours for experienced developer

**Priority:** HIGH - VPN is a common ISP service offering

---

## 🎯 Next Steps

1. **Create database migration** - Add wireguard_servers and wireguard_peers tables
2. **Deploy wg-easy** - Get WireGuard server running in Docker
3. **Implement client.py** - Build WireGuard API client
4. **Implement service.py** - Create business logic layer
5. **Implement schemas.py** - Create Pydantic schemas
6. **Implement router.py** - Build FastAPI endpoints
7. **Add to routers.py** - Register router
8. **Create tests** - Integration and unit tests
9. **Update orchestration** - Add VPN to provisioning workflow
10. **Deploy to production** - Launch VPN service!

---

This blueprint provides everything needed to implement a production-ready WireGuard VPN management system for ISPs. The database models are complete and production-ready. The remaining components follow the same patterns as existing modules (RADIUS, NetBox, VOLTHA, GenieACS) and can be implemented systematically.
