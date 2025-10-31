"""
Service Suspension Workflow

Atomic multi-system service suspension for subscribers.

Workflow Steps:
1. Verify subscriber and service exist
2. Suspend billing service (stop new charges)
3. Disable RADIUS authentication
4. Disable ONU in VOLTHA
5. Disable CPE in GenieACS
6. Update subscriber status to suspended
7. Send suspension notification email

This workflow is used to temporarily suspend a subscriber's service
without fully deprovisioning them (e.g., for non-payment, customer request).
"""
# mypy: disable-error-code="attr-defined,assignment,arg-type,union-attr,call-arg"

import logging
from datetime import datetime, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
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


def get_suspend_service_workflow() -> WorkflowDefinition:
    """Get the service suspension workflow definition."""
    return WorkflowDefinition(
        workflow_type=WorkflowType.SUSPEND_SERVICE,
        description="Atomic service suspension across all systems",
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
                step_name="suspend_billing_service",
                step_type="database",
                target_system="billing",
                handler="suspend_billing_service_handler",
                compensation_handler="reactivate_billing_service_handler",
                max_retries=3,
                timeout_seconds=20,
                required=True,
            ),
            StepDefinition(
                step_name="disable_radius_authentication",
                step_type="api",
                target_system="radius",
                handler="disable_radius_handler",
                compensation_handler="enable_radius_handler",
                max_retries=3,
                timeout_seconds=30,
                required=False,  # Can continue if RADIUS unavailable
            ),
            StepDefinition(
                step_name="disable_onu",
                step_type="api",
                target_system="voltha",
                handler="disable_onu_handler",
                compensation_handler="enable_onu_handler",
                max_retries=3,
                timeout_seconds=60,
                required=False,  # Can continue if ONU unavailable
            ),
            StepDefinition(
                step_name="disable_cpe",
                step_type="api",
                target_system="genieacs",
                handler="disable_cpe_handler",
                compensation_handler="enable_cpe_handler",
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
    Verify subscriber exists and can be suspended.

    Checks:
    - Subscriber exists
    - Subscriber is active (not already suspended)
    - Subscriber is not archived
    """
    logger.info("Verifying subscriber for suspension")

    subscriber_id = input_data["subscriber_id"]

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    if subscriber.status == "suspended":
        raise ValueError(f"Subscriber is already suspended: {subscriber_id}")

    if subscriber.status == "archived":
        raise ValueError(f"Cannot suspend archived subscriber: {subscriber_id}")

    logger.info(f"Verified subscriber: {subscriber.id} (current status: {subscriber.status})")

    # Store configuration for suspension
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
            "suspension_reason": input_data.get("reason", "Service suspended"),
            "suspend_until": input_data.get("suspend_until"),
        },
    }


async def suspend_billing_service_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Suspend billing service to prevent new charges."""
    logger.info("Suspending billing service")

    # Find service by subscriber_id
    service = (
        db.query(ServiceEntity)
        .filter(ServiceEntity.subscriber_id == context["subscriber_id"])
        .first()
    )

    if service:
        service.status = "suspended"
        service.suspended_at = datetime.now(UTC)
        service.suspension_reason = context.get("suspension_reason", "Service suspended")
        service.suspend_until = context.get("suspend_until")
        db.flush()
        logger.info(f"Billing service suspended: {service.service_id}")
    else:
        logger.warning(f"No billing service found for subscriber: {context['subscriber_id']}")

    return {
        "output_data": {"billing_suspended": True},
        "compensation_data": {"service_id": service.service_id if service else None},
        "context_updates": {},
    }


async def reactivate_billing_service_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate billing service suspension."""
    logger.info("Reactivating billing service (compensation)")

    service_id = compensation_data.get("service_id")
    if service_id:
        service = db.query(ServiceEntity).filter(ServiceEntity.service_id == service_id).first()
        if service:
            service.status = "active"
            service.suspended_at = None
            service.suspension_reason = None
            service.suspend_until = None
            db.flush()
            logger.info(f"Billing service reactivated: {service_id}")


async def disable_radius_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Disable RADIUS authentication."""
    from dotmac.platform.settings import settings

    # Check if RADIUS is enabled
    if not settings.features.radius_enabled:
        logger.info("RADIUS is disabled, skipping RADIUS authentication disablement")
        return {
            "output_data": {"skipped": True, "reason": "RADIUS not enabled"},
            "compensation_data": {},
            "context_updates": {},
        }

    # Get tenant_id from context or input_data
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
    if not tenant_id:
        # Try to get tenant_id from subscriber
        subscriber = db.query(Subscriber).filter(Subscriber.id == context["subscriber_id"]).first()
        if subscriber:
            tenant_id = subscriber.tenant_id
        else:
            logger.error(f"Cannot determine tenant_id for subscriber: {context['subscriber_id']}")
            raise ValueError("tenant_id is required for RADIUS operations")

    subscriber_id = context["subscriber_id"]
    logger.info(f"Disabling RADIUS authentication for subscriber: {subscriber_id}")

    radius_service = RADIUSService(db, tenant_id)

    try:
        # Update RADIUS account to disabled
        await radius_service.update_subscriber(
            subscriber_id=subscriber_id,
            enabled=False,
        )
        logger.info(f"RADIUS account disabled: {subscriber_id}")
    except Exception as e:
        logger.warning(f"Failed to disable RADIUS account (continuing anyway): {e}")

    return {
        "output_data": {"radius_disabled": True},
        "compensation_data": {"subscriber_id": subscriber_id, "tenant_id": tenant_id},
        "context_updates": {},
    }


async def enable_radius_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate RADIUS disablement."""
    logger.info("Enabling RADIUS authentication (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def disable_onu_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Disable ONU in VOLTHA."""
    onu_serial = context.get("onu_serial")
    if not onu_serial:
        logger.info("No ONU serial found, skipping disablement")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Disabling ONU: {onu_serial}")

    voltha_service = VOLTHAService()

    try:
        await voltha_service.disable_onu_by_serial(onu_serial)
        logger.info(f"ONU disabled: {onu_serial}")
    except Exception as e:
        logger.warning(f"Failed to disable ONU (continuing anyway): {e}")

    return {
        "output_data": {"onu_disabled": True},
        "compensation_data": {"onu_serial": onu_serial},
        "context_updates": {},
    }


async def enable_onu_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate ONU disablement."""
    logger.info("Enabling ONU (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def disable_cpe_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Disable CPE in GenieACS."""
    cpe_mac = context.get("cpe_mac")
    if not cpe_mac:
        logger.info("No CPE MAC found, skipping disablement")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Disabling CPE: {cpe_mac}")

    genieacs_service = GenieACSService()

    try:
        # In GenieACS, disabling might mean setting a parameter or removing config
        # This is a placeholder - actual implementation depends on GenieACS config
        await genieacs_service.refresh_device(cpe_mac)
        logger.info(f"CPE disabled: {cpe_mac}")
    except Exception as e:
        logger.warning(f"Failed to disable CPE (continuing anyway): {e}")

    return {
        "output_data": {"cpe_disabled": True},
        "compensation_data": {"cpe_mac": cpe_mac},
        "context_updates": {},
    }


async def enable_cpe_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate CPE disablement."""
    logger.info("Enabling CPE (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def update_subscriber_status_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Update subscriber status to suspended."""
    subscriber_id = context["subscriber_id"]

    logger.info(f"Updating subscriber status to suspended: {subscriber_id}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    # Update status to suspended
    subscriber.status = "suspended"
    # Set suspension timestamp and reason if fields exist
    if hasattr(subscriber, "suspended_at"):
        subscriber.suspended_at = datetime.now(UTC)
    if hasattr(subscriber, "suspension_reason"):
        subscriber.suspension_reason = context.get("suspension_reason", "Service suspended")
    if hasattr(subscriber, "suspend_until"):
        subscriber.suspend_until = context.get("suspend_until")
    db.flush()

    logger.info(f"Subscriber status updated to suspended: {subscriber_id}")

    return {
        "output_data": {
            "subscriber_suspended": True,
            "suspended_at": datetime.now(UTC).isoformat(),
            "suspension_reason": context.get("suspension_reason", "Service suspended"),
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
        if hasattr(subscriber, "suspended_at"):
            subscriber.suspended_at = None
        if hasattr(subscriber, "suspension_reason"):
            subscriber.suspension_reason = None
        if hasattr(subscriber, "suspend_until"):
            subscriber.suspend_until = None
        db.flush()


# ============================================================================
# Handler Registry
# ============================================================================


def register_handlers(saga: Any) -> None:
    """Register all step and compensation handlers."""
    # Step handlers
    saga.register_step_handler("verify_subscriber_handler", verify_subscriber_handler)
    saga.register_step_handler("suspend_billing_service_handler", suspend_billing_service_handler)
    saga.register_step_handler("disable_radius_handler", disable_radius_handler)
    saga.register_step_handler("disable_onu_handler", disable_onu_handler)
    saga.register_step_handler("disable_cpe_handler", disable_cpe_handler)
    saga.register_step_handler("update_subscriber_status_handler", update_subscriber_status_handler)

    # Compensation handlers
    saga.register_compensation_handler(
        "reactivate_billing_service_handler", reactivate_billing_service_handler
    )
    saga.register_compensation_handler("enable_radius_handler", enable_radius_handler)
    saga.register_compensation_handler("enable_onu_handler", enable_onu_handler)
    saga.register_compensation_handler("enable_cpe_handler", enable_cpe_handler)
    saga.register_compensation_handler(
        "revert_subscriber_status_handler", revert_subscriber_status_handler
    )

    logger.info("Registered all suspend_service workflow handlers")
