# Phase 4: IPv6 Lifecycle Management - Implementation Kickoff

**Date**: November 8, 2025
**Status**: 🚀 Starting Implementation
**Previous Phase**: Phase 3 (Field Service Management) - ✅ Complete
**Objective**: Implement complete IPv6 address and prefix delegation lifecycle management

---

## Executive Summary

Phase 4 extends the IPv6 provisioning implemented in Phase 2 with full lifecycle management, revocation workflows, and operational metrics. This closes a critical gap where IPv6 prefixes allocated from NetBox pools were never returned, leading to potential pool exhaustion.

---

## Problem Statement

### Current State (Post-Phase 2)
✅ **What Works**:
- IPv6 prefixes are allocated from NetBox during subscriber provisioning
- RADIUS returns IPv6 attributes (Framed-IPv6-Prefix, Delegated-IPv6-Prefix)
- DHCPv6-PD configured on TR-069 CPEs
- Network profiles track delegated prefixes

❌ **Critical Gaps**:
1. **No lifecycle tracking** - Cannot determine which prefixes are active vs. revoked
2. **No revocation workflow** - Terminating subscribers doesn't release prefixes back to NetBox
3. **Prefix leakage** - Pools exhaust over time as prefixes are never returned
4. **No metrics** - No visibility into IPv6 utilization or lifecycle events
5. **No dynamic updates** - Cannot change IPv6 prefix for active subscriber

---

## Phase 4 Scope

### 4.1 IPv6 Lifecycle State Machine

**File**: `src/dotmac/platform/network/models.py`

```
States:
PENDING → ALLOCATED → ACTIVE ⟷ SUSPENDED
                ↓
          REVOKING → REVOKED
                ↓
            FAILED (error path)
```

**New Fields**:
- `ipv6_state` - Current lifecycle state
- `ipv6_allocated_at` - When prefix was allocated from NetBox
- `ipv6_activated_at` - When prefix became active (provisioned)
- `ipv6_revoked_at` - When prefix was revoked
- `ipv6_netbox_prefix_id` - NetBox prefix ID for tracking

### 4.2 IPv6 Lifecycle Service

**File**: `src/dotmac/platform/network/ipv6_lifecycle_service.py` (NEW)

**Methods**:
- `allocate_ipv6_prefix()` - Allocate from NetBox, state = ALLOCATED
- `activate_ipv6_prefix()` - Mark active after provisioning
- `suspend_ipv6_prefix()` - Suspend service (keep prefix)
- `revoke_ipv6_prefix()` - Full revocation with cleanup
- `reactivate_ipv6_prefix()` - Reactivate after suspension
- `update_ipv6_prefix()` - Change prefix for active subscriber
- `cleanup_stale_assignments()` - Cleanup old REVOKED entries

### 4.3 Revocation Workflow

**Revoke Actions** (in order):
1. Update network profile state → REVOKING
2. Release prefix in NetBox (return to available pool)
3. Remove RADIUS IPv6 attributes
4. Send RADIUS CoA/Disconnect-Request to active sessions
5. Update CPE configuration (remove IPv6 via TR-069)
6. Update state → REVOKED
7. Emit Prometheus metrics

### 4.4 Orchestration Integration

**Modified Workflows**:
- `provision_subscriber.py` - Call `activate_ipv6_prefix()` after success
- `suspend_service.py` - Call `suspend_ipv6_prefix()`
- `deprovision_subscriber.py` - Call `revoke_ipv6_prefix()`

**New Activities**:
- `revoke_ipv6_prefix_handler` - Saga activity for revocation
- `activate_ipv6_lifecycle_handler` - Mark prefix active
- `cleanup_ipv6_stale_handler` - Celery periodic task

### 4.5 Prometheus Metrics

**New Metrics**:
```python
ipv6_lifecycle_state_total{state="active|suspended|revoked"}
ipv6_allocation_duration_seconds_bucket
ipv6_revocation_duration_seconds_bucket
ipv6_pool_utilization_percent{pool="..."}
ipv6_prefix_leak_total  # Prefixes not returned within 24h of termination
```

### 4.6 REST API Endpoints

**File**: `src/dotmac/platform/network/router.py`

**New Endpoints**:
- `POST /api/v1/network/ipv6/revoke` - Manual IPv6 revocation
- `POST /api/v1/network/ipv6/update` - Update IPv6 prefix
- `GET /api/v1/network/ipv6/lifecycle/{subscriber_id}` - Get lifecycle state
- `GET /api/v1/network/ipv6/metrics` - IPv6 utilization metrics

### 4.7 Database Migration

**File**: `alembic/versions/2025_11_08_xxxx-add_ipv6_lifecycle_fields.py`

**Changes**:
- Add enum type `ipv6_lifecycle_state`
- Add 5 new columns to `subscriber_network_profiles`
- Create indexes on `ipv6_state` and `ipv6_netbox_prefix_id`

---

## Implementation Plan

### Step 1: Database Model Updates (30 min)
- [ ] Add `IPv6LifecycleState` enum to `network/models.py`
- [ ] Add lifecycle fields to `SubscriberNetworkProfile`
- [ ] Create Alembic migration

### Step 2: IPv6 Lifecycle Service (2 hours)
- [ ] Create `network/ipv6_lifecycle_service.py`
- [ ] Implement state machine methods
- [ ] Add NetBox prefix release logic
- [ ] Add RADIUS attribute cleanup
- [ ] Add CPE configuration removal

### Step 3: Orchestration Integration (1 hour)
- [ ] Add `revoke_ipv6_prefix_handler` activity
- [ ] Integrate into `deprovision_subscriber` workflow
- [ ] Integrate into `suspend_service` workflow
- [ ] Add `activate_ipv6_lifecycle_handler`

### Step 4: Metrics & Monitoring (1 hour)
- [ ] Create `network/ipv6_metrics.py`
- [ ] Add Prometheus metric definitions
- [ ] Instrument lifecycle state transitions
- [ ] Add pool utilization metrics

### Step 5: REST API Endpoints (1 hour)
- [ ] Add revocation endpoint
- [ ] Add update endpoint
- [ ] Add lifecycle status endpoint
- [ ] Add metrics endpoint

### Step 6: Background Cleanup Task (30 min)
- [ ] Create Celery periodic task for stale cleanup
- [ ] Configure schedule (daily at 2 AM)

### Step 7: Testing (1 hour)
- [ ] Unit tests for lifecycle service
- [ ] Integration tests for revocation workflow
- [ ] Test NetBox prefix release
- [ ] Test RADIUS CoA triggers

---

## Success Criteria

✅ **Functional**:
- IPv6 prefixes released to NetBox on subscriber termination
- State transitions tracked with timestamps
- RADIUS sessions disconnected on revocation
- CPE configuration updated to remove IPv6

✅ **Operational**:
- Prometheus metrics show IPv6 pool utilization
- Alerts fire when pools reach 80% utilization
- Stale prefixes automatically cleaned up daily
- Audit trail for all IPv6 lifecycle events

✅ **Performance**:
- Revocation completes in < 5 seconds
- No impact on provisioning workflows
- Metric collection adds < 10ms overhead

---

## Dependencies

- ✅ NetBox service (`netbox/service.py`)
- ✅ RADIUS service (`radius/service.py`)
- ✅ GenieACS service (`genieacs/service.py`)
- ✅ Orchestration framework (`orchestration/`)
- ✅ Prometheus exporter (`monitoring/prometheus_exporter.py`)

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| NetBox API failures during revocation | Retry logic with exponential backoff; log failures for manual cleanup |
| RADIUS CoA not supported by NAS | Graceful degradation; log warning but continue revocation |
| CPE offline during IPv6 removal | Mark for retry; cleanup on next CPE connection |
| Database migration on large tables | Test on staging first; create indexes concurrently |

---

## Rollout Plan

### Phase 4.1 (Week 1) - Core Lifecycle
- Database migration
- Lifecycle service implementation
- Basic revocation workflow

### Phase 4.2 (Week 1) - Integration
- Orchestration workflow integration
- REST API endpoints
- Background cleanup task

### Phase 4.3 (Week 2) - Observability
- Prometheus metrics
- Grafana dashboards
- Alerting rules

### Phase 4.4 (Week 2) - Hardening
- Error handling improvements
- Retry logic
- Comprehensive testing

---

## Timeline

**Total Estimated Time**: 7-8 hours of development

**Target Completion**: November 8-9, 2025

---

## 🚀 Ready to Begin!

Starting implementation with Step 1: Database Model Updates

---

*Last Updated: November 8, 2025*
