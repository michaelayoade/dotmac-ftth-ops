# Phase 4: IPv6 Lifecycle Management - Implementation Plan

**Date**: November 7, 2025
**Status**: 🚧 Planning
**Objective**: Implement complete IPv6 address and prefix delegation lifecycle management

---

## Overview

Phase 4 extends the IPv6 provisioning implemented in Phase 2 with full lifecycle management:
- **Tracking**: Monitor IPv6 address and prefix delegation states (allocated, active, suspended, revoked)
- **Revocation**: Release IPv6 prefixes when subscribers terminate or change services
- **Cleanup**: Automated cleanup of stale IPv6 assignments
- **Metrics**: Prometheus metrics for IPv6 utilization and lifecycle events
- **RADIUS Integration**: Dynamic IPv6 attribute updates via CoA/DM

---

## Current State (Post-Phase 2)

### ✅ Already Implemented

1. **IPv6 Prefix Allocation** (`netbox/service.py`)
   - Allocates IPv6 prefixes from NetBox pools
   - Supports /48, /56, /60, /64 delegations
   - Integration with provisioning workflow

2. **IPv6 Assignment Modes** (`network/models.py`)
   - SLAAC (Stateless Address Autoconfiguration)
   - STATEFUL (DHCPv6 managed addresses)
   - DHCPV6_PD (Prefix Delegation)
   - DUAL_STACK (IPv4 + IPv6)
   - NONE (IPv4 only)

3. **RADIUS IPv6 Attributes** (`radius/service.py`)
   - `Framed-IPv6-Address` (RFC 3162)
   - `Framed-IPv6-Prefix` (RFC 3162)
   - `Delegated-IPv6-Prefix` (RFC 4818)

4. **DHCPv6-PD CPE Configuration** (`genieacs/service.py`)
   - Configures TR-069 CPEs for DHCPv6-PD
   - Sets WAN parameters for IPv6 prefix delegation

5. **Network Profile IPv6 Settings** (`network/models.py`)
   - `static_ipv6`: Static IPv6 address
   - `delegated_ipv6_prefix`: Delegated prefix (e.g., 2001:db8::/56)
   - `ipv6_pd_size`: Prefix delegation size (48, 56, 60, 64)
   - `ipv6_assignment_mode`: Assignment mode enum

### ❌ Gaps to Address

1. **No IPv6 Lifecycle Tracking**
   - No state machine for IPv6 address lifecycle
   - No tracking of when prefixes are allocated, activated, suspended, or revoked
   - No history/audit trail for IPv6 changes

2. **No IPv6 Revocation Workflow**
   - Terminating a subscriber doesn't release IPv6 prefix in NetBox
   - No cleanup of RADIUS IPv6 attributes
   - Prefixes can leak and exhaust pools

3. **No IPv6 Metrics**
   - No visibility into IPv6 prefix utilization
   - No tracking of DHCPv6-PD success/failure rates
   - No alerting on IPv6 pool exhaustion

4. **No Dynamic IPv6 Updates**
   - Cannot update IPv6 prefix for active subscriber (requires RADIUS CoA)
   - No workflow for migrating subscriber to different IPv6 prefix

---

## Phase 4 Scope

### 4.1 IPv6 Lifecycle State Tracking

**File**: `src/dotmac/platform/network/models.py`

Add lifecycle state tracking to network profiles:

```python
class IPv6LifecycleState(str, Enum):
    """IPv6 address/prefix lifecycle states"""
    PENDING = "pending"        # Requested but not yet allocated
    ALLOCATED = "allocated"    # Allocated in NetBox but not provisioned
    ACTIVE = "active"          # Provisioned and in use
    SUSPENDED = "suspended"    # Service suspended, prefix reserved
    REVOKING = "revoking"      # Revocation in progress
    REVOKED = "revoked"        # Released back to pool
    FAILED = "failed"          # Allocation or provisioning failed


# Add to SubscriberNetworkProfile model
class SubscriberNetworkProfile(TenantScopedModel):
    # ... existing fields ...

    # IPv6 lifecycle tracking (NEW)
    ipv6_state: Mapped[IPv6LifecycleState] = mapped_column(
        Enum(IPv6LifecycleState),
        default=IPv6LifecycleState.PENDING,
        nullable=False,
    )
    ipv6_allocated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ipv6_activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ipv6_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ipv6_netbox_prefix_id: Mapped[int | None] = mapped_column(Integer)  # NetBox prefix ID
```

**Migration**: `alembic/versions/2025_11_07_xxxx-add_ipv6_lifecycle_tracking.py`

### 4.2 IPv6 Prefix Revocation Service

**File**: `src/dotmac/platform/network/ipv6_lifecycle_service.py` (NEW)

```python
class IPv6LifecycleService:
    """
    Manages IPv6 address and prefix delegation lifecycle.

    Responsibilities:
    - Track IPv6 state transitions
    - Revoke IPv6 prefixes on service termination
    - Cleanup stale IPv6 assignments
    - Emit lifecycle events for monitoring
    """

    async def allocate_ipv6_prefix(
        self,
        subscriber_id: str,
        prefix_size: int,  # 48, 56, 60, or 64
    ) -> str:
        """
        Allocate IPv6 prefix and track lifecycle.

        State: PENDING → ALLOCATED
        """

    async def activate_ipv6_prefix(
        self,
        subscriber_id: str,
    ) -> None:
        """
        Mark IPv6 prefix as active after provisioning.

        State: ALLOCATED → ACTIVE
        """

    async def suspend_ipv6_prefix(
        self,
        subscriber_id: str,
    ) -> None:
        """
        Suspend IPv6 prefix (service suspended).

        State: ACTIVE → SUSPENDED
        Keeps prefix allocated but marks inactive.
        """

    async def revoke_ipv6_prefix(
        self,
        subscriber_id: str,
        release_to_netbox: bool = True,
    ) -> None:
        """
        Revoke IPv6 prefix and release to NetBox pool.

        State: * → REVOKING → REVOKED

        Actions:
        1. Update network profile state
        2. Release prefix in NetBox (if release_to_netbox=True)
        3. Remove RADIUS IPv6 attributes
        4. Send RADIUS CoA to disconnect active sessions
        5. Update CPE configuration (remove IPv6)
        6. Emit metrics event
        """

    async def cleanup_stale_ipv6_assignments(
        self,
        older_than_days: int = 30,
    ) -> int:
        """
        Cleanup stale IPv6 assignments in REVOKED state.

        Returns count of cleaned up assignments.
        """
```

### 4.3 Service Termination IPv6 Cleanup

**File**: `src/dotmac/platform/orchestration/workflows/terminate_subscriber.py`

Add IPv6 cleanup handler:

```python
@activity.defn(name="revoke_ipv6_prefix_handler")
async def revoke_ipv6_prefix_handler(context: WorkflowContext) -> dict[str, Any]:
    """
    Revoke IPv6 prefix delegation on service termination.

    Phase 4: IPv6 Lifecycle Enhancement
    """
    logger.info(
        "revoke_ipv6_prefix_handler.start",
        subscriber_id=context.subscriber_id,
        workflow_id=context.workflow_id,
    )

    ipv6_service = IPv6LifecycleService(context.session, context.tenant_id)

    try:
        # Revoke IPv6 prefix and release to pool
        await ipv6_service.revoke_ipv6_prefix(
            subscriber_id=context.subscriber_id,
            release_to_netbox=True,
        )

        logger.info(
            "revoke_ipv6_prefix_handler.success",
            subscriber_id=context.subscriber_id,
        )

        return {
            "status": "success",
            "ipv6_revoked": True,
        }

    except Exception as e:
        logger.error(
            "revoke_ipv6_prefix_handler.error",
            subscriber_id=context.subscriber_id,
            error=str(e),
        )
        return {
            "status": "failed",
            "error": str(e),
        }


# Add to terminate_subscriber_workflow
@workflow.defn(name="terminate_subscriber")
class TerminateSubscriberWorkflow:
    @workflow.run
    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        # ... existing handlers ...

        # Phase 4: Revoke IPv6 prefix
        ipv6_result = await workflow.execute_activity(
            revoke_ipv6_prefix_handler,
            context,
            start_to_close_timeout=timedelta(minutes=5),
        )
```

### 4.4 RADIUS CoA Integration for IPv6 Updates

**File**: `src/dotmac/platform/radius/service.py`

Add method to update IPv6 attributes dynamically:

```python
async def update_ipv6_attributes(
    self,
    username: str,
    *,
    framed_ipv6_address: str | None = None,
    framed_ipv6_prefix: str | None = None,
    delegated_ipv6_prefix: str | None = None,
    send_coa: bool = True,
) -> dict[str, Any]:
    """
    Update IPv6 RADIUS attributes for active subscriber.

    Phase 4: IPv6 Lifecycle Enhancement

    If send_coa=True, sends RADIUS CoA (Change of Authorization)
    to update active sessions.
    """
    # Update RadReply entries
    await self._update_radreply_attribute(
        username,
        attribute="Framed-IPv6-Address",
        value=framed_ipv6_address,
    )

    if delegated_ipv6_prefix:
        await self._update_radreply_attribute(
            username,
            attribute="Delegated-IPv6-Prefix",
            value=delegated_ipv6_prefix,
        )

    # Send RADIUS CoA if requested
    if send_coa:
        await self.send_coa_request(
            username=username,
            attributes={
                "Framed-IPv6-Address": framed_ipv6_address,
                "Delegated-IPv6-Prefix": delegated_ipv6_prefix,
            },
        )

    return {
        "updated": True,
        "coa_sent": send_coa,
    }


async def remove_ipv6_attributes(
    self,
    username: str,
    send_disconnect: bool = True,
) -> None:
    """
    Remove all IPv6 RADIUS attributes.

    Phase 4: Used during IPv6 prefix revocation.
    """
    await self._delete_radreply_attribute(username, "Framed-IPv6-Address")
    await self._delete_radreply_attribute(username, "Framed-IPv6-Prefix")
    await self._delete_radreply_attribute(username, "Delegated-IPv6-Prefix")

    if send_disconnect:
        await self.disconnect_session(username=username, reason="IPv6 revoked")
```

### 4.5 IPv6 Metrics and Monitoring

**File**: `src/dotmac/platform/network/ipv6_metrics.py` (NEW)

```python
from prometheus_client import Counter, Gauge, Histogram

# IPv6 allocation metrics
ipv6_allocations_total = Counter(
    "dotmac_ipv6_allocations_total",
    "Total IPv6 prefix allocations",
    ["tenant_id", "prefix_size", "assignment_mode"],
)

ipv6_revocations_total = Counter(
    "dotmac_ipv6_revocations_total",
    "Total IPv6 prefix revocations",
    ["tenant_id", "reason"],
)

ipv6_active_prefixes = Gauge(
    "dotmac_ipv6_active_prefixes",
    "Number of active IPv6 prefixes",
    ["tenant_id", "prefix_size"],
)

ipv6_pool_utilization = Gauge(
    "dotmac_ipv6_pool_utilization_percent",
    "IPv6 pool utilization percentage",
    ["tenant_id", "pool_name"],
)

ipv6_allocation_duration = Histogram(
    "dotmac_ipv6_allocation_duration_seconds",
    "Time to allocate IPv6 prefix",
    ["tenant_id"],
)

dhcpv6_pd_success_total = Counter(
    "dotmac_dhcpv6_pd_success_total",
    "Successful DHCPv6-PD configurations",
    ["tenant_id"],
)

dhcpv6_pd_failure_total = Counter(
    "dotmac_dhcpv6_pd_failure_total",
    "Failed DHCPv6-PD configurations",
    ["tenant_id", "error_type"],
)
```

### 4.6 IPv6 Lifecycle REST API

**File**: `src/dotmac/platform/network/router.py`

Add endpoints for IPv6 lifecycle management:

```python
@router.get(
    "/subscribers/{subscriber_id}/ipv6/status",
    response_model=IPv6StatusResponse,
    summary="Get IPv6 Lifecycle Status",
)
async def get_ipv6_status(
    subscriber_id: str,
    service: IPv6LifecycleService = Depends(get_ipv6_lifecycle_service),
) -> IPv6StatusResponse:
    """Get current IPv6 allocation and lifecycle status."""


@router.post(
    "/subscribers/{subscriber_id}/ipv6/revoke",
    summary="Revoke IPv6 Prefix",
)
async def revoke_ipv6_prefix(
    subscriber_id: str,
    release_to_pool: bool = Query(True),
    service: IPv6LifecycleService = Depends(get_ipv6_lifecycle_service),
) -> dict[str, Any]:
    """Manually revoke IPv6 prefix for subscriber."""


@router.post(
    "/ipv6/cleanup",
    summary="Cleanup Stale IPv6 Assignments",
)
async def cleanup_stale_ipv6(
    older_than_days: int = Query(30, ge=1),
    service: IPv6LifecycleService = Depends(get_ipv6_lifecycle_service),
    current_user: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    """Cleanup stale IPv6 assignments (admin only)."""
```

---

## Implementation Tasks

### Task 1: Database Schema (2 hours)
- [ ] Add IPv6 lifecycle fields to `SubscriberNetworkProfile`
- [ ] Create migration `2025_11_07_xxxx-add_ipv6_lifecycle_tracking.py`
- [ ] Run migration and verify schema

### Task 2: IPv6 Lifecycle Service (4 hours)
- [ ] Create `ipv6_lifecycle_service.py`
- [ ] Implement `allocate_ipv6_prefix()` with state tracking
- [ ] Implement `activate_ipv6_prefix()`
- [ ] Implement `suspend_ipv6_prefix()`
- [ ] Implement `revoke_ipv6_prefix()` with NetBox cleanup
- [ ] Implement `cleanup_stale_ipv6_assignments()`
- [ ] Add comprehensive logging

### Task 3: Service Termination Integration (2 hours)
- [ ] Add `revoke_ipv6_prefix_handler` to terminate workflow
- [ ] Update `terminate_subscriber_workflow` to call handler
- [ ] Test complete termination flow

### Task 4: RADIUS IPv6 Updates (3 hours)
- [ ] Implement `update_ipv6_attributes()` with CoA support
- [ ] Implement `remove_ipv6_attributes()`
- [ ] Add helper methods for RadReply updates
- [ ] Test RADIUS CoA packet generation

### Task 5: Metrics and Monitoring (2 hours)
- [ ] Create `ipv6_metrics.py` with Prometheus metrics
- [ ] Instrument lifecycle service with metrics
- [ ] Add Grafana dashboard queries
- [ ] Create alerting rules for pool exhaustion

### Task 6: REST API Endpoints (2 hours)
- [ ] Add IPv6 status endpoint
- [ ] Add IPv6 revocation endpoint
- [ ] Add stale cleanup endpoint
- [ ] Add API documentation

### Task 7: Testing (4 hours)
- [ ] Unit tests for `IPv6LifecycleService`
- [ ] Integration tests for termination workflow
- [ ] RADIUS CoA tests
- [ ] Metrics validation tests

### Task 8: Documentation (2 hours)
- [ ] Implementation summary
- [ ] API documentation
- [ ] Operational runbook
- [ ] Grafana dashboard setup guide

**Total Estimated Time**: ~21 hours

---

## Success Criteria

1. ✅ IPv6 prefixes track full lifecycle (PENDING → ALLOCATED → ACTIVE → REVOKED)
2. ✅ Service termination automatically revokes and releases IPv6 prefixes
3. ✅ NetBox prefix pools don't leak (revoked prefixes returned to pool)
4. ✅ RADIUS attributes updated dynamically via CoA
5. ✅ Prometheus metrics track IPv6 utilization and lifecycle events
6. ✅ Stale cleanup job prevents abandoned assignments
7. ✅ All workflows include comprehensive audit logging
8. ✅ 100% test coverage for critical paths

---

## Integration Points

### With Phase 1 (Network Profiles)
- Extends `SubscriberNetworkProfile` with lifecycle tracking
- Uses existing IPv6 assignment mode enum

### With Phase 2 (NetBox/VOLTHA)
- Calls NetBox API to release prefixes
- Integrates with existing IPv6 allocation flow

### With Phase 3 (RADIUS Option 82)
- Uses RADIUS service for CoA/DM packets
- Removes IPv6 attributes on revocation

### With Phase 5 (Telemetry)
- Prometheus metrics feed Grafana dashboards
- Alerting rules for operational visibility

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| NetBox API failure during revocation | Prefix leak | Retry logic + manual cleanup API |
| RADIUS CoA not supported by NAS | Active sessions keep old IPv6 | Graceful fallback, session disconnect |
| Race condition during concurrent revocations | Double-release | Idempotent revocation with state checks |
| Large-scale cleanup overwhelming NetBox | API throttling | Batch cleanup with rate limiting |

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Deploy updated code
- [ ] Configure Prometheus scraping for new metrics
- [ ] Import Grafana dashboard
- [ ] Set up alerting rules (pool exhaustion, high revocation rates)
- [ ] Schedule stale cleanup cron job
- [ ] Update operational runbooks
- [ ] Train support team on new IPv6 lifecycle endpoints

---

## Next Phase

**Phase 5: Telemetry & Alerts**
- Comprehensive Prometheus metrics
- Grafana dashboards for all phases
- Alert manager integration
- SLA monitoring

---

## References

- **RFC 3162**: RADIUS and IPv6
- **RFC 4818**: RADIUS Delegated-IPv6-Prefix Attribute
- **RFC 8415**: DHCPv6
- **Phase 2 Summary**: `docs/PHASE2_IMPLEMENTATION_SUMMARY.md`
- **Phase 3 Summary**: `docs/PHASE3_IMPLEMENTATION_SUMMARY.md`
