"""
Subscriber Provisioning Workflow

Atomic multi-system subscriber provisioning with automatic rollback.

Workflow Steps:
1. Create customer record in database
2. Create subscriber record in database
3. Create RADIUS authentication account (with dual-stack IP assignment)
4. Allocate IP addresses from NetBox (dual-stack: IPv4 + IPv6)
5. Activate ONU in VOLTHA
6. Configure CPE in GenieACS (with dual-stack WAN configuration)
7. Create billing service record
8. Send welcome email

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

    # Prepare RADIUS creation data with dual-stack support
    from ...radius.schemas import RADIUSSubscriberCreate

    # Strip CIDR notation from IP addresses (RADIUS expects just the IP)
    ipv4_address = context.get("ipv4_address")
    if ipv4_address and "/" in ipv4_address:
        ipv4_address = ipv4_address.split("/")[0]

    ipv6_address = context.get("ipv6_address")
    if ipv6_address and "/" in ipv6_address:
        ipv6_address = ipv6_address.split("/")[0]

    radius_data = RADIUSSubscriberCreate(
        subscriber_id=context["subscriber_id"],
        username=username,
        password=password,
        framed_ipv4_address=ipv4_address,
        framed_ipv6_address=ipv6_address,
        delegated_ipv6_prefix=context.get("ipv6_prefix"),
        bandwidth_profile=input_data.get("service_plan_id"),
        vlan_id=input_data.get("vlan_id"),
    )

    # Create RADIUS user
    radius_user = await radius_service.create_subscriber(radius_data)

    logger.info(f"Created RADIUS account: {username} (IPv4: {ipv4_address}, IPv6: {ipv6_address})")

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
    """Allocate dual-stack IP addresses from NetBox."""
    if not input_data.get("allocate_ip_from_netbox", True):
        logger.info("Skipping IP allocation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    # Check for static IPs (backward compatibility)
    if input_data.get("ipv4_address") or input_data.get("ipv6_address"):
        logger.info(
            f"Using provided static IPs - IPv4: {input_data.get('ipv4_address')}, "
            f"IPv6: {input_data.get('ipv6_address')}"
        )
        return {
            "output_data": {
                "ipv4_address": input_data.get("ipv4_address"),
                "ipv6_address": input_data.get("ipv6_address"),
                "ipv6_prefix": input_data.get("ipv6_prefix"),
                "static_ip": True,
            },
            "compensation_data": {"skipped": True},
            "context_updates": {
                "ipv4_address": input_data.get("ipv4_address"),
                "ipv6_address": input_data.get("ipv6_address"),
                "ipv6_prefix": input_data.get("ipv6_prefix"),
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

        ipv4_allocation, ipv6_allocation = await netbox_service.allocate_dual_stack_ips(
            ipv4_prefix_id=ipv4_prefix_id,
            ipv6_prefix_id=ipv6_prefix_id,
            description=f"Subscriber {context['subscriber_number']}",
            dns_name=f"sub-{context['subscriber_number']}.ftth.net",
            tenant=input_data.get("tenant_id"),
        )

        logger.info(
            f"Allocated dual-stack IPs - IPv4: {ipv4_allocation['address']}, "
            f"IPv6: {ipv6_allocation['address']}"
        )

        return {
            "output_data": {
                "ipv4_address": ipv4_allocation["address"],
                "ipv4_id": ipv4_allocation["id"],
                "ipv6_address": ipv6_allocation["address"],
                "ipv6_id": ipv6_allocation["id"],
            },
            "compensation_data": {
                "ipv4_id": ipv4_allocation["id"],
                "ipv6_id": ipv6_allocation["id"],
                "ipv4_address": ipv4_allocation["address"],
                "ipv6_address": ipv6_allocation["address"],
            },
            "context_updates": {
                "ipv4_address": ipv4_allocation["address"],
                "ipv6_address": ipv6_allocation["address"],
            },
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

    # Activate ONU
    onu_activation = await voltha_service.activate_onu(
        serial_number=onu_serial,
        subscriber_id=context["subscriber_id"],
        bandwidth_mbps=input_data.get("bandwidth_mbps", 100),
        vlan_id=input_data.get("vlan_id"),
    )

    logger.info(f"ONU activated: {onu_activation['onu_id']}")

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

    # Configure CPE with dual-stack support
    cpe_config = await genieacs_service.configure_device(
        mac_address=cpe_mac,
        subscriber_id=context["subscriber_id"],
        wan_ipv4=context.get("ipv4_address"),
        wan_ipv6=context.get("ipv6_address"),
        ipv6_prefix=context.get("ipv6_prefix"),
        wifi_ssid=f"Subscriber-{context['subscriber_number']}",
        wifi_password=f"wifi_{uuid4().hex[:12]}",
    )

    logger.info(
        f"CPE configured: {cpe_config['device_id']} "
        f"(IPv4: {context.get('ipv4_address')}, IPv6: {context.get('ipv6_address')})"
    )

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
        service_metadata={
            "subscriber_number": context["subscriber_number"],
            "connection_type": input_data["connection_type"],
        },
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


# ============================================================================
# Handler Registry
# ============================================================================


def register_handlers(saga: Any) -> None:
    """Register all step and compensation handlers."""
    # Step handlers
    saga.register_step_handler("create_customer_handler", create_customer_handler)
    saga.register_step_handler("create_subscriber_handler", create_subscriber_handler)
    saga.register_step_handler("create_radius_account_handler", create_radius_account_handler)
    saga.register_step_handler("allocate_ip_handler", allocate_ip_handler)
    saga.register_step_handler("activate_onu_handler", activate_onu_handler)
    saga.register_step_handler("configure_cpe_handler", configure_cpe_handler)
    saga.register_step_handler("create_billing_service_handler", create_billing_service_handler)

    # Compensation handlers
    saga.register_compensation_handler("delete_customer_handler", delete_customer_handler)
    saga.register_compensation_handler("delete_subscriber_handler", delete_subscriber_handler)
    saga.register_compensation_handler(
        "delete_radius_account_handler", delete_radius_account_handler
    )
    saga.register_compensation_handler("release_ip_handler", release_ip_handler)
    saga.register_compensation_handler("deactivate_onu_handler", deactivate_onu_handler)
    saga.register_compensation_handler("unconfigure_cpe_handler", unconfigure_cpe_handler)
    saga.register_compensation_handler(
        "delete_billing_service_handler", delete_billing_service_handler
    )

    logger.info("Registered all provision_subscriber workflow handlers")
