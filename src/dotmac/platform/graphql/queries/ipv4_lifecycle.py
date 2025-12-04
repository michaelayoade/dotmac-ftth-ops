"""
GraphQL queries and mutations for IPv4 address lifecycle management.

Phase 5: Provides operations for managing IPv4 address lifecycle states.
"""

from uuid import UUID

import strawberry
import structlog

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.ipv4_lifecycle import (
    IPv4ActivationInput,
    IPv4AllocationInput,
    IPv4LifecycleOperation,
    IPv4LifecycleStatus,
    IPv4RevocationInput,
    IPv4SuspensionInput,
    LifecycleStateEnum,
)
from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService
from dotmac.platform.network.lifecycle_protocol import LifecycleState

logger = structlog.get_logger(__name__)


def _to_lifecycle_state_enum(state: LifecycleState) -> LifecycleStateEnum:
    """Convert Python LifecycleState to GraphQL enum."""
    return LifecycleStateEnum(state.value)


@strawberry.type
class IPv4LifecycleQueries:
    """Queries for IPv4 lifecycle status."""

    @strawberry.field(description="Get IPv4 lifecycle status for a subscriber")  # type: ignore[misc]
    async def ipv4_lifecycle_status(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
    ) -> IPv4LifecycleStatus | None:
        """Get current IPv4 lifecycle status for a subscriber."""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)
            result = await service.get_state(subscriber_uuid)

            if not result:
                return None

            return IPv4LifecycleStatus(
                subscriber_id=subscriber_id,
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to get IPv4 lifecycle status: {e}", exc_info=True)
            raise


@strawberry.type
class IPv4LifecycleMutations:
    """Mutations for IPv4 lifecycle operations."""

    @strawberry.mutation(description="Allocate IPv4 address for a subscriber")  # type: ignore[misc]
    async def allocate_ipv4(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
        input: IPv4AllocationInput,
    ) -> IPv4LifecycleOperation:
        """Allocate IPv4 address from pool. Transitions: PENDING -> ALLOCATED"""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)
            pool_id = UUID(input.pool_id) if input.pool_id else None

            result = await service.allocate(
                subscriber_id=subscriber_uuid,
                pool_id=pool_id,
                requested_address=input.requested_address,
                commit=True,
            )

            logger.info(
                "ipv4_allocated_via_graphql",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                address=result.address,
            )

            return IPv4LifecycleOperation(
                success=result.success,
                message="IPv4 address allocated successfully",
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                coa_result=result.coa_result,
                disconnect_result=result.disconnect_result,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to allocate IPv4: {e}", exc_info=True)
            raise

    @strawberry.mutation(description="Activate allocated IPv4 address")  # type: ignore[misc]
    async def activate_ipv4(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
        input: IPv4ActivationInput,
    ) -> IPv4LifecycleOperation:
        """Activate IPv4 address. Transitions: ALLOCATED -> ACTIVE"""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)

            result = await service.activate(
                subscriber_id=subscriber_uuid,
                username=input.username,
                nas_ip=input.nas_ip,
                send_coa=input.send_coa,
                update_netbox=input.update_netbox,
                commit=True,
            )

            logger.info(
                "ipv4_activated_via_graphql",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                address=result.address,
                coa_sent=input.send_coa,
            )

            return IPv4LifecycleOperation(
                success=result.success,
                message="IPv4 address activated successfully",
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                coa_result=result.coa_result,
                disconnect_result=result.disconnect_result,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to activate IPv4: {e}", exc_info=True)
            raise

    @strawberry.mutation(description="Suspend active IPv4 address")  # type: ignore[misc]
    async def suspend_ipv4(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
        input: IPv4SuspensionInput,
    ) -> IPv4LifecycleOperation:
        """Suspend IPv4 address. Transitions: ACTIVE -> SUSPENDED"""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)

            result = await service.suspend(
                subscriber_id=subscriber_uuid,
                username=input.username,
                nas_ip=input.nas_ip,
                send_coa=input.send_coa,
                reason=input.reason,
                commit=True,
            )

            logger.info(
                "ipv4_suspended_via_graphql",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                address=result.address,
                reason=input.reason,
            )

            return IPv4LifecycleOperation(
                success=result.success,
                message="IPv4 address suspended successfully",
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                coa_result=result.coa_result,
                disconnect_result=result.disconnect_result,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to suspend IPv4: {e}", exc_info=True)
            raise

    @strawberry.mutation(description="Reactivate suspended IPv4 address")  # type: ignore[misc]
    async def reactivate_ipv4(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
    ) -> IPv4LifecycleOperation:
        """Reactivate IPv4 address. Transitions: SUSPENDED -> ACTIVE"""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)

            result = await service.reactivate(
                subscriber_id=subscriber_uuid,
                commit=True,
            )

            logger.info(
                "ipv4_reactivated_via_graphql",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                address=result.address,
            )

            return IPv4LifecycleOperation(
                success=result.success,
                message="IPv4 address reactivated successfully",
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                coa_result=result.coa_result,
                disconnect_result=result.disconnect_result,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to reactivate IPv4: {e}", exc_info=True)
            raise

    @strawberry.mutation(description="Revoke IPv4 address and return to pool")  # type: ignore[misc]
    async def revoke_ipv4(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
        input: IPv4RevocationInput,
    ) -> IPv4LifecycleOperation:
        """Revoke IPv4 address. Transitions: ANY -> REVOKING -> REVOKED"""
        db = info.context.db
        tenant_id = info.context.get_active_tenant_id()

        service = IPv4LifecycleService(db, tenant_id)
        try:
            subscriber_uuid = UUID(subscriber_id)

            result = await service.revoke(
                subscriber_id=subscriber_uuid,
                username=input.username,
                nas_ip=input.nas_ip,
                send_disconnect=input.send_disconnect,
                release_to_pool=input.release_to_pool,
                update_netbox=input.update_netbox,
                commit=True,
            )

            logger.info(
                "ipv4_revoked_via_graphql",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                address=result.address,
                disconnect_sent=input.send_disconnect,
            )

            return IPv4LifecycleOperation(
                success=result.success,
                message="IPv4 address revoked successfully",
                address=result.address,
                state=_to_lifecycle_state_enum(result.state),
                allocated_at=result.allocated_at,
                activated_at=result.activated_at,
                suspended_at=result.suspended_at,
                revoked_at=result.revoked_at,
                netbox_ip_id=result.netbox_ip_id,
                coa_result=result.coa_result,
                disconnect_result=result.disconnect_result,
                metadata=result.metadata,
            )
        except Exception as e:
            logger.error(f"Failed to revoke IPv4: {e}", exc_info=True)
            raise
