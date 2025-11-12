# Phase 5: IPv4 Lifecycle Management - Implementation Guide

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Integration Points](#integration-points)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)

## Overview

Phase 5 implements comprehensive IPv4 address lifecycle management for the DotMac FTTH platform. This feature provides automated tracking and management of IPv4 addresses through their complete lifecycle from allocation to revocation.

### Key Features

- **State Machine Management**: 7-state lifecycle (PENDING → ALLOCATED → ACTIVE → SUSPENDED → REVOKING → REVOKED → FAILED)
- **RADIUS Integration**: Automatic CoA and Disconnect-Request for dynamic session management
- **NetBox IPAM Sync**: Bidirectional synchronization with NetBox IP Address Management
- **Multi-tenant Isolation**: Complete tenant-scoped operations and data isolation
- **Background Cleanup**: Automated cleanup of stale addresses and leak detection
- **Real-time Metrics**: Prometheus metrics for monitoring and alerting
- **Dual API**: Both REST and GraphQL APIs for maximum flexibility

### Lifecycle States

```
PENDING     → Initial state, IP reserved but not allocated
ALLOCATED   → IP allocated from pool, assigned to subscriber
ACTIVE      → IP activated, subscriber online
SUSPENDED   → Temporarily suspended (e.g., non-payment)
REVOKING    → Revocation in progress
REVOKED     → IP released back to pool
FAILED      → Operation failed, requires manual intervention
```

### State Transitions

- **allocate**: PENDING → ALLOCATED
- **activate**: ALLOCATED → ACTIVE
- **suspend**: ACTIVE → SUSPENDED
- **reactivate**: SUSPENDED → ACTIVE
- **revoke**: ANY → REVOKING → REVOKED

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                               │
│  ┌──────────────────┐        ┌─────────────────────────┐   │
│  │   REST API       │        │   GraphQL API            │   │
│  │ (FastAPI)        │        │  (Strawberry)            │   │
│  └────────┬─────────┘        └───────────┬─────────────┘   │
└───────────┼───────────────────────────────┼─────────────────┘
            │                               │
            v                               v
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       IPv4LifecycleService                           │   │
│  │   implements AddressLifecycleService protocol        │   │
│  └─────┬────────────────────────────────────┬───────────┘   │
└────────┼────────────────────────────────────┼───────────────┘
         │                                    │
         v                                    v
┌────────────────────┐            ┌──────────────────────────┐
│  Database Layer    │            │   External Integrations  │
│  ┌──────────────┐  │            │  ┌────────────────────┐  │
│  │ IPReservation│  │            │  │ RADIUS Client      │  │
│  │   Model      │  │            │  │  - CoA             │  │
│  │              │  │            │  │  - Disconnect      │  │
│  └──────────────┘  │            │  └────────────────────┘  │
│  ┌──────────────┐  │            │  ┌────────────────────┐  │
│  │   IPPool     │  │            │  │ NetBox IPAM        │  │
│  │    Model     │  │            │  │  - IP Sync         │  │
│  └──────────────┘  │            │  │  - Status Update   │  │
│                    │            │  └────────────────────┘  │
└────────────────────┘            └──────────────────────────┘
         │                                    │
         v                                    v
┌─────────────────────────────────────────────────────────────┐
│                  Background Tasks (Celery)                  │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │ Cleanup Task         │  │ Metrics Emission Task       │ │
│  │ - Delete old entries │  │ - State counts              │ │
│  │ - Detect leaks       │  │ - Utilization rates         │ │
│  │ - Auto-complete stuck│  │ - Pool statistics           │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Unified Lifecycle Protocol

Phase 5 introduces a shared `AddressLifecycleService` protocol that both IPv4 and IPv6 lifecycle services implement:

```python
from typing import Protocol, Optional
from uuid import UUID
from dotmac.platform.network.lifecycle_protocol import (
    AddressLifecycleService,
    LifecycleResult,
    LifecycleState
)

class AddressLifecycleService(Protocol):
    """Unified protocol for IP address lifecycle management."""

    async def allocate(
        self,
        subscriber_id: UUID,
        pool_id: Optional[UUID] = None,
        requested_address: Optional[str] = None,
        commit: bool = True
    ) -> LifecycleResult:
        """Allocate IP address from pool."""
        ...

    async def activate(
        self,
        subscriber_id: UUID,
        username: Optional[str] = None,
        nas_ip: Optional[str] = None,
        send_coa: bool = False,
        update_netbox: bool = True,
        commit: bool = True
    ) -> LifecycleResult:
        """Activate allocated IP address."""
        ...

    async def suspend(
        self,
        subscriber_id: UUID,
        username: Optional[str] = None,
        nas_ip: Optional[str] = None,
        send_coa: bool = True,
        reason: Optional[str] = None,
        commit: bool = True
    ) -> LifecycleResult:
        """Suspend active IP address."""
        ...

    async def reactivate(
        self,
        subscriber_id: UUID,
        commit: bool = True
    ) -> LifecycleResult:
        """Reactivate suspended IP address."""
        ...

    async def revoke(
        self,
        subscriber_id: UUID,
        username: Optional[str] = None,
        nas_ip: Optional[str] = None,
        send_disconnect: bool = True,
        release_to_pool: bool = True,
        update_netbox: bool = True,
        commit: bool = True
    ) -> LifecycleResult:
        """Revoke IP address and return to pool."""
        ...
```

## Database Schema

### Migration: `2025_11_08_1553-add_ipv4_lifecycle_fields_to_ip_reservations.py`

Added fields to `ip_reservations` table:

```sql
-- Lifecycle state enum
CREATE TYPE lifecyclestate AS ENUM (
    'pending',
    'allocated',
    'active',
    'suspended',
    'revoking',
    'revoked',
    'failed'
);

-- New columns
ALTER TABLE ip_reservations ADD COLUMN lifecycle_state lifecyclestate NOT NULL DEFAULT 'pending';
ALTER TABLE ip_reservations ADD COLUMN lifecycle_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ip_reservations ADD COLUMN lifecycle_activated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ip_reservations ADD COLUMN lifecycle_suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ip_reservations ADD COLUMN lifecycle_revoked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ip_reservations ADD COLUMN lifecycle_metadata JSONB DEFAULT '{}';

-- Indexes for performance
CREATE INDEX idx_ip_reservations_lifecycle_state ON ip_reservations(lifecycle_state);
CREATE INDEX idx_ip_reservations_lifecycle_allocated_at ON ip_reservations(lifecycle_allocated_at) WHERE lifecycle_allocated_at IS NOT NULL;
```

### IPReservation Model Extensions

```python
class IPReservation(Base, TimestampMixin, TenantMixin):
    # ... existing fields ...

    # Phase 5: IPv4 Lifecycle Management
    lifecycle_state: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="Current lifecycle state"
    )

    lifecycle_allocated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the IP was allocated"
    )

    lifecycle_activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the IP was activated"
    )

    lifecycle_suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the IP was suspended"
    )

    lifecycle_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the IP was revoked"
    )

    lifecycle_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Additional lifecycle metadata"
    )
```

## API Reference

### REST API Endpoints

Base URL: `/api/v1/network`

#### 1. Get IPv4 Lifecycle Status

```http
GET /network/subscribers/{subscriber_id}/ipv4/status
```

**Response:**
```json
{
  "subscriber_id": "550e8400-e29b-41d4-a716-446655440000",
  "address": "203.0.113.10",
  "state": "active",
  "allocated_at": "2025-11-08T10:30:00Z",
  "activated_at": "2025-11-08T10:31:00Z",
  "suspended_at": null,
  "revoked_at": null,
  "netbox_ip_id": 12345,
  "metadata": {
    "pool_id": "a1b2c3d4-...",
    "allocation_method": "auto"
  }
}
```

#### 2. Allocate IPv4 Address

```http
POST /network/subscribers/{subscriber_id}/ipv4/allocate
Content-Type: application/json

{
  "pool_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requested_address": "203.0.113.10"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "IPv4 address allocated successfully",
  "address": "203.0.113.10",
  "state": "allocated",
  "allocated_at": "2025-11-08T10:30:00Z",
  "activated_at": null,
  "suspended_at": null,
  "revoked_at": null,
  "netbox_ip_id": null,
  "coa_result": null,
  "disconnect_result": null,
  "metadata": {}
}
```

#### 3. Activate IPv4 Address

```http
POST /network/subscribers/{subscriber_id}/ipv4/activate
Content-Type: application/json

{
  "username": "subscriber@radius.domain",
  "nas_ip": "10.0.0.1",
  "send_coa": true,
  "update_netbox": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "IPv4 address activated successfully",
  "address": "203.0.113.10",
  "state": "active",
  "allocated_at": "2025-11-08T10:30:00Z",
  "activated_at": "2025-11-08T10:31:00Z",
  "suspended_at": null,
  "revoked_at": null,
  "netbox_ip_id": 12345,
  "coa_result": {
    "success": true,
    "code": "CoA-ACK",
    "message": "CoA applied successfully"
  },
  "disconnect_result": null,
  "metadata": {}
}
```

#### 4. Suspend IPv4 Address

```http
POST /network/subscribers/{subscriber_id}/ipv4/suspend
Content-Type: application/json

{
  "username": "subscriber@radius.domain",
  "nas_ip": "10.0.0.1",
  "send_coa": true,
  "reason": "Non-payment"
}
```

#### 5. Reactivate IPv4 Address

```http
POST /network/subscribers/{subscriber_id}/ipv4/reactivate
```

#### 6. Revoke IPv4 Address

```http
POST /network/subscribers/{subscriber_id}/ipv4/revoke
Content-Type: application/json

{
  "username": "subscriber@radius.domain",
  "nas_ip": "10.0.0.1",
  "send_disconnect": true,
  "release_to_pool": true,
  "update_netbox": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "IPv4 address revoked successfully",
  "address": "203.0.113.10",
  "state": "revoked",
  "allocated_at": "2025-11-08T10:30:00Z",
  "activated_at": "2025-11-08T10:31:00Z",
  "suspended_at": null,
  "revoked_at": "2025-11-08T12:00:00Z",
  "netbox_ip_id": null,
  "coa_result": null,
  "disconnect_result": {
    "success": true,
    "code": "Disconnect-ACK",
    "message": "Session terminated"
  },
  "metadata": {}
}
```

### GraphQL API

#### Queries

##### 1. Get IPv4 Lifecycle Status

```graphql
query GetIPv4Status($subscriberId: String!) {
  ipv4LifecycleStatus(subscriberId: $subscriberId) {
    subscriberId
    address
    state
    allocatedAt
    activatedAt
    suspendedAt
    revokedAt
    netboxIpId
    metadata
  }
}
```

#### Mutations

##### 1. Allocate IPv4

```graphql
mutation AllocateIPv4($subscriberId: String!, $input: IPv4AllocationInput!) {
  allocateIpv4(subscriberId: $subscriberId, input: $input) {
    success
    message
    address
    state
    allocatedAt
    netboxIpId
  }
}

# Variables
{
  "subscriberId": "550e8400-e29b-41d4-a716-446655440000",
  "input": {
    "poolId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "requestedAddress": null
  }
}
```

##### 2. Activate IPv4

```graphql
mutation ActivateIPv4($subscriberId: String!, $input: IPv4ActivationInput!) {
  activateIpv4(subscriberId: $subscriberId, input: $input) {
    success
    message
    address
    state
    activatedAt
    coaResult
    netboxIpId
  }
}

# Variables
{
  "subscriberId": "550e8400-e29b-41d4-a716-446655440000",
  "input": {
    "username": "subscriber@radius.domain",
    "nasIp": "10.0.0.1",
    "sendCoa": true,
    "updateNetbox": true
  }
}
```

##### 3. Suspend IPv4

```graphql
mutation SuspendIPv4($subscriberId: String!, $input: IPv4SuspensionInput!) {
  suspendIpv4(subscriberId: $subscriberId, input: $input) {
    success
    message
    address
    state
    suspendedAt
    coaResult
  }
}
```

##### 4. Reactivate IPv4

```graphql
mutation ReactivateIPv4($subscriberId: String!) {
  reactivateIpv4(subscriberId: $subscriberId) {
    success
    message
    address
    state
    suspendedAt
  }
}
```

##### 5. Revoke IPv4

```graphql
mutation RevokeIPv4($subscriberId: String!, $input: IPv4RevocationInput!) {
  revokeIpv4(subscriberId: $subscriberId, input: $input) {
    success
    message
    address
    state
    revokedAt
    disconnectResult
  }
}

# Variables
{
  "subscriberId": "550e8400-e29b-41d4-a716-446655440000",
  "input": {
    "username": "subscriber@radius.domain",
    "nasIp": "10.0.0.1",
    "sendDisconnect": true,
    "releaseToPool": true,
    "updateNetbox": true
  }
}
```

## Integration Points

### 1. RADIUS Integration

IPv4 lifecycle integrates with RADIUS for dynamic session management:

**CoA (Change of Authorization):**
- Sent during `activate()` to push IPv4 address to active session
- Sent during `suspend()` to apply bandwidth restrictions
- Attributes sent:
  - `Framed-IP-Address`: IPv4 address
  - `Session-Timeout`: Configured timeout
  - Vendor-specific attributes based on NAS type

**Disconnect-Request:**
- Sent during `revoke()` to forcibly terminate session
- Ensures clean session cleanup

### 2. NetBox IPAM Integration

Bidirectional synchronization with NetBox:

**During Allocation:**
- Reserve IP in NetBox IPAM
- Store NetBox IP ID in `lifecycle_metadata`

**During Activation:**
- Update NetBox IP status to "Active"
- Add subscriber reference

**During Revocation:**
- Update NetBox IP status to "Available"
- Remove subscriber reference

### 3. Provisioning Workflow Integration

IPv4 lifecycle is integrated into subscriber provisioning:

```python
from dotmac.platform.orchestration.workflows.provision_subscriber import (
    allocate_ip_handler
)

# In provisioning workflow
async def allocate_ip_handler(input_data, context, db):
    # ... existing logic ...

    # Phase 5: IPv4 lifecycle allocation
    if enable_ipv4:
        ipv4_service = IPv4LifecycleService(db, tenant_id)
        ipv4_result = await ipv4_service.allocate(
            subscriber_id=subscriber_id,
            pool_id=input_data.get("ipv4_pool_id"),
            commit=True
        )
        context["ipv4_address"] = ipv4_result.address
```

## Deployment

### Prerequisites

1. **Database Migration:**
```bash
# Run Alembic migration
poetry run alembic upgrade head
```

2. **Environment Variables:**
```bash
# NetBox Integration
NETBOX_API_URL=https://netbox.example.com/api
NETBOX_API_TOKEN=your-netbox-token

# RADIUS Integration
RADIUS_SERVER=10.0.0.1
RADIUS_SECRET=your-radius-secret
```

3. **Celery Workers:**
```bash
# Start Celery worker with IPv4 lifecycle tasks
celery -A dotmac.platform.celery_app worker \
  --loglevel=info \
  --queues=network,lifecycle
```

### Celery Beat Schedule

Add to `celery_beat_schedule`:

```python
CELERY_BEAT_SCHEDULE = {
    # ... existing schedules ...

    "cleanup-ipv4-stale-reservations": {
        "task": "network.cleanup_ipv4_stale_reservations",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
    },

    "emit-ipv4-lifecycle-metrics": {
        "task": "network.emit_ipv4_lifecycle_metrics",
        "schedule": timedelta(minutes=5),  # Every 5 minutes
    },
}
```

### Grafana Dashboard Import

1. Navigate to Grafana → Dashboards → Import
2. Upload: `grafana/dashboards/ipv4-lifecycle.json`
3. Select Prometheus datasource
4. Click Import

## Monitoring

### Prometheus Metrics

The following metrics are exposed:

#### Counter Metrics

```
# Total lifecycle operations
dotmac_ipv4_lifecycle_operations_total{tenant_id, operation, status}

# Operations: allocate, activate, suspend, reactivate, revoke
# Status: success, failed
```

#### Histogram Metrics

```
# Operation duration in seconds
dotmac_ipv4_lifecycle_operation_duration_seconds{tenant_id, operation}

# Buckets: .001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10
```

#### Gauge Metrics (emitted by background tasks)

```
# State counts
ipv4_lifecycle_state_count{tenant_id, state}

# Pool metrics
ipv4_pool_total_addresses{tenant_id, pool_name}
ipv4_pool_available_count{tenant_id, pool_name}

# Health metrics
ipv4_address_leak_count{tenant_id}
ipv4_netbox_integrated_count{tenant_id}
```

### Grafana Dashboard Panels

The IPv4 Lifecycle dashboard (`ipv4-lifecycle.json`) includes:

1. **State Distribution** (Pie Chart) - Address distribution across states
2. **Utilization Rate** (Gauge) - % of addresses in ACTIVE state
3. **Pool Utilization** (Gauge) - Overall pool capacity usage
4. **Allocation Rate** (Time Series) - Allocations per minute
5. **Activation Rate** (Time Series) - Activations per minute
6. **Suspension/Revocation Rate** (Time Series) - State changes per minute
7. **Address Leaks** (Stat) - Addresses stuck >24h
8. **NetBox Integration Rate** (Stat) - % addresses synced with NetBox
9. **Allocation Duration p95** (Stat) - 95th percentile latency
10. **Activation Duration p95** (Stat) - 95th percentile latency
11. **Revocation Duration p95** (Stat) - 95th percentile latency
12. **Total Active Addresses** (Stat) - Current active count
13. **State Timeline** (Stacked Area) - State distribution over time
14. **Operation Success Rate** (Time Series) - Success % by operation
15. **Pool Health Table** (Table) - Per-pool utilization breakdown

### Alerting Rules

Recommended Prometheus alerts:

```yaml
groups:
  - name: ipv4_lifecycle
    rules:
      - alert: IPv4PoolHighUtilization
        expr: |
          (sum(ipv4_lifecycle_state_count{state=~"allocated|active"}) by (tenant_id, pool_name)
          / sum(ipv4_pool_total_addresses) by (tenant_id, pool_name)) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "IPv4 pool {{ $labels.pool_name }} utilization high"
          description: "Pool utilization is {{ $value | humanizePercentage }}"

      - alert: IPv4AddressLeak
        expr: sum(ipv4_address_leak_count) by (tenant_id) > 10
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "IPv4 address leak detected"
          description: "{{ $value }} addresses stuck in ALLOCATED for >24h"

      - alert: IPv4AllocationFailureRate
        expr: |
          rate(dotmac_ipv4_lifecycle_operations_total{operation="allocate",status="failed"}[5m])
          / rate(dotmac_ipv4_lifecycle_operations_total{operation="allocate"}[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High IPv4 allocation failure rate"
          description: "{{ $value | humanizePercentage }} of allocations failing"

      - alert: IPv4NetBoxSyncLow
        expr: |
          (sum(ipv4_netbox_integrated_count) by (tenant_id)
          / sum(ipv4_lifecycle_state_count{state=~"allocated|active"}) by (tenant_id)) < 0.95
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low NetBox synchronization rate"
          description: "Only {{ $value | humanizePercentage }} of IPs synced with NetBox"
```

## Troubleshooting

### Common Issues

#### 1. Address Stuck in ALLOCATED State

**Symptoms:** IP addresses remain in ALLOCATED state for >24 hours

**Diagnosis:**
```bash
# Check background cleanup task logs
grep "cleanup_ipv4_stale_reservations" /var/log/celery/worker.log

# Query database for stuck addresses
SELECT id, ip_address, subscriber_id, lifecycle_allocated_at
FROM ip_reservations
WHERE lifecycle_state = 'allocated'
  AND lifecycle_allocated_at < NOW() - INTERVAL '24 hours';
```

**Resolution:**
1. Manual activation:
   ```bash
   curl -X POST http://localhost:8000/api/v1/network/subscribers/{id}/ipv4/activate \
     -H "Content-Type: application/json" \
     -d '{"send_coa": true, "update_netbox": true}'
   ```

2. Or revoke and reallocate:
   ```bash
   curl -X POST http://localhost:8000/api/v1/network/subscribers/{id}/ipv4/revoke \
     -d '{"release_to_pool": true}'
   ```

#### 2. CoA/Disconnect Failures

**Symptoms:** RADIUS operations return errors

**Diagnosis:**
```python
# Check RADIUS client logs
logger.error("radius_coa_failed", subscriber_id=id, error=str(e))
```

**Resolution:**
1. Verify RADIUS server connectivity:
   ```bash
   telnet <radius_server> 3799  # CoA port
   telnet <radius_server> 1700  # Disconnect port
   ```

2. Check RADIUS secret configuration
3. Verify NAS IP is correct
4. Enable `send_coa=False` to skip RADIUS if needed

#### 3. NetBox Sync Issues

**Symptoms:** `netbox_ip_id` is null for active addresses

**Diagnosis:**
```bash
# Check NetBox API connectivity
curl -H "Authorization: Token $NETBOX_API_TOKEN" \
  https://netbox.example.com/api/ipam/ip-addresses/
```

**Resolution:**
1. Verify NetBox credentials
2. Check tenant prefix configuration in NetBox
3. Run manual sync:
   ```python
   from dotmac.platform.netbox.service import NetBoxService

   netbox = NetBoxService()
   result = await netbox.reserve_ip(
       prefix_id=123,
       subscriber_id="uuid",
       description="Manual sync"
   )
   ```

#### 4. Pool Exhaustion

**Symptoms:** Allocations fail with "No available IP addresses"

**Diagnosis:**
```sql
SELECT
    pool_name,
    total_addresses,
    assigned_count,
    available_count,
    (assigned_count::float / total_addresses * 100) as utilization_pct
FROM ip_pools
WHERE tenant_id = '<tenant-id>';
```

**Resolution:**
1. Add new IP pool or expand existing
2. Clean up revoked addresses:
   ```sql
   DELETE FROM ip_reservations
   WHERE lifecycle_state = 'revoked'
     AND lifecycle_revoked_at < NOW() - INTERVAL '90 days';
   ```
3. Check for leaked addresses and revoke

## Migration Guide

### Upgrading from Previous Versions

#### Step 1: Database Migration

```bash
# Backup database
pg_dump -h localhost -U postgres dotmac > backup_$(date +%Y%m%d).sql

# Run migration
poetry run alembic upgrade head

# Verify migration
poetry run alembic current
# Should show: 18d78dc9acd0 (head)
```

#### Step 2: Populate Lifecycle State

For existing IP reservations:

```sql
-- Set initial lifecycle state based on current status
UPDATE ip_reservations
SET
    lifecycle_state = CASE
        WHEN status = 'assigned' THEN 'active'
        WHEN status = 'reserved' THEN 'allocated'
        WHEN status = 'released' THEN 'pending'
        ELSE 'pending'
    END,
    lifecycle_allocated_at = CASE
        WHEN status IN ('assigned', 'reserved') THEN created_at
        ELSE NULL
    END,
    lifecycle_activated_at = CASE
        WHEN status = 'assigned' THEN created_at
        ELSE NULL
    END
WHERE lifecycle_state = 'pending';
```

#### Step 3: Update Application Code

Replace direct IP assignment with lifecycle operations:

**Before:**
```python
# Old direct assignment
reservation = IPReservation(
    tenant_id=tenant_id,
    pool_id=pool_id,
    ip_address=ip,
    subscriber_id=subscriber_id,
    status=IPReservationStatus.ASSIGNED
)
db.add(reservation)
await db.commit()
```

**After:**
```python
# New lifecycle-aware allocation
from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService

ipv4_service = IPv4LifecycleService(db, tenant_id)

# Allocate
result = await ipv4_service.allocate(
    subscriber_id=subscriber_id,
    pool_id=pool_id,
    commit=True
)

# Activate
await ipv4_service.activate(
    subscriber_id=subscriber_id,
    username=username,
    nas_ip=nas_ip,
    send_coa=True,
    commit=True
)
```

#### Step 4: Configure Background Tasks

Update `celeryconfig.py`:

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE.update({
    "cleanup-ipv4-stale-reservations": {
        "task": "network.cleanup_ipv4_stale_reservations",
        "schedule": crontab(hour=2, minute=0),
    },
    "emit-ipv4-lifecycle-metrics": {
        "task": "network.emit_ipv4_lifecycle_metrics",
        "schedule": timedelta(minutes=5),
    },
})
```

Restart Celery Beat:
```bash
systemctl restart celery-beat
```

#### Step 5: Import Grafana Dashboard

```bash
# Using Grafana API
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @grafana/dashboards/ipv4-lifecycle.json
```

#### Step 6: Verify Deployment

1. **Check metrics emission:**
   ```bash
   curl http://localhost:8000/metrics | grep ipv4_lifecycle
   ```

2. **Test allocation:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/network/subscribers/{id}/ipv4/allocate \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"pool_id": "..."}'
   ```

3. **Monitor Grafana:**
   - Navigate to IPv4 Lifecycle Dashboard
   - Verify data is appearing in panels
   - Check for any error panels

### Rollback Procedure

If issues arise:

```bash
# Rollback database migration
poetry run alembic downgrade -1

# Restore from backup if needed
psql -h localhost -U postgres dotmac < backup_YYYYMMDD.sql

# Revert code changes
git revert <commit-hash>

# Restart services
systemctl restart celery-worker celery-beat gunicorn
```

## Performance Considerations

### Database Indexing

Ensure indexes are created for optimal query performance:

```sql
-- Lifecycle state index (for filtering by state)
CREATE INDEX idx_ip_reservations_lifecycle_state
ON ip_reservations(lifecycle_state);

-- Allocation timestamp index (for leak detection)
CREATE INDEX idx_ip_reservations_lifecycle_allocated_at
ON ip_reservations(lifecycle_allocated_at)
WHERE lifecycle_allocated_at IS NOT NULL;

-- Composite index for tenant + state queries
CREATE INDEX idx_ip_reservations_tenant_lifecycle_state
ON ip_reservations(tenant_id, lifecycle_state);
```

### Connection Pooling

Configure async connection pool for high throughput:

```python
# In settings.py
SQLALCHEMY_POOL_SIZE = 20
SQLALCHEMY_MAX_OVERFLOW = 10
SQLALCHEMY_POOL_TIMEOUT = 30
SQLALCHEMY_POOL_RECYCLE = 3600
```

### Caching Recommendations

Cache frequently accessed data:

```python
from aiocache import cached

@cached(ttl=300)  # 5 minutes
async def get_pool_utilization(pool_id: UUID) -> float:
    # Cache pool stats to reduce DB load
    pass
```

## Security Considerations

### Authentication

All API endpoints require authentication:

```python
from dotmac.platform.auth.core import get_current_user

@router.post("/subscribers/{subscriber_id}/ipv4/allocate")
async def allocate_ipv4(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),  # Required
    db: AsyncSession = Depends(get_session_dependency)
):
    # Verify tenant access
    await _ensure_subscriber_access(db, current_user, subscriber_id)
```

### Tenant Isolation

All queries are automatically scoped to tenant:

```python
# Service enforces tenant isolation
class IPv4LifecycleService:
    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id  # All queries filtered by this
```

### Audit Logging

All lifecycle operations are logged:

```python
logger.info(
    "ipv4_allocated",
    tenant_id=tenant_id,
    subscriber_id=subscriber_id,
    address=result.address,
    pool_id=pool_id,
    user_id=current_user.id
)
```

## Best Practices

1. **Always use lifecycle service** - Don't manipulate IP reservations directly
2. **Enable commit=False for testing** - Use transactions for safe testing
3. **Monitor pool utilization** - Set alerts at 85% threshold
4. **Regular cleanup** - Ensure Celery beat tasks are running
5. **Graceful degradation** - Handle RADIUS/NetBox failures gracefully
6. **Idempotency** - Operations can be safely retried

## Support

For issues or questions:
- GitHub Issues: https://github.com/dotmac/ftth-ops/issues
- Documentation: https://docs.dotmac.io/ipv4-lifecycle
- Team: network-team@dotmac.io
