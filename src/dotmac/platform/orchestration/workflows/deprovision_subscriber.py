"""
Subscriber Deprovisioning Workflow

Atomic multi-system subscriber deprovisioning with proper cleanup order.

Workflow Steps:
1. Suspend billing service (prevent new charges)
2. Deactivate ONU in VOLTHA
3. Unconfigure CPE in GenieACS
4. Release IP address in NetBox
5. Delete RADIUS authentication account
6. Delete network profile (soft delete, preserves audit trail)
7. Archive subscriber record (soft delete)

Cleanup Order: Reverse of provisioning to ensure proper cleanup.
"""

# mypy: disable-error-code="attr-defined,assignment,arg-type,union-attr,call-arg"

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from ...billing.core.entities import ServiceEntity
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


def get_deprovision_subscriber_workflow() -> WorkflowDefinition:
    """Get the subscriber deprovisioning workflow definition."""
    return WorkflowDefinition(
        workflow_type=WorkflowType.DEPROVISION_SUBSCRIBER,
        description="Atomic subscriber deprovisioning across all systems",
        steps=[
            StepDefinition(
                step_name="verify_subscriber",
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
                required=False,  # Can continue even if billing fails
            ),
            StepDefinition(
                step_name="deactivate_onu",
                step_type="api",
                target_system="voltha",
                handler="deactivate_onu_handler",
                compensation_handler="reactivate_onu_handler",
                max_retries=3,
                timeout_seconds=60,
                required=False,  # Can continue if ONU already offline
            ),
            StepDefinition(
                step_name="unconfigure_cpe",
                step_type="api",
                target_system="genieacs",
                handler="unconfigure_cpe_handler",
                compensation_handler="reconfigure_cpe_handler",
                max_retries=3,
                timeout_seconds=45,
                required=False,  # Can continue if CPE not found
            ),
            StepDefinition(
                step_name="revoke_ipv6_lifecycle",
                step_type="database",
                target_system="database",
                handler="revoke_ipv6_lifecycle_handler",
                compensation_handler="reactivate_ipv6_lifecycle_handler",
                max_retries=3,
                timeout_seconds=15,
                required=False,  # Optional Phase 4 enhancement
            ),
            StepDefinition(
                step_name="revoke_ipv4_lifecycle",
                step_type="database",
                target_system="database",
                handler="revoke_ipv4_lifecycle_handler",
                compensation_handler="reactivate_ipv4_lifecycle_handler",
                max_retries=3,
                timeout_seconds=15,
                required=False,  # Optional Phase 5 enhancement
            ),
            StepDefinition(
                step_name="release_ip_address",
                step_type="api",
                target_system="netbox",
                handler="release_ip_handler",
                compensation_handler="reallocate_ip_handler",
                max_retries=3,
                timeout_seconds=30,
                required=False,  # Can continue if IP not found
            ),
            StepDefinition(
                step_name="delete_radius_account",
                step_type="api",
                target_system="radius",
                handler="delete_radius_account_handler",
                compensation_handler="recreate_radius_account_handler",
                max_retries=3,
                timeout_seconds=30,
                required=False,  # Can continue if RADIUS account not found
            ),
            StepDefinition(
                step_name="delete_network_profile",
                step_type="database",
                target_system="database",
                handler="delete_network_profile_handler",
                compensation_handler="restore_network_profile_handler",
                max_retries=3,
                timeout_seconds=10,
                required=False,  # Can continue if network profile not found
            ),
            StepDefinition(
                step_name="archive_subscriber",
                step_type="database",
                target_system="database",
                handler="archive_subscriber_handler",
                compensation_handler="restore_subscriber_handler",
                max_retries=3,
                timeout_seconds=10,
                required=True,  # Must archive subscriber
            ),
        ],
        max_retries=1,  # Limited retries for deprovisioning
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
    Verify subscriber exists and get current configuration.

    This step collects information needed for cleanup.
    """
    logger.info("Verifying subscriber for deprovisioning")

    subscriber_id = input_data["subscriber_id"]

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    if subscriber.status == "archived":
        raise ValueError(f"Subscriber already archived: {subscriber_id}")

    logger.info(f"Verified subscriber: {subscriber.id} ({subscriber.subscriber_id})")

    # Store configuration for cleanup
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
            "onu_serial": subscriber.ont_serial_number,
            "cpe_mac": subscriber.ont_mac_address,  # Assuming CPE MAC stored here
            "previous_status": subscriber.status,
        },
    }


async def suspend_billing_service_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Suspend billing service before deprovisioning."""
    logger.info("Suspending billing service")

    # Find and suspend service by subscriber_id
    service = (
        db.query(ServiceEntity)
        .filter(ServiceEntity.subscriber_id == context["subscriber_id"])
        .first()
    )

    if service:
        service.status = "suspended"
        service.suspended_at = datetime.now(UTC)
        service.suspension_reason = input_data.get("reason", "Deprovisioning")
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
            db.flush()
            logger.info(f"Billing service reactivated: {service_id}")


async def deactivate_onu_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Deactivate ONU in VOLTHA."""
    onu_serial = context.get("onu_serial")
    if not onu_serial:
        logger.info("No ONU serial found, skipping deactivation")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Deactivating ONU: {onu_serial}")

    voltha_service = VOLTHAService()

    try:
        await voltha_service.deactivate_onu_by_serial(onu_serial)
        logger.info(f"ONU deactivated: {onu_serial}")
    except Exception as e:
        logger.warning(f"Failed to deactivate ONU (continuing anyway): {e}")

    return {
        "output_data": {"onu_deactivated": True},
        "compensation_data": {"onu_serial": onu_serial},
        "context_updates": {},
    }


async def reactivate_onu_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate ONU deactivation."""
    logger.info("Reactivating ONU (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def unconfigure_cpe_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Unconfigure CPE in GenieACS."""
    cpe_mac = context.get("cpe_mac")
    if not cpe_mac:
        logger.info("No CPE MAC found, skipping unconfiguration")
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Unconfiguring CPE: {cpe_mac}")

    genieacs_service = GenieACSService()

    try:
        await genieacs_service.delete_device(cpe_mac)
        logger.info(f"CPE unconfigured: {cpe_mac}")
    except Exception as e:
        logger.warning(f"Failed to unconfigure CPE (continuing anyway): {e}")

    return {
        "output_data": {"cpe_unconfigured": True},
        "compensation_data": {"cpe_mac": cpe_mac},
        "context_updates": {},
    }


async def reconfigure_cpe_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate CPE unconfiguration."""
    logger.info("Reconfiguring CPE (compensation)")
    # Partial compensation - may require manual intervention
    pass


async def release_ip_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Release IP address in NetBox."""
    subscriber_id = context["subscriber_id"]

    logger.info(f"Releasing IP for subscriber: {subscriber_id}")

    netbox_service = NetBoxService()

    try:
        released = await netbox_service.release_subscriber_ip(subscriber_id)
        logger.info(f"IP released: {released}")
    except Exception as e:
        logger.warning(f"Failed to release IP (continuing anyway): {e}")

    return {
        "output_data": {"ip_released": True},
        "compensation_data": {"subscriber_id": subscriber_id},
        "context_updates": {},
    }


async def reallocate_ip_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate IP release."""
    logger.info("Reallocating IP (compensation)")
    # Partial compensation - new IP will be allocated if needed
    pass


async def delete_radius_account_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Delete RADIUS authentication account."""
    from dotmac.platform.settings import settings

    # Check if RADIUS is enabled
    if not settings.features.radius_enabled:
        logger.info("RADIUS is disabled, skipping RADIUS account deletion")
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
    logger.info(f"Deleting RADIUS account for subscriber: {subscriber_id}")

    radius_service = RADIUSService(db, tenant_id)

    try:
        deleted = await radius_service.delete_subscriber_by_id(subscriber_id)
        logger.info(f"RADIUS account deleted: {deleted}")
    except Exception as e:
        logger.warning(f"Failed to delete RADIUS account (continuing anyway): {e}")

    return {
        "output_data": {"radius_deleted": True},
        "compensation_data": {"subscriber_id": subscriber_id, "tenant_id": tenant_id},
        "context_updates": {},
    }


async def recreate_radius_account_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate RADIUS account deletion."""
    logger.info("Recreating RADIUS account (compensation)")
    # Partial compensation - requires subscriber details
    pass


async def delete_network_profile_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Delete (soft-delete) network profile to preserve audit trail."""
    subscriber_id = context["subscriber_id"]

    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")
    if not tenant_id:
        # Try to get tenant from subscriber
        subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
        if subscriber:
            tenant_id = subscriber.tenant_id

    if not tenant_id:
        logger.warning(
            f"Cannot delete network profile without tenant_id for subscriber {subscriber_id}"
        )
        return {
            "output_data": {"skipped": True},
            "compensation_data": {},
            "context_updates": {},
        }

    logger.info(f"Deleting network profile for subscriber: {subscriber_id}")

    profile_service = SubscriberNetworkProfileService(db, tenant_id)

    try:
        profile = await profile_service.get_by_subscriber_id(subscriber_id)
        if profile:
            # Soft delete the profile (preserves audit trail)
            await profile_service.delete_profile(subscriber_id)
            logger.info(
                f"Network profile deleted for subscriber {subscriber_id} "
                f"(VLAN: {profile.service_vlan}, profile ID: {profile.id})"
            )
            return {
                "output_data": {"network_profile_deleted": True},
                "compensation_data": {
                    "subscriber_id": subscriber_id,
                    "tenant_id": tenant_id,
                    "profile_id": str(profile.id),
                },
                "context_updates": {},
            }
        else:
            logger.info(f"No network profile found for subscriber {subscriber_id}")
            return {
                "output_data": {"skipped": True},
                "compensation_data": {},
                "context_updates": {},
            }
    except Exception as e:
        logger.warning(f"Failed to delete network profile (continuing anyway): {e}")
        return {
            "output_data": {"skipped": True, "error": str(e)},
            "compensation_data": {},
            "context_updates": {},
        }


async def restore_network_profile_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate network profile deletion (restore from soft delete)."""
    if compensation_data.get("skipped"):
        return

    logger.info("Restoring network profile (compensation)")
    # TODO: Implement restore from soft delete if needed
    # For now, network profile restore requires manual intervention
    pass


async def archive_subscriber_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """Archive subscriber record (soft delete)."""
    subscriber_id = context["subscriber_id"]

    logger.info(f"Archiving subscriber: {subscriber_id}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not subscriber:
        raise ValueError(f"Subscriber not found: {subscriber_id}")

    # Soft delete - change status to archived
    subscriber.status = "archived"
    subscriber.archived_at = datetime.now()
    subscriber.archived_reason = input_data.get("reason", "Deprovisioned")
    db.flush()

    logger.info(f"Subscriber archived: {subscriber_id}")

    return {
        "output_data": {
            "subscriber_archived": True,
            "archived_at": subscriber.archived_at.isoformat(),
        },
        "compensation_data": {
            "subscriber_id": subscriber_id,
            "previous_status": context["previous_status"],
        },
        "context_updates": {},
    }


async def restore_subscriber_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """Compensate subscriber archival."""
    subscriber_id = compensation_data["subscriber_id"]
    previous_status = compensation_data["previous_status"]

    logger.info(f"Restoring subscriber: {subscriber_id}")

    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber:
        subscriber.status = previous_status
        subscriber.archived_at = None
        subscriber.archived_reason = None
        db.flush()


async def revoke_ipv6_lifecycle_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Revoke IPv6 lifecycle state during deprovisioning (Phase 4).

    Transitions: ACTIVE -> REVOKING -> REVOKED

    This step releases the IPv6 prefix back to NetBox and clears lifecycle state.
    """
    from ...network.ipv6_lifecycle_service import IPv6LifecycleService

    subscriber_id = context.get("subscriber_id")
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

    # Check if subscriber has IPv6 prefix to revoke
    ipv6_prefix = context.get("delegated_ipv6_prefix") or context.get("ipv6_prefix")

    if not ipv6_prefix:
        logger.info(
            f"No IPv6 prefix found for subscriber {subscriber_id}, skipping IPv6 lifecycle revocation"
        )
        return {
            "output_data": {"skipped": True, "reason": "no_ipv6_prefix"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing subscriber_id or tenant_id for IPv6 lifecycle revocation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return {
            "output_data": {"skipped": True, "reason": "missing_ids"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    try:
        logger.info(f"Revoking IPv6 lifecycle for subscriber {subscriber_id}: prefix={ipv6_prefix}")

        service = IPv6LifecycleService(db, tenant_id)

        # Revoke IPv6 prefix (ACTIVE -> REVOKING -> REVOKED)
        result = await service.revoke_ipv6(
            subscriber_id=subscriber_id,
            username=context.get("radius_username"),
            nas_ip=None,  # Could be added if NAS info is in context
            send_disconnect=True,  # Send RADIUS disconnect during deprovisioning
            release_to_netbox=True,  # Release prefix back to NetBox pool
            commit=True,
        )

        logger.info(
            f"IPv6 lifecycle revoked: subscriber={subscriber_id}, "
            f"prefix={result.get('prefix')}, state={result.get('state')}"
        )

        return {
            "output_data": {
                "ipv6_lifecycle_revoked": True,
                "ipv6_state": str(result.get("state")),
                "ipv6_revoked_at": str(result.get("revoked_at")),
                "prefix_released_to_netbox": True,
            },
            "compensation_data": {
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv6_prefix": result.get("prefix"),
                "previous_state": str(result.get("previous_state")),
            },
            "context_updates": {
                "ipv6_lifecycle_state": str(result.get("state")),
            },
        }

    except Exception as e:
        # Log error but don't fail deprovisioning - IPv6 lifecycle is optional
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
        return {
            "output_data": {
                "skipped": True,
                "reason": "revocation_error",
                "error": str(e),
            },
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }


async def reactivate_ipv6_lifecycle_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """
    Compensate IPv6 lifecycle revocation by reactivating (Phase 4).

    Transitions: REVOKED -> ACTIVE (best effort)
    """
    from ...network.ipv6_lifecycle_service import IPv6LifecycleService

    if compensation_data.get("skipped"):
        logger.info("Skipping IPv6 lifecycle reactivation (was not revoked)")
        return

    subscriber_id = compensation_data.get("subscriber_id")
    tenant_id = compensation_data.get("tenant_id")
    ipv6_prefix = compensation_data.get("ipv6_prefix")
    previous_state = compensation_data.get("previous_state")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing data for IPv6 lifecycle reactivation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return

    try:
        logger.info(
            f"Attempting to reactivate IPv6 lifecycle for subscriber {subscriber_id}: "
            f"prefix={ipv6_prefix}, previous_state={previous_state}"
        )

        IPv6LifecycleService(db, tenant_id)

        # Note: This is best-effort compensation. The prefix was already released
        # to NetBox, so we can only restore the database state, not the allocation.
        # In a real compensation scenario, you might need to re-allocate from NetBox.

        # For now, just log that compensation is needed but can't be fully done
        logger.warning(
            f"IPv6 lifecycle revocation cannot be fully compensated - "
            f"prefix {ipv6_prefix} was already released to NetBox. "
            f"Manual intervention may be required for subscriber {subscriber_id}."
        )

    except Exception as e:
        # Log error but don't fail compensation - best effort
        logger.error(
            f"Failed to reactivate IPv6 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv6_lifecycle.reactivation_failed",
                "subscriber_id": subscriber_id,
                "tenant_id": tenant_id,
                "ipv6_prefix": ipv6_prefix,
                "error": str(e),
            },
        )


async def revoke_ipv4_lifecycle_handler(
    input_data: dict[str, Any],
    context: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    """
    Revoke IPv4 lifecycle state during deprovisioning (Phase 5).

    Transitions: ACTIVE -> REVOKING -> REVOKED

    This step releases the IPv4 address back to the pool and clears lifecycle state.
    """
    from uuid import UUID

    from ...network.ipv4_lifecycle_service import IPv4LifecycleService

    subscriber_id = context.get("subscriber_id")
    tenant_id = context.get("tenant_id") or input_data.get("tenant_id")

    # Check if subscriber has IPv4 address to revoke
    ipv4_address = context.get("static_ipv4_address") or context.get("ipv4_address")

    if not ipv4_address:
        logger.info(
            f"No static IPv4 address found for subscriber {subscriber_id}, skipping IPv4 lifecycle revocation"
        )
        return {
            "output_data": {"skipped": True, "reason": "no_ipv4_address"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing subscriber_id or tenant_id for IPv4 lifecycle revocation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return {
            "output_data": {"skipped": True, "reason": "missing_ids"},
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }

    try:
        logger.info(
            f"Revoking IPv4 lifecycle for subscriber {subscriber_id}: address={ipv4_address}"
        )

        service = IPv4LifecycleService(db, tenant_id)

        # Convert subscriber_id to UUID
        subscriber_uuid = UUID(subscriber_id) if isinstance(subscriber_id, str) else subscriber_id

        # Revoke IPv4 address (ACTIVE -> REVOKING -> REVOKED)
        result = await service.revoke(
            subscriber_id=subscriber_uuid,
            username=context.get("radius_username"),
            nas_ip=None,  # Could be added if NAS info is in context
            send_disconnect=True,  # Send RADIUS disconnect during deprovisioning
            release_to_pool=True,  # Release address back to pool
            update_netbox=True,  # Update NetBox if available
            commit=True,
        )

        logger.info(
            f"IPv4 lifecycle revoked: subscriber={subscriber_id}, "
            f"address={result.address}, state={result.state}"
        )

        return {
            "output_data": {
                "ipv4_lifecycle_revoked": True,
                "ipv4_state": result.state.value,
                "ipv4_revoked_at": result.revoked_at.isoformat() if result.revoked_at else None,
                "address_released_to_pool": True,
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
        # Log error but don't fail deprovisioning - IPv4 lifecycle is optional
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
        return {
            "output_data": {
                "skipped": True,
                "reason": "revocation_error",
                "error": str(e),
            },
            "compensation_data": {"skipped": True},
            "context_updates": {},
        }


async def reactivate_ipv4_lifecycle_handler(
    step_data: dict[str, Any],
    compensation_data: dict[str, Any],
    db: Session,
) -> None:
    """
    Compensate IPv4 lifecycle revocation by reactivating (Phase 5).

    Transitions: REVOKED -> ACTIVE (best effort)
    """
    from ...network.ipv4_lifecycle_service import IPv4LifecycleService

    if compensation_data.get("skipped"):
        logger.info("Skipping IPv4 lifecycle reactivation (was not revoked)")
        return

    subscriber_id = compensation_data.get("subscriber_id")
    tenant_id = compensation_data.get("tenant_id")
    ipv4_address = compensation_data.get("ipv4_address")

    if not subscriber_id or not tenant_id:
        logger.warning(
            f"Missing data for IPv4 lifecycle reactivation: "
            f"subscriber_id={subscriber_id}, tenant_id={tenant_id}"
        )
        return

    try:
        logger.info(
            f"Attempting to reactivate IPv4 lifecycle for subscriber {subscriber_id}: "
            f"address={ipv4_address}"
        )

        IPv4LifecycleService(db, tenant_id)

        # Note: This is best-effort compensation. The address was already released
        # to the pool, so we can only restore the database state, not the allocation.
        # In a real compensation scenario, you might need to re-allocate from the pool.

        # For now, just log that compensation is needed but can't be fully done
        logger.warning(
            f"IPv4 lifecycle revocation cannot be fully compensated - "
            f"address {ipv4_address} was already released to pool. "
            f"Manual intervention may be required for subscriber {subscriber_id}."
        )

    except Exception as e:
        # Log error but don't fail compensation - best effort
        logger.error(
            f"Failed to reactivate IPv4 lifecycle for subscriber {subscriber_id}: {e}",
            exc_info=True,
            extra={
                "event": "ipv4_lifecycle.reactivation_failed",
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
    saga.register_step_handler("verify_subscriber_handler", verify_subscriber_handler)
    saga.register_step_handler("suspend_billing_service_handler", suspend_billing_service_handler)
    saga.register_step_handler("deactivate_onu_handler", deactivate_onu_handler)
    saga.register_step_handler("unconfigure_cpe_handler", unconfigure_cpe_handler)
    saga.register_step_handler("revoke_ipv6_lifecycle_handler", revoke_ipv6_lifecycle_handler)
    saga.register_step_handler("revoke_ipv4_lifecycle_handler", revoke_ipv4_lifecycle_handler)
    saga.register_step_handler("release_ip_handler", release_ip_handler)
    saga.register_step_handler("delete_radius_account_handler", delete_radius_account_handler)
    saga.register_step_handler("delete_network_profile_handler", delete_network_profile_handler)
    saga.register_step_handler("archive_subscriber_handler", archive_subscriber_handler)

    # Compensation handlers
    saga.register_compensation_handler(
        "reactivate_billing_service_handler", reactivate_billing_service_handler
    )
    saga.register_compensation_handler("reactivate_onu_handler", reactivate_onu_handler)
    saga.register_compensation_handler("reconfigure_cpe_handler", reconfigure_cpe_handler)
    saga.register_compensation_handler(
        "reactivate_ipv6_lifecycle_handler", reactivate_ipv6_lifecycle_handler
    )
    saga.register_compensation_handler(
        "reactivate_ipv4_lifecycle_handler", reactivate_ipv4_lifecycle_handler
    )
    saga.register_compensation_handler("reallocate_ip_handler", reallocate_ip_handler)
    saga.register_compensation_handler(
        "recreate_radius_account_handler", recreate_radius_account_handler
    )
    saga.register_compensation_handler(
        "restore_network_profile_handler", restore_network_profile_handler
    )
    saga.register_compensation_handler("restore_subscriber_handler", restore_subscriber_handler)

    logger.info("Registered all deprovision_subscriber workflow handlers")
