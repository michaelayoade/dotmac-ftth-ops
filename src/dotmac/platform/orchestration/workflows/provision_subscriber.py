"""
Subscriber Provisioning Workflow

Atomic multi-system subscriber provisioning with automatic rollback.

Workflow Steps:
1. Create customer record in database
2. Create subscriber record in database
3. Create RADIUS authentication account
4. Allocate IP address from NetBox
5. Activate ONU in VOLTHA
6. Configure CPE in GenieACS
7. Create billing service record
8. Send welcome email

Each step has a compensation handler for automatic rollback.
"""

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

# TODO: Create Service model in billing.core.models
# from ...billing.core.models import Service
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
    """Create RADIUS authentication account."""
    if not input_data.get("create_radius_account", True):
        logger.info("Skipping RADIUS account creation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info("Creating RADIUS account")

    radius_service = RADIUSService(db)

    # Generate username (typically email or subscriber ID)
    username = input_data.get("email", context["subscriber_number"])
    password = input_data.get("password") or f"tmp_{uuid4().hex[:12]}"

    # Create RADIUS user
    radius_user = await radius_service.create_subscriber(
        username=username,
        password=password,
        subscriber_id=context["subscriber_id"],
        bandwidth_profile=input_data.get("service_plan_id"),
        vlan_id=input_data.get("vlan_id"),
    )

    logger.info(f"Created RADIUS account: {username}")

    return {
        "output_data": {
            "radius_username": username,
            "radius_user_id": radius_user.id,
        },
        "compensation_data": {
            "radius_username": username,
            "radius_user_id": radius_user.id,
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
    if compensation_data.get("skipped"):
        return

    username = compensation_data["radius_username"]
    logger.info(f"Deleting RADIUS account: {username}")

    radius_service = RADIUSService(db)
    await radius_service.delete_subscriber(username)


async def allocate_ip_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Allocate IP address from NetBox."""
    if not input_data.get("allocate_ip_from_netbox", True):
        logger.info("Skipping IP allocation (disabled)")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    # If static IP provided, use it
    if input_data.get("ipv4_address"):
        logger.info(f"Using provided static IP: {input_data['ipv4_address']}")
        return {
            "output_data": {
                "ipv4_address": input_data["ipv4_address"],
                "static_ip": True,
            },
            "compensation_data": {"skipped": True},
            "context_updates": {
                "ipv4_address": input_data["ipv4_address"],
            },
        }

    logger.info("Allocating IP address from NetBox")

    netbox_service = NetBoxService()

    # Allocate IP from pool
    ip_allocation = await netbox_service.allocate_ip(
        subscriber_id=context["subscriber_id"],
        description=f"Subscriber {context['subscriber_number']}",
    )

    logger.info(f"Allocated IP: {ip_allocation['address']}")

    return {
        "output_data": {
            "ipv4_address": ip_allocation["address"],
            "ip_id": ip_allocation["id"],
        },
        "compensation_data": {
            "ip_id": ip_allocation["id"],
            "ipv4_address": ip_allocation["address"],
        },
        "context_updates": {
            "ipv4_address": ip_allocation["address"],
        },
    }


async def release_ip_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate IP allocation."""
    if compensation_data.get("skipped"):
        return

    ip_id = compensation_data["ip_id"]
    logger.info(f"Releasing IP: {compensation_data['ipv4_address']}")

    netbox_service = NetBoxService()
    await netbox_service.release_ip(ip_id)


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

    # Configure CPE
    cpe_config = await genieacs_service.configure_device(
        mac_address=cpe_mac,
        subscriber_id=context["subscriber_id"],
        wan_ip=context.get("ipv4_address"),
        wifi_ssid=f"Subscriber-{context['subscriber_number']}",
        wifi_password=f"wifi_{uuid4().hex[:12]}",
    )

    logger.info(f"CPE configured: {cpe_config['device_id']}")

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

    # TODO: Implement Service model creation
    # service = Service(
    #     customer_id=context["customer_id"],
    #     subscriber_id=context["subscriber_id"],
    #     service_type="broadband",
    #     service_name=f"Broadband Service - {input_data['connection_type'].upper()}",
    #     plan_id=input_data.get("service_plan_id"),
    #     status="active" if input_data.get("auto_activate", True) else "pending",
    #     bandwidth_mbps=input_data.get("bandwidth_mbps"),
    #     metadata={
    #         "subscriber_number": context["subscriber_number"],
    #         "connection_type": input_data["connection_type"],
    #     },
    # )
    # db.add(service)
    # db.flush()

    # Temporary: Return mock service_id
    service_id = str(uuid4())
    logger.info(f"Created billing service (mock): {service_id}")

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

    # TODO: Implement Service model deletion
    # service = db.query(Service).filter(Service.id == service_id).first()
    # if service:
    #     db.delete(service)
    #     db.flush()
    logger.info(f"Billing service deletion (mock): {service_id}")


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
    saga.register_compensation_handler("delete_radius_account_handler", delete_radius_account_handler)
    saga.register_compensation_handler("release_ip_handler", release_ip_handler)
    saga.register_compensation_handler("deactivate_onu_handler", deactivate_onu_handler)
    saga.register_compensation_handler("unconfigure_cpe_handler", unconfigure_cpe_handler)
    saga.register_compensation_handler("delete_billing_service_handler", delete_billing_service_handler)

    logger.info("Registered all provision_subscriber workflow handlers")
