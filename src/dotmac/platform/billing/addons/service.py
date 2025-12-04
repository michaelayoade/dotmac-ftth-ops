"""
Add-on service layer for business logic.

Handles add-on purchases, cancellations, and quantity management for tenants.
"""

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from inspect import isawaitable
from typing import TYPE_CHECKING, cast
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.exceptions import AddonNotFoundError
from dotmac.platform.billing.models import BillingAddonTable, BillingTenantAddonTable

from .models import (
    Addon,
    AddonBillingType,
    AddonResponse,
    AddonStatus,
    AddonType,
    TenantAddonResponse,
)

if TYPE_CHECKING:
    from dotmac.platform.billing.models import BillingSubscriptionTable

logger = structlog.get_logger(__name__)


class AddonService:
    """Service for managing add-ons and tenant add-on purchases."""

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize service with database session."""
        self.db = db_session

    @staticmethod
    async def _resolve(value):
        """Await value if needed."""
        if isawaitable(value):
            return await value
        return value

    # --------------------------------------------------------------------- #
    # Internal helpers
    # --------------------------------------------------------------------- #

    @staticmethod
    def _to_minor_units(amount: Decimal) -> int:
        """Convert a Decimal amount to minor currency units (e.g., cents)."""
        quantized = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return int(quantized * Decimal("100"))

    async def _get_subscription(
        self, tenant_id: str, subscription_id: str
    ) -> "BillingSubscriptionTable | None":
        """Fetch a subscription and validate tenant ownership."""
        from dotmac.platform.billing.models import BillingSubscriptionTable

        stmt = (
            select(BillingSubscriptionTable)
            .where(BillingSubscriptionTable.subscription_id == subscription_id)
            .where(BillingSubscriptionTable.tenant_id == tenant_id)
        )
        result = await self.db.execute(stmt)
        return await self._resolve(result.scalar_one_or_none())

    async def _get_latest_active_subscription(
        self, tenant_id: str
    ) -> "BillingSubscriptionTable | None":
        """Return the most recent active/trialing subscription for the tenant."""
        from dotmac.platform.billing.models import BillingSubscriptionTable
        from dotmac.platform.billing.subscriptions.models import SubscriptionStatus

        stmt = (
            select(BillingSubscriptionTable)
            .where(BillingSubscriptionTable.tenant_id == tenant_id)
            .where(
                BillingSubscriptionTable.status.in_(
                    [
                        SubscriptionStatus.ACTIVE.value,
                        SubscriptionStatus.TRIALING.value,
                    ]
                )
            )
            .order_by(BillingSubscriptionTable.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return await self._resolve(result.scalar_one_or_none())

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
        logger.info("Fetching available add-ons", tenant_id=tenant_id, plan_id=plan_id)

        # Build query for active add-ons
        stmt = select(BillingAddonTable).where(
            BillingAddonTable.tenant_id == tenant_id,
            BillingAddonTable.is_active == True,  # noqa: E712
        )

        result = await self.db.execute(stmt)
        scalars_result = await self._resolve(result.scalars())
        addon_rows = await self._resolve(scalars_result.all())

        # Convert to response models
        addons = []
        for row in addon_rows:
            if plan_id and not row.compatible_with_all_plans:
                compatible_ids = row.compatible_plan_ids or []
                if plan_id not in compatible_ids:
                    continue
            addons.append(
                AddonResponse(
                    addon_id=row.addon_id,
                    name=row.name,
                    description=row.description,
                    addon_type=AddonType(row.addon_type),
                    billing_type=AddonBillingType(row.billing_type),
                    price=Decimal(str(row.price)),
                    currency=row.currency,
                    setup_fee=Decimal(str(row.setup_fee)) if row.setup_fee is not None else None,
                    is_quantity_based=row.is_quantity_based,
                    min_quantity=int(row.min_quantity),
                    max_quantity=int(row.max_quantity) if row.max_quantity is not None else None,
                    metered_unit=row.metered_unit,
                    included_quantity=(
                        int(row.included_quantity) if row.included_quantity is not None else None
                    ),
                    is_active=row.is_active,
                    is_featured=row.is_featured,
                    compatible_with_all_plans=row.compatible_with_all_plans,
                    icon=row.icon,
                    features=row.features or [],
                )
            )

        return addons

    async def get_addon(self, addon_id: str) -> Addon | None:
        """Get add-on by ID."""
        logger.info("Fetching add-on", addon_id=addon_id)

        stmt = select(BillingAddonTable).where(BillingAddonTable.addon_id == addon_id)
        result = await self.db.execute(stmt)
        row = await self._resolve(result.scalar_one_or_none())

        if not row:
            return None

        return Addon(
            addon_id=row.addon_id,
            tenant_id=row.tenant_id,
            name=row.name,
            description=row.description,
            addon_type=AddonType(row.addon_type),
            billing_type=AddonBillingType(row.billing_type),
            price=Decimal(str(row.price)),
            currency=row.currency,
            setup_fee=Decimal(str(row.setup_fee)) if row.setup_fee is not None else None,
            is_quantity_based=row.is_quantity_based,
            min_quantity=int(row.min_quantity),
            max_quantity=int(row.max_quantity) if row.max_quantity is not None else None,
            metered_unit=row.metered_unit,
            included_quantity=(
                int(row.included_quantity) if row.included_quantity is not None else None
            ),
            is_active=row.is_active,
            is_featured=row.is_featured,
            compatible_with_all_plans=row.compatible_with_all_plans,
            compatible_plan_ids=row.compatible_plan_ids or [],
            metadata=row.metadata_json or {},
            icon=row.icon,
            features=row.features or [],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    # ============================================================================
    # Tenant Add-on Management
    # ============================================================================

    async def get_active_addons(self, tenant_id: str) -> list[TenantAddonResponse]:
        """
        Get all active add-ons for a tenant.

        Returns add-ons with status=ACTIVE or CANCELED (if not yet ended).
        """
        logger.info("Fetching active add-ons for tenant", tenant_id=tenant_id)

        # Query for tenant add-ons with active or canceled status
        stmt = (
            select(BillingTenantAddonTable, BillingAddonTable)
            .join(BillingAddonTable, BillingTenantAddonTable.addon_id == BillingAddonTable.addon_id)
            .where(
                BillingTenantAddonTable.tenant_id == tenant_id,
                BillingTenantAddonTable.status.in_(
                    [
                        AddonStatus.ACTIVE.value,
                        AddonStatus.CANCELED.value,
                    ]
                ),
            )
            .order_by(BillingTenantAddonTable.started_at.desc())
        )

        result = await self.db.execute(stmt)
        rows = await self._resolve(result.all())

        # Convert to response models
        tenant_addons = []
        for tenant_addon_row, addon_row in rows:
            addon_response = AddonResponse(
                addon_id=addon_row.addon_id,
                name=addon_row.name,
                description=addon_row.description,
                addon_type=AddonType(addon_row.addon_type),
                billing_type=AddonBillingType(addon_row.billing_type),
                price=Decimal(str(addon_row.price)),
                currency=addon_row.currency,
                setup_fee=(
                    Decimal(str(addon_row.setup_fee)) if addon_row.setup_fee is not None else None
                ),
                is_quantity_based=addon_row.is_quantity_based,
                min_quantity=int(addon_row.min_quantity),
                max_quantity=(
                    int(addon_row.max_quantity) if addon_row.max_quantity is not None else None
                ),
                metered_unit=addon_row.metered_unit,
                included_quantity=(
                    int(addon_row.included_quantity)
                    if addon_row.included_quantity is not None
                    else None
                ),
                is_active=addon_row.is_active,
                is_featured=addon_row.is_featured,
                compatible_with_all_plans=addon_row.compatible_with_all_plans,
                icon=addon_row.icon,
                features=addon_row.features or [],
            )

            tenant_addons.append(
                TenantAddonResponse(
                    tenant_addon_id=tenant_addon_row.tenant_addon_id,
                    tenant_id=tenant_addon_row.tenant_id,
                    addon_id=tenant_addon_row.addon_id,
                    subscription_id=tenant_addon_row.subscription_id,
                    status=AddonStatus(tenant_addon_row.status),
                    quantity=int(tenant_addon_row.quantity),
                    started_at=tenant_addon_row.started_at,
                    current_period_start=tenant_addon_row.current_period_start,
                    current_period_end=tenant_addon_row.current_period_end,
                    canceled_at=tenant_addon_row.canceled_at,
                    ended_at=tenant_addon_row.ended_at,
                    current_usage=int(tenant_addon_row.current_usage),
                    addon=addon_response,
                )
            )

        return tenant_addons

    async def get_tenant_addon(
        self, tenant_addon_id: str, tenant_id: str
    ) -> TenantAddonResponse | None:
        """
        Get specific tenant add-on by ID.

        Validates tenant ownership.
        """
        logger.info("Fetching tenant add-on", tenant_addon_id=tenant_addon_id, tenant_id=tenant_id)

        # Query for tenant add-on with tenant ownership check
        stmt = (
            select(BillingTenantAddonTable, BillingAddonTable)
            .join(BillingAddonTable, BillingTenantAddonTable.addon_id == BillingAddonTable.addon_id)
            .where(
                BillingTenantAddonTable.tenant_addon_id == tenant_addon_id,
                BillingTenantAddonTable.tenant_id == tenant_id,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one_or_none()

        if not row:
            return None

        tenant_addon_row, addon_row = row

        addon_response = AddonResponse(
            addon_id=addon_row.addon_id,
            name=addon_row.name,
            description=addon_row.description,
            addon_type=AddonType(addon_row.addon_type),
            billing_type=AddonBillingType(addon_row.billing_type),
            price=Decimal(str(addon_row.price)),
            currency=addon_row.currency,
            setup_fee=(
                Decimal(str(addon_row.setup_fee)) if addon_row.setup_fee is not None else None
            ),
            is_quantity_based=addon_row.is_quantity_based,
            min_quantity=int(addon_row.min_quantity),
            max_quantity=(
                int(addon_row.max_quantity) if addon_row.max_quantity is not None else None
            ),
            metered_unit=addon_row.metered_unit,
            included_quantity=(
                int(addon_row.included_quantity)
                if addon_row.included_quantity is not None
                else None
            ),
            is_active=addon_row.is_active,
            is_featured=addon_row.is_featured,
            compatible_with_all_plans=addon_row.compatible_with_all_plans,
            icon=addon_row.icon,
            features=addon_row.features or [],
        )

        return TenantAddonResponse(
            tenant_addon_id=tenant_addon_row.tenant_addon_id,
            tenant_id=tenant_addon_row.tenant_id,
            addon_id=tenant_addon_row.addon_id,
            subscription_id=tenant_addon_row.subscription_id,
            status=AddonStatus(tenant_addon_row.status),
            quantity=int(tenant_addon_row.quantity),
            started_at=tenant_addon_row.started_at,
            current_period_start=tenant_addon_row.current_period_start,
            current_period_end=tenant_addon_row.current_period_end,
            canceled_at=tenant_addon_row.canceled_at,
            ended_at=tenant_addon_row.ended_at,
            current_usage=int(tenant_addon_row.current_usage),
            addon=addon_response,
        )

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
            if addon.max_quantity is not None and quantity > addon.max_quantity:
                raise ValueError(f"Quantity cannot exceed {addon.max_quantity}")
        elif quantity != 1:
            raise ValueError("This add-on does not support quantity adjustments")

        subscription = None
        plan_id: str | None = None

        if subscription_id:
            subscription = await self._get_subscription(tenant_id, subscription_id)
            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found for tenant {tenant_id}")
            plan_id = str(subscription.plan_id)
        else:
            subscription = await self._get_latest_active_subscription(tenant_id)
            if subscription:
                plan_id = str(subscription.plan_id)

        if not addon.compatible_with_all_plans:
            allowed_plan_ids = set(addon.compatible_plan_ids or [])
            if plan_id is None or plan_id not in allowed_plan_ids:
                raise ValueError(
                    "Add-on is not compatible with the tenant's current subscription plan"
                )

        # Implement actual purchase logic
        now = datetime.now(UTC)
        tenant_addon_id = f"taddon_{uuid4().hex[:24]}"

        # Calculate billing period based on subscription or addon billing type
        current_period_start = now
        current_period_end: datetime | None = None

        if subscription:
            if subscription.current_period_start:
                current_period_start = cast(datetime, subscription.current_period_start)
            if subscription.current_period_end:
                current_period_end = cast(datetime | None, subscription.current_period_end)

        # Create TenantAddon record
        tenant_addon_row = BillingTenantAddonTable(
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            addon_id=addon_id,
            subscription_id=subscription_id,
            status=AddonStatus.ACTIVE.value,
            quantity=quantity,
            started_at=now,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            current_usage=0,
            metadata_json={
                "purchased_by_user_id": purchased_by_user_id,
                "purchased_at": now.isoformat(),
            },
            created_at=now,
            updated_at=now,
        )

        self.db.add(tenant_addon_row)

        # Calculate pricing (price * quantity + setup_fee)
        total_amount = addon.price * quantity
        if addon.setup_fee:
            total_amount += addon.setup_fee

        # Create invoice for charges using invoice service
        logger.info(
            "Creating invoice for add-on purchase",
            tenant_id=tenant_id,
            addon_id=addon_id,
            total_amount=str(total_amount),
            currency=addon.currency,
        )

        # Get customer information from subscription or use tenant as customer
        customer_id = str(tenant_id)
        if subscription and subscription.customer_id:
            customer_id = str(subscription.customer_id)

        # Resolve real billing contact data (email + address)
        from dotmac.platform.billing.integration import BillingIntegrationService

        billing_integration = BillingIntegrationService(self.db)
        (
            billing_email,
            billing_address,
        ) = await billing_integration._resolve_customer_billing_details(
            customer_id=str(customer_id), tenant_id=str(tenant_id)
        )

        # Prepare invoice line items
        line_items = []

        # Add main add-on charge
        line_items.append(
            {
                "description": f"{addon.name} (x{quantity})",
                "quantity": quantity,
                "unit_price": self._to_minor_units(addon.price),
                "total_price": self._to_minor_units(addon.price * quantity),
                "product_id": addon_id,
                "subscription_id": subscription_id,
                "tax_rate": 0.0,
                "tax_amount": 0,
                "discount_percentage": 0.0,
                "discount_amount": 0,
                "extra_data": {
                    "addon_type": addon.addon_type.value,
                    "tenant_addon_id": tenant_addon_id,
                },
            }
        )

        # Add setup fee if applicable
        if addon.setup_fee and addon.setup_fee > 0:
            line_items.append(
                {
                    "description": f"{addon.name} - Setup Fee",
                    "quantity": 1,
                    "unit_price": self._to_minor_units(addon.setup_fee),
                    "total_price": self._to_minor_units(addon.setup_fee),
                    "product_id": f"{addon_id}_setup",
                    "subscription_id": subscription_id,
                    "tax_rate": 0.0,
                    "tax_amount": 0,
                    "discount_percentage": 0.0,
                    "discount_amount": 0,
                    "extra_data": {
                        "addon_type": "setup_fee",
                        "tenant_addon_id": tenant_addon_id,
                    },
                }
            )

        # Create invoice using InvoiceService
        from dotmac.platform.billing.invoicing.service import InvoiceService

        invoice_service = InvoiceService(self.db)

        try:
            invoice = await invoice_service.create_invoice(
                tenant_id=tenant_id,
                customer_id=customer_id,
                billing_email=billing_email,
                billing_address=billing_address,
                line_items=line_items,
                currency=addon.currency,
                due_days=30,
                notes=f"Add-on purchase: {addon.name}",
                internal_notes=f"Purchased by user {purchased_by_user_id}",
                subscription_id=subscription_id,
                created_by=purchased_by_user_id or "system",
                idempotency_key=f"addon_purchase_{tenant_addon_id}",
                extra_data={
                    "tenant_addon_id": tenant_addon_id,
                    "addon_id": addon_id,
                    "quantity": quantity,
                },
            )

            logger.info(
                "Invoice created for add-on purchase",
                tenant_id=tenant_id,
                invoice_id=invoice.invoice_id,
                invoice_number=invoice.invoice_number,
                total_amount=invoice.total_amount,
            )

            # Store invoice reference in tenant addon metadata
            tenant_addon_row.metadata_json["invoice_id"] = invoice.invoice_id
            tenant_addon_row.metadata_json["invoice_number"] = invoice.invoice_number

        except Exception as e:
            logger.error(
                "Failed to create invoice for add-on purchase",
                tenant_id=tenant_id,
                addon_id=addon_id,
                error=str(e),
            )
            # Don't fail the entire purchase if invoice creation fails
            # The purchase will still be recorded, invoice can be created manually

        # Commit the transaction
        await self.db.commit()
        await self.db.refresh(tenant_addon_row)

        # Send confirmation email (async task - would use notification service)
        logger.info(
            "Add-on purchase confirmation email would be sent",
            tenant_id=tenant_id,
            addon_id=addon_id,
            user_id=purchased_by_user_id,
        )

        # Fetch addon details for response
        addon_row = await self.db.execute(
            select(BillingAddonTable).where(BillingAddonTable.addon_id == addon_id)
        )
        addon_details = await self._resolve(addon_row.scalar_one())

        addon_response = AddonResponse(
            addon_id=addon_details.addon_id,
            name=addon_details.name,
            description=addon_details.description,
            addon_type=AddonType(addon_details.addon_type),
            billing_type=AddonBillingType(addon_details.billing_type),
            price=Decimal(str(addon_details.price)),
            currency=addon_details.currency,
            setup_fee=(
                Decimal(str(addon_details.setup_fee))
                if addon_details.setup_fee is not None
                else None
            ),
            is_quantity_based=addon_details.is_quantity_based,
            min_quantity=int(addon_details.min_quantity),
            max_quantity=(
                int(addon_details.max_quantity) if addon_details.max_quantity is not None else None
            ),
            metered_unit=addon_details.metered_unit,
            included_quantity=(
                int(addon_details.included_quantity)
                if addon_details.included_quantity is not None
                else None
            ),
            is_active=addon_details.is_active,
            is_featured=addon_details.is_featured,
            compatible_with_all_plans=addon_details.compatible_with_all_plans,
            icon=addon_details.icon,
            features=addon_details.features or [],
        )

        return TenantAddonResponse(
            tenant_addon_id=tenant_addon_row.tenant_addon_id,
            tenant_id=tenant_addon_row.tenant_id,
            addon_id=tenant_addon_row.addon_id,
            subscription_id=tenant_addon_row.subscription_id,
            status=AddonStatus(tenant_addon_row.status),
            quantity=int(tenant_addon_row.quantity),
            started_at=tenant_addon_row.started_at,
            current_period_start=tenant_addon_row.current_period_start,
            current_period_end=tenant_addon_row.current_period_end,
            canceled_at=tenant_addon_row.canceled_at,
            ended_at=tenant_addon_row.ended_at,
            current_usage=int(tenant_addon_row.current_usage),
            addon=addon_response,
        )

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
        if addon.max_quantity is not None and new_quantity > addon.max_quantity:
            raise ValueError(f"Quantity cannot exceed {addon.max_quantity}")

        # Implement quantity update logic
        old_quantity = tenant_addon.quantity
        quantity_diff = new_quantity - old_quantity

        if quantity_diff == 0:
            # No change, return current state
            return tenant_addon

        tenant_addon_row_stmt = (
            select(BillingTenantAddonTable)
            .where(BillingTenantAddonTable.tenant_addon_id == tenant_addon_id)
            .where(BillingTenantAddonTable.tenant_id == tenant_id)
        )
        tenant_addon_row_result = await self.db.execute(tenant_addon_row_stmt)
        tenant_addon_row = await self._resolve(tenant_addon_row_result.scalar_one_or_none())
        if not tenant_addon_row:
            raise AddonNotFoundError(f"Add-on {tenant_addon_id} not found for tenant")
        existing_metadata = dict(tenant_addon_row.metadata_json or {})

        # Calculate proration for mid-cycle change
        now = datetime.now(UTC)

        if tenant_addon.current_period_end and tenant_addon.current_period_start:
            # Calculate proration based on remaining period
            total_period_seconds = (
                tenant_addon.current_period_end - tenant_addon.current_period_start
            ).total_seconds()
            remaining_seconds = (tenant_addon.current_period_end - now).total_seconds()
            raw_proration_factor = (
                remaining_seconds / total_period_seconds if total_period_seconds > 0 else 0.0
            )
            proration_factor = max(0.0, min(1.0, raw_proration_factor))

            # Calculate prorated amount
            price_diff = addon.price * quantity_diff
            prorated_amount = price_diff * Decimal(str(proration_factor))

            logger.info(
                "Quantity change proration calculated",
                tenant_addon_id=tenant_addon_id,
                old_quantity=old_quantity,
                new_quantity=new_quantity,
                price_diff=str(price_diff),
                prorated_amount=str(prorated_amount),
                proration_factor=proration_factor,
            )

            # Create invoice for additional charges (if increase) or issue credit (if decrease)
            if quantity_diff > 0:
                logger.info(
                    "Quantity increase - creating invoice",
                    tenant_addon_id=tenant_addon_id,
                    prorated_amount=str(prorated_amount),
                )

                # Get customer information
                customer_id = tenant_id

                if tenant_addon.subscription_id:
                    from dotmac.platform.billing.models import BillingSubscriptionTable

                    sub_stmt = select(BillingSubscriptionTable).where(
                        BillingSubscriptionTable.subscription_id == tenant_addon.subscription_id,
                        BillingSubscriptionTable.tenant_id == tenant_id,
                    )
                    sub_result = await self.db.execute(sub_stmt)
                    subscription = await self._resolve(sub_result.scalar_one_or_none())
                    if subscription:
                        customer_id = subscription.customer_id

                from dotmac.platform.billing.integration import BillingIntegrationService

                integration_service = BillingIntegrationService(self.db)
                (
                    billing_email,
                    billing_address,
                ) = await integration_service._resolve_customer_billing_details(
                    customer_id=str(customer_id), tenant_id=str(tenant_id)
                )

                # Prepare invoice line items for quantity increase
                line_items = [
                    {
                        "description": f"{addon.name} - Quantity Increase ({old_quantity} → {new_quantity})",
                        "quantity": quantity_diff,
                        "unit_price": self._to_minor_units(addon.price),
                        "total_price": self._to_minor_units(prorated_amount),
                        "product_id": addon.addon_id,
                        "subscription_id": tenant_addon.subscription_id,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                        "extra_data": {
                            "addon_type": addon.addon_type.value,
                            "tenant_addon_id": tenant_addon_id,
                            "quantity_change": quantity_diff,
                            "prorated": True,
                            "proration_factor": proration_factor,
                        },
                    }
                ]

                # Create invoice using InvoiceService
                from dotmac.platform.billing.invoicing.service import InvoiceService

                invoice_service = InvoiceService(self.db)

                try:
                    invoice = await invoice_service.create_invoice(
                        tenant_id=tenant_id,
                        customer_id=customer_id,
                        billing_email=billing_email,
                        billing_address=billing_address,
                        line_items=line_items,
                        currency=addon.currency,
                        due_days=30,
                        notes=f"Add-on quantity increase: {addon.name}",
                        internal_notes=f"Quantity changed from {old_quantity} to {new_quantity} by user {updated_by_user_id}",
                        subscription_id=tenant_addon.subscription_id,
                        created_by=updated_by_user_id or "system",
                        idempotency_key=f"addon_qty_increase_{tenant_addon_id}_{now.timestamp()}",
                        extra_data={
                            "tenant_addon_id": tenant_addon_id,
                            "addon_id": addon.addon_id,
                            "quantity_change": quantity_diff,
                            "old_quantity": old_quantity,
                            "new_quantity": new_quantity,
                        },
                    )

                    logger.info(
                        "Invoice created for add-on quantity increase",
                        tenant_id=tenant_id,
                        invoice_id=invoice.invoice_id,
                        invoice_number=invoice.invoice_number,
                        prorated_amount=self._to_minor_units(prorated_amount),
                    )

                except Exception as e:
                    logger.error(
                        "Failed to create invoice for quantity increase",
                        tenant_addon_id=tenant_addon_id,
                        error=str(e),
                    )
                    # Don't fail the entire update if invoice creation fails

            else:
                logger.info(
                    "Quantity decrease - issuing credit",
                    tenant_addon_id=tenant_addon_id,
                    credit_amount=str(abs(prorated_amount)),
                )

                # Get the most recent invoice for this addon if available
                invoice_id = None
                if "invoice_id" in existing_metadata:
                    invoice_id = existing_metadata["invoice_id"]

                # If no invoice found, we'll create a standalone credit note
                if not invoice_id:
                    # Try to find the most recent invoice for this customer
                    from dotmac.platform.billing.core.entities import InvoiceEntity

                    invoice_stmt = (
                        select(InvoiceEntity.invoice_id)
                        .where(InvoiceEntity.tenant_id == tenant_id)
                        .where(
                            InvoiceEntity.customer_id == tenant_id
                        )  # Use tenant as customer fallback
                        .order_by(InvoiceEntity.created_at.desc())
                        .limit(1)
                    )
                    invoice_result = await self.db.execute(invoice_stmt)
                    invoice_id = await self._resolve(invoice_result.scalar_one_or_none())

                # Create credit note for quantity decrease
                from dotmac.platform.billing.core.enums import CreditReason
                from dotmac.platform.billing.credit_notes.service import CreditNoteService

                credit_service = CreditNoteService(self.db)
                credit_amount = abs(prorated_amount)

                if invoice_id:
                    try:
                        credit_note = await credit_service.create_credit_note(
                            tenant_id=tenant_id,
                            invoice_id=invoice_id,
                            reason=CreditReason.PRODUCT_RETURN,  # Or use a custom reason
                            line_items=[
                                {
                                    "description": f"{addon.name} - Quantity Decrease ({old_quantity} → {new_quantity})",
                                    "quantity": abs(quantity_diff),
                                    "unit_price": self._to_minor_units(addon.price),
                                    "amount": self._to_minor_units(credit_amount),
                                    "extra_data": {
                                        "addon_type": addon.addon_type.value,
                                        "tenant_addon_id": tenant_addon_id,
                                        "quantity_change": quantity_diff,
                                        "prorated": True,
                                        "proration_factor": proration_factor,
                                    },
                                }
                            ],
                            notes=f"Credit for add-on quantity decrease: {addon.name}",
                            internal_notes=f"Quantity changed from {old_quantity} to {new_quantity} by user {updated_by_user_id}",
                            created_by=updated_by_user_id or "system",
                            auto_apply=True,
                        )

                        logger.info(
                            "Credit note created for add-on quantity decrease",
                            tenant_id=tenant_id,
                            credit_note_id=credit_note.credit_note_id,
                            credit_note_number=credit_note.credit_note_number,
                            credit_amount=self._to_minor_units(credit_amount),
                        )

                    except Exception as e:
                        logger.error(
                            "Failed to create credit note for quantity decrease",
                            tenant_addon_id=tenant_addon_id,
                            error=str(e),
                        )
                        # Don't fail the entire update if credit note creation fails
                else:
                    logger.warning(
                        "No invoice found for credit application - credit note skipped",
                        tenant_addon_id=tenant_addon_id,
                        tenant_id=tenant_id,
                    )

        # Update tenant add-on quantity
        from sqlalchemy import update

        # Prepare metadata with quantity changes history
        quantity_changes = list(existing_metadata.get("quantity_changes", []))
        quantity_changes.append(
            {
                "from": old_quantity,
                "to": new_quantity,
                "updated_by": updated_by_user_id,
                "updated_at": now.isoformat(),
            }
        )

        updated_metadata = {
            **existing_metadata,
            "quantity_changes": quantity_changes,
        }

        stmt = (
            update(BillingTenantAddonTable)
            .where(BillingTenantAddonTable.tenant_addon_id == tenant_addon_id)
            .where(BillingTenantAddonTable.tenant_id == tenant_id)
            .values(
                quantity=new_quantity,
                updated_at=now,
                metadata_json=updated_metadata,
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

        # Fetch updated tenant addon
        updated_tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not updated_tenant_addon:
            raise AddonNotFoundError(f"Failed to fetch updated add-on {tenant_addon_id}")

        return updated_tenant_addon

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

        # Implement cancellation logic
        now = datetime.now(UTC)
        ended_at = None

        tenant_addon_row_stmt = (
            select(BillingTenantAddonTable)
            .where(BillingTenantAddonTable.tenant_addon_id == tenant_addon_id)
            .where(BillingTenantAddonTable.tenant_id == tenant_id)
        )
        tenant_addon_row_result = await self.db.execute(tenant_addon_row_stmt)
        tenant_addon_row = await self._resolve(tenant_addon_row_result.scalar_one_or_none())
        existing_metadata = dict((tenant_addon_row.metadata_json or {}) if tenant_addon_row else {})

        if cancel_immediately:
            # Immediate cancellation - end the add-on now
            ended_at = now

            # Calculate refund for remaining period
            if tenant_addon.current_period_end and tenant_addon.current_period_start:
                addon = await self.get_addon(tenant_addon.addon_id)
                if addon:
                    total_period_seconds = (
                        tenant_addon.current_period_end - tenant_addon.current_period_start
                    ).total_seconds()
                    remaining_seconds = (tenant_addon.current_period_end - now).total_seconds()
                    raw_proration_factor = (
                        remaining_seconds / total_period_seconds
                        if total_period_seconds > 0
                        else 0.0
                    )
                    proration_factor = max(0.0, min(1.0, raw_proration_factor))

                    # Calculate refund amount
                    period_amount = addon.price * tenant_addon.quantity
                    refund_amount = period_amount * Decimal(str(proration_factor))

                    logger.info(
                        "Immediate cancellation refund calculated",
                        tenant_addon_id=tenant_addon_id,
                        refund_amount=str(refund_amount),
                        proration_factor=proration_factor,
                    )

                    # Issue credit/refund through billing service
                    if refund_amount > 0:
                        invoice_id = existing_metadata.get("invoice_id")

                        if not invoice_id:
                            from dotmac.platform.billing.core.entities import InvoiceEntity

                            invoice_stmt = (
                                select(InvoiceEntity.invoice_id)
                                .where(InvoiceEntity.tenant_id == tenant_id)
                                .where(
                                    InvoiceEntity.customer_id == tenant_id
                                )  # Use tenant as customer fallback
                                .order_by(InvoiceEntity.created_at.desc())
                                .limit(1)
                            )
                            invoice_result = await self.db.execute(invoice_stmt)
                            invoice_id = await self._resolve(invoice_result.scalar_one_or_none())

                        from dotmac.platform.billing.core.enums import CreditReason
                        from dotmac.platform.billing.credit_notes.service import CreditNoteService

                        credit_service = CreditNoteService(self.db)

                        if invoice_id:
                            try:
                                credit_note = await credit_service.create_credit_note(
                                    tenant_id=tenant_id,
                                    invoice_id=invoice_id,
                                    reason=CreditReason.SUBSCRIPTION_CANCELLATION,
                                    line_items=[
                                        {
                                            "description": f"{addon.name} - Cancellation Refund (Remaining Period)",
                                            "quantity": tenant_addon.quantity,
                                            "unit_price": self._to_minor_units(addon.price),
                                            "amount": self._to_minor_units(refund_amount),
                                            "extra_data": {
                                                "addon_type": addon.addon_type.value,
                                                "tenant_addon_id": tenant_addon_id,
                                                "cancellation_type": "immediate",
                                                "prorated": True,
                                                "proration_factor": proration_factor,
                                                "period_amount": self._to_minor_units(
                                                    period_amount
                                                ),
                                            },
                                        }
                                    ],
                                    notes=f"Credit for immediate cancellation of {addon.name}",
                                    internal_notes=f"Canceled by user {canceled_by_user_id}. Reason: {reason}",
                                    created_by=canceled_by_user_id or "system",
                                    auto_apply=True,
                                )

                                logger.info(
                                    "Credit note created for add-on cancellation refund",
                                    tenant_id=tenant_id,
                                    tenant_addon_id=tenant_addon_id,
                                    credit_note_id=credit_note.credit_note_id,
                                    credit_note_number=credit_note.credit_note_number,
                                    refund_amount=self._to_minor_units(refund_amount),
                                )

                            except Exception as e:
                                logger.error(
                                    "Failed to create credit note for cancellation refund",
                                    tenant_addon_id=tenant_addon_id,
                                    error=str(e),
                                )
                                # Don't fail the cancellation if credit note creation fails
                                # The cancellation will still be recorded
                        else:
                            logger.warning(
                                "No invoice found for refund - credit note skipped",
                                tenant_addon_id=tenant_addon_id,
                                tenant_id=tenant_id,
                                refund_amount=str(refund_amount),
                            )
        else:
            # Cancel at period end - addon remains active until period ends
            if tenant_addon.current_period_end:
                ended_at = tenant_addon.current_period_end
            else:
                # No period end set, end immediately
                ended_at = now

        # Update tenant add-on status
        from sqlalchemy import update

        cancellation_metadata = {
            **existing_metadata,
            "cancellation": {
                "canceled_by": canceled_by_user_id,
                "canceled_at": now.isoformat(),
                "cancel_immediately": cancel_immediately,
                "reason": reason,
                "ended_at": ended_at.isoformat() if ended_at else None,
            },
        }

        stmt = (
            update(BillingTenantAddonTable)
            .where(BillingTenantAddonTable.tenant_addon_id == tenant_addon_id)
            .where(BillingTenantAddonTable.tenant_id == tenant_id)
            .values(
                status=(
                    AddonStatus.CANCELED.value
                    if not cancel_immediately
                    else AddonStatus.ENDED.value
                ),
                canceled_at=now,
                ended_at=ended_at,
                updated_at=now,
                metadata_json=cancellation_metadata,
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

        # Send cancellation confirmation email
        logger.info(
            "Add-on cancellation confirmation email would be sent",
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            user_id=canceled_by_user_id,
        )

        # Fetch updated tenant addon
        updated_tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not updated_tenant_addon:
            raise AddonNotFoundError(f"Failed to fetch canceled add-on {tenant_addon_id}")

        return updated_tenant_addon

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

        # Implement reactivation logic
        now = datetime.now(UTC)

        # Update tenant add-on status
        from sqlalchemy import update

        # Fetch current metadata
        fetch_stmt = select(BillingTenantAddonTable).where(
            BillingTenantAddonTable.tenant_addon_id == tenant_addon_id,
            BillingTenantAddonTable.tenant_id == tenant_id,
        )
        fetch_result = await self.db.execute(fetch_stmt)
        tenant_addon_row = await self._resolve(fetch_result.scalar_one_or_none())
        existing_metadata = dict((tenant_addon_row.metadata_json or {}) if tenant_addon_row else {})

        reactivation_metadata = {
            **(existing_metadata or {}),
            "reactivation": {
                "reactivated_by": reactivated_by_user_id,
                "reactivated_at": now.isoformat(),
                "previous_cancellation_at": (
                    tenant_addon.canceled_at.isoformat() if tenant_addon.canceled_at else None
                ),
            },
        }

        stmt = (
            update(BillingTenantAddonTable)
            .where(BillingTenantAddonTable.tenant_addon_id == tenant_addon_id)
            .where(BillingTenantAddonTable.tenant_id == tenant_id)
            .values(
                status=AddonStatus.ACTIVE.value,
                canceled_at=None,
                ended_at=None,
                updated_at=now,
                metadata_json=reactivation_metadata,
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

        # Send reactivation confirmation email
        logger.info(
            "Add-on reactivation confirmation email would be sent",
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            user_id=reactivated_by_user_id,
        )

        # Fetch updated tenant addon
        updated_tenant_addon = await self.get_tenant_addon(tenant_addon_id, tenant_id)
        if not updated_tenant_addon:
            raise AddonNotFoundError(f"Failed to fetch reactivated add-on {tenant_addon_id}")

        return updated_tenant_addon
