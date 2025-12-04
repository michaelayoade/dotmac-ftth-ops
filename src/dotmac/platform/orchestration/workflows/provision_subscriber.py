"""
Subscriber Provisioning Workflow

Atomic multi-system subscriber provisioning with automatic rollback.

Workflow Steps:
1. Create customer record in database
2. Create subscriber record in database
3. Create network profile (VLAN, Option 82, IPv6 settings)
4. Create RADIUS authentication account (with dual-stack IP assignment)
5. Allocate IP addresses from NetBox (dual-stack: IPv4 + IPv6)
6. Activate ONU in VOLTHA
7. Configure CPE in GenieACS (with dual-stack WAN configuration)
8. Create billing service record

Each step has a compensation handler for automatic rollback.

IPv6 Support:
- Dual-stack allocation: Allocates both IPv4 and IPv6 addresses atomically
- IPv6-only support: Can provision subscribers with IPv6 only
- Backward compatible: IPv4-only mode still supported
- RADIUS integration: Assigns both Framed-IP-Address and Framed-IPv6-Address
- CPE configuration: Configures dual-stack WAN on customer premises equipment
"""

# mypy: disable-error-code="attr-defined,assignment,arg-type,union-attr,call-arg,misc,no-untyped-call"

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from ...billing.core.entities import ServiceEntity
from ...customer_management.models import Customer
from ...genieacs.service import GenieACSService
from ...netbox.service import NetBoxService
from ...network.profile_service import SubscriberNetworkProfileService
from ...radius.service import RADIUSService
from ...subscribers.models import Subscriber
from ...voltha.service import VOLTHAService
from ..schemas import StepDefinition, WorkflowDefinition, WorkflowType

logger = logging.getLogger(__name__)


# ============================================================================
# Workflow Definition
# ============================================================================


def get_provision_subscriber_workflow() -> WorkflowDefinition:
    """Get the subscriber provisioning workflow definition."""
    return WorkflowDefinition(
        workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
        description="Atomic subscriber provisioning across all systems",
        steps=[
            StepDefinition(
                step_name="create_customer",
                step_type="database",
                target_system="database",
                handler="create_customer_handler",
                compensation_handler="delete_customer_handler",
                max_retries=3,
                timeout_seconds=10,
                required=True,
            ),
            StepDefinition(
                step_name="create_subscriber",
                step_type="database",
                target_system="database",
                handler="create_subscriber_handler",
                compensation_handler="delete_subscriber_handler",
                max_retries=3,
                timeout_seconds=10,
                required=True,
            ),
            StepDefinition(
                step_name="create_network_profile",
                step_type="database",
                target_system="database",
                handler="create_network_profile_handler",
                compensation_handler="delete_network_profile_handler",
                max_retries=3,
                timeout_seconds=10,
                required=True,
            ),
            StepDefinition(
                step_name="create_radius_account",
                step_type="api",
                target_system="radius",
                handler="create_radius_account_handler",
                compensation_handler="delete_radius_account_handler",
                max_retries=3,
                timeout_seconds=30,
                required=True,
            ),
            StepDefinition(
                step_name="allocate_ip_address",
                step_type="api",
                target_system="netbox",
                handler="allocate_ip_handler",
                compensation_handler="release_ip_handler",
                max_retries=3,
                timeout_seconds=30,
                required=False,  # Can continue without IP allocation
            ),
            StepDefinition(
                step_name="activate_ipv6_lifecycle",
                step_type="database",
                target_system="database",
                handler="activate_ipv6_lifecycle_handler",
                compensation_handler="revoke_ipv6_lifecycle_handler",
                max_retries=3,
                timeout_seconds=15,
                required=False,  # Optional Phase 4 enhancement
            ),
            StepDefinition(
                step_name="activate_ipv4_lifecycle",
                step_type="database",
                target_system="database",
                handler="activate_ipv4_lifecycle_handler",
                compensation_handler="revoke_ipv4_lifecycle_handler",
                max_retries=3,
                timeout_seconds=15,
                required=False,  # Optional Phase 5 enhancement
            ),
            StepDefinition(
                step_name="activate_onu",
                step_type="api",
                target_system="voltha",
                handler="activate_onu_handler",
                compensation_handler="deactivate_onu_handler",
                max_retries=5,
                timeout_seconds=60,
                required=True,
            ),
            StepDefinition(
                step_name="configure_cpe",
                step_type="api",
                target_system="genieacs",
                handler="configure_cpe_handler",
                compensation_handler="unconfigure_cpe_handler",
                max_retries=3,
                timeout_seconds=45,
                required=False,  # Can continue without CPE config
            ),
            StepDefinition(
                step_name="create_billing_service",
                step_type="database",
                target_system="billing",
                handler="create_billing_service_handler",
                compensation_handler="delete_billing_service_handler",
                max_retries=3,
                timeout_seconds=20,
                required=True,
            ),
        ],
        max_retries=2,
        timeout_seconds=300,
    )


# ============================================================================
# Step Handlers
# ============================================================================


async def create_customer_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Create or link customer record.

    Args:
        input_data: Workflow input data
        context: Execution context
        db: Database session

    Returns:
        Handler result with customer_id
    """
    logger.info("Creating customer record")

    # Check if customer_id provided
    customer_id = input_data.get("customer_id")

    if customer_id:
        # Verify existing customer
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise ValueError(f"Customer not found: {customer_id}")
        logger.info(f"Using existing customer: {customer_id}")
    else:
        # Create new customer
        customer = Customer(
            first_name=input_data["first_name"],
            last_name=input_data["last_name"],
            email=input_data["email"],
            phone=input_data["phone"],
            status="active",
        )
        db.add(customer)
        db.flush()
        logger.info(f"Created new customer: {customer.id}")

    return {
        "output_data": {
            "customer_id": customer.id,
        },
        "compensation_data": {
            "customer_id": customer.id,
            "was_created": customer_id is None,
        },
        "context_updates": {
            "customer_id": customer.id,
        },
    }


async def delete_customer_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate customer creation."""
    # Only delete if we created it
    if not compensation_data.get("was_created"):
        logger.info("Skipping customer deletion (pre-existing)")
        return

    customer_id = compensation_data["customer_id"]
    logger.info(f"Deleting customer: {customer_id}")

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer:
        db.delete(customer)
        db.flush()


async def create_subscriber_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Create subscriber record."""
    logger.info("Creating subscriber record")

    customer_id = context["customer_id"]

    subscriber = Subscriber(
        customer_id=customer_id,
        subscriber_id=f"SUB-{uuid4().hex[:12].upper()}",
        first_name=input_data["first_name"],
        last_name=input_data["last_name"],
        email=input_data["email"],
        phone=input_data["phone"],
        secondary_phone=input_data.get("secondary_phone"),
        service_address=input_data["service_address"],
        service_city=input_data["service_city"],
        service_state=input_data["service_state"],
        service_postal_code=input_data["service_postal_code"],
        service_country=input_data.get("service_country", "USA"),
        connection_type=input_data["connection_type"],
        service_plan=input_data.get("service_plan_id"),
        bandwidth_mbps=input_data.get("bandwidth_mbps"),
        ont_serial_number=input_data.get("onu_serial"),
        ont_mac_address=input_data.get("onu_mac"),
        installation_date=input_data.get("installation_date"),
        installation_notes=input_data.get("installation_notes"),
        status="pending",  # Will be activated later
        notes=input_data.get("notes"),
        tags=input_data.get("tags", {}),
    )

    db.add(subscriber)
    db.flush()

    logger.info(f"Created subscriber: {subscriber.id} ({subscriber.subscriber_id})")

    return {
        "output_data": {
            "subscriber_id": subscriber.id,
            "subscriber_number": subscriber.subscriber_id,
        },
        "compensation_data": {
            "subscriber_id": subscriber.id,
        },
        "context_updates": {
            "subscriber_id": subscriber.id,
            "subscriber_number": subscriber.subscriber_id,
        },
    }


async def delete_subscriber_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate subscriber creation."""
    subscriber_id = compensation_data["subscriber_id"]
    logger.info(f"Deleting subscriber: {subscriber_id}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber:
        db.delete(subscriber)
        db.flush()


async def create_network_profile_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Create subscriber network profile with VLAN, Option 82, and IPv6 settings.

    Args:
        input_data: Workflow input data
        context: Execution context (includes subscriber_id from previous step)
        db: Database session

    Returns:
        Handler result with network_profile_id
    """
    logger.info("Creating network profile")

    subscriber_id = context["subscriber_id"]
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

    if not tenant_id:
        raise ValueError("tenant_id is required for network profile creation")

    profile_service = SubscriberNetworkProfileService(db, tenant_id)

    # Build profile data from input
    from ...network.models import IPv6AssignmentMode, Option82Policy

    profile_data = {
        "subscriber_id": subscriber_id,
        # VLAN settings
        "service_vlan": input_data.get("service_vlan"),
        "inner_vlan": input_data.get("inner_vlan"),
        "qinq_enabled": input_data.get("qinq_enabled", False),
        "vlan_pool": input_data.get("vlan_pool"),
        # Option 82 settings
        "circuit_id": input_data.get("circuit_id"),
        "remote_id": input_data.get("remote_id"),
        "option82_policy": input_data.get("option82_policy", Option82Policy.LOG.value),
        # IPv6 settings
        "static_ipv4": input_data.get("static_ipv4"),
        "static_ipv6": input_data.get("static_ipv6"),
        "delegated_ipv6_prefix": input_data.get("delegated_ipv6_prefix"),
        "ipv6_pd_size": input_data.get("ipv6_pd_size", 56),  # Default /56
        "ipv6_assignment_mode": input_data.get(
            "ipv6_assignment_mode", IPv6AssignmentMode.DUAL_STACK.value
        ),
        # Metadata
        "metadata_": input_data.get("network_metadata", {}),
    }

    # Create or update profile
    profile = await profile_service.upsert_profile(subscriber_id, profile_data)

    logger.info(
        f"Created network profile: {profile.id} for subscriber {subscriber_id} "
        f"(VLAN: {profile.service_vlan}, IPv6 mode: {profile.ipv6_assignment_mode.value})"
    )

    return {
        "output_data": {
            "network_profile_id": str(profile.id),
            "service_vlan": profile.service_vlan,
            "qinq_enabled": profile.qinq_enabled,
            "ipv6_assignment_mode": profile.ipv6_assignment_mode.value,
        },
        "compensation_data": {
            "network_profile_id": str(profile.id),
            "subscriber_id": subscriber_id,
            "tenant_id": tenant_id,
        },
        "context_updates": {
            "network_profile_id": str(profile.id),
            "service_vlan": profile.service_vlan,
            "inner_vlan": profile.inner_vlan,
            "qinq_enabled": profile.qinq_enabled,
            "static_ipv4": profile.static_ipv4,
            "static_ipv6": profile.static_ipv6,
            "delegated_ipv6_prefix": profile.delegated_ipv6_prefix,
            "ipv6_assignment_mode": profile.ipv6_assignment_mode.value,
        },
    }


async def delete_network_profile_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate network profile creation."""
    subscriber_id = compensation_data["subscriber_id"]
    tenant_id = compensation_data.get("tenant_id")

    if not tenant_id:
        logger.warning(
            f"No tenant_id in compensation data for network profile deletion: {subscriber_id}"
        )
        return

    logger.info(f"Deleting network profile for subscriber: {subscriber_id}")

    profile_service = SubscriberNetworkProfileService(db, tenant_id)

    try:
        await profile_service.delete_profile(subscriber_id)
        logger.info(f"Network profile deleted for subscriber: {subscriber_id}")
    except Exception as e:
        logger.error(f"Failed to delete network profile for subscriber {subscriber_id}: {e}")
        # Don't raise - allow compensation to continue


async def create_radius_account_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Create RADIUS authentication account with dual-stack IP support."""
    from dotmac.platform.settings import settings

    # Check if RADIUS is enabled
    if not settings.features.radius_enabled:
        logger.info("RADIUS is disabled, skipping RADIUS account creation")
        return {
            "output_data": {"skipped": True, "reason": "RADIUS not enabled"},
            "compensation_data": {},
            "context_updates": {},
        }

    if not input_data.get("create_radius_account", True):
        logger.info("Skipping RADIUS account creation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    # Get tenant_id from context or input_data
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
    if not tenant_id:
        logger.error("tenant_id is required for RADIUS account creation")
        raise ValueError("tenant_id is required for RADIUS operations")

    logger.info("Creating RADIUS account")

    radius_service = RADIUSService(db, tenant_id)

    # Generate username (typically email or subscriber ID)
    username = input_data.get("email", context["subscriber_number"])
    password = input_data.get("password") or f"tmp_{uuid4().hex[:12]}"

    # Prepare RADIUS creation data with dual-stack support and network profile
    from ...radius.schemas import RADIUSSubscriberCreate

    # Strip CIDR notation from IP addresses (RADIUS expects just the IP)
    ipv4_address = context.get("ipv4_address")
    if ipv4_address and "/" in ipv4_address:
        ipv4_address = ipv4_address.split("/")[0]

    ipv6_address = context.get("ipv6_address")
    if ipv6_address and "/" in ipv6_address:
        ipv6_address = ipv6_address.split("/")[0]

    # Get VLAN from network profile (context) - takes priority over input_data
    vlan_id = context.get("service_vlan") or input_data.get("vlan_id")

    # Get delegated IPv6 prefix from network profile or context
    delegated_ipv6_prefix = context.get("delegated_ipv6_prefix") or context.get("ipv6_prefix")

    radius_data = RADIUSSubscriberCreate(
        subscriber_id=context["subscriber_id"],
        username=username,
        password=password,
        framed_ipv4_address=ipv4_address,
        framed_ipv6_address=ipv6_address,
        delegated_ipv6_prefix=delegated_ipv6_prefix,
        bandwidth_profile=input_data.get("service_plan_id"),
        vlan_id=vlan_id,
    )

    # Create RADIUS user
    radius_user = await radius_service.create_subscriber(radius_data)

    logger.info(
        f"Created RADIUS account: {username} "
        f"(IPv4: {ipv4_address}, IPv6: {ipv6_address}, "
        f"VLAN: {vlan_id}, IPv6 PD: {delegated_ipv6_prefix})"
    )

    return {
        "output_data": {
            "radius_username": username,
            "radius_user_id": radius_user.id,
        },
        "compensation_data": {
            "radius_username": username,
            "radius_user_id": radius_user.id,
            "tenant_id": tenant_id,
        },
        "context_updates": {
            "radius_username": username,
        },
    }


async def delete_radius_account_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate RADIUS account creation."""
    from dotmac.platform.settings import settings

    if compensation_data.get("skipped"):
        return

    # Check if RADIUS is enabled
    if not settings.features.radius_enabled:
        logger.info("RADIUS is disabled, skipping RADIUS account deletion")
        return

    username = compensation_data["radius_username"]
    tenant_id = compensation_data.get("tenant_id")
    if not tenant_id:
        logger.warning(f"No tenant_id in compensation data for RADIUS deletion: {username}")
        return

    logger.info(f"Deleting RADIUS account: {username}")

    radius_service = RADIUSService(db, tenant_id)
    await radius_service.delete_subscriber(username)


async def allocate_ip_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Allocate dual-stack IP addresses from NetBox or use static IPs from network profile.

    Priority:
    1. Static IPs from network profile (skip NetBox allocation)
    2. Static IPs from input_data (backward compatibility)
    3. Dynamic allocation from NetBox

    If dynamic allocation occurs, IPs are written back to network profile.
    """
    if not input_data.get("allocate_ip_from_netbox", True):
        logger.info("Skipping IP allocation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    # Check network profile for static IPs first (from context set by create_network_profile step)
    static_ipv4 = context.get("static_ipv4")
    static_ipv6 = context.get("static_ipv6")
    delegated_ipv6_prefix = context.get("delegated_ipv6_prefix")

    # Backward compatibility: Check input_data for static IPs
    if not static_ipv4 and input_data.get("ipv4_address"):
        static_ipv4 = input_data.get("ipv4_address")
    if not static_ipv6 and input_data.get("ipv6_address"):
        static_ipv6 = input_data.get("ipv6_address")
    if not delegated_ipv6_prefix and input_data.get("ipv6_prefix"):
        delegated_ipv6_prefix = input_data.get("ipv6_prefix")

    # Use static IPs if configured (skip NetBox allocation)
    if static_ipv4 or static_ipv6:
        # Audit log: Static IP usage
        subscriber_id = context.get("subscriber_id")
        subscriber_number = context.get("subscriber_number")
        tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

        logger.info(
            f"IP Allocation - Static from profile: subscriber_id={subscriber_id}, "
            f"subscriber_number={subscriber_number}, tenant_id={tenant_id}, "
            f"ipv4={static_ipv4}, ipv6={static_ipv6}, ipv6_prefix={delegated_ipv6_prefix}, "
            f"source=network_profile, netbox_skipped=True",
            extra={
                "event": "ip_allocation.static_from_profile",
                "subscriber_id": subscriber_id,
                "subscriber_number": subscriber_number,
                "tenant_id": tenant_id,
                "ipv4_address": static_ipv4,
                "ipv6_address": static_ipv6,
                "ipv6_prefix": delegated_ipv6_prefix,
                "allocation_source": "network_profile",
                "netbox_allocation_skipped": True,
            },
        )

        return {
            "output_data": {
                "ipv4_address": static_ipv4,
                "ipv6_address": static_ipv6,
                "ipv6_prefix": delegated_ipv6_prefix,
                "static_ip": True,
                "source": "network_profile",
            },
            "compensation_data": {"skipped": True},
            "context_updates": {
                "ipv4_address": static_ipv4,
                "ipv6_address": static_ipv6,
                "ipv6_prefix": delegated_ipv6_prefix,
            },
        }

    # Determine allocation strategy
    enable_ipv6 = input_data.get("enable_ipv6", True)
    ipv4_prefix_id = input_data.get("ipv4_prefix_id")
    ipv6_prefix_id = input_data.get("ipv6_prefix_id")

    netbox_service = NetBoxService()

    # Dual-stack allocation (IPv4 + IPv6)
    if enable_ipv6 and ipv4_prefix_id and ipv6_prefix_id:
        logger.info("Allocating dual-stack IPs from NetBox")

        # Phase 2: Extract IPv6 PD parameters from context/input_data
        ipv6_pd_parent_prefix_id = input_data.get("ipv6_pd_parent_prefix_id")
        ipv6_pd_size = context.get("ipv6_pd_size") or input_data.get("ipv6_pd_size", 56)
        subscriber_id = context.get("subscriber_id")

        # Call NetBox with optional IPv6 PD parameters
        allocation_result = await netbox_service.allocate_dual_stack_ips(
            ipv4_prefix_id=ipv4_prefix_id,
            ipv6_prefix_id=ipv6_prefix_id,
            description=f"Subscriber {context['subscriber_number']}",
            dns_name=f"sub-{context['subscriber_number']}.ftth.net",
            tenant=input_data.get("tenant_id"),
            subscriber_id=subscriber_id,
            ipv6_pd_parent_prefix_id=ipv6_pd_parent_prefix_id,
            ipv6_pd_size=ipv6_pd_size if ipv6_pd_parent_prefix_id else None,
        )

        # Handle both 2-tuple (ipv4, ipv6) and 3-tuple (ipv4, ipv6, ipv6_pd) responses
        if len(allocation_result) == 3:
            ipv4_allocation, ipv6_allocation, ipv6_pd_allocation = allocation_result
            has_ipv6_pd = True
        else:
            ipv4_allocation, ipv6_allocation = allocation_result
            ipv6_pd_allocation = None
            has_ipv6_pd = False

        log_msg = f"Allocated dual-stack IPs - IPv4: {ipv4_allocation['address']}, IPv6: {ipv6_allocation['address']}"
        if has_ipv6_pd and ipv6_pd_allocation:
            log_msg += f", IPv6 PD: {ipv6_pd_allocation['prefix']}"
        logger.info(log_msg)

        # Write allocated IPs back to network profile (keep source of truth in sync)
        subscriber_id = context.get("subscriber_id")
        tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
        if subscriber_id and tenant_id:
            try:
                profile_service = SubscriberNetworkProfileService(db, tenant_id)
                profile_update = {
                    "static_ipv4": ipv4_allocation["address"],
                    "static_ipv6": ipv6_allocation["address"],
                }
                # Phase 2: Write back IPv6 PD prefix if allocated
                if has_ipv6_pd and ipv6_pd_allocation:
                    profile_update["delegated_ipv6_prefix"] = ipv6_pd_allocation["prefix"]

                await profile_service.upsert_profile(subscriber_id, profile_update)

                # Audit log: IP writeback to profile
                log_extra = {
                    "event": "ip_allocation.writeback_to_profile",
                    "subscriber_id": subscriber_id,
                    "tenant_id": tenant_id,
                    "ipv4_address": ipv4_allocation["address"],
                    "ipv6_address": ipv6_allocation["address"],
                    "ipv4_id": ipv4_allocation["id"],
                    "ipv6_id": ipv6_allocation["id"],
                }
                if has_ipv6_pd and ipv6_pd_allocation:
                    log_extra["ipv6_pd_prefix"] = ipv6_pd_allocation["prefix"]

                logger.info(
                    f"IP Allocation - Writeback to profile: subscriber_id={subscriber_id}, "
                    f"ipv4={ipv4_allocation['address']}, ipv6={ipv6_allocation['address']}"
                    + (
                        f", ipv6_pd={ipv6_pd_allocation['prefix']}"
                        if has_ipv6_pd and ipv6_pd_allocation
                        else ""
                    ),
                    extra=log_extra,
                )
            except Exception as e:
                logger.warning(
                    f"Failed to write IPs back to network profile: {e}. Continuing...",
                    extra={
                        "event": "ip_allocation.writeback_failed",
                        "subscriber_id": subscriber_id,
                        "error": str(e),
                    },
                )

        # Build output_data and context_updates
        output_data = {
            "ipv4_address": ipv4_allocation["address"],
            "ipv4_id": ipv4_allocation["id"],
            "ipv6_address": ipv6_allocation["address"],
            "ipv6_id": ipv6_allocation["id"],
            "source": "netbox_dynamic",
        }
        compensation_data = {
            "ipv4_id": ipv4_allocation["id"],
            "ipv6_id": ipv6_allocation["id"],
            "ipv4_address": ipv4_allocation["address"],
            "ipv6_address": ipv6_allocation["address"],
            "subscriber_id": subscriber_id,
            "tenant_id": tenant_id,
        }
        context_updates = {
            "ipv4_address": ipv4_allocation["address"],
            "ipv6_address": ipv6_allocation["address"],
        }

        # Phase 2: Add IPv6 PD to output if allocated
        if has_ipv6_pd and ipv6_pd_allocation:
            output_data["ipv6_pd_prefix"] = ipv6_pd_allocation["prefix"]
            output_data["ipv6_pd_id"] = ipv6_pd_allocation.get("id")
            context_updates["delegated_ipv6_prefix"] = ipv6_pd_allocation["prefix"]
            compensation_data["ipv6_pd_id"] = ipv6_pd_allocation.get("id")

        return {
            "output_data": output_data,
            "compensation_data": compensation_data,
            "context_updates": context_updates,
        }

    # IPv4-only allocation (backward compatibility)
    elif ipv4_prefix_id:
        logger.info("Allocating IPv4-only from NetBox")

        ipv4_allocation = await netbox_service.allocate_ip(
            prefix_id=ipv4_prefix_id,
            data={
                "description": f"Subscriber {context['subscriber_number']}",
                "dns_name": f"sub-{context['subscriber_number']}.ftth.net",
                "tenant": input_data.get("tenant_id"),
            },
        )

        logger.info(f"Allocated IPv4: {ipv4_allocation['address']}")  # type: ignore[index]

        return {
            "output_data": {
                "ipv4_address": ipv4_allocation["address"],  # type: ignore[index]
                "ipv4_id": ipv4_allocation["id"],  # type: ignore[index]
            },
            "compensation_data": {
                "ipv4_id": ipv4_allocation["id"],  # type: ignore[index]
                "ipv4_address": ipv4_allocation["address"],  # type: ignore[index]
            },
            "context_updates": {
                "ipv4_address": ipv4_allocation["address"],  # type: ignore[index]
            },
        }

    # IPv6-only allocation
    elif enable_ipv6 and ipv6_prefix_id:
        logger.info("Allocating IPv6-only from NetBox")

        ipv6_allocation = await netbox_service.allocate_ip(
            prefix_id=ipv6_prefix_id,
            data={
                "description": f"Subscriber {context['subscriber_number']}",
                "dns_name": f"sub-{context['subscriber_number']}.ftth.net",
                "tenant": input_data.get("tenant_id"),
            },
        )

        logger.info(f"Allocated IPv6: {ipv6_allocation['address']}")  # type: ignore[index]

        return {
            "output_data": {
                "ipv6_address": ipv6_allocation["address"],  # type: ignore[index]
                "ipv6_id": ipv6_allocation["id"],  # type: ignore[index]
            },
            "compensation_data": {
                "ipv6_id": ipv6_allocation["id"],  # type: ignore[index]
                "ipv6_address": ipv6_allocation["address"],  # type: ignore[index]
            },
            "context_updates": {
                "ipv6_address": ipv6_allocation["address"],  # type: ignore[index]
            },
        }

    else:
        raise ValueError("No IP allocation strategy specified (missing prefix IDs)")


async def release_ip_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate IP allocation (dual-stack aware)."""
    if compensation_data.get("skipped"):
        return

    netbox_service = NetBoxService()

    # Release IPv4 if allocated
    if compensation_data.get("ipv4_id"):
        logger.info(f"Releasing IPv4: {compensation_data.get('ipv4_address')}")
        try:
            await netbox_service.delete_ip_address(compensation_data["ipv4_id"])
        except Exception as e:
            logger.error(f"Failed to release IPv4: {e}")

    # Release IPv6 if allocated
    if compensation_data.get("ipv6_id"):
        logger.info(f"Releasing IPv6: {compensation_data.get('ipv6_address')}")
        try:
            await netbox_service.delete_ip_address(compensation_data["ipv6_id"])
        except Exception as e:
            logger.error(f"Failed to release IPv6: {e}")

    # Backward compatibility: release single IP
    if compensation_data.get("ip_id"):
        logger.info(f"Releasing IP: {compensation_data.get('ipv4_address')}")
        try:
            await netbox_service.release_ip(compensation_data["ip_id"])
        except Exception as e:
            logger.error(f"Failed to release IP: {e}")


async def activate_onu_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Activate ONU in VOLTHA."""
    if not input_data.get("configure_voltha", True):
        logger.info("Skipping ONU activation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    onu_serial = input_data.get("onu_serial")
    if not onu_serial:
        logger.warning("No ONU serial provided, skipping activation")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Activating ONU: {onu_serial}")

    voltha_service = VOLTHAService()

    # Get VLAN from network profile (context) - takes priority over input_data
    vlan_id = context.get("service_vlan") or input_data.get("vlan_id")

    # Phase 2: Get QinQ parameters from network profile context
    qinq_enabled = context.get("qinq_enabled", False)
    inner_vlan = context.get("inner_vlan")

    # Activate ONU with network profile settings
    onu_activation = await voltha_service.activate_onu(
        serial_number=onu_serial,
        subscriber_id=context["subscriber_id"],
        bandwidth_mbps=input_data.get("bandwidth_mbps", 100),
        vlan_id=vlan_id,
        qinq_enabled=qinq_enabled,
        inner_vlan=inner_vlan,
    )

    log_msg = f"ONU activated: {onu_activation['onu_id']} (VLAN: {vlan_id}"
    if qinq_enabled and inner_vlan:
        log_msg += f", QinQ enabled, Inner VLAN: {inner_vlan}"
    log_msg += ")"
    logger.info(log_msg)

    return {
        "output_data": {
            "onu_id": onu_activation["onu_id"],
            "onu_status": onu_activation["status"],
        },
        "compensation_data": {
            "onu_id": onu_activation["onu_id"],
            "onu_serial": onu_serial,
        },
        "context_updates": {
            "onu_id": onu_activation["onu_id"],
        },
    }


async def deactivate_onu_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate ONU activation."""
    if compensation_data.get("skipped"):
        return

    onu_id = compensation_data["onu_id"]
    logger.info(f"Deactivating ONU: {onu_id}")

    voltha_service = VOLTHAService()
    await voltha_service.deactivate_onu(onu_id)


async def configure_cpe_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Configure CPE in GenieACS."""
    if not input_data.get("configure_genieacs", True):
        logger.info("Skipping CPE configuration (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    cpe_mac = input_data.get("cpe_mac")
    if not cpe_mac:
        logger.warning("No CPE MAC provided, skipping configuration")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Configuring CPE: {cpe_mac}")

    genieacs_service = GenieACSService()

    # Phase 2: Get delegated IPv6 prefix from context (from network profile or IPv6 PD allocation)
    delegated_ipv6_prefix = context.get("delegated_ipv6_prefix") or context.get("ipv6_prefix")

    # Configure CPE with dual-stack support and DHCPv6-PD
    cpe_config = await genieacs_service.configure_device(
        mac_address=cpe_mac,
        subscriber_id=context["subscriber_id"],
        wan_ipv4=context.get("ipv4_address"),
        wan_ipv6=context.get("ipv6_address"),
        ipv6_prefix=delegated_ipv6_prefix,
        ipv6_pd_enabled=bool(delegated_ipv6_prefix),  # Enable DHCPv6-PD if prefix available
        wifi_ssid=f"Subscriber-{context['subscriber_number']}",
        wifi_password=f"wifi_{uuid4().hex[:12]}",
    )

    log_msg = f"CPE configured: {cpe_config['device_id']} (IPv4: {context.get('ipv4_address')}, IPv6: {context.get('ipv6_address')}"
    if delegated_ipv6_prefix:
        log_msg += f", IPv6 PD: {delegated_ipv6_prefix}"
    log_msg += ")"
    logger.info(log_msg)

    return {
        "output_data": {
            "cpe_id": cpe_config["device_id"],
            "cpe_status": cpe_config["status"],
        },
        "compensation_data": {
            "cpe_id": cpe_config["device_id"],
            "cpe_mac": cpe_mac,
        },
        "context_updates": {
            "cpe_id": cpe_config["device_id"],
        },
    }


async def unconfigure_cpe_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate CPE configuration."""
    if compensation_data.get("skipped"):
        return

    cpe_id = compensation_data["cpe_id"]
    logger.info(f"Unconfiguring CPE: {cpe_id}")

    genieacs_service = GenieACSService()
    await genieacs_service.unconfigure_device(cpe_id)


async def create_billing_service_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Create billing service record."""
    logger.info("Creating billing service")

    # Get tenant_id from context or input_data
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
    if not tenant_id:
        raise ValueError("tenant_id is required for service creation")

    # Build comprehensive service metadata including network profile
    service_metadata = {
        "subscriber_number": context["subscriber_number"],
        "connection_type": input_data["connection_type"],
        # Network profile configuration (authoritative source for lifecycle operations)
        "network_profile": {
            "network_profile_id": context.get("network_profile_id"),
            "service_vlan": context.get("service_vlan"),
            "inner_vlan": context.get("inner_vlan"),
            "qinq_enabled": context.get("qinq_enabled", False),
            "ipv6_assignment_mode": context.get("ipv6_assignment_mode"),
        },
        # Allocated network resources
        "allocated_ips": {
            "ipv4": context.get("ipv4_address"),
            "ipv6": context.get("ipv6_address"),
            "ipv6_prefix": context.get("ipv6_prefix") or context.get("delegated_ipv6_prefix"),
            "source": context.get("source", "netbox_dynamic"),
        },
        # ONU/CPE device info
        "devices": {
            "onu_id": context.get("onu_id"),
            "cpe_id": context.get("cpe_id"),
        },
        # RADIUS info
        "radius": {
            "username": context.get("radius_username"),
        },
    }

    # Create service entity
    service = ServiceEntity(
        tenant_id=tenant_id,
        customer_id=context["customer_id"],
        subscriber_id=context["subscriber_id"],
        service_type="broadband",
        service_name=f"Broadband Service - {input_data['connection_type'].upper()}",
        plan_id=input_data.get("service_plan_id"),
        status="active" if input_data.get("auto_activate", True) else "pending",
        bandwidth_mbps=input_data.get("bandwidth_mbps"),
        service_metadata=service_metadata,
    )

    # Set activation timestamp if auto-activating
    if input_data.get("auto_activate", True):
        service.activated_at = datetime.now(UTC)

    db.add(service)
    db.flush()

    service_id = service.service_id
    logger.info(f"Created billing service: {service_id}")

    return {
        "output_data": {
            "service_id": service_id,
            "service_status": "active",
        },
        "compensation_data": {
            "service_id": service_id,
        },
        "context_updates": {
            "service_id": service_id,
        },
    }


async def delete_billing_service_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate billing service creation."""
    service_id = compensation_data["service_id"]
    logger.info(f"Deleting billing service: {service_id}")

    # Delete service entity (or soft delete if using SoftDeleteMixin)
    service = db.query(ServiceEntity).filter(ServiceEntity.service_id == service_id).first()
    if service:
        db.delete(service)  # Hard delete for compensation
        db.flush()
        logger.info(f"Billing service deleted: {service_id}")
    else:
        logger.warning(f"Billing service not found for deletion: {service_id}")


async def activate_ipv6_lifecycle_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Activate IPv6 lifecycle state after successful prefix allocation (Phase 4).

    Transitions: ALLOCATED -> ACTIVE

    This step tracks IPv6 prefix lifecycle after NetBox allocation and
    RADIUS provisioning are complete.
    """
    from ...network.ipv6_lifecycle_service import IPv6LifecycleService

    # Skip if no IPv6 prefix was allocated
    ipv6_prefix = context.get("delegated_ipv6_prefix") or context.get("ipv6_prefix")
    context.get("ipv6_pd_id")

    if not ipv6_prefix:
        logger.info("No IPv6 prefix allocated, skipping IPv6 lifecycle activation")
        return {
            "output_data": {"skipped": True, "reason": "no_ipv6_prefix"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    subscriber_id = context.get("subscriber_id")
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing subscriber_id or tenant_id for IPv6 lifecycle activation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return {
            "output_data": {"skipped": True, "reason": "missing_ids"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    try:
        logger.info(
            f"Activating IPv6 lifecycle for subscriber {subscriber_id}: prefix={ipv6_prefix}"
        )

        service = IPv6LifecycleService(db, tenant_id)

        # Activate IPv6 prefix (ALLOCATED -> ACTIVE)
        result = await service.activate_ipv6(
            subscriber_id=subscriber_id,
            username=context.get("radius_username"),
            nas_ip=None,  # Could be added if NAS info is in context
            send_coa=False,  # Don't send CoA during initial provisioning
            commit=True,
        )

        logger.info(
            f"IPv6 lifecycle activated: subscriber={subscriber_id}, "
            f"prefix={result.get('prefix')}, state={result.get('state')}"
        )

        return {
            "output_data": {
                "ipv6_lifecycle_activated": True,
                "ipv6_state": str(result.get("state")),
                "ipv6_activated_at": str(result.get("activated_at")),
            },
            "compensation_data": {
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv6_prefix": ipv6_prefix,
            },
            "context_updates": {
                "ipv6_lifecycle_state": str(result.get("state")),
            },
        }

    except Exception as e:
        # Log error but don't fail provisioning - IPv6 lifecycle is optional
        logger.error(
            f"Failed to activate IPv6 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv6_lifecycle.activation_failed",
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv6_prefix": ipv6_prefix,
                "error": str(e),
            },
        )
        return {
            "output_data": {
                "skipped": True,
                "reason": "activation_error",
                "error": str(e),
            },
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }


async def revoke_ipv6_lifecycle_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """
    Compensate IPv6 lifecycle activation by revoking the prefix (Phase 4).

    Transitions: ACTIVE -> REVOKING -> REVOKED
    """
    from ...network.ipv6_lifecycle_service import IPv6LifecycleService

    if compensation_data.get("skipped"):
        logger.info("Skipping IPv6 lifecycle revocation (was not activated)")
        return

    subscriber_id = compensation_data.get("subscriber_id")
    tenant_id = compensation_data.get("tenant_id")
    ipv6_prefix = compensation_data.get("ipv6_prefix")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing data for IPv6 lifecycle revocation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return

    try:
        logger.info(f"Revoking IPv6 lifecycle for subscriber {subscriber_id}: prefix={ipv6_prefix}")

        service = IPv6LifecycleService(db, tenant_id)

        # Revoke IPv6 prefix (return to NetBox pool)
        await service.revoke_ipv6(
            subscriber_id=subscriber_id,
            username=None,  # No RADIUS disconnect during compensation
            nas_ip=None,
            send_disconnect=False,  # Don't send disconnect during rollback
            release_to_netbox=True,  # Release back to NetBox
            commit=True,
        )

        logger.info(
            f"IPv6 lifecycle revoked successfully: subscriber={subscriber_id}, prefix={ipv6_prefix}"
        )

    except Exception as e:
        # Log error but don't fail compensation - best effort cleanup
        logger.error(
            f"Failed to revoke IPv6 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv6_lifecycle.revocation_failed",
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv6_prefix": ipv6_prefix,
                "error": str(e),
            },
        )


async def activate_ipv4_lifecycle_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Activate IPv4 lifecycle state after successful IP allocation (Phase 5).

    Transitions: ALLOCATED/PENDING -> ACTIVE

    This step tracks IPv4 static IP lifecycle after NetBox/IPManagement
    allocation and RADIUS provisioning are complete.
    """
    from uuid import UUID

    from ...network.ipv4_lifecycle_service import IPv4LifecycleService

    # Skip if no IPv4 address was allocated
    ipv4_address = context.get("static_ipv4_address") or context.get("ipv4_address")

    if not ipv4_address:
        logger.info("No static IPv4 address allocated, skipping IPv4 lifecycle activation")
        return {
            "output_data": {"skipped": True, "reason": "no_ipv4_address"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    subscriber_id = context.get("subscriber_id")
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing subscriber_id or tenant_id for IPv4 lifecycle activation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return {
            "output_data": {"skipped": True, "reason": "missing_ids"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    try:
        logger.info(
            f"Activating IPv4 lifecycle for subscriber {subscriber_id}: address={ipv4_address}"
        )

        service = IPv4LifecycleService(db, tenant_id)

        # Activate IPv4 address (ALLOCATED/PENDING -> ACTIVE)
        # Convert subscriber_id to UUID if it's a string
        subscriber_uuid = UUID(subscriber_id) if isinstance(subscriber_id, str) else subscriber_id

        result = await service.activate(
            subscriber_id=subscriber_uuid,
            username=context.get("radius_username"),
            nas_ip=None,  # Could be added if NAS info is in context
            send_coa=False,  # Don't send CoA during initial provisioning
            update_netbox=True,  # Update NetBox if available
            commit=True,
        )

        logger.info(
            f"IPv4 lifecycle activated: subscriber={subscriber_id}, "
            f"address={result.address}, state={result.state}"
        )

        return {
            "output_data": {
                "ipv4_lifecycle_activated": True,
                "ipv4_state": result.state.value,
                "ipv4_activated_at": result.activated_at.isoformat()
                if result.activated_at
                else None,
            },
            "compensation_data": {
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv4_address": ipv4_address,
            },
            "context_updates": {
                "ipv4_lifecycle_state": result.state.value,
            },
        }

    except Exception as e:
        # Log error but don't fail provisioning - IPv4 lifecycle is optional
        logger.error(
            f"Failed to activate IPv4 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv4_lifecycle.activation_failed",
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv4_address": ipv4_address,
                "error": str(e),
            },
        )
        return {
            "output_data": {
                "skipped": True,
                "reason": "activation_error",
                "error": str(e),
            },
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }


async def revoke_ipv4_lifecycle_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """
    Compensate IPv4 lifecycle activation by revoking the IP address (Phase 5).

    Transitions: ACTIVE -> REVOKING -> REVOKED
    """
    from uuid import UUID

    from ...network.ipv4_lifecycle_service import IPv4LifecycleService

    if compensation_data.get("skipped"):
        logger.info("Skipping IPv4 lifecycle revocation (was not activated)")
        return

    subscriber_id = compensation_data.get("subscriber_id")
    tenant_id = compensation_data.get("tenant_id")
    ipv4_address = compensation_data.get("ipv4_address")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing data for IPv4 lifecycle revocation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return

    try:
        logger.info(
            f"Revoking IPv4 lifecycle for subscriber {subscriber_id}: address={ipv4_address}"
        )

        service = IPv4LifecycleService(db, tenant_id)

        # Convert subscriber_id to UUID
        subscriber_uuid = UUID(subscriber_id) if isinstance(subscriber_id, str) else subscriber_id

        # Revoke IPv4 address (return to pool)
        await service.revoke(
            subscriber_id=subscriber_uuid,
            username=None,  # No RADIUS disconnect during compensation
            nas_ip=None,
            send_disconnect=False,  # Don't send disconnect during rollback
            release_to_pool=True,  # Release back to pool
            update_netbox=True,  # Update NetBox if available
            commit=True,
        )

        logger.info(
            f"IPv4 lifecycle revoked successfully: subscriber={subscriber_id}, address={ipv4_address}"
        )

    except Exception as e:
        # Log error but don't fail compensation - best effort cleanup
        logger.error(
            f"Failed to revoke IPv4 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv4_lifecycle.revocation_failed",
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv4_address": ipv4_address,
                "error": str(e),
            },
        )


# ============================================================================
# Handler Registry
# ============================================================================


def register_handlers(saga: Any) -> None:
    """Register all step and compensation handlers."""
    # Step handlers
    saga.register_step_handler("create_customer_handler", create_customer_handler)
    saga.register_step_handler("create_subscriber_handler", create_subscriber_handler)
    saga.register_step_handler("create_network_profile_handler", create_network_profile_handler)
    saga.register_step_handler("create_radius_account_handler", create_radius_account_handler)
    saga.register_step_handler("allocate_ip_handler", allocate_ip_handler)
    saga.register_step_handler("activate_ipv6_lifecycle_handler", activate_ipv6_lifecycle_handler)
    saga.register_step_handler("activate_ipv4_lifecycle_handler", activate_ipv4_lifecycle_handler)
    saga.register_step_handler("activate_onu_handler", activate_onu_handler)
    saga.register_step_handler("configure_cpe_handler", configure_cpe_handler)
    saga.register_step_handler("create_billing_service_handler", create_billing_service_handler)

    # Compensation handlers
    saga.register_compensation_handler("delete_customer_handler", delete_customer_handler)
    saga.register_compensation_handler("delete_subscriber_handler", delete_subscriber_handler)
    saga.register_compensation_handler(
        "delete_network_profile_handler", delete_network_profile_handler
    )
    saga.register_compensation_handler(
        "delete_radius_account_handler", delete_radius_account_handler
    )
    saga.register_compensation_handler("release_ip_handler", release_ip_handler)
    saga.register_compensation_handler(
        "revoke_ipv6_lifecycle_handler", revoke_ipv6_lifecycle_handler
    )
    saga.register_compensation_handler(
        "revoke_ipv4_lifecycle_handler", revoke_ipv4_lifecycle_handler
    )
    saga.register_compensation_handler("deactivate_onu_handler", deactivate_onu_handler)
    saga.register_compensation_handler("unconfigure_cpe_handler", unconfigure_cpe_handler)
    saga.register_compensation_handler(
        "delete_billing_service_handler", delete_billing_service_handler
    )

    logger.info("Registered all provision_subscriber workflow handlers")
