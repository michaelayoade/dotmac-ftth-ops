"""
GraphQL queries and mutations for subscriber network profiles.

Provides operations for viewing and managing subscriber network configuration.
"""

import strawberry
import structlog
from sqlalchemy import Integer, func, select

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.network_profile import (
    IPv6AssignmentModeEnum,
    NetworkProfile,
    NetworkProfileInput,
    NetworkProfileStats,
    Option82Alert,
    Option82PolicyEnum,
)
from dotmac.platform.network.models import (
    IPv6AssignmentMode,
    Option82Policy,
    SubscriberNetworkProfile,
)
from dotmac.platform.network.profile_service import SubscriberNetworkProfileService
from dotmac.platform.network.schemas import NetworkProfileUpdate

logger = structlog.get_logger(__name__)


def _to_graphql_enum(py_enum: IPv6AssignmentMode | Option82Policy) -> str:
    """Convert Python enum to GraphQL enum value."""
    return py_enum.value


def _from_graphql_enum(
    graphql_enum: IPv6AssignmentModeEnum | Option82PolicyEnum,
) -> IPv6AssignmentMode | Option82Policy:
    """Convert GraphQL enum to Python enum."""
    if isinstance(graphql_enum, IPv6AssignmentModeEnum):
        return IPv6AssignmentMode(graphql_enum.value)
    if isinstance(graphql_enum, Option82PolicyEnum):
        return Option82Policy(graphql_enum.value)
    raise ValueError(f"Unknown enum type: {type(graphql_enum)}")


def _to_network_profile_type(db_profile: SubscriberNetworkProfile) -> NetworkProfile:
    """Convert database model to GraphQL type."""
    return NetworkProfile(
        id=str(db_profile.id),
        subscriber_id=db_profile.subscriber_id,
        tenant_id=db_profile.tenant_id,
        circuit_id=db_profile.circuit_id,
        remote_id=db_profile.remote_id,
        option82_policy=Option82PolicyEnum(db_profile.option82_policy.value),
        service_vlan=db_profile.service_vlan,
        inner_vlan=db_profile.inner_vlan,
        vlan_pool=db_profile.vlan_pool,
        qinq_enabled=db_profile.qinq_enabled,
        static_ipv4=db_profile.static_ipv4,
        static_ipv6=db_profile.static_ipv6,
        delegated_ipv6_prefix=db_profile.delegated_ipv6_prefix,
        ipv6_pd_size=db_profile.ipv6_pd_size,
        ipv6_assignment_mode=IPv6AssignmentModeEnum(db_profile.ipv6_assignment_mode.value),
        metadata=db_profile.metadata_,
        created_at=db_profile.created_at,
        updated_at=db_profile.updated_at,
    )


@strawberry.type
class NetworkProfileQueries:
    """Queries for subscriber network profiles."""

    @strawberry.field(description="Get network profile for a subscriber")  # type: ignore[misc]
    async def network_profile(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
    ) -> NetworkProfile | None:
        """
        Get network profile configuration for a specific subscriber.

        Args:
            subscriber_id: Subscriber ID to fetch profile for

        Returns:
            Network profile if configured, None otherwise
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = SubscriberNetworkProfileService(context.db, tenant_id)
        db_profile = await service.get_profile(subscriber_id)

        if not db_profile:
            return None

        return _to_network_profile_type(db_profile)

    @strawberry.field(description="Get network profile statistics")  # type: ignore[misc]
    async def network_profile_stats(
        self,
        info: strawberry.Info[Context],
    ) -> NetworkProfileStats:
        """
        Get aggregated statistics for network profiles in the tenant.

        Returns:
            Network profile statistics
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # Query statistics
        stmt = select(
            func.count(SubscriberNetworkProfile.id).label("total"),
            func.count(SubscriberNetworkProfile.static_ipv4).label("ipv4_count"),
            func.count(SubscriberNetworkProfile.static_ipv6).label("ipv6_count"),
            func.count(SubscriberNetworkProfile.service_vlan).label("vlan_count"),
            func.sum(func.cast(SubscriberNetworkProfile.qinq_enabled, Integer())).label(
                "qinq_count"
            ),
            func.count(SubscriberNetworkProfile.circuit_id).label("option82_count"),
        ).where(
            SubscriberNetworkProfile.tenant_id == tenant_id,
            SubscriberNetworkProfile.deleted_at.is_(None),
        )

        result = await context.db.execute(stmt)
        row = result.one()

        # Count by Option82 policy
        policy_stmt = (
            select(
                SubscriberNetworkProfile.option82_policy,
                func.count(SubscriberNetworkProfile.id).label("count"),
            )
            .where(
                SubscriberNetworkProfile.tenant_id == tenant_id,
                SubscriberNetworkProfile.deleted_at.is_(None),
            )
            .group_by(SubscriberNetworkProfile.option82_policy)
        )

        policy_result = await context.db.execute(policy_stmt)
        policy_counts: dict[str, int] = dict(policy_result.all())  # type: ignore[arg-type]

        return NetworkProfileStats(
            total_profiles=row.total or 0,
            profiles_with_static_ipv4=row.ipv4_count or 0,
            profiles_with_static_ipv6=row.ipv6_count or 0,
            profiles_with_vlans=row.vlan_count or 0,
            profiles_with_qinq=row.qinq_count or 0,
            profiles_with_option82=row.option82_count or 0,
            option82_enforce_count=policy_counts.get(Option82Policy.ENFORCE, 0),
            option82_log_count=policy_counts.get(Option82Policy.LOG, 0),
            option82_ignore_count=policy_counts.get(Option82Policy.IGNORE, 0),
        )

    @strawberry.field(description="Get active Option 82 alerts")  # type: ignore[misc]
    async def option82_alerts(
        self,
        info: strawberry.Info[Context],
        active_only: bool = True,
        limit: int = 50,
    ) -> list[Option82Alert]:
        """
        Get Option 82 mismatch alerts for the tenant.

        Args:
            active_only: Only return unresolved alerts
            limit: Maximum number of alerts to return

        Returns:
            List of Option 82 alerts
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # TODO: Implement alert storage/retrieval
        # For now, return empty list
        # In production, this would query an alerts table
        logger.info(
            "option82_alerts_queried",
            tenant_id=tenant_id,
            active_only=active_only,
            limit=limit,
        )
        return []


@strawberry.type
class NetworkProfileMutations:
    """Mutations for subscriber network profiles."""

    @strawberry.mutation(description="Create or update network profile")  # type: ignore[misc]
    async def upsert_network_profile(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
        profile: NetworkProfileInput,
    ) -> NetworkProfile:
        """
        Create or update a subscriber's network profile.

        Args:
            subscriber_id: Subscriber ID
            profile: Network profile configuration

        Returns:
            Created or updated network profile
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = SubscriberNetworkProfileService(context.db, tenant_id)

        # Convert GraphQL input to service schema
        update_data = NetworkProfileUpdate(
            circuit_id=profile.circuit_id,
            remote_id=profile.remote_id,
            service_vlan=profile.service_vlan,
            inner_vlan=profile.inner_vlan,
            vlan_pool=profile.vlan_pool,
            qinq_enabled=profile.qinq_enabled,
            static_ipv4=profile.static_ipv4,  # type: ignore[arg-type]
            static_ipv6=profile.static_ipv6,  # type: ignore[arg-type]
            delegated_ipv6_prefix=profile.delegated_ipv6_prefix,
            ipv6_pd_size=profile.ipv6_pd_size,
            ipv6_assignment_mode=(
                IPv6AssignmentMode(profile.ipv6_assignment_mode.value)
                if profile.ipv6_assignment_mode
                else None
            ),
            option82_policy=(
                Option82Policy(profile.option82_policy.value) if profile.option82_policy else None
            ),
            metadata=profile.metadata,
        )

        response = await service.upsert_profile(subscriber_id, update_data, commit=True)

        # Fetch the ORM model for GraphQL conversion
        stmt = select(SubscriberNetworkProfile).where(
            SubscriberNetworkProfile.subscriber_id == subscriber_id,
            SubscriberNetworkProfile.tenant_id == tenant_id,
        )
        result = await context.db.execute(stmt)
        db_profile = result.scalar_one()

        logger.info(
            "network_profile_upserted_graphql",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            has_vlans=bool(response.service_vlan),
        )

        return _to_network_profile_type(db_profile)

    @strawberry.mutation(description="Delete network profile")  # type: ignore[misc]
    async def delete_network_profile(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
    ) -> bool:
        """
        Delete a subscriber's network profile.

        Args:
            subscriber_id: Subscriber ID

        Returns:
            True if deleted, False if not found
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = SubscriberNetworkProfileService(context.db, tenant_id)
        deleted = await service.delete_profile(subscriber_id, commit=True)

        logger.info(
            "network_profile_deleted_graphql",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            deleted=deleted,
        )

        return deleted
