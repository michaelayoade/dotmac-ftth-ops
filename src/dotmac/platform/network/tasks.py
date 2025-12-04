"""
IPv6 Lifecycle Background Tasks (Phase 4).

Periodic tasks for IPv6 prefix lifecycle management and cleanup.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from celery import shared_task
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from dotmac.platform.ip_management.models import IPPoolStatus, IPReservationStatus
from dotmac.platform.network.ipv6_lifecycle_service import IPv6LifecycleService
from dotmac.platform.network.models import IPv6LifecycleState, SubscriberNetworkProfile
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


@shared_task(name="network.cleanup_ipv6_stale_prefixes")
def cleanup_ipv6_stale_prefixes() -> dict[str, int]:
    """
    Cleanup stale IPv6 prefix lifecycle entries.

    Runs daily to:
    1. Delete REVOKED entries older than 90 days (audit cleanup)
    2. Detect and alert on prefixes stuck in ALLOCATED for >24 hours
    3. Detect and alert on prefixes stuck in REVOKING for >1 hour
    4. Emit metrics for IPv6 prefix leaks

    Returns:
        Dict with cleanup statistics
    """
    import asyncio

    return asyncio.run(_cleanup_ipv6_stale_prefixes_async())


async def _cleanup_ipv6_stale_prefixes_async() -> dict[str, int]:
    """Async implementation of IPv6 cleanup task."""
    logger.info("Starting IPv6 lifecycle stale prefix cleanup")

    # Create async engine for this task
    engine = create_async_engine(
        settings.database.sqlalchemy_url,
        echo=False,
        pool_pre_ping=True,
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    stats = {
        "revoked_deleted": 0,
        "allocated_stale": 0,
        "revoking_stuck": 0,
        "errors": 0,
    }

    try:
        async with async_session() as session:
            # 1. Delete REVOKED entries older than 90 days (audit cleanup)
            revoked_cutoff = datetime.now(UTC) - timedelta(days=90)

            stmt_delete_old_revoked = select(SubscriberNetworkProfile).where(
                SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.REVOKED,
                SubscriberNetworkProfile.ipv6_revoked_at < revoked_cutoff,
            )
            result = await session.execute(stmt_delete_old_revoked)
            old_revoked = result.scalars().all()

            for profile in old_revoked:
                # Just clear lifecycle fields, don't delete profile
                profile.ipv6_state = IPv6LifecycleState.PENDING
                profile.ipv6_allocated_at = None
                profile.ipv6_activated_at = None
                profile.ipv6_revoked_at = None
                profile.ipv6_netbox_prefix_id = None
                stats["revoked_deleted"] += 1

            logger.info(
                f"Cleaned up {stats['revoked_deleted']} old REVOKED IPv6 entries (>90 days)"
            )

            # 2. Detect prefixes stuck in ALLOCATED for >24 hours (possible leak)
            allocated_cutoff = datetime.now(UTC) - timedelta(hours=24)

            stmt_stale_allocated = select(SubscriberNetworkProfile).where(
                SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.ALLOCATED,
                SubscriberNetworkProfile.ipv6_allocated_at < allocated_cutoff,
            )
            result = await session.execute(stmt_stale_allocated)
            stale_allocated = result.scalars().all()

            stats["allocated_stale"] = len(stale_allocated)

            if stats["allocated_stale"] > 0:
                logger.warning(
                    f"Found {stats['allocated_stale']} IPv6 prefixes stuck in ALLOCATED state for >24h",
                    extra={
                        "event": "ipv6_lifecycle.stale_allocated_detected",
                        "count": stats["allocated_stale"],
                        "subscriber_ids": [p.subscriber_id for p in stale_allocated],
                    },
                )

                # Emit alert metric for monitoring
                for profile in stale_allocated:
                    logger.error(
                        "IPv6 prefix leak detected",
                        extra={
                            "event": "ipv6_lifecycle.prefix_leak",
                            "subscriber_id": profile.subscriber_id,
                            "tenant_id": profile.tenant_id,
                            "prefix": profile.delegated_ipv6_prefix,
                            "allocated_at": profile.ipv6_allocated_at.isoformat()
                            if profile.ipv6_allocated_at
                            else None,
                            "hours_stuck": (
                                datetime.now(UTC) - profile.ipv6_allocated_at
                            ).total_seconds()
                            / 3600
                            if profile.ipv6_allocated_at
                            else None,
                        },
                    )

            # 3. Detect prefixes stuck in REVOKING for >1 hour (cleanup failed)
            revoking_cutoff = datetime.now(UTC) - timedelta(hours=1)

            stmt_stuck_revoking = select(SubscriberNetworkProfile).where(
                SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.REVOKING,
                SubscriberNetworkProfile.updated_at < revoking_cutoff,
            )
            result = await session.execute(stmt_stuck_revoking)
            stuck_revoking = result.scalars().all()

            stats["revoking_stuck"] = len(stuck_revoking)

            if stats["revoking_stuck"] > 0:
                logger.warning(
                    f"Found {stats['revoking_stuck']} IPv6 prefixes stuck in REVOKING state for >1h",
                    extra={
                        "event": "ipv6_lifecycle.stuck_revoking_detected",
                        "count": stats["revoking_stuck"],
                        "subscriber_ids": [p.subscriber_id for p in stuck_revoking],
                    },
                )

                # Attempt to complete revocation for stuck entries
                for profile in stuck_revoking:
                    try:
                        logger.info(
                            f"Attempting to complete stuck revocation for subscriber {profile.subscriber_id}"
                        )

                        # Create lifecycle service instance
                        service = IPv6LifecycleService(
                            session, profile.tenant_id, netbox_client=None
                        )

                        # Force complete revocation
                        await service.revoke_ipv6(
                            subscriber_id=profile.subscriber_id,
                            username=None,
                            nas_ip=None,
                            send_disconnect=False,  # Already sent
                            release_to_netbox=True,  # Try to release
                            commit=False,  # Will commit at end
                        )

                        logger.info(
                            f"Successfully completed stuck revocation for subscriber {profile.subscriber_id}"
                        )

                    except Exception as e:
                        logger.error(
                            f"Failed to complete stuck revocation for subscriber {profile.subscriber_id}: {e}",
                            exc_info=True,
                            extra={
                                "event": "ipv6_lifecycle.stuck_revocation_failed",
                                "subscriber_id": profile.subscriber_id,
                                "error": str(e),
                            },
                        )
                        stats["errors"] += 1

            await session.commit()

        logger.info(
            "IPv6 lifecycle cleanup completed",
            extra={
                "event": "ipv6_lifecycle.cleanup_completed",
                "stats": stats,
            },
        )

    except Exception as e:
        logger.error(
            f"IPv6 lifecycle cleanup failed: {e}",
            exc_info=True,
            extra={"event": "ipv6_lifecycle.cleanup_failed", "error": str(e)},
        )
        stats["errors"] += 1

    finally:
        await engine.dispose()

    return stats


@shared_task(name="network.emit_ipv6_metrics")
def emit_ipv6_metrics() -> dict[str, Any]:
    """
    Emit IPv6 lifecycle metrics for Prometheus.

    Runs every 5 minutes to update metrics gauges.

    Returns:
        Dict with metric counts
    """
    import asyncio

    return asyncio.run(_emit_ipv6_metrics_async())


async def _emit_ipv6_metrics_async() -> dict[str, Any]:
    """Async implementation of IPv6 metrics emission."""
    from dotmac.platform.network.ipv6_metrics import IPv6Metrics

    logger.debug("Emitting IPv6 lifecycle metrics")

    engine = create_async_engine(
        settings.database.sqlalchemy_url,
        echo=False,
        pool_pre_ping=True,
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    metrics: dict[str, Any] = {}

    try:
        async with async_session() as session:
            # Get metrics for all tenants
            metrics_service = IPv6Metrics(session, tenant_id=None)

            # Get state counts
            state_counts = await metrics_service.get_ipv6_state_counts()
            metrics["state_counts"] = state_counts

            # Get utilization stats
            utilization = await metrics_service.get_ipv6_utilization_stats()
            metrics["utilization"] = utilization

            # Get NetBox integration stats
            netbox_stats = await metrics_service.get_ipv6_netbox_integration_stats()
            metrics["netbox_integration"] = netbox_stats

            logger.debug(
                "IPv6 metrics emitted",
                extra={
                    "event": "ipv6_lifecycle.metrics_emitted",
                    "metrics": metrics,
                },
            )

    except Exception as e:
        logger.error(
            f"Failed to emit IPv6 metrics: {e}",
            exc_info=True,
            extra={"event": "ipv6_lifecycle.metrics_emission_failed", "error": str(e)},
        )

    finally:
        await engine.dispose()

    return metrics


# =============================================================================
# Phase 5: IPv4 Lifecycle Background Tasks
# =============================================================================


@shared_task(name="network.cleanup_ipv4_stale_reservations")
def cleanup_ipv4_stale_reservations() -> dict[str, int]:
    """
    Cleanup stale IPv4 address lifecycle entries.

    Runs daily to:
    1. Delete REVOKED entries older than 90 days (audit cleanup)
    2. Detect and alert on addresses stuck in ALLOCATED for >24 hours
    3. Auto-complete addresses stuck in REVOKING for >1 hour
    4. Emit metrics for IPv4 address leaks

    Returns:
        Dict with cleanup statistics
    """
    import asyncio

    return asyncio.run(_cleanup_ipv4_stale_reservations_async())


async def _cleanup_ipv4_stale_reservations_async() -> dict[str, int]:
    """Async implementation of IPv4 cleanup task."""
    from dotmac.platform.ip_management.models import IPReservation
    from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService

    logger.info("Starting IPv4 lifecycle stale reservation cleanup")

    # Create async engine for this task
    engine = create_async_engine(
        settings.database.sqlalchemy_url,
        echo=False,
        pool_pre_ping=True,
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    stats = {
        "revoked_deleted": 0,
        "allocated_stale": 0,
        "revoking_stuck": 0,
        "revoked_completed": 0,
        "errors": 0,
    }

    try:
        async with async_session() as session:
            # 1. Delete REVOKED entries older than 90 days (audit cleanup)
            revoked_cutoff = datetime.now(UTC) - timedelta(days=90)

            stmt_delete_old_revoked = select(IPReservation).where(
                IPReservation.lifecycle_state == "revoked",
                IPReservation.lifecycle_revoked_at < revoked_cutoff,
            )
            result = await session.execute(stmt_delete_old_revoked)
            old_revoked = result.scalars().all()

            for reservation in old_revoked:
                # Just clear lifecycle fields, don't delete reservation
                reservation.lifecycle_state = "pending"
                reservation.lifecycle_allocated_at = None
                reservation.lifecycle_activated_at = None
                reservation.lifecycle_suspended_at = None
                reservation.lifecycle_revoked_at = None
                reservation.lifecycle_metadata = {}
                reservation.status = IPReservationStatus.RELEASED  # Mark as available in pool
                stats["revoked_deleted"] += 1

            logger.info(
                f"Cleaned up {stats['revoked_deleted']} old REVOKED IPv4 entries (>90 days)"
            )

            # 2. Detect addresses stuck in ALLOCATED for >24 hours (possible leak)
            allocated_cutoff = datetime.now(UTC) - timedelta(hours=24)

            stmt_stale_allocated = select(IPReservation).where(
                IPReservation.lifecycle_state == "allocated",
                IPReservation.lifecycle_allocated_at < allocated_cutoff,
            )
            result = await session.execute(stmt_stale_allocated)
            stale_allocated = result.scalars().all()

            stats["allocated_stale"] = len(stale_allocated)

            if stats["allocated_stale"] > 0:
                logger.warning(
                    f"Found {stats['allocated_stale']} IPv4 addresses stuck in ALLOCATED state for >24h",
                    extra={
                        "event": "ipv4_lifecycle.stale_allocated_detected",
                        "count": stats["allocated_stale"],
                        "subscriber_ids": [r.subscriber_id for r in stale_allocated],
                    },
                )

                # Emit alert metric for monitoring
                for reservation in stale_allocated:
                    logger.error(
                        "IPv4 address leak detected",
                        extra={
                            "event": "ipv4_lifecycle.address_leak",
                            "subscriber_id": reservation.subscriber_id,
                            "tenant_id": reservation.tenant_id,
                            "address": reservation.ip_address,
                            "pool_id": reservation.pool_id,
                            "allocated_at": reservation.lifecycle_allocated_at.isoformat()
                            if reservation.lifecycle_allocated_at
                            else None,
                            "hours_stuck": (
                                datetime.now(UTC) - reservation.lifecycle_allocated_at
                            ).total_seconds()
                            / 3600
                            if reservation.lifecycle_allocated_at
                            else None,
                        },
                    )

            # 3. Detect addresses stuck in REVOKING for >1 hour (cleanup failed)
            revoking_cutoff = datetime.now(UTC) - timedelta(hours=1)

            stmt_stuck_revoking = select(IPReservation).where(
                IPReservation.lifecycle_state == "revoking",
                IPReservation.updated_at < revoking_cutoff,
            )
            result = await session.execute(stmt_stuck_revoking)
            stuck_revoking = result.scalars().all()

            stats["revoking_stuck"] = len(stuck_revoking)

            if stats["revoking_stuck"] > 0:
                logger.warning(
                    f"Found {stats['revoking_stuck']} IPv4 addresses stuck in REVOKING state for >1h",
                    extra={
                        "event": "ipv4_lifecycle.stuck_revoking_detected",
                        "count": stats["revoking_stuck"],
                        "subscriber_ids": [r.subscriber_id for r in stuck_revoking],
                    },
                )

                # Attempt to complete revocation for stuck entries
                for reservation in stuck_revoking:
                    try:
                        logger.info(
                            f"Attempting to complete stuck IPv4 revocation for subscriber {reservation.subscriber_id}"
                        )

                        # Create lifecycle service instance
                        service = IPv4LifecycleService(session, reservation.tenant_id)

                        # Force complete revocation
                        from uuid import UUID

                        await service.revoke(
                            subscriber_id=UUID(reservation.subscriber_id),
                            username=None,
                            nas_ip=None,
                            send_disconnect=False,  # Already sent
                            release_to_pool=True,  # Release to pool
                            update_netbox=False,  # Skip NetBox update
                            commit=False,  # Will commit at end
                        )

                        stats["revoked_completed"] += 1

                        logger.info(
                            f"Successfully completed stuck IPv4 revocation for subscriber {reservation.subscriber_id}"
                        )

                    except Exception as e:
                        logger.error(
                            f"Failed to complete stuck IPv4 revocation for subscriber {reservation.subscriber_id}: {e}",
                            exc_info=True,
                            extra={
                                "event": "ipv4_lifecycle.stuck_revocation_failed",
                                "subscriber_id": reservation.subscriber_id,
                                "error": str(e),
                            },
                        )
                        stats["errors"] += 1

            await session.commit()

        logger.info(
            "IPv4 lifecycle cleanup completed",
            extra={
                "event": "ipv4_lifecycle.cleanup_completed",
                "stats": stats,
            },
        )

    except Exception as e:
        logger.error(
            f"IPv4 lifecycle cleanup failed: {e}",
            exc_info=True,
            extra={"event": "ipv4_lifecycle.cleanup_failed", "error": str(e)},
        )
        stats["errors"] += 1

    finally:
        await engine.dispose()

    return stats


@shared_task(name="network.emit_ipv4_lifecycle_metrics")
def emit_ipv4_lifecycle_metrics() -> dict[str, Any]:
    """
    Emit IPv4 lifecycle metrics to Prometheus.

    Runs periodically (every 5 minutes) to export:
    - IPv4 address counts by lifecycle state
    - Pool utilization rates
    - Allocation/revocation rates
    - NetBox integration statistics

    Returns:
        Dict with metric values
    """
    import asyncio

    return asyncio.run(_emit_ipv4_lifecycle_metrics_async())


async def _emit_ipv4_lifecycle_metrics_async() -> dict[str, Any]:
    """Async implementation of IPv4 metrics emission task."""
    from dotmac.platform.ip_management.models import IPReservation

    logger.debug("Emitting IPv4 lifecycle metrics")

    # Create async engine for this task
    engine = create_async_engine(
        settings.database.sqlalchemy_url,
        echo=False,
        pool_pre_ping=True,
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    metrics: dict[str, Any] = {
        "state_counts": {},
        "utilization": {},
        "pool_stats": {},
    }

    try:
        async with async_session() as session:
            # Get state counts
            stmt_state_counts = select(
                IPReservation.lifecycle_state,
                func.count(IPReservation.id).label("count"),
            ).group_by(IPReservation.lifecycle_state)
            result = await session.execute(stmt_state_counts)
            state_counts = {row[0]: row[1] for row in result}
            metrics["state_counts"] = state_counts

            # Get utilization stats
            total_count = sum(state_counts.values())
            active_count = state_counts.get("active", 0)
            allocated_count = state_counts.get("allocated", 0)
            revoked_count = state_counts.get("revoked", 0)

            metrics["utilization"] = {
                "total": total_count,
                "active": active_count,
                "allocated": allocated_count,
                "revoked": revoked_count,
                "utilization_rate": (active_count / total_count * 100) if total_count > 0 else 0,
                "allocation_rate": ((active_count + allocated_count) / total_count * 100)
                if total_count > 0
                else 0,
            }

            # Get pool statistics
            from dotmac.platform.ip_management.models import IPPool

            stmt_pool_count = select(func.count(IPPool.id)).where(
                IPPool.status == IPPoolStatus.ACTIVE,
                IPPool.deleted_at.is_(None),
            )
            result = await session.execute(stmt_pool_count)
            pool_count = result.scalar() or 0

            stmt_addresses_per_pool = select(func.avg(func.count(IPReservation.id))).group_by(
                IPReservation.pool_id
            )
            result = await session.execute(stmt_addresses_per_pool)
            avg_addresses_per_pool = result.scalar() or 0

            metrics["pool_stats"] = {
                "pool_count": pool_count,
                "avg_addresses_per_pool": float(avg_addresses_per_pool),
            }

            logger.debug(
                "IPv4 metrics emitted",
                extra={
                    "event": "ipv4_lifecycle.metrics_emitted",
                    "metrics": metrics,
                },
            )

    except Exception as e:
        logger.error(
            f"Failed to emit IPv4 metrics: {e}",
            exc_info=True,
            extra={"event": "ipv4_lifecycle.metrics_emission_failed", "error": str(e)},
        )

    finally:
        await engine.dispose()

    return metrics
