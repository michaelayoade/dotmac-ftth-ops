# Provisioning & Enforcement Hardening - Implementation Plan

**Status**: Planning Phase
**Target**: Complete backend provisioning and enforcement integration
**Last Updated**: 2025-11-07

---

## Executive Summary

This document outlines the implementation plan for hardening the subscriber provisioning and enforcement pipeline end-to-end. The work is organized into 5 backend-focused phases that build upon existing infrastructure to create a fully integrated, policy-driven provisioning system.

### Current State Assessment

Based on comprehensive codebase analysis:

**✅ What's Already Implemented:**
- Dual-stack IPv4/IPv6 provisioning workflows
- Network profile database model with Option 82, VLAN, and IPv6 fields
- NetBox integration with static IP and delegated prefix support
- VOLTHA integration with VLAN flow configuration
- RADIUS service with vendor-specific bandwidth attributes
- CoA (Change of Authorization) with multi-vendor support
- GraphQL and REST APIs for network profile management

**❌ Critical Gaps:**
- Network profiles NOT consumed by orchestration workflows
- Option 82 enforcement NOT implemented (fields exist but unused)
- QinQ (double VLAN tagging) fields exist but not fully integrated
- VLAN enforcement in RADIUS incomplete
- IPv6 PD (Prefix Delegation) attributes exist but not pushed to RADIUS
- Service configuration not persisted for lifecycle operations
- No telemetry/alerts for policy violations

---

## Phase 1: Subscriber Profile Consumption

**Objective**: Make orchestration workflows consume and persist SubscriberNetworkProfile data throughout the subscriber lifecycle.

### 1.1 Workflow Enhancements

#### File: `src/dotmac/platform/orchestration/workflows/provision_subscriber.py`

**Changes Required:**

1. **Add network profile creation step** (after `create_subscriber_handler`):
   ```python
   StepDefinition(
       step_name="create_network_profile",
       step_type="database",
       target_system="database",
       handler="create_network_profile_handler",
       compensation_handler="delete_network_profile_handler",
       max_retries=3,
       timeout_seconds=10,
       required=True,
   )
   ```

2. **Implement `create_network_profile_handler`**:
   - Accept profile data from input_data (service_vlan, inner_vlan, circuit_id, remote_id, etc.)
   - Use `SubscriberNetworkProfileService.upsert_profile()`
   - Store profile ID in context: `context["network_profile_id"]`
   - Include default option82_policy and ipv6_assignment_mode

3. **Update `allocate_ip_handler`** (lines 394-532):
   - Fetch network profile: `profile = await profile_service.get_by_subscriber_id(subscriber_id)`
   - Use `profile.static_ipv4` if set (skip NetBox allocation)
   - Use `profile.static_ipv6` if set
   - Use `profile.delegated_ipv6_prefix` for IPv6 PD
   - Store allocated IPs back to profile if dynamically assigned

4. **Update `create_radius_account_handler`** (lines 283-363):
   - Fetch network profile from context
   - Pass `vlan_id=profile.service_vlan` to RADIUSSubscriberCreate
   - Add IPv6 PD prefix: `delegated_ipv6_prefix=profile.delegated_ipv6_prefix`
   - Pass QinQ settings via metadata

5. **Update `activate_onu_handler`** (lines 570-619):
   - Fetch network profile
   - Pass `vlan_id=profile.service_vlan` to VOLTHA
   - Pass `inner_vlan=profile.inner_vlan` if `profile.qinq_enabled`
   - Include bandwidth profile from service plan

#### File: `src/dotmac/platform/orchestration/workflows/suspend_service.py`

**Changes Required:**

1. **Update suspend workflow** to read network profile:
   - Fetch profile to get current VLAN/IP settings
   - Send CoA with service_vlan for VLAN-based suspension
   - Preserve profile data (don't delete)

2. **Add RADIUS CoA step** for bandwidth throttling:
   - Call `radius_service.send_coa()` with reduced bandwidth
   - Use vendor-specific strategy from profile metadata

#### File: `src/dotmac/platform/orchestration/workflows/activate_service.py`

**Changes Required:**

1. **Update resume workflow** to restore settings:
   - Fetch profile
   - Send CoA with original bandwidth profile
   - Restore VLAN if changed during suspension

#### File: `src/dotmac/platform/orchestration/workflows/deprovision_subscriber.py`

**Changes Required:**

1. **Add network profile cleanup step**:
   - Soft-delete profile (preserve audit trail)
   - Log final configuration for compliance

### 1.2 Service Configuration Persistence

**Problem**: No ServiceInstance model exists. Service data is split across Subscriber and ServiceEntity.

**Solution**: Use `service_metadata` JSON field in ServiceEntity to store authoritative provisioning data.

#### File: `src/dotmac/platform/billing/core/entities.py`

**Enhancement**:

Update `create_billing_service_handler` to store network profile data:

```python
service_metadata = {
    "subscriber_number": context["subscriber_number"],
    "connection_type": input_data["connection_type"],
    "network_profile": {
        "service_vlan": profile.service_vlan,
        "inner_vlan": profile.inner_vlan,
        "qinq_enabled": profile.qinq_enabled,
        "static_ipv4": profile.static_ipv4,
        "static_ipv6": profile.static_ipv6,
        "delegated_ipv6_prefix": profile.delegated_ipv6_prefix,
        "ipv6_assignment_mode": profile.ipv6_assignment_mode.value,
        "option82_policy": profile.option82_policy.value,
        "circuit_id": profile.circuit_id,
        "remote_id": profile.remote_id,
    },
    "allocated_ips": {
        "ipv4": context.get("ipv4_address"),
        "ipv6": context.get("ipv6_address"),
        "ipv6_prefix": context.get("ipv6_prefix"),
    },
}
```

### 1.3 Testing Requirements

**Test Files to Update:**
- `tests/orchestration/test_provision_subscriber_workflow.py`
- `tests/network/test_network_profile_service.py`

**Test Cases:**
1. Provision subscriber with pre-defined network profile
2. Provision with static IPs from profile (skip NetBox)
3. Provision with dynamic IPs (write back to profile)
4. Suspend/resume preserves profile settings
5. Deprovision soft-deletes profile
6. Workflow rollback deletes network profile

**Acceptance Criteria:**
- [ ] Network profile created automatically during provisioning
- [ ] Static IPs from profile honored (NetBox skipped)
- [ ] Dynamic IPs written back to profile after allocation
- [ ] Profile data persisted in service_metadata for lifecycle ops
- [ ] Suspend/resume/terminate workflows read profile correctly
- [ ] All tests pass with >85% coverage

---

## Phase 2: NetBox/VOLTHA Integration

**Objective**: Extend NetBox and VOLTHA adapters to consume profile-provided settings and keep sources of truth synchronized.

### 2.1 NetBox Adapter Enhancements

#### File: `src/dotmac/platform/netbox/service.py`

**Current State**:
- Lines 722-850: `allocate_dual_stack_ips()` method exists
- Supports static IP via optional `address` parameter
- No IPv6 PD pool allocation

**Changes Required:**

1. **Add IPv6 prefix delegation allocation** (new method):
   ```python
   async def allocate_ipv6_delegated_prefix(
       self,
       *,
       parent_prefix_id: int,
       prefix_length: int,  # e.g., 56 for /56
       subscriber_id: str,
       tenant: str | None = None,
   ) -> dict[str, Any]:
       """
       Allocate a delegated IPv6 prefix from a parent aggregate.

       For DHCPv6-PD scenarios where subscriber needs a /56 or /60 prefix.
       """
   ```

2. **Update `allocate_dual_stack_ips()`** (add prefix delegation):
   - Add optional `ipv6_prefix_delegation` parameter
   - If set, call `allocate_ipv6_delegated_prefix()` after IPv6 address
   - Return `(ipv4_response, ipv6_response, ipv6_pd_response)`

3. **Add static IP bypass logging**:
   - When static IPs provided, log to audit trail: "Static IP used, skipped NetBox allocation"
   - Store association in NetBox custom fields (link static IP to subscriber)

4. **Add writeback method for dynamic allocations**:
   ```python
   async def sync_allocation_to_profile(
       self,
       *,
       subscriber_id: str,
       ipv4_address: str | None,
       ipv6_address: str | None,
       ipv6_prefix: str | None,
   ) -> None:
       """
       Write allocated IPs back to SubscriberNetworkProfile.

       Ensures network profile remains source of truth even when
       IPs are dynamically allocated.
       """
   ```

#### File: `src/dotmac/platform/network/workflow_service.py`

**Current State**: `NetworkService.allocate_resources()` exists at lines 50-200 (estimated)

**Changes Required:**

1. **Load network profile first** (before any allocation):
   ```python
   profile = await profile_service.get_by_subscriber_id(subscriber_id)
   if not profile:
       raise ValueError(f"Network profile not found for subscriber {subscriber_id}")
   ```

2. **Honor profile-provided static IPs**:
   - Check `profile.static_ipv4` - if set, skip IPv4 allocation
   - Check `profile.static_ipv6` - if set, skip IPv6 allocation
   - Check `profile.delegated_ipv6_prefix` - if set, skip IPv6 PD allocation

3. **For dynamic allocations, write back to profile**:
   - After NetBox allocates IPs, call `netbox_service.sync_allocation_to_profile()`
   - Update profile model with allocated IPs

4. **Return comprehensive allocation result**:
   ```python
   return {
       "service_id": str(uuid4()),
       "ipv4_address": ipv4 or profile.static_ipv4,
       "ipv6_address": ipv6 or profile.static_ipv6,
       "ipv6_delegated_prefix": ipv6_pd or profile.delegated_ipv6_prefix,
       "service_vlan": profile.service_vlan,
       "inner_vlan": profile.inner_vlan,
       "qinq_enabled": profile.qinq_enabled,
       "netbox_ip_id": netbox_ip_id,
       "source": "static" if profile.static_ipv4 else "dynamic",
   }
   ```

### 2.2 VOLTHA Integration Enhancements

#### File: `src/dotmac/platform/voltha/service.py`

**Current State**:
- Lines 442-563: `provision_onu()` method exists
- Lines 664-768: `_configure_vlan_flow()` supports single VLAN
- No QinQ support

**Changes Required:**

1. **Add QinQ flow configuration** (new method):
   ```python
   async def _configure_qinq_flows(
       self,
       *,
       logical_device_id: str,
       onu_port: int,
       service_vlan: int,  # S-VLAN (outer)
       inner_vlan: int,    # C-VLAN (customer)
       bandwidth_mbps: int,
   ) -> None:
       """
       Configure QinQ (802.1ad) flows for double VLAN tagging.

       Upstream: Tag with C-VLAN, then S-VLAN
       Downstream: Pop S-VLAN, then C-VLAN
       """
   ```

2. **Update `provision_onu()` signature**:
   - Add `inner_vlan: int | None` parameter
   - Add `qinq_enabled: bool` parameter
   - Add `static_ipv4: str | None` parameter (for logging)
   - Add `ipv6_assignment_mode: str | None` parameter

3. **Update provisioning logic** (lines 500-550):
   ```python
   if vlan and qinq_enabled and inner_vlan:
       await self._configure_qinq_flows(
           logical_device_id=logical_device_id,
           onu_port=onu_port,
           service_vlan=vlan,
           inner_vlan=inner_vlan,
           bandwidth_mbps=bandwidth_mbps,
       )
   elif vlan:
       await self._configure_vlan_flow(...)  # existing single VLAN
   ```

4. **Add metadata logging**:
   - Log static IP assignments to VOLTHA custom fields (if supported)
   - Store IPv6 assignment mode in ONU notes

#### File: `src/dotmac/platform/voltha/schemas.py`

**Changes Required:**

1. **Update `ONUProvisionRequest` schema**:
   ```python
   class ONUProvisionRequest(BaseModel):
       serial_number: str
       olt_device_id: str
       pon_port: int
       subscriber_id: str | None = None
       vlan: int | None = None
       inner_vlan: int | None = None  # NEW
       qinq_enabled: bool = False     # NEW
       bandwidth_profile: str | None = None
       static_ipv4: str | None = None  # NEW (for logging)
       ipv6_assignment_mode: str | None = None  # NEW
   ```

### 2.3 GenieACS CPE Configuration

#### File: `src/dotmac/platform/genieacs/service.py`

**Current State**: Lines 666-674 in provision workflow show dual-stack WAN config

**Changes Required:**

1. **Update `configure_device()` method**:
   - Add `service_vlan: int | None` parameter
   - Add `inner_vlan: int | None` parameter
   - Add `delegated_ipv6_prefix: str | None` parameter
   - Add `ipv6_pd_size: int | None` parameter

2. **Update TR-069 parameter set**:
   ```python
   parameters = {
       "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress": wan_ipv4,
       "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_VLAN_ID": service_vlan,
       # IPv6 PD
       "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_Enable": "1",
       "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_PrefixDelegation": delegated_ipv6_prefix,
       # DHCPv6-PD
       "InternetGatewayDevice.DHCPv6.Client.1.RequestedOptions": "25",  # PD option
   }
   ```

3. **Add VLAN validation**:
   - If QinQ enabled, ensure CPE supports 802.1ad
   - Log warning if CPE model doesn't support required features

### 2.4 Testing Requirements

**Test Files:**
- `tests/netbox/test_ipv6_prefix_delegation.py` (new)
- `tests/voltha/test_qinq_flows.py` (new)
- `tests/network/test_static_ip_provisioning.py` (new)

**Test Cases:**
1. Allocate IPv6 delegated prefix (/56, /60, /64)
2. Skip NetBox allocation when static IPs present
3. Write dynamic IPs back to network profile
4. Configure QinQ flows in VOLTHA
5. Provision CPE with IPv6 PD settings
6. Validate VLAN ranges (1-4094)

**Acceptance Criteria:**
- [ ] IPv6 PD allocation from NetBox works
- [ ] Static IPs honored (NetBox skipped, logged)
- [ ] Dynamic IPs written back to profile after allocation
- [ ] QinQ flows created in VOLTHA (S-VLAN + C-VLAN)
- [ ] GenieACS configures CPE with VLAN and IPv6 PD
- [ ] All tests pass with >85% coverage

---

## Phase 3: RADIUS Option 82 & VLAN Enforcement

**Objective**: Implement Option 82 enforcement and ensure VLAN/QinQ/Tunnel attributes are consistently present in RADIUS.

### 3.1 RADIUS Option 82 Enforcement

**Current State**:
- Option 82 fields exist in `SubscriberNetworkProfile` (circuit_id, remote_id, option82_policy)
- NO enforcement logic exists
- FreeRADIUS integration needed

**Architecture**: FreeRADIUS parses Access-Request packets, this backend validates against stored profiles.

#### File: `src/dotmac/platform/radius/option82.py` (NEW)

**Create new module**:

```python
"""
RADIUS Option 82 (DHCP Relay Agent Information) enforcement.

Validates circuit-id and remote-id from Access-Request against stored
SubscriberNetworkProfile data according to configured policy.
"""

from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from ..network.models import Option82Policy, SubscriberNetworkProfile
from ..network.profile_service import SubscriberNetworkProfileService


class Option82ValidationResult(str, Enum):
    """Result of Option 82 validation."""

    MATCH = "match"              # All attributes match
    MISMATCH = "mismatch"        # Attributes don't match
    MISSING = "missing"          # No Option 82 data in request
    NO_PROFILE = "no_profile"    # Subscriber has no network profile
    POLICY_IGNORE = "ignored"    # Policy set to IGNORE


async def validate_option82(
    *,
    db: Session,
    tenant_id: str,
    username: str,
    circuit_id: str | None,
    remote_id: str | None,
) -> tuple[Option82ValidationResult, dict[str, Any]]:
    """
    Validate DHCP Option 82 attributes against stored profile.

    Args:
        db: Database session
        tenant_id: Tenant ID
        username: RADIUS username (used to lookup subscriber)
        circuit_id: Circuit-ID from Access-Request (Option 82 sub-option 1)
        remote_id: Remote-ID from Access-Request (Option 82 sub-option 2)

    Returns:
        Tuple of (validation_result, details_dict)

    Details dict contains:
        - policy: The Option82Policy that was applied
        - expected_circuit_id: Value from profile
        - expected_remote_id: Value from profile
        - actual_circuit_id: Value from request
        - actual_remote_id: Value from request
        - action: "accept" | "reject" | "log"
    """
    profile_service = SubscriberNetworkProfileService(db, tenant_id)

    # Get subscriber ID from username (via RADIUS lookup)
    from ..radius.service import RADIUSService
    radius_service = RADIUSService(db, tenant_id)
    subscriber_id = await radius_service.get_subscriber_id_by_username(username)

    if not subscriber_id:
        return Option82ValidationResult.NO_PROFILE, {
            "action": "accept",  # Allow if no profile (backward compat)
            "reason": "No subscriber found for username",
        }

    # Get network profile
    profile = await profile_service.get_by_subscriber_id(subscriber_id)
    if not profile:
        return Option82ValidationResult.NO_PROFILE, {
            "action": "accept",
            "reason": "No network profile configured",
        }

    policy = profile.option82_policy

    # IGNORE policy: skip validation
    if policy == Option82Policy.IGNORE:
        return Option82ValidationResult.POLICY_IGNORE, {
            "policy": policy.value,
            "action": "accept",
        }

    # Check if Option 82 data present in request
    if not circuit_id and not remote_id:
        return Option82ValidationResult.MISSING, {
            "policy": policy.value,
            "action": "reject" if policy == Option82Policy.ENFORCE else "accept",
            "reason": "No Option 82 data in request",
        }

    # Validate circuit_id
    circuit_match = (
        circuit_id == profile.circuit_id
        if profile.circuit_id
        else True  # Allow if not configured
    )

    # Validate remote_id
    remote_match = (
        remote_id == profile.remote_id
        if profile.remote_id
        else True  # Allow if not configured
    )

    details = {
        "policy": policy.value,
        "expected_circuit_id": profile.circuit_id,
        "expected_remote_id": profile.remote_id,
        "actual_circuit_id": circuit_id,
        "actual_remote_id": remote_id,
    }

    if circuit_match and remote_match:
        return Option82ValidationResult.MATCH, {
            **details,
            "action": "accept",
        }
    else:
        return Option82ValidationResult.MISMATCH, {
            **details,
            "action": "reject" if policy == Option82Policy.ENFORCE else "accept",
            "mismatch_fields": [
                "circuit_id" if not circuit_match else None,
                "remote_id" if not remote_match else None,
            ],
        }
```

#### File: `src/dotmac/platform/radius/service.py`

**Changes Required:**

1. **Add Option 82 validation to authentication flow**:

   Currently, this backend manages the RadCheck/RadReply database that FreeRADIUS queries. We need to add a REST endpoint that FreeRADIUS can call for Option 82 validation.

2. **Add new method** (around line 600):
   ```python
   async def validate_access_request(
       self,
       *,
       username: str,
       nas_ip_address: str,
       nas_port_id: str,
       circuit_id: str | None = None,
       remote_id: str | None = None,
       **attributes: Any,
   ) -> dict[str, Any]:
       """
       Validate an Access-Request including Option 82 enforcement.

       This method is called by FreeRADIUS via REST API during authentication.

       Returns:
           - accept: bool
           - reason: str
           - vlan_attributes: dict (if accepted)
       """
       from .option82 import validate_option82

       # Validate Option 82
       result, details = await validate_option82(
           db=self.db,
           tenant_id=self.tenant_id,
           username=username,
           circuit_id=circuit_id,
           remote_id=remote_id,
       )

       # Log validation result
       logger.info(
           f"Option 82 validation for {username}: {result.value}",
           extra=details,
       )

       # Emit metric
       self._emit_option82_metric(result, details)

       # Determine action
       action = details.get("action", "accept")

       if action == "reject":
           return {
               "accept": False,
               "reason": f"Option 82 mismatch: {details.get('reason', 'Unknown')}",
               "validation_result": result.value,
               "details": details,
           }

       # Accept: return VLAN attributes
       # Get subscriber network profile for VLAN settings
       subscriber_id = await self.get_subscriber_id_by_username(username)
       profile = await self._get_network_profile(subscriber_id)

       vlan_attributes = self._build_vlan_attributes(profile) if profile else {}

       return {
           "accept": True,
           "reason": "Authorized",
           "validation_result": result.value,
           "vlan_attributes": vlan_attributes,
           "details": details,
       }
   ```

3. **Add VLAN attribute builder** (new method):
   ```python
   def _build_vlan_attributes(
       self,
       profile: SubscriberNetworkProfile,
   ) -> dict[str, Any]:
       """
       Build RADIUS VLAN/Tunnel attributes from network profile.

       Returns RFC 2868 Tunnel attributes for VLAN assignment.
       """
       if not profile.service_vlan:
           return {}

       attributes = {
           "Tunnel-Type": "VLAN",
           "Tunnel-Medium-Type": "IEEE-802",
           "Tunnel-Private-Group-ID": str(profile.service_vlan),
       }

       # QinQ support (vendor-specific)
       if profile.qinq_enabled and profile.inner_vlan:
           # Store as vendor-specific attribute or custom field
           attributes["X-QinQ-Inner-VLAN"] = str(profile.inner_vlan)
           attributes["X-QinQ-Enabled"] = "1"

       return attributes
   ```

4. **Add metrics emission**:
   ```python
   def _emit_option82_metric(
       self,
       result: Option82ValidationResult,
       details: dict[str, Any],
   ) -> None:
       """Emit Prometheus metrics for Option 82 validation."""
       # Increment counter
       option82_validation_counter.labels(
           tenant_id=self.tenant_id,
           result=result.value,
           policy=details.get("policy", "unknown"),
           action=details.get("action", "unknown"),
       ).inc()
   ```

#### File: `src/dotmac/platform/radius/router.py`

**Changes Required:**

1. **Add Option 82 validation endpoint** (new):
   ```python
   @router.post(
       "/validate-access-request",
       response_model=AccessRequestValidationResponse,
   )
   async def validate_access_request(
       request: AccessRequestValidation,
       db: Session = Depends(get_db),
       tenant_id: str = Depends(get_tenant_id),
   ) -> AccessRequestValidationResponse:
       """
       Validate RADIUS Access-Request including Option 82 enforcement.

       Called by FreeRADIUS via rlm_rest module during authentication.
       """
       service = RADIUSService(db, tenant_id)

       result = await service.validate_access_request(
           username=request.username,
           nas_ip_address=request.nas_ip_address,
           nas_port_id=request.nas_port_id,
           circuit_id=request.circuit_id,
           remote_id=request.remote_id,
       )

       return AccessRequestValidationResponse(**result)
   ```

#### File: `src/dotmac/platform/radius/schemas.py`

**Changes Required:**

1. **Add validation request/response schemas**:
   ```python
   class AccessRequestValidation(BaseModel):
       """RADIUS Access-Request validation request."""

       username: str
       nas_ip_address: str
       nas_port_id: str
       circuit_id: str | None = None
       remote_id: str | None = None


   class AccessRequestValidationResponse(BaseModel):
       """RADIUS Access-Request validation response."""

       accept: bool
       reason: str
       validation_result: str  # Option82ValidationResult enum value
       vlan_attributes: dict[str, Any] = {}
       details: dict[str, Any] = {}
   ```

### 3.2 VLAN Attribute Enforcement in RadReply

**Current State**:
- Lines 800-900 in radius/service.py: `_add_vlan_attributes()` method exists
- Only called when explicitly requested
- Not automatically applied during subscriber creation

**Changes Required:**

#### File: `src/dotmac/platform/radius/service.py`

1. **Update `create_subscriber()` method** (around line 300):
   - Automatically call `_add_vlan_attributes()` if `vlan_id` present
   - Fetch network profile if subscriber_id provided
   - Use profile.service_vlan if vlan_id not explicitly passed

2. **Update `_add_vlan_attributes()` method** (make it automatic):
   ```python
   async def _add_vlan_attributes(
       self,
       username: str,
       vlan_id: int,
       inner_vlan: int | None = None,
       qinq_enabled: bool = False,
   ) -> None:
       """
       Add VLAN tunnel attributes to radreply.

       Automatically called during subscriber creation/update when VLAN present.
       """
       # RFC 2868 Tunnel attributes
       tunnel_attrs = [
           {"attribute": "Tunnel-Type", "op": "=", "value": "VLAN"},
           {"attribute": "Tunnel-Medium-Type", "op": "=", "value": "IEEE-802"},
           {"attribute": "Tunnel-Private-Group-ID", "op": "=", "value": str(vlan_id)},
       ]

       # Add to radreply
       for attr in tunnel_attrs:
           await self._add_reply_attribute(username, **attr)

       # QinQ support (vendor-specific)
       if qinq_enabled and inner_vlan:
           await self._add_reply_attribute(
               username,
               attribute="X-QinQ-Inner-VLAN",
               op="=",
               value=str(inner_vlan),
           )
   ```

### 3.3 CoA VLAN Updates

**Current State**:
- CoA implementation exists in `radius/coa_client.py`
- Lines 200-400: CoA packet building
- No VLAN change support

**Changes Required:**

#### File: `src/dotmac/platform/radius/coa_client.py`

1. **Add VLAN change CoA method**:
   ```python
   async def send_vlan_change_coa(
       self,
       *,
       username: str,
       nas_ip_address: str,
       session_id: str,
       new_vlan: int,
       inner_vlan: int | None = None,
   ) -> CoAResponse:
       """
       Send CoA to change subscriber VLAN (service migration).

       Used when subscriber changes plans with different VLAN requirements.
       """
       attributes = [
           ("User-Name", username),
           ("Acct-Session-Id", session_id),
           # Tunnel attributes
           ("Tunnel-Type", "VLAN"),
           ("Tunnel-Medium-Type", "IEEE-802"),
           ("Tunnel-Private-Group-ID", str(new_vlan)),
       ]

       if inner_vlan:
           attributes.append(("X-QinQ-Inner-VLAN", str(inner_vlan)))

       return await self._send_coa_packet(
           nas_ip_address=nas_ip_address,
           attributes=attributes,
           message_type="CoA-Request",
       )
   ```

### 3.4 FreeRADIUS Integration Setup

**New Documentation File**: `docs/FREERADIUS_OPTION82_SETUP.md`

Contents:
1. FreeRADIUS rlm_rest configuration for Option 82 validation endpoint
2. Dictionary entries for custom attributes (X-QinQ-*)
3. Example authorize section configuration
4. Debugging and troubleshooting

**Key FreeRADIUS Config** (`/etc/freeradius/mods-enabled/rest`):

```
rest {
    connect_uri = "http://backend:8000/api/radius"

    authorize {
        uri = "${..connect_uri}/validate-access-request"
        method = 'post'
        body = 'json'
        data = '{
            "username": "%{User-Name}",
            "nas_ip_address": "%{NAS-IP-Address}",
            "nas_port_id": "%{NAS-Port-Id}",
            "circuit_id": "%{DHCP-Agent-Circuit-Id}",
            "remote_id": "%{DHCP-Agent-Remote-Id}"
        }'

        # Parse response
        tls = ${..tls}
    }
}
```

### 3.5 Testing Requirements

**Test Files:**
- `tests/radius/test_option82_enforcement.py` (new)
- `tests/radius/test_vlan_attributes.py` (update)
- `tests/radius/test_coa_vlan_change.py` (new)

**Test Cases:**
1. Option 82 ENFORCE policy: reject on mismatch
2. Option 82 LOG policy: accept but log mismatch
3. Option 82 IGNORE policy: skip validation
4. VLAN attributes auto-added to radreply
5. QinQ attributes in radreply
6. CoA VLAN change updates NAS
7. FreeRADIUS integration (manual/integration test)

**Acceptance Criteria:**
- [ ] Option 82 validation endpoint works
- [ ] ENFORCE policy rejects mismatches
- [ ] LOG policy logs but accepts
- [ ] VLAN attributes automatically added to radreply
- [ ] QinQ inner VLAN included when enabled
- [ ] CoA sends VLAN change to NAS
- [ ] FreeRADIUS integration tested end-to-end
- [ ] All tests pass with >85% coverage

---

## Phase 4: IPv6 Lifecycle Enhancement

**Objective**: Complete IPv6 provisioning lifecycle with delegated prefixes, RADIUS attributes, and OLT/CPE configuration.

**Current State**:
- Dual-stack (IPv4+IPv6) provisioning already works
- IPv6 address allocation from NetBox implemented
- RADIUS Framed-IPv6-Address supported
- Delegated-IPv6-Prefix field exists but not fully integrated

### 4.1 IPv6 Prefix Delegation (PD) in NetBox

**Already implemented** (from Phase 2.1), but add:

#### File: `src/dotmac/platform/netbox/service.py`

1. **Add PD pool management**:
   ```python
   async def create_ipv6_pd_pool(
       self,
       *,
       parent_prefix: str,  # e.g., "2001:db8::/32"
       delegation_size: int,  # e.g., 56 for /56 delegations
       tenant: str | None = None,
       site_id: int | None = None,
   ) -> dict[str, Any]:
       """
       Create an IPv6 prefix delegation pool.

       Subdivides parent prefix into delegation-sized chunks.
       Used for DHCPv6-PD scenarios.
       """
   ```

2. **Add PD availability check**:
   ```python
   async def get_available_pd_prefixes(
       self,
       parent_prefix_id: int,
       delegation_size: int,
       limit: int = 100,
   ) -> list[str]:
       """
       Get available IPv6 prefixes for delegation.

       Returns list of unallocated prefixes that can be delegated.
       """
   ```

### 4.2 RADIUS IPv6 Attribute Integration

#### File: `src/dotmac/platform/radius/service.py`

**Current State**: Lines 334-340 in provision workflow show IPv6 addresses passed to RADIUS

**Changes Required:**

1. **Update `create_subscriber()` method** to handle IPv6 PD:
   ```python
   async def create_subscriber(
       self,
       data: RADIUSSubscriberCreate,
   ) -> RADIUSUserResponse:
       """Create RADIUS subscriber with full IPv6 support."""

       # ... existing code ...

       # IPv6 attributes
       if data.framed_ipv6_address:
           await self._add_reply_attribute(
               username,
               attribute="Framed-IPv6-Address",
               op="=",
               value=data.framed_ipv6_address,
           )

       # IPv6 Prefix (for SLAAC)
       if data.framed_ipv6_prefix:
           await self._add_reply_attribute(
               username,
               attribute="Framed-IPv6-Prefix",
               op="=",
               value=data.framed_ipv6_prefix,
           )

       # Delegated IPv6 Prefix (for DHCPv6-PD)
       if data.delegated_ipv6_prefix:
           await self._add_reply_attribute(
               username,
               attribute="Delegated-IPv6-Prefix",
               op="=",
               value=data.delegated_ipv6_prefix,
           )

       # IPv6 assignment mode (for logging/monitoring)
       if data.ipv6_assignment_mode:
           await self._add_check_attribute(
               username,
               attribute="X-IPv6-Assignment-Mode",
               op="==",
               value=data.ipv6_assignment_mode,
           )
   ```

#### File: `src/dotmac/platform/radius/attributes.py`

**Changes Required:**

1. **Add IPv6 attributes to dictionary** (if missing):
   ```python
   # RFC 3162 IPv6 RADIUS attributes
   RADIUS_ATTRIBUTES = {
       95: ("NAS-IPv6-Address", "ipv6addr"),
       96: ("Framed-Interface-Id", "ifid"),
       97: ("Framed-IPv6-Prefix", "ipv6prefix"),
       98: ("Login-IPv6-Host", "ipv6addr"),
       99: ("Framed-IPv6-Route", "string"),
       100: ("Framed-IPv6-Pool", "string"),
       # RFC 4818
       123: ("Delegated-IPv6-Prefix", "ipv6prefix"),
   }
   ```

### 4.3 VOLTHA/OLT IPv6 Configuration

#### File: `src/dotmac/platform/voltha/service.py`

**Changes Required:**

1. **Add IPv6 metadata to ONU provisioning**:
   - Store IPv6 assignment mode in ONU custom fields (if VOLTHA supports)
   - Log delegated prefix for troubleshooting

   Update `provision_onu()` to accept and log IPv6 settings:
   ```python
   logger.info(
       f"ONU {serial_number} provisioned with IPv6 mode: {ipv6_assignment_mode}, "
       f"Delegated prefix: {delegated_ipv6_prefix}"
   )
   ```

### 4.4 GenieACS CPE IPv6 Configuration

#### File: `src/dotmac/platform/genieacs/service.py`

**Changes Required:**

1. **Update `configure_device()` with full IPv6 support** (already partially done in Phase 2):
   ```python
   async def configure_device(
       self,
       *,
       mac_address: str,
       subscriber_id: str,
       wan_ipv4: str | None = None,
       wan_ipv6: str | None = None,
       ipv6_prefix: str | None = None,
       delegated_ipv6_prefix: str | None = None,  # NEW
       ipv6_assignment_mode: str | None = None,  # NEW
       **config: Any,
   ) -> dict[str, Any]:
       """Configure CPE with dual-stack and DHCPv6-PD support."""

       parameters = {}

       # IPv4
       if wan_ipv4:
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress"] = wan_ipv4

       # IPv6 based on assignment mode
       if ipv6_assignment_mode == "slaac":
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_Enable"] = "1"
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_AddressType"] = "SLAAC"

       elif ipv6_assignment_mode == "stateful":
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_Enable"] = "1"
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_AddressType"] = "DHCPv6"

       elif ipv6_assignment_mode in ("pd", "dual_stack"):
           # DHCPv6 Prefix Delegation
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_Enable"] = "1"
           parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_PrefixDelegation_Enable"] = "1"
           if delegated_ipv6_prefix:
               parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_IPv6_PrefixDelegation"] = delegated_ipv6_prefix

       # Set parameters via TR-069
       await self.set_parameters(mac_address, parameters)
   ```

### 4.5 Workflow Integration

#### File: `src/dotmac/platform/orchestration/workflows/provision_subscriber.py`

**Changes Required:**

1. **Update `create_radius_account_handler`** (lines 334-343):
   - Pass `ipv6_assignment_mode` from network profile
   - Pass `delegated_ipv6_prefix` from profile or allocation

2. **Update `allocate_ip_handler`** (lines 394-532):
   - Check `profile.ipv6_assignment_mode`
   - If mode is PD or DUAL_STACK, allocate delegated prefix
   - Store prefix in context: `context["ipv6_delegated_prefix"]`

3. **Update `configure_cpe_handler`** (lines 638-693):
   - Pass `delegated_ipv6_prefix` from context
   - Pass `ipv6_assignment_mode` from profile

### 4.6 Testing Requirements

**Test Files:**
- `tests/radius/test_ipv6_attributes.py` (update)
- `tests/netbox/test_ipv6_prefix_delegation.py` (from Phase 2)
- `tests/genieacs/test_ipv6_pd_configuration.py` (new)
- `tests/orchestration/test_ipv6_provisioning_modes.py` (new)

**Test Cases:**
1. Provision with IPv6 SLAAC mode
2. Provision with IPv6 Stateful (DHCPv6) mode
3. Provision with IPv6 PD mode (allocate /56 or /60)
4. Provision with Dual-Stack mode (IPv4 + IPv6 PD)
5. RADIUS receives correct IPv6 attributes
6. GenieACS configures CPE for DHCPv6-PD
7. CoA updates IPv6 prefix

**Acceptance Criteria:**
- [ ] IPv6 PD pool creation and allocation works
- [ ] All IPv6 assignment modes supported (SLAAC, Stateful, PD, Dual-Stack)
- [ ] RADIUS radreply contains correct IPv6 attributes
- [ ] GenieACS configures CPE with IPv6 based on mode
- [ ] VOLTHA logs IPv6 settings for troubleshooting
- [ ] All tests pass with >85% coverage

---

## Phase 5: Telemetry & Alerts

**Objective**: Add comprehensive logging, metrics, and alerts for Option 82 mismatches, VLAN enforcement, and static IP assignments.

### 5.1 Prometheus Metrics

#### File: `src/dotmac/platform/radius/metrics.py` (NEW)

**Create new metrics module**:

```python
"""
RADIUS service Prometheus metrics.
"""

from prometheus_client import Counter, Histogram, Gauge

# Option 82 validation
option82_validation_counter = Counter(
    "radius_option82_validations_total",
    "Total Option 82 validation attempts",
    labelnames=["tenant_id", "result", "policy", "action"],
)

option82_mismatch_counter = Counter(
    "radius_option82_mismatches_total",
    "Total Option 82 mismatches detected",
    labelnames=["tenant_id", "policy", "field"],
)

# VLAN enforcement
vlan_assignment_counter = Counter(
    "radius_vlan_assignments_total",
    "Total VLAN assignments",
    labelnames=["tenant_id", "vlan_type"],  # vlan_type: single, qinq
)

vlan_change_counter = Counter(
    "radius_vlan_changes_total",
    "Total VLAN changes via CoA",
    labelnames=["tenant_id", "success"],
)

# IPv6 provisioning
ipv6_assignment_counter = Counter(
    "radius_ipv6_assignments_total",
    "Total IPv6 assignments",
    labelnames=["tenant_id", "mode"],  # mode: slaac, stateful, pd, dual_stack
)

ipv6_pd_allocation_counter = Counter(
    "netbox_ipv6_pd_allocations_total",
    "Total IPv6 prefix delegations",
    labelnames=["tenant_id", "prefix_size"],  # prefix_size: 56, 60, 64
)

# Static IP usage
static_ip_usage_counter = Counter(
    "radius_static_ip_assignments_total",
    "Total static IP assignments (skipped NetBox)",
    labelnames=["tenant_id", "ip_version"],  # ip_version: 4, 6
)

# Access request validation
access_request_duration = Histogram(
    "radius_access_request_validation_duration_seconds",
    "Duration of access request validation",
    labelnames=["tenant_id", "result"],
)

# Active subscribers by VLAN
active_subscribers_by_vlan = Gauge(
    "radius_active_subscribers_by_vlan",
    "Number of active subscribers per VLAN",
    labelnames=["tenant_id", "vlan_id"],
)
```

### 5.2 Structured Logging

#### File: `src/dotmac/platform/radius/option82.py`

**Update validation function** to log structured events:

```python
# After validation
logger.info(
    "option82_validation",
    extra={
        "event": "option82_validation",
        "tenant_id": tenant_id,
        "username": username,
        "result": result.value,
        "policy": details.get("policy"),
        "action": details.get("action"),
        "circuit_id_match": circuit_match,
        "remote_id_match": remote_match,
        "expected_circuit_id": profile.circuit_id,
        "actual_circuit_id": circuit_id,
        "expected_remote_id": profile.remote_id,
        "actual_remote_id": remote_id,
    },
)

# Log mismatch details
if result == Option82ValidationResult.MISMATCH:
    logger.warning(
        f"Option 82 mismatch for {username}: "
        f"circuit_id={circuit_id} (expected: {profile.circuit_id}), "
        f"remote_id={remote_id} (expected: {profile.remote_id})",
        extra={
            "event": "option82_mismatch",
            "severity": "high" if policy == Option82Policy.ENFORCE else "medium",
            "tenant_id": tenant_id,
            "username": username,
            "subscriber_id": subscriber_id,
        },
    )
```

#### File: `src/dotmac/platform/netbox/service.py`

**Add static IP usage logging**:

```python
async def allocate_dual_stack_ips(...):
    # Check for static IPs first
    if static_ipv4:
        logger.info(
            "static_ip_used",
            extra={
                "event": "static_ip_used",
                "tenant_id": tenant,
                "subscriber_id": subscriber_id,
                "ip_address": static_ipv4,
                "ip_version": "4",
                "skipped_netbox": True,
            },
        )
        static_ip_usage_counter.labels(
            tenant_id=tenant,
            ip_version="4",
        ).inc()
```

### 5.3 Audit Trail

#### File: `src/dotmac/platform/network/profile_service.py`

**Enhance audit logging**:

```python
async def upsert_profile(
    self,
    subscriber_id: str,
    profile_data: dict[str, Any],
) -> SubscriberNetworkProfile:
    """Update or insert network profile with full audit trail."""

    existing = await self.get_by_subscriber_id(subscriber_id)

    if existing:
        # Log changes
        changes = self._compute_changes(existing, profile_data)
        if changes:
            logger.info(
                "network_profile_updated",
                extra={
                    "event": "network_profile_updated",
                    "tenant_id": self.tenant_id,
                    "subscriber_id": subscriber_id,
                    "profile_id": existing.id,
                    "changes": changes,
                    "updated_by": profile_data.get("updated_by"),
                },
            )
    else:
        logger.info(
            "network_profile_created",
            extra={
                "event": "network_profile_created",
                "tenant_id": self.tenant_id,
                "subscriber_id": subscriber_id,
                "profile_data": profile_data,
                "created_by": profile_data.get("created_by"),
            },
        )
```

### 5.4 Grafana Dashboards

**New File**: `docs/monitoring/RADIUS_ENFORCEMENT_DASHBOARD.json`

**Dashboard Panels:**

1. **Option 82 Compliance**:
   - Query: `rate(radius_option82_validations_total[5m])`
   - Breakdown by result (match, mismatch, missing)
   - Alert on mismatch rate > 5%

2. **VLAN Assignments by Type**:
   - Query: `radius_vlan_assignments_total`
   - Breakdown by vlan_type (single, qinq)
   - Show top 10 VLANs by subscriber count

3. **IPv6 Assignment Modes**:
   - Query: `radius_ipv6_assignments_total`
   - Breakdown by mode (slaac, stateful, pd, dual_stack)
   - Trend over time

4. **Static IP Usage**:
   - Query: `radius_static_ip_assignments_total`
   - Breakdown by IP version
   - Percentage vs dynamic allocations

5. **Access Request Duration**:
   - Query: `histogram_quantile(0.99, rate(radius_access_request_validation_duration_seconds_bucket[5m]))`
   - P99, P95, P50 latency
   - Alert on P99 > 500ms

6. **Active Subscribers by VLAN**:
   - Query: `radius_active_subscribers_by_vlan`
   - Heatmap view
   - Alert on VLAN capacity (> 4000 subscribers per VLAN)

### 5.5 Alert Rules

**New File**: `docs/monitoring/RADIUS_ALERTS.yaml`

```yaml
groups:
  - name: radius_enforcement
    interval: 30s
    rules:
      # Option 82 mismatch rate
      - alert: HighOption82MismatchRate
        expr: |
          rate(radius_option82_mismatches_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          component: radius
        annotations:
          summary: "High Option 82 mismatch rate detected"
          description: "Tenant {{ $labels.tenant_id }} has {{ $value | humanizePercentage }} Option 82 mismatches in the last 5 minutes."

      # VLAN capacity
      - alert: VLANCapacityHigh
        expr: |
          radius_active_subscribers_by_vlan > 4000
        for: 10m
        labels:
          severity: warning
          component: radius
        annotations:
          summary: "VLAN {{ $labels.vlan_id }} approaching capacity"
          description: "VLAN {{ $labels.vlan_id }} has {{ $value }} active subscribers (threshold: 4000)."

      # IPv6 PD pool exhaustion
      - alert: IPv6PDPoolLowAvailability
        expr: |
          (netbox_ipv6_pd_available_prefixes / netbox_ipv6_pd_total_prefixes) < 0.1
        for: 15m
        labels:
          severity: warning
          component: netbox
        annotations:
          summary: "IPv6 PD pool low availability"
          description: "Less than 10% IPv6 delegated prefixes available in tenant {{ $labels.tenant_id }}."

      # Access request latency
      - alert: HighAccessRequestLatency
        expr: |
          histogram_quantile(0.99, rate(radius_access_request_validation_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
          component: radius
        annotations:
          summary: "High RADIUS access request latency"
          description: "P99 access request validation latency is {{ $value }}s (threshold: 0.5s)."

      # CoA failure rate
      - alert: HighCoAFailureRate
        expr: |
          rate(radius_vlan_changes_total{success="false"}[5m]) / rate(radius_vlan_changes_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          component: radius
        annotations:
          summary: "High CoA failure rate"
          description: "{{ $value | humanizePercentage }} of CoA requests are failing in tenant {{ $labels.tenant_id }}."
```

### 5.6 Logging Configuration

#### File: `src/dotmac/platform/settings.py`

**Add logging configuration**:

```python
# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/dotmac/radius_enforcement.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
        },
    },
    "loggers": {
        "dotmac.platform.radius": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "dotmac.platform.network": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
```

### 5.7 Testing Requirements

**Test Files:**
- `tests/radius/test_metrics.py` (new)
- `tests/monitoring/test_alerts.py` (new)

**Test Cases:**
1. Option 82 mismatch increments counter
2. VLAN assignment increments counter
3. IPv6 PD allocation increments counter with correct prefix_size
4. Static IP usage counter increments
5. Access request duration recorded
6. Audit trail logs all profile changes
7. Alert rules trigger correctly (manual verification)

**Acceptance Criteria:**
- [ ] All metrics exposed on `/metrics` endpoint
- [ ] Structured logging outputs JSON format
- [ ] Audit trail captures all network profile changes
- [ ] Grafana dashboard displays all panels correctly
- [ ] Alert rules trigger on threshold violations
- [ ] Log rotation configured (10MB files, 5 backups)
- [ ] All tests pass with >85% coverage

---

## Implementation Timeline

### Phase 1: Subscriber Profile Consumption (2 weeks)
- Week 1: Workflow integration + network profile handlers
- Week 2: Service metadata persistence + testing

### Phase 2: NetBox/VOLTHA Integration (2 weeks)
- Week 1: NetBox IPv6 PD + static IP bypass + QinQ VOLTHA
- Week 2: GenieACS CPE config + testing

### Phase 3: RADIUS Option 82 & VLAN Enforcement (3 weeks)
- Week 1: Option 82 validation module + RADIUS endpoint
- Week 2: VLAN attribute automation + CoA VLAN changes
- Week 3: FreeRADIUS integration + testing

### Phase 4: IPv6 Lifecycle (2 weeks)
- Week 1: IPv6 PD pool management + RADIUS attributes
- Week 2: GenieACS DHCPv6-PD config + testing

### Phase 5: Telemetry & Alerts (1 week)
- Week 1: Metrics, logging, dashboards, alerts

**Total Duration**: 10 weeks (2.5 months)

---

## Rollout Strategy

### Development Environment
1. Implement Phase 1 + 2 together (foundational changes)
2. Deploy to dev environment
3. Run integration tests
4. Manual QA verification

### Staging Environment
1. Deploy Phases 1-4
2. Run full test suite
3. Performance testing (load test with 10,000 subscribers)
4. Security review (Option 82 enforcement testing)

### Production Environment
1. Deploy Phase 1 first (read-only profile consumption)
2. Monitor for 1 week
3. Enable Phase 2 (NetBox/VOLTHA integration)
4. Monitor for 1 week
5. Enable Phase 3 (Option 82 enforcement in LOG mode)
6. Monitor for 1 week
7. Enable ENFORCE mode for select tenants
8. Full rollout after validation

### Feature Flags
- `ENABLE_NETWORK_PROFILE_CONSUMPTION`: Phase 1
- `ENABLE_STATIC_IP_BYPASS`: Phase 2
- `ENABLE_QINQ_PROVISIONING`: Phase 2
- `ENABLE_OPTION82_ENFORCEMENT`: Phase 3
- `OPTION82_DEFAULT_POLICY`: LOG (change to ENFORCE after validation)
- `ENABLE_IPV6_PD`: Phase 4
- `ENABLE_VLAN_COA_UPDATES`: Phase 3

---

## Success Metrics

### Technical Metrics
- Option 82 enforcement active for 100% of subscribers
- VLAN assignments succeed 99.9% of time
- IPv6 PD allocations succeed 99.5% of time
- Access request latency P99 < 500ms
- CoA success rate > 99%

### Operational Metrics
- Zero unauthorized sessions (Option 82 mismatches rejected)
- 100% of network profiles consumed by workflows
- Static IP assignments tracked (100% audit trail)
- VLAN capacity monitored (alerts before exhaustion)

### Business Metrics
- Reduced support tickets for IP/VLAN misconfigurations (-50%)
- Faster provisioning time (all data pre-configured in profile)
- Improved compliance (full audit trail of all assignments)

---

## Risks and Mitigation

### Risk 1: FreeRADIUS Integration Complexity
**Mitigation**:
- Start with LOG mode for Option 82 (non-blocking)
- Provide detailed setup documentation
- Create Docker Compose test environment with FreeRADIUS

### Risk 2: Performance Impact of Profile Lookups
**Mitigation**:
- Add Redis caching for network profiles (TTL: 5 minutes)
- Database indexing on subscriber_id lookups
- Load test with 100,000 concurrent sessions

### Risk 3: VLAN Exhaustion
**Mitigation**:
- Implement VLAN pool management with auto-scaling
- Alert when VLAN utilization > 80%
- Support multiple VLAN ranges per tenant

### Risk 4: IPv6 Complexity
**Mitigation**:
- Comprehensive testing for all IPv6 modes
- Support IPv4-only fallback
- Document IPv6 troubleshooting procedures

---

## Dependencies

### External Systems
- **FreeRADIUS**: Version 3.0+ required for rlm_rest module
- **NetBox**: Version 3.0+ required for IPv6 PD support
- **VOLTHA**: Version 2.8+ for QinQ flow configuration
- **GenieACS**: Version 1.2+ for DHCPv6-PD TR-069 parameters

### Internal Services
- PostgreSQL 13+ (for network profile storage)
- Redis 6+ (for profile caching)
- Prometheus 2.30+ (for metrics)
- Grafana 8.0+ (for dashboards)

---

## Appendices

### A. Database Schema Changes

**Migration**: `2025_11_15_0000_add_network_profile_audit.py`

```python
def upgrade():
    # Add audit columns to subscriber_network_profiles
    op.add_column('subscriber_network_profiles',
        sa.Column('last_validated_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('subscriber_network_profiles',
        sa.Column('last_validation_result', sa.String(50), nullable=True)
    )
    op.add_column('subscriber_network_profiles',
        sa.Column('option82_mismatch_count', sa.Integer, nullable=False, server_default='0')
    )
```

### B. API Endpoints

**New Endpoints:**
- `POST /api/radius/validate-access-request` - Option 82 validation
- `POST /api/netbox/allocate-ipv6-prefix` - IPv6 PD allocation
- `POST /api/radius/coa/vlan-change` - CoA VLAN update
- `GET /api/network-profiles/{subscriber_id}/audit` - Profile audit trail

### C. Configuration Examples

See separate files:
- `docs/FREERADIUS_OPTION82_SETUP.md`
- `docs/NETBOX_IPV6_PD_SETUP.md`
- `docs/VOLTHA_QINQ_CONFIGURATION.md`

---

**Document Version**: 1.0
**Author**: Implementation Planning Team
**Review Date**: 2025-11-07
