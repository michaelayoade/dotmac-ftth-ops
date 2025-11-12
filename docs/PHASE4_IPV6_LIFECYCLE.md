# Phase 4: IPv6 Lifecycle Management

**Status**: ✅ Completed
**Version**: 1.0
**Last Updated**: November 7, 2025

## Overview

Phase 4 implements comprehensive IPv6 prefix lifecycle management with state tracking, IPAM integration, and dynamic session updates via RADIUS CoA. This enables operators to manage IPv6 prefix allocation, activation, suspension, and revocation with full observability and operational control.

## Features

- **7-State Lifecycle Management**: Complete state machine from allocation to revocation
- **NetBox IPAM Integration**: Automated prefix allocation and release
- **RADIUS CoA Support**: Dynamic session updates without restart
- **Prometheus Metrics**: Full lifecycle observability
- **REST API**: Operational endpoints for all lifecycle transitions
- **Automatic Cleanup**: IPv6 revocation on service termination
- **Idempotent Operations**: Safe retry behavior for all operations

---

## State Machine

### Lifecycle States

```
┌─────────┐     allocate      ┌───────────┐     activate     ┌────────┐
│ PENDING │ ──────────────▶ │ ALLOCATED │ ──────────────▶ │ ACTIVE │
└─────────┘                   └───────────┘                  └────────┘
     │                             │                             │   │
     │                             │         revoke              │   │ suspend
     │                             └──────────────▶┌──────────┐ │   └──────▶┌───────────┐
     │                                              │ REVOKING │◀┘           │ SUSPENDED │
     │                  revoke                      └──────────┘             └───────────┘
     └─────────────────────────────────────────────────┘  │                        │
                                                           ▼                        │ resume
     ┌────────┐◀────────────────────────────────────┌─────────┐                   │
     │ FAILED │                                      │ REVOKED │◀──────────────────┘
     └────────┘                                      └─────────┘
```

### State Descriptions

| State | Description | Valid Transitions |
|-------|-------------|------------------|
| **PENDING** | Initial state, prefix not yet allocated | → ALLOCATED, FAILED |
| **ALLOCATED** | Prefix reserved from NetBox | → ACTIVE, REVOKED, FAILED |
| **ACTIVE** | Prefix in use by subscriber | → SUSPENDED, REVOKING |
| **SUSPENDED** | Service suspended, prefix retained | → ACTIVE, REVOKED |
| **REVOKING** | Revocation in progress | → REVOKED, FAILED |
| **REVOKED** | Prefix returned to pool | (terminal state) |
| **FAILED** | Operation failed, manual intervention required | → PENDING (manual) |

### Transition Rules

```python
VALID_TRANSITIONS = {
    IPv6LifecycleState.PENDING: {IPv6LifecycleState.ALLOCATED, IPv6LifecycleState.FAILED},
    IPv6LifecycleState.ALLOCATED: {IPv6LifecycleState.ACTIVE, IPv6LifecycleState.REVOKED, IPv6LifecycleState.FAILED},
    IPv6LifecycleState.ACTIVE: {IPv6LifecycleState.SUSPENDED, IPv6LifecycleState.REVOKING},
    IPv6LifecycleState.SUSPENDED: {IPv6LifecycleState.ACTIVE, IPv6LifecycleState.REVOKED},
    IPv6LifecycleState.REVOKING: {IPv6LifecycleState.REVOKED, IPv6LifecycleState.FAILED},
    IPv6LifecycleState.REVOKED: set(),  # Terminal state
    IPv6LifecycleState.FAILED: {IPv6LifecycleState.PENDING},  # Manual recovery
}
```

---

## REST API Endpoints

Base path: `/api/network/subscribers/{subscriber_id}/ipv6`

### 1. Get IPv6 Lifecycle Status

**Endpoint**: `GET /api/network/subscribers/{subscriber_id}/ipv6/status`

**Description**: Retrieve current IPv6 lifecycle state and metadata.

**Response** (200 OK):
```json
{
  "subscriberId": "sub_123",
  "prefix": "2001:db8:100::/56",
  "prefixSize": 56,
  "state": "active",
  "allocatedAt": "2025-11-07T10:00:00Z",
  "activatedAt": "2025-11-07T10:05:00Z",
  "revokedAt": null,
  "netboxPrefixId": 12345,
  "assignmentMode": "pd"
}
```

**Errors**:
- `404`: Network profile not found

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/status
```

---

### 2. Allocate IPv6 Prefix

**Endpoint**: `POST /api/network/subscribers/{subscriber_id}/ipv6/allocate`

**Description**: Allocate an IPv6 prefix from NetBox IPAM.

**Transition**: `PENDING → ALLOCATED`

**Request Body**:
```json
{
  "prefixSize": 56,
  "netboxPoolId": 100
}
```

**Parameters**:
- `prefixSize` (int, optional): Prefix length in bits (48-64), default: 56
- `netboxPoolId` (int, optional): NetBox parent prefix ID to allocate from

**Response** (201 Created):
```json
{
  "success": true,
  "message": "IPv6 prefix allocated successfully",
  "prefix": "2001:db8:100::/56",
  "state": "allocated",
  "allocatedAt": "2025-11-07T10:00:00Z",
  "netboxPrefixId": 12345
}
```

**Errors**:
- `400`: Invalid state transition or unsupported assignment mode
- `404`: Subscriber not found

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefixSize": 56}' \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/allocate
```

---

### 3. Activate IPv6 Prefix

**Endpoint**: `POST /api/network/subscribers/{subscriber_id}/ipv6/activate`

**Description**: Mark prefix as active. Optionally send RADIUS CoA to update live session.

**Transition**: `ALLOCATED → ACTIVE`

**Request Body**:
```json
{
  "username": "subscriber@realm",
  "nasIp": "10.0.0.1",
  "sendCoa": true
}
```

**Parameters**:
- `username` (string, optional): RADIUS username for CoA targeting
- `nasIp` (string, optional): NAS IP address for CoA routing
- `sendCoa` (boolean): Send RADIUS CoA to update session without disconnect (default: false)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "IPv6 prefix activated successfully",
  "prefix": "2001:db8:100::/56",
  "state": "active",
  "activatedAt": "2025-11-07T10:05:00Z",
  "coaResult": {
    "success": true,
    "message": "CoA-Request sent successfully",
    "responseCode": "CoA-ACK"
  }
}
```

**Errors**:
- `400`: Invalid state transition or missing CoA parameters
- `404`: Subscriber not found

**Example with CoA**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "subscriber@realm",
    "nasIp": "10.0.0.1",
    "sendCoa": true
  }' \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/activate
```

---

### 4. Suspend IPv6 Prefix

**Endpoint**: `POST /api/network/subscribers/{subscriber_id}/ipv6/suspend`

**Description**: Suspend service while retaining prefix allocation.

**Transition**: `ACTIVE → SUSPENDED`

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "message": "IPv6 prefix suspended successfully",
  "prefix": "2001:db8:100::/56",
  "state": "suspended"
}
```

**Errors**:
- `400`: Invalid state transition
- `404`: Subscriber not found

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/suspend
```

---

### 5. Resume IPv6 Prefix

**Endpoint**: `POST /api/network/subscribers/{subscriber_id}/ipv6/resume`

**Description**: Resume suspended service.

**Transition**: `SUSPENDED → ACTIVE`

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "message": "IPv6 prefix resumed successfully",
  "prefix": "2001:db8:100::/56",
  "state": "active"
}
```

**Errors**:
- `400`: Invalid state transition
- `404`: Subscriber not found

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/resume
```

---

### 6. Revoke IPv6 Prefix

**Endpoint**: `POST /api/network/subscribers/{subscriber_id}/ipv6/revoke`

**Description**: Revoke prefix and return to NetBox pool. Optionally send RADIUS Disconnect-Request.

**Transition**: `ANY → REVOKING → REVOKED`

**Request Body**:
```json
{
  "username": "subscriber@realm",
  "nasIp": "10.0.0.1",
  "sendDisconnect": true,
  "releaseToNetbox": true
}
```

**Parameters**:
- `username` (string, optional): RADIUS username for disconnect targeting
- `nasIp` (string, optional): NAS IP address for disconnect routing
- `sendDisconnect` (boolean): Send RADIUS Disconnect-Request to force session restart (default: false)
- `releaseToNetbox` (boolean): Release prefix back to NetBox (default: true)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "IPv6 prefix revoked successfully",
  "prefix": "2001:db8:100::/56",
  "state": "revoked",
  "revokedAt": "2025-11-07T10:15:00Z",
  "disconnectResult": {
    "success": true,
    "message": "Disconnect-Request sent successfully",
    "responseCode": "Disconnect-ACK"
  }
}
```

**Errors**:
- `400`: Missing disconnect parameters when sendDisconnect=true
- `404`: Subscriber not found

**Idempotency**: Revoking an already revoked prefix is safe and returns the existing state.

**Example with Disconnect**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "subscriber@realm",
    "nasIp": "10.0.0.1",
    "sendDisconnect": true,
    "releaseToNetbox": true
  }' \
  https://api.example.com/api/network/subscribers/sub_123/ipv6/revoke
```

---

## Integration Points

### 1. NetBox IPAM Integration

**Purpose**: Automated IPv6 prefix allocation and tracking.

**Operations**:
- **Allocate**: Reserve prefix from parent pool
- **Release**: Return prefix to pool on revocation

**Configuration**:
```python
from dotmac.platform.ipam.netbox_client import NetBoxClient

netbox_client = NetBoxClient(
    base_url=settings.NETBOX_URL,
    token=settings.NETBOX_API_TOKEN
)

# Used by IPv6LifecycleService
service = IPv6LifecycleService(
    session=db_session,
    tenant_id=tenant_id,
    netbox_client=netbox_client
)
```

**Database Tracking**:
- Field: `ipv6_netbox_prefix_id` stores NetBox prefix ID
- Indexed for efficient lookup
- Nulled on revocation

**Error Handling**:
- NetBox unavailable: Operation fails, state remains unchanged
- Allocation fails: State transitions to FAILED
- Release fails: Warning logged, state still transitions to REVOKED

---

### 2. RADIUS CoA Integration

**Purpose**: Dynamic session updates without subscriber reconnection.

**Operations**:
- **CoA (Change of Authorization)**: Update IPv6 prefix on active session
- **Disconnect-Request**: Force session termination

**RADIUS Attributes** (RFC 4818):
```
# CoA Packet for IPv6 Prefix Update
User-Name = "subscriber@realm"
Delegated-IPv6-Prefix = "56 2001:db8:100::/56"  # Format: "length prefix"
```

**Configuration**:
```python
from dotmac.platform.radius.coa_client import CoAClient

coa_client = CoAClient(
    tenant_id=tenant_id,
    radius_secret=settings.RADIUS_COA_SECRET,
    nas_ip="10.0.0.1",  # NAS to send CoA to
    coa_port=3799
)

# Used by IPv6LifecycleService
service = IPv6LifecycleService(
    session=db_session,
    tenant_id=tenant_id,
    coa_client=coa_client
)
```

**CoA Response Codes**:
- **CoA-ACK**: NAS accepted and applied changes
- **CoA-NAK**: NAS rejected changes (session not found, unsupported attributes)

**Disconnect Response Codes**:
- **Disconnect-ACK**: Session terminated successfully
- **Disconnect-NAK**: Session not found or disconnect failed

**Error Handling**:
- CoA/Disconnect failures are logged but don't block state transitions
- Results included in API response for operator visibility

---

### 3. Service Termination Integration

**Purpose**: Automatic IPv6 cleanup when subscriber service is terminated.

**Implementation**:
```python
# In LifecycleService.terminate_service()

# Phase 4: Revoke IPv6 prefix on termination
try:
    ipv6_service = IPv6LifecycleService(session=self.session, tenant_id=tenant_id)
    ipv6_revocation_result = await ipv6_service.revoke_ipv6(
        subscriber_id=service.subscriber_id,
        release_to_netbox=True,
        commit=False,  # Part of larger transaction
    )
    logger.info(
        "ipv6.revoked_on_termination",
        subscriber_id=service.subscriber_id,
        prefix=ipv6_revocation_result.get("prefix"),
    )
except Exception as e:
    logger.warning(
        "ipv6.revocation_failed_on_termination",
        subscriber_id=service.subscriber_id,
        error=str(e),
    )
    # Don't block termination if IPv6 revocation fails
```

**Behavior**:
- Triggered automatically when `ServiceStatus.TERMINATED`
- Releases prefix back to NetBox
- Errors logged but don't block service termination
- Part of atomic transaction with service termination

**Location**: `src/dotmac/platform/services/lifecycle/service.py:825-883`

---

## Prometheus Metrics

### Lifecycle State Metrics

**`dotmac_ipv6_lifecycle_state_total`** (Gauge)
- **Description**: Total number of IPv6 prefixes by lifecycle state
- **Labels**: `tenant_id`, `state` (pending/allocated/active/suspended/revoking/revoked/failed)
- **Usage**: Monitor state distribution and identify stuck allocations

```promql
# Total active IPv6 prefixes per tenant
dotmac_ipv6_lifecycle_state_total{state="active"}

# Prefixes stuck in REVOKING state (investigate)
dotmac_ipv6_lifecycle_state_total{state="revoking"} > 0
```

---

**`dotmac_ipv6_lifecycle_utilization_rate`** (Gauge)
- **Description**: Percentage of network profiles with active IPv6 prefixes
- **Labels**: `tenant_id`
- **Usage**: Track IPv6 adoption rate

```promql
# IPv6 utilization rate per tenant
dotmac_ipv6_lifecycle_utilization_rate

# Alert if utilization drops unexpectedly
dotmac_ipv6_lifecycle_utilization_rate < 70
```

---

**`dotmac_ipv6_prefix_allocations_active`** (Gauge)
- **Description**: Number of active IPv6 prefix allocations
- **Labels**: `tenant_id`
- **Usage**: Monitor active IPv6 subscribers

```promql
# Total active IPv6 allocations
sum(dotmac_ipv6_prefix_allocations_active)
```

---

**`dotmac_ipv6_prefix_allocations_pending`** (Gauge)
- **Description**: Number of pending IPv6 prefix allocations
- **Labels**: `tenant_id`
- **Usage**: Identify allocation backlogs

```promql
# Alert on pending allocations (should be processed quickly)
dotmac_ipv6_prefix_allocations_pending > 10
```

---

**`dotmac_ipv6_prefix_allocations_revoked`** (Gauge)
- **Description**: Number of revoked IPv6 prefix allocations
- **Labels**: `tenant_id`
- **Usage**: Track churn and cleanup operations

```promql
# Revocation rate over time
rate(dotmac_ipv6_prefix_allocations_revoked[5m])
```

---

### Operation Metrics

**`dotmac_ipv6_lifecycle_operations_total`** (Counter)
- **Description**: Total number of IPv6 lifecycle operations
- **Labels**: `tenant_id`, `operation` (allocate/activate/suspend/resume/revoke), `status` (success/failed)
- **Usage**: Track operation success/failure rates

```promql
# Success rate by operation
rate(dotmac_ipv6_lifecycle_operations_total{status="success"}[5m])
  /
rate(dotmac_ipv6_lifecycle_operations_total[5m])

# Alert on high failure rate
rate(dotmac_ipv6_lifecycle_operations_total{status="failed"}[5m]) > 1
```

---

**`dotmac_ipv6_lifecycle_operation_duration_seconds`** (Histogram)
- **Description**: Duration of IPv6 lifecycle operations
- **Labels**: `tenant_id`, `operation`
- **Buckets**: 0.1, 0.5, 1.0, 2.5, 5.0, 10.0 seconds
- **Usage**: Monitor operation latency and identify slow operations

```promql
# 95th percentile latency by operation
histogram_quantile(0.95,
  rate(dotmac_ipv6_lifecycle_operation_duration_seconds_bucket[5m])
)

# Average allocation time
rate(dotmac_ipv6_lifecycle_operation_duration_seconds_sum{operation="allocate"}[5m])
  /
rate(dotmac_ipv6_lifecycle_operation_duration_seconds_count{operation="allocate"}[5m])
```

---

**`dotmac_ipv6_netbox_integration_rate`** (Gauge)
- **Description**: Percentage of IPv6 prefixes tracked in NetBox
- **Labels**: `tenant_id`
- **Usage**: Monitor IPAM integration health

```promql
# NetBox integration rate per tenant
dotmac_ipv6_netbox_integration_rate

# Alert if integration rate is low
dotmac_ipv6_netbox_integration_rate < 95
```

---

### Exporting Metrics

**Manual Export** (from Python):
```python
from dotmac.platform.network.ipv6_metrics import IPv6Metrics
from dotmac.platform.monitoring.prometheus_exporter import PrometheusExporter

# Collect lifecycle metrics
ipv6_metrics = IPv6Metrics(db_session, tenant_id="tenant-123")
lifecycle_summary = await ipv6_metrics.get_ipv6_lifecycle_summary()

# Export to Prometheus
PrometheusExporter.export_ipv6_lifecycle_metrics(
    lifecycle_summary=lifecycle_summary,
    tenant_id="tenant-123"
)
```

**Recording Operations**:
```python
# In API endpoint or service method
import time
from dotmac.platform.monitoring.prometheus_exporter import PrometheusExporter

start_time = time.time()
try:
    result = await ipv6_service.allocate_ipv6(...)
    duration = time.time() - start_time
    PrometheusExporter.record_ipv6_lifecycle_operation(
        tenant_id=tenant_id,
        operation="allocate",
        success=True,
        duration_seconds=duration
    )
except Exception as e:
    duration = time.time() - start_time
    PrometheusExporter.record_ipv6_lifecycle_operation(
        tenant_id=tenant_id,
        operation="allocate",
        success=False,
        duration_seconds=duration
    )
    raise
```

---

## Usage Examples

### 1. Standard Lifecycle: Allocate → Activate

```python
from dotmac.platform.network.ipv6_lifecycle_service import IPv6LifecycleService

# Initialize service
ipv6_service = IPv6LifecycleService(
    session=db_session,
    tenant_id="tenant-123",
    netbox_client=netbox_client
)

# Step 1: Allocate prefix from NetBox
allocation = await ipv6_service.allocate_ipv6(
    subscriber_id="sub_123",
    prefix_size=56,
    commit=True
)
# Result: {'prefix': '2001:db8:100::/56', 'state': 'allocated', ...}

# Step 2: Activate prefix (optionally with CoA)
activation = await ipv6_service.activate_ipv6(
    subscriber_id="sub_123",
    username="subscriber@realm",
    nas_ip="10.0.0.1",
    send_coa=True,  # Update live session
    commit=True
)
# Result: {'prefix': '2001:db8:100::/56', 'state': 'active', 'coa_result': {...}}
```

---

### 2. Temporary Suspension

```python
# Suspend service (e.g., payment issue)
suspension = await ipv6_service.suspend_ipv6(
    subscriber_id="sub_123",
    commit=True
)
# Result: {'prefix': '2001:db8:100::/56', 'state': 'suspended'}

# Resume service after payment received
resumption = await ipv6_service.resume_ipv6(
    subscriber_id="sub_123",
    commit=True
)
# Result: {'prefix': '2001:db8:100::/56', 'state': 'active'}
```

---

### 3. Service Termination with Disconnect

```python
# Revoke prefix and force disconnect
revocation = await ipv6_service.revoke_ipv6(
    subscriber_id="sub_123",
    username="subscriber@realm",
    nas_ip="10.0.0.1",
    send_disconnect=True,  # Force session restart
    release_to_netbox=True,  # Return to pool
    commit=True
)
# Result: {
#   'prefix': '2001:db8:100::/56',
#   'state': 'revoked',
#   'disconnect_result': {'success': True, ...}
# }
```

---

### 4. Check Lifecycle Status

```python
# Get current lifecycle status
status = await ipv6_service.get_lifecycle_status(
    subscriber_id="sub_123"
)
# Result: {
#   'subscriber_id': 'sub_123',
#   'prefix': '2001:db8:100::/56',
#   'state': 'active',
#   'allocated_at': datetime(...),
#   'activated_at': datetime(...),
#   'netbox_prefix_id': 12345,
#   ...
# }
```

---

### 5. Bulk Status Check (Metrics)

```python
from dotmac.platform.network.ipv6_metrics import IPv6Metrics

ipv6_metrics = IPv6Metrics(db_session, tenant_id="tenant-123")

# Get state counts
state_counts = await ipv6_metrics.get_ipv6_state_counts()
# Result: {'pending': 5, 'allocated': 12, 'active': 143, 'suspended': 3, ...}

# Get utilization stats
utilization = await ipv6_metrics.get_ipv6_utilization_stats()
# Result: {
#   'total_profiles': 163,
#   'active_prefixes': 143,
#   'allocated_prefixes': 12,
#   'utilization_rate': 87.73,
#   ...
# }

# Get NetBox integration stats
netbox_stats = await ipv6_metrics.get_ipv6_netbox_integration_stats()
# Result: {
#   'total_prefixes': 155,
#   'netbox_tracked': 152,
#   'netbox_integration_rate': 98.06,
#   ...
# }
```

---

## Best Practices

### 1. Always Use CoA When Possible

When activating or updating IPv6 prefixes for active sessions, use CoA to avoid subscriber disconnection:

```python
# ✅ Good: Update live session without restart
await ipv6_service.activate_ipv6(
    subscriber_id="sub_123",
    username="subscriber@realm",
    nas_ip="10.0.0.1",
    send_coa=True,  # Update session dynamically
    commit=True
)

# ❌ Avoid: Skip CoA and force subscriber to reconnect
await ipv6_service.activate_ipv6(
    subscriber_id="sub_123",
    send_coa=False,  # Subscriber must disconnect/reconnect to get prefix
    commit=True
)
```

### 2. Handle State Transitions Gracefully

Check current state before operations to provide better error messages:

```python
from dotmac.platform.network.ipv6_lifecycle_service import InvalidStateTransition

try:
    await ipv6_service.allocate_ipv6(subscriber_id="sub_123", commit=True)
except InvalidStateTransition as e:
    # Check current state and guide user
    status = await ipv6_service.get_lifecycle_status(subscriber_id="sub_123")
    if status["state"] == IPv6LifecycleState.ACTIVE:
        return {"error": "Prefix already allocated and active. Use revoke first."}
    raise
```

### 3. Use Idempotent Operations

Design workflows to safely retry operations:

```python
# Safe to retry - revoke is idempotent
for subscriber_id in batch:
    try:
        await ipv6_service.revoke_ipv6(subscriber_id=subscriber_id, commit=True)
    except Exception as e:
        logger.error(f"Revocation failed for {subscriber_id}: {e}")
        # Safe to continue - can retry later
```

### 4. Monitor Lifecycle Metrics

Set up Prometheus alerts for lifecycle health:

```yaml
# prometheus_alerts.yml
groups:
  - name: ipv6_lifecycle
    rules:
      # Alert on stuck REVOKING state
      - alert: IPv6StuckRevoking
        expr: dotmac_ipv6_lifecycle_state_total{state="revoking"} > 0
        for: 5m
        annotations:
          summary: "IPv6 prefixes stuck in REVOKING state"

      # Alert on high allocation failure rate
      - alert: IPv6AllocationFailureRate
        expr: rate(dotmac_ipv6_lifecycle_operations_total{operation="allocate",status="failed"}[5m]) > 0.1
        for: 2m
        annotations:
          summary: "High IPv6 allocation failure rate"

      # Alert on low NetBox integration rate
      - alert: IPv6NetBoxIntegrationLow
        expr: dotmac_ipv6_netbox_integration_rate < 95
        for: 10m
        annotations:
          summary: "Low NetBox integration rate for IPv6 prefixes"
```

### 5. Use Transactions for Atomicity

Always commit lifecycle operations within broader service transactions:

```python
# ✅ Good: Part of atomic transaction
async with db_session.begin():
    # Update service status
    service.status = ServiceStatus.ACTIVE

    # Activate IPv6 as part of same transaction
    await ipv6_service.activate_ipv6(
        subscriber_id=service.subscriber_id,
        send_coa=True,
        commit=False  # Will commit with outer transaction
    )
    # Both operations succeed or both roll back

# ❌ Avoid: Separate transactions can leave inconsistent state
await ipv6_service.activate_ipv6(subscriber_id="sub_123", commit=True)
service.status = ServiceStatus.ACTIVE
await db_session.commit()  # If this fails, IPv6 is active but service isn't
```

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `InvalidStateTransition` | Operation not allowed from current state | Check current state, follow valid transition path |
| `IPv6LifecycleError` | Unsupported assignment mode or missing profile | Verify profile exists and has correct assignment mode |
| `NetBoxAllocationError` | NetBox API unavailable or pool exhausted | Check NetBox connectivity, verify pool has available prefixes |
| `CoATimeoutError` | NAS didn't respond to CoA/Disconnect | Verify NAS IP, check RADIUS secret, ensure NAS supports CoA |

### Error Response Format

```json
{
  "detail": "Cannot allocate from state IPv6LifecycleState.ACTIVE. Expected PENDING or FAILED.",
  "status_code": 400
}
```

### Graceful Degradation

Critical path operations (e.g., service termination) continue even if IPv6 operations fail:

```python
# Service termination won't be blocked by IPv6 revocation failure
try:
    await ipv6_service.revoke_ipv6(subscriber_id=subscriber_id)
except Exception as e:
    logger.warning("IPv6 revocation failed but termination continues", error=str(e))

# Service termination completes successfully
service.status = ServiceStatus.TERMINATED
await db_session.commit()
```

---

## Testing

### Running Tests

```bash
# Run all Phase 4 tests
poetry run pytest tests/network/test_ipv6_lifecycle_service.py -v

# Run specific test
poetry run pytest tests/network/test_ipv6_lifecycle_service.py::test_allocate_ipv6_success -v

# Run with coverage
poetry run pytest tests/network/test_ipv6_lifecycle_service.py --cov=dotmac.platform.network.ipv6_lifecycle_service
```

### Test Coverage

- ✅ Allocate IPv6 success
- ✅ Allocate from invalid state (error case)
- ✅ Allocate with wrong assignment mode (error case)
- ✅ Activate IPv6 success
- ✅ Activate with RADIUS CoA integration
- ✅ Suspend IPv6 success
- ✅ Resume IPv6 success
- ✅ Revoke IPv6 success with NetBox release
- ✅ Revoke with RADIUS Disconnect-Request
- ✅ Revoke idempotency
- ✅ Get lifecycle status

**Test Location**: `tests/network/test_ipv6_lifecycle_service.py` (11 tests, all passing)

---

## Database Schema

### IPv6 Lifecycle Fields

Added to `SubscriberNetworkProfile` model:

```python
class SubscriberNetworkProfile(TenantScopedModel):
    # ... existing fields ...

    # Phase 4: IPv6 Lifecycle Tracking
    ipv6_state: Mapped[IPv6LifecycleState] = mapped_column(
        SQLEnum(IPv6LifecycleState, name="ipv6lifecyclestate"),
        nullable=False,
        default=IPv6LifecycleState.PENDING,
        comment="Current lifecycle state of IPv6 prefix allocation",
    )

    ipv6_allocated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was allocated from NetBox",
    )

    ipv6_activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was marked as active",
    )

    ipv6_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was revoked and returned to pool",
    )

    ipv6_netbox_prefix_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,  # Indexed for NetBox lookups
        comment="NetBox IPAM prefix ID for tracking and release",
    )
```

### Migration

**File**: `alembic/versions/2025_11_07_1124-fa38dcc0e77a_add_ipv6_lifecycle_fields.py`

```bash
# Apply migration
poetry run alembic upgrade head

# Rollback if needed
poetry run alembic downgrade -1
```

---

## Related Documentation

- **Phase 2**: IPv6 Prefix Delegation (DHCPv6-PD) - `docs/PHASE2_IPV6.md`
- **Phase 3**: RADIUS Option 82 & VLAN Enforcement - `docs/PHASE3_RADIUS_OPTION82.md`
- **RADIUS CoA**: RFC 5176 Implementation - `docs/RADIUS_COA.md`
- **NetBox Integration**: IPAM Workflows - `docs/NETBOX_INTEGRATION.md`
- **Prometheus Metrics**: Complete metrics reference - `docs/METRICS.md`

---

## Changelog

### Version 1.0 (November 7, 2025)
- ✅ Initial Phase 4 implementation
- ✅ 7-state lifecycle management
- ✅ NetBox IPAM integration
- ✅ RADIUS CoA support for IPv6
- ✅ Prometheus metrics (8 new metrics)
- ✅ REST API endpoints (6 endpoints)
- ✅ Service termination integration
- ✅ Comprehensive test coverage (11 tests)

---

## Support

For questions or issues:
- **Documentation**: `docs/`
- **Tests**: `tests/network/test_ipv6_lifecycle_service.py`
- **Source Code**:
  - Service: `src/dotmac/platform/network/ipv6_lifecycle_service.py`
  - API: `src/dotmac/platform/network/router.py`
  - Metrics: `src/dotmac/platform/network/ipv6_metrics.py`
