# Static IP Management System - Implementation Guide

## ✅ Completed Components

### 1. Database Models (`src/dotmac/platform/ip_management/models.py`)

**IPPool Model**:
- Manages IP address pools for allocation
- Fields:
  - `pool_name`: Human-readable name
  - `pool_type`: IPV4_PUBLIC, IPV4_PRIVATE, IPV6_GLOBAL, IPV6_ULA, IPV6_PREFIX_DELEGATION
  - `network_cidr`: Network range (e.g., "203.0.113.0/24")
  - `gateway`: Gateway IP address
  - `dns_servers`: Comma-separated DNS servers
  - `vlan_id`: Associated VLAN
  - `status`: ACTIVE, RESERVED, DEPLETED, MAINTENANCE
  - `total_addresses`, `reserved_count`, `assigned_count`: Utilization tracking
  - `netbox_prefix_id`, `netbox_synced_at`: NetBox integration
  - `auto_assign_enabled`: Enable automatic assignment
  - `allow_manual_reservation`: Allow manual reservations

**IPReservation Model**:
- Tracks individual IP assignments
- Fields:
  - `pool_id`: Associated pool
  - `subscriber_id`: Linked subscriber
  - `ip_address`: Reserved IP
  - `ip_type`: ipv4, ipv6, or ipv6_prefix
  - `prefix_length`: For IPv6 delegations
  - `status`: RESERVED, ASSIGNED, RELEASED, EXPIRED
  - `reserved_at`, `assigned_at`, `released_at`, `expires_at`: Lifecycle timestamps
  - `netbox_ip_id`, `netbox_synced`: NetBox integration
  - `assigned_by`, `assignment_reason`, `notes`: Audit trail

**Unique Constraints**:
- One IP per tenant (prevents conflicts)
- One IP type per subscriber (prevents duplicate assignments)
- One pool name per tenant

### 2. Database Migration (`alembic/versions/2025_11_08_1400-add_ip_management_tables.py`)

Creates:
- `ip_pools` table with indexes
- `ip_reservations` table with indexes
- Enums: IPPoolType, IPPoolStatus, IPReservationStatus
- Foreign keys to tenants and subscribers
- Proper cascading deletes

### 3. Subscriber Model Integration

Added `ip_reservations` relationship to Subscriber model for easy access to assigned IPs.

## 📋 Components to Implement

### Service Layer (`src/dotmac/platform/ip_management/ip_service.py`)

```python
class IPManagementService:
    """
    Service for managing IP pools and reservations with conflict detection.
    """

    # Pool Management
    async def create_pool(self, pool_data: PoolCreate) -> IPPool
    async def list_pools(self, filters: PoolFilters) -> list[IPPool]
    async def get_pool(self, pool_id: UUID) -> IPPool | None
    async def update_pool(self, pool_id: UUID, updates: PoolUpdate) -> IPPool
    async def delete_pool(self, pool_id: UUID) -> bool
    async def calculate_pool_utilization(self, pool_id: UUID) -> PoolUtilization

    # IP Assignment
    async def reserve_ip(self, subscriber_id: str, ip_address: str, pool_id: UUID) -> IPReservation
    async def assign_ip_auto(self, subscriber_id: str, pool_id: UUID, ip_type: str) -> IPReservation
    async def release_ip(self, reservation_id: UUID) -> bool
    async def extend_reservation(self, reservation_id: UUID, expires_at: datetime) -> IPReservation

    # Conflict Detection
    async def check_ip_conflicts(self, ip_address: str, tenant_id: str) -> list[ConflictInfo]
    async def validate_ip_in_pool(self, ip_address: str, pool_id: UUID) -> bool
    async def find_available_ip(self, pool_id: UUID) -> str | None

    # Lifecycle Management
    async def cleanup_expired_reservations(self) -> int
    async def reclaim_released_ips(self, days: int = 30) -> int

    # Statistics
    async def get_pool_stats(self, pool_id: UUID) -> PoolStats
    async def get_tenant_ip_usage(self, tenant_id: str) -> TenantIPStats
```

**Key Features**:
1. **Conflict Detection**: Check for duplicate IPs across tenant
2. **Auto-Assignment**: Automatically find and assign available IPs
3. **Pool Validation**: Ensure IPs belong to pool network
4. **Utilization Tracking**: Update pool counters on assignment/release
5. **IPv4/IPv6 Support**: Handle both IP versions and prefix delegation
6. **Lifecycle Management**: Auto-expire and reclaim IPs

### NetBox Integration (`src/dotmac/platform/ip_management/netbox_sync.py`)

```python
class NetBoxIPSync:
    """
    Synchronize IP pools and reservations with NetBox IPAM.
    """

    # Sync Operations
    async def sync_pool_to_netbox(self, pool_id: UUID) -> NetBoxSyncResult
    async def sync_reservation_to_netbox(self, reservation_id: UUID) -> NetBoxSyncResult
    async def sync_from_netbox(self, netbox_prefix_id: int) -> IPPool

    # Conflict Resolution
    async def detect_netbox_conflicts(self, pool_id: UUID) -> list[NetBoxConflict]
    async def resolve_conflict(self, conflict_id: str, resolution: ConflictResolution) -> bool

    # Bulk Operations
    async def bulk_sync_pools(self, tenant_id: str) -> BulkSyncResult
    async def import_netbox_prefix(self, prefix_id: int, tenant_id: str) -> IPPool
```

**Integration Points**:
1. Create NetBox prefix when pool is created
2. Create NetBox IP address when reservation is made
3. Sync status changes (reserved → assigned → released)
4. Import existing NetBox prefixes as pools
5. Detect and alert on conflicts
6. Bi-directional sync with conflict resolution

### REST API (`src/dotmac/platform/ip_management/router.py`)

```python
# IP Pool Management
GET    /api/v1/ip-management/pools
POST   /api/v1/ip-management/pools
GET    /api/v1/ip-management/pools/{pool_id}
PUT    /api/v1/ip-management/pools/{pool_id}
DELETE /api/v1/ip-management/pools/{pool_id}
GET    /api/v1/ip-management/pools/{pool_id}/utilization
GET    /api/v1/ip-management/pools/{pool_id}/available-ips

# IP Reservation Management
GET    /api/v1/ip-management/reservations
POST   /api/v1/ip-management/reservations
GET    /api/v1/ip-management/reservations/{reservation_id}
PUT    /api/v1/ip-management/reservations/{reservation_id}
DELETE /api/v1/ip-management/reservations/{reservation_id}

# Assignment Operations
POST   /api/v1/ip-management/subscribers/{subscriber_id}/assign-ip
POST   /api/v1/ip-management/subscribers/{subscriber_id}/release-ip
GET    /api/v1/ip-management/subscribers/{subscriber_id}/ips

# Conflict Detection
POST   /api/v1/ip-management/check-conflicts
GET    /api/v1/ip-management/conflicts

# NetBox Sync
POST   /api/v1/ip-management/pools/{pool_id}/sync-netbox
POST   /api/v1/ip-management/netbox/import-prefix/{prefix_id}
GET    /api/v1/ip-management/netbox/conflicts

# Statistics
GET    /api/v1/ip-management/stats
GET    /api/v1/ip-management/pools/{pool_id}/stats
```

### GraphQL API (`src/dotmac/platform/graphql/types/ip_management.py`)

```graphql
type IPPool {
  id: ID!
  poolName: String!
  poolType: IPPoolType!
  networkCidr: String!
  gateway: String
  dnsServers: [String!]
  vlanId: Int
  status: IPPoolStatus!
  totalAddresses: Int!
  reservedCount: Int!
  assignedCount: Int!
  availableCount: Int!
  utilizationPercent: Float!
  autoAssignEnabled: Boolean!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type IPReservation {
  id: ID!
  poolId: ID!
  subscriberId: String!
  ipAddress: String!
  ipType: String!
  status: IPReservationStatus!
  reservedAt: DateTime!
  assignedAt: DateTime
  releasedAt: DateTime
  expiresAt: DateTime
  assignedBy: String
  notes: String
}

type IPConflict {
  ipAddress: String!
  conflictType: ConflictType!
  existingReservation: IPReservation
  netboxConflict: NetBoxConflictInfo
  severity: ConflictSeverity!
}

type PoolUtilization {
  poolId: ID!
  total: Int!
  reserved: Int!
  assigned: Int!
  available: Int!
  utilizationPercent: Float!
  projectedDepletionDate: DateTime
}

# Queries
query {
  ipPools(filters: IPPoolFilters): [IPPool!]!
  ipPool(id: ID!): IPPool
  ipReservations(filters: ReservationFilters): [IPReservation!]!
  subscriberIPs(subscriberId: String!): [IPReservation!]!
  checkIPConflicts(ipAddress: String!): [IPConflict!]!
  poolUtilization(poolId: ID!): PoolUtilization!
}

# Mutations
mutation {
  createIPPool(input: CreateIPPoolInput!): IPPool!
  updateIPPool(id: ID!, input: UpdateIPPoolInput!): IPPool!
  deleteIPPool(id: ID!): Boolean!

  reserveIP(input: ReserveIPInput!): IPReservation!
  assignIPAuto(subscriberId: String!, poolId: ID!): IPReservation!
  releaseIP(reservationId: ID!): Boolean!

  syncPoolToNetBox(poolId: ID!): NetBoxSyncResult!
  importNetBoxPrefix(prefixId: Int!): IPPool!
}
```

### Frontend Components

#### 1. IP Pool List (`components/ip-management/IPPoolList.tsx`)

```tsx
<IPPoolList>
  - Table view of all IP pools
  - Columns: Name, Type, Network, Utilization, Status, Actions
  - Filters: Type, Status, Search
  - Utilization bar charts
  - Create Pool button
  - Quick actions: Edit, Delete, View Details, Sync NetBox
</IPPoolList>
```

#### 2. IP Pool Form (`components/ip-management/IPPoolForm.tsx`)

```tsx
<IPPoolForm mode="create|edit">
  - Pool name input
  - Pool type select (IPv4 Public, IPv4 Private, IPv6, etc.)
  - Network CIDR input with validation
  - Gateway input
  - DNS servers (comma-separated)
  - VLAN ID input
  - Auto-assign toggle
  - Manual reservation toggle
  - Description textarea
  - NetBox prefix ID input
  - Submit/Cancel buttons
</IPPoolForm>
```

#### 3. IP Reservation Manager (`components/ip-management/IPReservationManager.tsx`)

```tsx
<IPReservationManager subscriberId={id}>
  - Current IP assignments display
  - Available pools dropdown
  - Manual IP input with conflict check
  - Auto-assign button
  - Release button
  - Reservation history
  - Conflict alerts
  - NetBox sync status
</IPReservationManager>
```

#### 4. IP Conflict Detector (`components/ip-management/IPConflictDetector.tsx`)

```tsx
<IPConflictDetector ipAddress={ip} onCheck={handleCheck}>
  - IP address input
  - Check button
  - Conflict results display:
    - Existing reservations
    - NetBox conflicts
    - RADIUS sessions using IP
    - Network profile assignments
  - Resolution suggestions
  - Force assign option (with warning)
</IPConflictDetector>
```

#### 5. Pool Utilization Dashboard (`components/ip-management/PoolUtilizationDashboard.tsx`)

```tsx
<PoolUtilizationDashboard>
  - Summary cards:
    - Total Pools
    - Total IPs
    - Assigned IPs
    - Available IPs
  - Pool utilization charts (bar/pie)
  - Depletion warnings
  - IPv4 vs IPv6 breakdown
  - Top utilized pools
  - Recent assignments
</PoolUtilizationDashboard>
```

#### 6. NetBox Sync Manager (`components/ip-management/NetBoxSyncManager.tsx`)

```tsx
<NetBoxSyncManager>
  - Sync status indicators
  - Last sync timestamp
  - Conflict count
  - Sync all button
  - Import NetBox prefix
  - Conflict resolution interface
  - Sync history log
</NetBoxSyncManager>
```

### Orchestration Hooks

#### 1. Subscriber Provisioning Hook

```python
# In orchestration workflow
async def provision_subscriber_with_ip(subscriber_id: str, plan_id: str):
    """
    Automatically assign IP when provisioning subscriber.
    """
    # 1. Determine required IP type from plan
    plan = await get_plan(plan_id)
    requires_static_ipv4 = plan.features.get("static_ip", False)
    requires_ipv6_pd = plan.features.get("ipv6_pd", False)

    # 2. Find appropriate pool
    if requires_static_ipv4:
        pool = await ip_service.find_pool_by_type(
            tenant_id=tenant_id,
            pool_type=IPPoolType.IPV4_PUBLIC
        )
        # 3. Auto-assign IP
        reservation = await ip_service.assign_ip_auto(
            subscriber_id=subscriber_id,
            pool_id=pool.id,
            ip_type="ipv4"
        )
        # 4. Update network profile
        await network_profile_service.upsert_profile(
            subscriber_id=subscriber_id,
            data=NetworkProfileUpdate(static_ipv4=reservation.ip_address)
        )

    if requires_ipv6_pd:
        # Similar logic for IPv6 prefix delegation
        pass
```

#### 2. Service Plan Change Hook

```python
async def handle_plan_change(subscriber_id: str, old_plan_id: str, new_plan_id: str):
    """
    Adjust IP assignments when plan changes.
    """
    old_plan = await get_plan(old_plan_id)
    new_plan = await get_plan(new_plan_id)

    # Upgrade: Add static IP if new plan includes it
    if not old_plan.features.get("static_ip") and new_plan.features.get("static_ip"):
        await assign_static_ip(subscriber_id)

    # Downgrade: Release static IP if removed from plan
    if old_plan.features.get("static_ip") and not new_plan.features.get("static_ip"):
        await release_static_ip(subscriber_id)
```

#### 3. Service Termination Hook

```python
async def terminate_subscriber(subscriber_id: str):
    """
    Release all IPs when terminating subscriber.
    """
    # Get all reservations
    reservations = await ip_service.get_subscriber_reservations(subscriber_id)

    # Release each IP
    for reservation in reservations:
        await ip_service.release_ip(reservation.id)

    # Sync to NetBox
    for reservation in reservations:
        await netbox_sync.delete_ip_address(reservation.netbox_ip_id)
```

## 🎯 Key Features

### Conflict Detection

1. **Database-level conflicts**: Check ip_reservations table
2. **NetBox conflicts**: Query NetBox for existing assignments
3. **RADIUS conflicts**: Check active sessions using IP
4. **Network profile conflicts**: Check static_ipv4/ipv6 fields
5. **Pool boundary check**: Ensure IP is within pool CIDR

### Auto-Assignment Algorithm

```python
async def find_available_ip(pool: IPPool) -> str | None:
    """
    Find next available IP in pool.
    """
    # 1. Parse network CIDR
    network = ipaddress.ip_network(pool.network_cidr)

    # 2. Get all assigned IPs in pool
    assigned_ips = await get_assigned_ips_in_pool(pool.id)
    assigned_set = set(assigned_ips)

    # 3. Iterate through network hosts
    for ip in network.hosts():
        ip_str = str(ip)

        # Skip gateway
        if ip_str == pool.gateway:
            continue

        # Skip if already assigned
        if ip_str in assigned_set:
            continue

        # Found available IP
        return ip_str

    # Pool depleted
    return None
```

### Utilization Tracking

Automatically updated on:
- IP reservation: `reserved_count += 1`
- IP assignment: `assigned_count += 1`, `reserved_count -= 1`
- IP release: `assigned_count -= 1`

Triggers:
- Alert when utilization > 80%
- Change status to DEPLETED when utilization = 100%
- Projected depletion date based on assignment rate

## 🧪 Testing Strategy

### Unit Tests (`tests/ip_management/test_ip_service.py`)

```python
async def test_reserve_ip_success()
async def test_reserve_ip_conflict()
async def test_auto_assign_ip()
async def test_auto_assign_depleted_pool()
async def test_release_ip()
async def test_pool_utilization_tracking()
async def test_ipv6_prefix_delegation()
async def test_conflict_detection()
async def test_cleanup_expired_reservations()
```

### Integration Tests (`tests/ip_management/test_ip_router.py`)

```python
async def test_create_pool_api()
async def test_assign_ip_via_api()
async def test_release_ip_via_api()
async def test_check_conflicts_api()
async def test_sync_netbox_api()
```

### E2E Tests (`tests/e2e/test_ip_management_flow.py`)

```python
async def test_complete_subscriber_provisioning_with_ip()
async def test_plan_upgrade_adds_static_ip()
async def test_subscriber_termination_releases_ips()
```

## 📚 Documentation

Create the following docs:
1. `IP_MANAGEMENT_USER_GUIDE.md` - Operator guide for using UI
2. `IP_MANAGEMENT_API.md` - API reference with examples
3. `IP_MANAGEMENT_NETBOX_INTEGRATION.md` - NetBox setup guide
4. `IP_MANAGEMENT_TROUBLESHOOTING.md` - Common issues and solutions

## 🚀 Deployment Checklist

- [ ] Run migration: `alembic upgrade head`
- [ ] Create initial IP pools for tenant
- [ ] Configure NetBox integration
- [ ] Set up cleanup cron job for expired reservations
- [ ] Configure orchestration hooks
- [ ] Train operators on IP management UI
- [ ] Set up monitoring for pool utilization
- [ ] Configure alerts for conflicts and depletion

## 💡 Future Enhancements

1. **DHCP Integration**: Auto-update DHCP server configurations
2. **IP Assignment Policies**: Business rules for pool selection
3. **Reservation Templates**: Pre-configure IP assignments for site types
4. **Batch Operations**: Bulk import/export of IP assignments
5. **IP Address History**: Track full lifecycle of each IP
6. **Geographic IP Pools**: Assign IPs based on subscriber location
7. **IPv6 Address Planning**: Tools for designing IPv6 addressing schemes
8. **Integration with DNS**: Auto-create DNS records for static IPs
9. **Cost Tracking**: Associate costs with public IP usage
10. **Audit Reports**: Generate compliance reports for IP usage

## 📞 Support

For implementation questions:
- Check existing IP management implementations
- Review NetBox API documentation
- Consult IPv6 addressing best practices
- Test conflict detection thoroughly before production

This system provides enterprise-grade static IP management with comprehensive conflict detection, NetBox integration, and seamless orchestration hooks for automatic IP lifecycle management.
