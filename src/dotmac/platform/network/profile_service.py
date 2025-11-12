"""
Service helpers for managing subscriber network profiles.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.models import (
    IPv6AssignmentMode,
    Option82Policy,
    SubscriberNetworkProfile,
)
from dotmac.platform.network.schemas import NetworkProfileResponse, NetworkProfileUpdate

logger = structlog.get_logger(__name__)


class SubscriberNetworkProfileService:
    """CRUD helper for subscriber network profiles."""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    async def get_profile(self, subscriber_id: str) -> SubscriberNetworkProfile | None:
        """Fetch profile for a subscriber."""
        stmt = (
            select(SubscriberNetworkProfile)
            .where(
                SubscriberNetworkProfile.tenant_id == self.tenant_id,
                SubscriberNetworkProfile.subscriber_id == subscriber_id,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_profile(
        self,
        subscriber_id: str,
        data: NetworkProfileUpdate,
        *,
        commit: bool = False,
    ) -> NetworkProfileResponse:
        """Create or update a network profile for a subscriber."""

        payload = data.model_dump(exclude_unset=True, by_alias=False)

        if delegated_prefix := payload.get("delegated_ipv6_prefix"):
            payload["delegated_ipv6_prefix"] = data._validate_prefix(delegated_prefix)

        if metadata := payload.get("metadata"):
            payload["metadata_"] = data._normalize_metadata(metadata)
            payload.pop("metadata", None)

        if "static_ipv4" in payload and payload["static_ipv4"] is not None:
            payload["static_ipv4"] = str(payload["static_ipv4"])
        if "static_ipv6" in payload and payload["static_ipv6"] is not None:
            payload["static_ipv6"] = str(payload["static_ipv6"])

        existing = await self.get_profile(subscriber_id)
        if existing:
            for field, value in payload.items():
                setattr(existing, field, value)
            instance = existing
        else:
            instance = SubscriberNetworkProfile(
                id=uuid4(),
                tenant_id=self.tenant_id,
                subscriber_id=subscriber_id,
                ipv6_assignment_mode=payload.get("ipv6_assignment_mode", IPv6AssignmentMode.NONE)
                or IPv6AssignmentMode.NONE,
                option82_policy=payload.get("option82_policy", Option82Policy.LOG)
                or Option82Policy.LOG,
                qinq_enabled=payload.get("qinq_enabled", False) or False,
            )

            for field, value in payload.items():
                setattr(instance, field, value)

            self.session.add(instance)

        await self.session.flush()

        if commit:
            await self.session.commit()

        logger.info(
            "subscriber_network_profile_updated",
            tenant_id=self.tenant_id,
            subscriber_id=subscriber_id,
            has_circuit=bool(instance.circuit_id),
            has_static_ipv4=bool(instance.static_ipv4),
        )

        return NetworkProfileResponse.model_validate(instance)

    async def delete_profile(self, subscriber_id: str, *, commit: bool = False) -> bool:
        """Soft-delete a profile."""
        profile = await self.get_profile(subscriber_id)
        if not profile:
            return False

        await self.session.delete(profile)
        if commit:
            await self.session.commit()
        return True

    async def list_profiles(self) -> Sequence[SubscriberNetworkProfile]:
        """Return all profiles for the tenant (admin tooling)."""
        stmt = select(SubscriberNetworkProfile).where(
            SubscriberNetworkProfile.tenant_id == self.tenant_id,
        )
        result = await self.session.execute(stmt)
        return tuple(result.scalars().all())

    async def get_stats(self) -> dict[str, int]:
        """
        Calculate aggregate statistics for network profiles in the tenant.

        Returns counts for various profile configurations including VLANs,
        static IPs, QinQ, Option 82 policies, dual-stack setups, NetBox tracking,
        and IPv6 lifecycle states.
        """
        from .models import IPv6LifecycleState

        profiles = await self.list_profiles()

        total_profiles = len(profiles)
        profiles_with_static_ipv4 = sum(1 for p in profiles if p.static_ipv4)
        profiles_with_static_ipv6 = sum(1 for p in profiles if p.static_ipv6)
        profiles_with_vlans = sum(1 for p in profiles if p.service_vlan)
        profiles_with_qinq = sum(1 for p in profiles if p.qinq_enabled)
        profiles_with_option82 = sum(1 for p in profiles if p.circuit_id or p.remote_id)

        option82_enforce_count = sum(
            1 for p in profiles if p.option82_policy == Option82Policy.ENFORCE
        )
        option82_log_count = sum(1 for p in profiles if p.option82_policy == Option82Policy.LOG)
        option82_ignore_count = sum(
            1 for p in profiles if p.option82_policy == Option82Policy.IGNORE
        )

        # New metrics: Dual-stack and NetBox integration
        dual_stack_profiles = sum(
            1 for p in profiles if p.static_ipv4 and (p.static_ipv6 or p.delegated_ipv6_prefix)
        )
        netbox_tracked_profiles = sum(1 for p in profiles if p.ipv6_netbox_prefix_id)

        # New metrics: IPv6 lifecycle state tracking
        ipv6_allocated = sum(1 for p in profiles if p.ipv6_state == IPv6LifecycleState.ALLOCATED)
        ipv6_active = sum(1 for p in profiles if p.ipv6_state == IPv6LifecycleState.ACTIVE)
        ipv6_suspended = sum(1 for p in profiles if p.ipv6_state == IPv6LifecycleState.SUSPENDED)
        ipv6_revoked = sum(1 for p in profiles if p.ipv6_state == IPv6LifecycleState.REVOKED)

        return {
            "total_profiles": total_profiles,
            "profiles_with_static_ipv4": profiles_with_static_ipv4,
            "profiles_with_static_ipv6": profiles_with_static_ipv6,
            "profiles_with_vlans": profiles_with_vlans,
            "profiles_with_qinq": profiles_with_qinq,
            "profiles_with_option82": profiles_with_option82,
            "option82_enforce_count": option82_enforce_count,
            "option82_log_count": option82_log_count,
            "option82_ignore_count": option82_ignore_count,
            # Dual-stack and NetBox tracking
            "dual_stack_profiles": dual_stack_profiles,
            "netbox_tracked_profiles": netbox_tracked_profiles,
            # IPv6 lifecycle states
            "ipv6_allocated": ipv6_allocated,
            "ipv6_active": ipv6_active,
            "ipv6_suspended": ipv6_suspended,
            "ipv6_revoked": ipv6_revoked,
        }
