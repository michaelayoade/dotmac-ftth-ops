"""
Add-on service layer for business logic.

Handles add-on purchases, cancellations, and quantity management for tenants.
"""

from datetime import UTC, datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.exceptions import AddonNotFoundError

from .models import (
    Addon,
    AddonResponse,
    AddonStatus,
    TenantAddonResponse,
)

logger = structlog.get_logger(__name__)


class AddonService:
    """Service for managing add-ons and tenant add-on purchases."""

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize service with database session."""
        self.db = db_session

    # ============================================================================
    # Add-on Catalog Operations
    # ============================================================================

    async def get_available_addons(
        self, tenant_id: str, plan_id: str | None = None
    ) -> list[AddonResponse]:
        """
        Get all add-ons available for tenant to purchase.

        Filters by:
        - Active status
        - Plan compatibility (if plan_id provided)
        """
        # Note: This is a placeholder implementation
        # In production, you would query from a database table
        logger.info("Fetching available add-ons", tenant_id=tenant_id, plan_id=plan_id)

        # TODO: Implement database query when add-ons table exists
        # For now, return empty list
        return []

    async def get_addon(self, addon_id: str) -> Addon | None:
        """Get add-on by ID."""
        # Note: Placeholder implementation
        # TODO: Implement database query
        logger.info("Fetching add-on", addon_id=addon_id)
        return None

    # ============================================================================
    # Tenant Add-on Management
    # ============================================================================

    async def get_active_addons(self, tenant_id: str) -> list[TenantAddonResponse]:
        """
        Get all active add-ons for a tenant.

        Returns add-ons with status=ACTIVE or CANCELED (if not yet ended).
        """
        # Note: Placeholder implementation
        # TODO: Implement database query
        logger.info("Fetching active add-ons for tenant", tenant_id=tenant_id)
        return []

    async def get_tenant_addon(
        self, tenant_addon_id: str, tenant_id: str
    ) -> TenantAddonResponse | None:
        """
        Get specific tenant add-on by ID.

        Validates tenant ownership.
        """
        # Note: Placeholder implementation
        # TODO: Implement database query with tenant_id check
        logger.info(
            "Fetching tenant add-on", tenant_addon_id=tenant_addon_id, tenant_id=tenant_id
        )
        return None

    async def purchase_addon(
        self,
        tenant_id: str,
        addon_id: str,
        quantity: int,
        subscription_id: str | None,
        purchased_by_user_id: str,
    ) -> TenantAddonResponse:
        """
        Purchase an add-on for a tenant.

        Steps:
        1. Validate add-on exists and is available
        2. Check plan compatibility
        3. Validate quantity constraints
        4. Create tenant add-on record
        5. Calculate and create invoice for charges
        6. Send confirmation email
        """
        logger.info(
            "Purchasing add-on",
            tenant_id=tenant_id,
            addon_id=addon_id,
            quantity=quantity,
            user_id=purchased_by_user_id,
        )

        # Validate add-on exists
        addon = await self.get_addon(addon_id)
        if not addon:
            raise AddonNotFoundError(f"Add-on {addon_id} not found")

        if not addon.is_active:
            raise ValueError(f"Add-on {addon_id} is not available for purchase")

        # Validate quantity
        if addon.is_quantity_based:
            if quantity < addon.min_quantity:
                raise ValueError(f"Quantity must be at least {addon.min_quantity}")
            if addon.max_quantity and quantity > addon.max_quantity:
                raise ValueError(f"Quantity cannot exceed {addon.max_quantity}")
        elif quantity != 1:
            raise ValueError("This add-on does not support quantity adjustments")

        # TODO: Implement actual purchase logic
        # - Create TenantAddon record
        # - Calculate pricing (price * quantity + setup_fee)
        # - Create invoice for charges
        # - Send confirmation email

        raise NotImplementedError("Add-on purchase will be implemented in database migration phase")

    async def update_addon_quantity(
        self,
        tenant_addon_id: str,
        tenant_id: str,
        new_quantity: int,
        updated_by_user_id: str,
    ) -> TenantAddonResponse:
        """
        Update quantity for a tenant's add-on.

        Only works for quantity-based add-ons.
        Prorates charges for mid-cycle changes.
        """
        logger.info(
            "Updating add-on quantity",
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            new_quantity=new_quantity,
            user_id=updated_by_user_id,
        )

        # Get tenant add-on
        tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not tenant_addon:
            raise AddonNotFoundError(f"Add-on {tenant_addon_id} not found for tenant")

        if tenant_addon.status != AddonStatus.ACTIVE:
            raise ValueError("Cannot update quantity for inactive add-on")

        # Get add-on details
        addon = await self.get_addon(tenant_addon.addon_id)
        if not addon:
            raise AddonNotFoundError(f"Add-on {tenant_addon.addon_id} not found in catalog")

        if not addon.is_quantity_based:
            raise ValueError("This add-on does not support quantity adjustments")

        # Validate new quantity
        if new_quantity < addon.min_quantity:
            raise ValueError(f"Quantity must be at least {addon.min_quantity}")
        if addon.max_quantity and new_quantity > addon.max_quantity:
            raise ValueError(f"Quantity cannot exceed {addon.max_quantity}")

        # TODO: Implement quantity update logic
        # - Calculate proration for mid-cycle change
        # - Create invoice for additional charges (if increase)
        # - Issue credit (if decrease)
        # - Update tenant add-on quantity

        raise NotImplementedError("Quantity update will be implemented in database migration phase")

    async def cancel_addon(
        self,
        tenant_addon_id: str,
        tenant_id: str,
        cancel_immediately: bool,
        reason: str | None,
        canceled_by_user_id: str,
    ) -> TenantAddonResponse:
        """
        Cancel a tenant's add-on.

        Args:
            cancel_immediately: If True, ends immediately with refund.
                              If False, cancels at period end.
        """
        logger.info(
            "Canceling add-on",
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            cancel_immediately=cancel_immediately,
            reason=reason,
            user_id=canceled_by_user_id,
        )

        # Get tenant add-on
        tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not tenant_addon:
            raise AddonNotFoundError(f"Add-on {tenant_addon_id} not found for tenant")

        if tenant_addon.status in (AddonStatus.CANCELED, AddonStatus.ENDED):
            raise ValueError("Add-on is already canceled or ended")

        # TODO: Implement cancellation logic
        # - Mark add-on as canceled
        # - Calculate refund (if immediate cancellation)
        # - Issue credit/refund
        # - Send cancellation confirmation email
        # - Record cancellation reason

        raise NotImplementedError("Add-on cancellation will be implemented in database migration phase")

    async def reactivate_addon(
        self, tenant_addon_id: str, tenant_id: str, reactivated_by_user_id: str
    ) -> TenantAddonResponse:
        """
        Reactivate a canceled add-on before period end.

        Similar to subscription reactivation.
        """
        logger.info(
            "Reactivating add-on",
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            user_id=reactivated_by_user_id,
        )

        # Get tenant add-on
        tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not tenant_addon:
            raise AddonNotFoundError(f"Add-on {tenant_addon_id} not found for tenant")

        if tenant_addon.status != AddonStatus.CANCELED:
            raise ValueError("Only canceled add-ons can be reactivated")

        if tenant_addon.ended_at and tenant_addon.ended_at <= datetime.now(UTC):
            raise ValueError("Cannot reactivate add-on after period has ended")

        # TODO: Implement reactivation logic
        # - Remove cancellation flag
        # - Set status back to ACTIVE
        # - Send reactivation confirmation email

        raise NotImplementedError("Add-on reactivation will be implemented in database migration phase")
