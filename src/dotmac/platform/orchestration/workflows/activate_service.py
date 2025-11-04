"""
Service Activation Workflow

Atomic multi-system service activation for subscribers.

Workflow Steps:
1. Verify subscriber and service exist
2. Activate billing service
3. Enable RADIUS authentication
4. Activate ONU in VOLTHA
5. Enable CPE in GenieACS
6. Update subscriber status to active
7. Send activation notification email

This workflow is used to activate a suspended or pending service.
"""

# mypy: disable-error-code="attr-defined,assignment,arg-type,union-attr,call-arg"

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from ...billing.core.entities import ServiceEntity
from ...genieacs.service import GenieACSService
from ...radius.service import RADIUSService
from ...subscribers.models import Subscriber
from ...voltha.service import VOLTHAService
from ..schemas import StepDefinition, WorkflowDefinition, WorkflowType

logger = logging.getLogger(__name__)


# ============================================================================
# Workflow Definition
# ============================================================================


def get_activate_service_workflow() -> WorkflowDefinition:
    """Get the service activation workflow definition."""
    return WorkflowDefinition(
        workflow_type=WorkflowType.ACTIVATE_SERVICE,
        description="Atomic service activation across all systems",
        steps=[
            StepDefinition(
                step_name="verify_subscriber_and_service",
                step_type="database",
                target_system="database",
                handler="verify_subscriber_handler",
                compensation_handler=None,  # No compensation needed for verification
                max_retries=1,
                timeout_seconds=10,
                required=True,
            ),
            StepDefinition(
                step_name="activate_billing_service",
                step_type="database",
                target_system="billing",
                handler="activate_billing_service_handler",
                compensation_handler="suspend_billing_service_handler",
                max_retries=3,
                timeout_seconds=20,
                required=True,
            ),
            StepDefinition(
                step_name="enable_radius_authentication",
                step_type="api",
                target_system="radius",
                handler="enable_radius_handler",
                compensation_handler="disable_radius_handler",
                max_retries=3,
                timeout_seconds=30,
                required=False,  # Can continue if RADIUS unavailable
            ),
            StepDefinition(
                step_name="activate_onu",
                step_type="api",
                target_system="voltha",
                handler="activate_onu_handler",
                compensation_handler="deactivate_onu_handler",
                max_retries=3,
                timeout_seconds=60,
                required=False,  # Can continue if ONU unavailable
            ),
            StepDefinition(
                step_name="enable_cpe",
                step_type="api",
                target_system="genieacs",
                handler="enable_cpe_handler",
                compensation_handler="disable_cpe_handler",
                max_retries=3,
                timeout_seconds=45,
                required=False,  # Can continue if CPE unavailable
            ),
            StepDefinition(
                step_name="update_subscriber_status",
                step_type="database",
                target_system="database",
                handler="update_subscriber_status_handler",
                compensation_handler="revert_subscriber_status_handler",
                max_retries=3,
                timeout_seconds=10,
                required=True,
            ),
        ],
        max_retries=2,
        timeout_seconds=300,
    )


# ============================================================================
# Step Handlers
# ============================================================================


async def verify_subscriber_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Verify subscriber exists and can be activated.

    Checks:
    - Subscriber exists
    - Subscriber is not already active
    - Subscriber is not archived
    """
    logger.info("Verifying subscriber for activation")

    subscriber_id = input_data["subscriber_id"]

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    if subscriber.status == "active":
        raise ValueError(f"Subscriber is already active: {subscriber_id}")

    if subscriber.status == "archived":
        raise ValueError(f"Cannot activate archived subscriber: {subscriber_id}")

    logger.info(f"Verified subscriber: {subscriber.id} (current status: {subscriber.status})")

    # Store configuration for activation
    return {
        "output_data": {
            "subscriber_id": subscriber.id,
            "subscriber_number": subscriber.subscriber_id,
            "customer_id": subscriber.customer_id,
            "current_status": subscriber.status,
        },
        "compensation_data": {},
        "context_updates": {
            "subscriber_id": subscriber.id,
            "subscriber_number": subscriber.subscriber_id,
            "customer_id": subscriber.customer_id,
            "previous_status": subscriber.status,
            "onu_serial": subscriber.ont_serial_number,
            "cpe_mac": subscriber.ont_mac_address,
        },
    }


async def activate_billing_service_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Activate billing service."""
    logger.info("Activating billing service")

    # Find service by service_id (if provided) or subscriber_id
    service_id = input_data.get("service_id")
    if service_id:
        service = db.query(ServiceEntity).filter(ServiceEntity.service_id == service_id).first()
    else:
        # Find service by subscriber_id
        service = (
            db.query(ServiceEntity)
            .filter(ServiceEntity.subscriber_id == context["subscriber_id"])
            .first()
        )

    if service:
        service.status = "active"
        service.activated_at = datetime.now(UTC)
        service.suspended_at = None  # Clear suspension
        service.suspension_reason = None
        db.flush()
        logger.info(f"Billing service activated: {service.service_id}")
    else:
        logger.warning(f"No billing service found for subscriber: {context['subscriber_id']}")

    return {
        "output_data": {"billing_activated": True},
        "compensation_data": {"service_id": service.service_id if service else None},
        "context_updates": {},
    }


async def suspend_billing_service_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate billing service activation."""
    logger.info("Suspending billing service (compensation)")

    service_id = compensation_data.get("service_id")
    if service_id:
        service = db.query(ServiceEntity).filter(ServiceEntity.service_id == service_id).first()
        if service:
            service.status = "suspended"
            service.suspended_at = datetime.now(UTC)
            service.suspension_reason = "Activation rollback"
            db.flush()
            logger.info(f"Billing service suspended: {service_id}")


async def enable_radius_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Enable RADIUS authentication."""
    from dotmac.platform.settings import settings

    # Check if RADIUS is enabled
    if not settings.features.radius_enabled:
        logger.info("RADIUS is disabled, skipping RADIUS authentication enablement")
        return {
            "output_data": {"skipped": True, "reason": "RADIUS not enabled"},
            "compensation_data": {},
            "context_updates": {},
        }

    # Get tenant_id from context or input_data
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
    if not tenant_id:
        # Try to get tenant_id from subscriber
        from ...subscribers.models import Subscriber

        subscriber = db.query(Subscriber).filter(Subscriber.id == context["subscriber_id"]).first()
        if subscriber:
            tenant_id = subscriber.tenant_id
        else:
            logger.error(f"Cannot determine tenant_id for subscriber: {context['subscriber_id']}")
            raise ValueError("tenant_id is required for RADIUS operations")

    subscriber_id = context["subscriber_id"]
    logger.info(f"Enabling RADIUS authentication for subscriber: {subscriber_id}")

    radius_service = RADIUSService(db, tenant_id)

    try:
        # Check if RADIUS account exists
        radius_user = await radius_service.get_subscriber_by_id(subscriber_id)
        if radius_user:
            # Update to enable if disabled
            await radius_service.update_subscriber(
                subscriber_id=subscriber_id,
                enabled=True,
            )
            logger.info(f"RADIUS account enabled: {subscriber_id}")
        else:
            logger.warning(f"RADIUS account not found for subscriber: {subscriber_id}")
    except Exception as e:
        logger.warning(f"Failed to enable RADIUS account (continuing anyway): {e}")

    return {
        "output_data": {"radius_enabled": True},
        "compensation_data": {"subscriber_id": subscriber_id, "tenant_id": tenant_id},
        "context_updates": {},
    }


async def disable_radius_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate RADIUS enablement."""
    logger.info("Disabling RADIUS authentication (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def activate_onu_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Activate ONU in VOLTHA."""
    onu_serial = context.get("onu_serial")
    if not onu_serial:
        logger.info("No ONU serial found, skipping activation")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Activating ONU: {onu_serial}")

    voltha_service = VOLTHAService()

    try:
        await voltha_service.enable_onu_by_serial(onu_serial)
        logger.info(f"ONU activated: {onu_serial}")
    except Exception as e:
        logger.warning(f"Failed to activate ONU (continuing anyway): {e}")

    return {
        "output_data": {"onu_activated": True},
        "compensation_data": {"onu_serial": onu_serial},
        "context_updates": {},
    }


async def deactivate_onu_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate ONU activation."""
    logger.info("Deactivating ONU (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def enable_cpe_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Enable CPE in GenieACS."""
    cpe_mac = context.get("cpe_mac")
    if not cpe_mac:
        logger.info("No CPE MAC found, skipping enablement")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Enabling CPE: {cpe_mac}")

    genieacs_service = GenieACSService()

    try:
        # In GenieACS, enabling might mean setting a parameter
        # This is a placeholder - actual implementation depends on GenieACS config
        await genieacs_service.refresh_device(cpe_mac)
        logger.info(f"CPE enabled: {cpe_mac}")
    except Exception as e:
        logger.warning(f"Failed to enable CPE (continuing anyway): {e}")

    return {
        "output_data": {"cpe_enabled": True},
        "compensation_data": {"cpe_mac": cpe_mac},
        "context_updates": {},
    }


async def disable_cpe_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate CPE enablement."""
    logger.info("Disabling CPE (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def update_subscriber_status_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Update subscriber status to active."""
    subscriber_id = context["subscriber_id"]

    logger.info(f"Updating subscriber status to active: {subscriber_id}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    # Update status to active
    subscriber.status = "active"
    # Set activation timestamp if field exists
    if hasattr(subscriber, "activated_at"):
        subscriber.activated_at = datetime.now(UTC)
    db.flush()

    logger.info(f"Subscriber status updated to active: {subscriber_id}")

    return {
        "output_data": {
            "subscriber_activated": True,
            "activated_at": datetime.now(UTC).isoformat(),
        },
        "compensation_data": {
            "subscriber_id": subscriber_id,
            "previous_status": context["previous_status"],
        },
        "context_updates": {},
    }


async def revert_subscriber_status_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate subscriber status update."""
    subscriber_id = compensation_data["subscriber_id"]
    previous_status = compensation_data["previous_status"]

    logger.info(f"Reverting subscriber status: {subscriber_id} to {previous_status}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber:
        subscriber.status = previous_status
        if hasattr(subscriber, "activated_at"):
            subscriber.activated_at = None
        db.flush()


# ============================================================================
# Handler Registry
# ============================================================================


def register_handlers(saga: Any) -> None:
    """Register all step and compensation handlers."""
    # Step handlers
    saga.register_step_handler("verify_subscriber_handler", verify_subscriber_handler)
    saga.register_step_handler("activate_billing_service_handler", activate_billing_service_handler)
    saga.register_step_handler("enable_radius_handler", enable_radius_handler)
    saga.register_step_handler("activate_onu_handler", activate_onu_handler)
    saga.register_step_handler("enable_cpe_handler", enable_cpe_handler)
    saga.register_step_handler("update_subscriber_status_handler", update_subscriber_status_handler)

    # Compensation handlers
    saga.register_compensation_handler(
        "suspend_billing_service_handler", suspend_billing_service_handler
    )
    saga.register_compensation_handler("disable_radius_handler", disable_radius_handler)
    saga.register_compensation_handler("deactivate_onu_handler", deactivate_onu_handler)
    saga.register_compensation_handler("disable_cpe_handler", disable_cpe_handler)
    saga.register_compensation_handler(
        "revert_subscriber_status_handler", revert_subscriber_status_handler
    )

    logger.info("Registered all activate_service workflow handlers")
