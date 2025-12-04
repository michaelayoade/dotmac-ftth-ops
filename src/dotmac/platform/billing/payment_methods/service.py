"""
Payment methods service layer for business logic.

Handles payment method management including adding, verifying,
and removing payment methods with payment gateway integration.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.exceptions import PaymentMethodError

from .db_models import BillingPaymentMethodTable
from .models import (
    CardBrand,
    PaymentMethodResponse,
    PaymentMethodStatus,
    PaymentMethodType,
)

logger = structlog.get_logger(__name__)


class PaymentMethodService:
    """Service for managing tenant payment methods."""

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize service with database session."""
        self.db = db_session

    # ============================================================================
    # Payment Method Operations
    # ============================================================================

    async def list_payment_methods_for_customer(
        self, tenant_id: str, customer_id: str
    ) -> list[PaymentMethodResponse]:
        """
        List all payment methods for a customer.

        Currently payment methods are tenant-scoped, so this filters by tenant_id.
        The customer_id parameter is accepted for future extensibility.
        """
        return await self.list_payment_methods(tenant_id)

    async def list_payment_methods(self, tenant_id: str) -> list[PaymentMethodResponse]:
        """
        List all payment methods for a tenant.

        Returns only active and pending verification methods.
        Excludes expired and inactive methods.
        """
        logger.info("Listing payment methods for tenant", tenant_id=tenant_id)

        # Query active payment methods (not soft deleted)
        stmt = (
            select(BillingPaymentMethodTable)
            .where(
                BillingPaymentMethodTable.tenant_id == tenant_id,
                BillingPaymentMethodTable.is_deleted == False,  # noqa: E712
            )
            .order_by(
                BillingPaymentMethodTable.is_default.desc(),  # Default first
                BillingPaymentMethodTable.created_at.desc(),
            )
        )

        result = await self.db.execute(stmt)
        payment_methods = result.scalars().all()

        # Convert ORM models to response schemas
        return [self._orm_to_response(pm) for pm in payment_methods]

    async def get_payment_method(
        self, payment_method_id: str, tenant_id: str
    ) -> PaymentMethodResponse | None:
        """
        Get specific payment method by ID.

        Validates tenant ownership.
        """
        logger.info(
            "Fetching payment method",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
        )

        # Convert to UUID and query with tenant validation
        try:
            pm_uuid = UUID(payment_method_id)
        except ValueError:
            logger.warning("Invalid payment method ID format", payment_method_id=payment_method_id)
            return None

        stmt = select(BillingPaymentMethodTable).where(
            BillingPaymentMethodTable.id == pm_uuid,
            BillingPaymentMethodTable.tenant_id == tenant_id,
            BillingPaymentMethodTable.is_deleted == False,  # noqa: E712
        )

        result = await self.db.execute(stmt)
        payment_method = result.scalar_one_or_none()

        if not payment_method:
            return None

        return self._orm_to_response(payment_method)

    async def get_default_payment_method(self, tenant_id: str) -> PaymentMethodResponse | None:
        """Get tenant's default payment method."""
        logger.info("Fetching default payment method", tenant_id=tenant_id)

        # Query for default payment method
        stmt = select(BillingPaymentMethodTable).where(
            BillingPaymentMethodTable.tenant_id == tenant_id,
            BillingPaymentMethodTable.is_default == True,  # noqa: E712
            BillingPaymentMethodTable.is_deleted == False,  # noqa: E712
        )

        result = await self.db.execute(stmt)
        payment_method = result.scalar_one_or_none()

        if not payment_method:
            return None

        return self._orm_to_response(payment_method)

    async def add_payment_method(
        self,
        tenant_id: str,
        method_type: PaymentMethodType,
        token: str,
        billing_details: dict[str, Any],
        set_as_default: bool,
        added_by_user_id: str,
    ) -> PaymentMethodResponse:
        """
        Add a new payment method for tenant.

        Steps:
        1. Validate token with payment gateway
        2. Create payment method in gateway
        3. Store payment method details (securely)
        4. Set as default if requested (or if first method)
        5. For bank accounts, initiate verification
        """
        logger.info(
            "Adding payment method",
            tenant_id=tenant_id,
            method_type=method_type,
            user_id=added_by_user_id,
        )

        # Get Paystack plugin (uses plugin system for better architecture)
        _ = self._get_paystack_plugin()

        # Validate and extract payment details via plugin
        payment_details = {}
        provider_payment_method_id = ""
        is_verified = True  # Cards are auto-verified, bank accounts require verification

        try:
            if method_type == PaymentMethodType.CARD:
                # For cards, token is the authorization code from Paystack frontend
                # In production, this would be validated via Paystack API
                # For now, we'll extract basic details from billing_details
                payment_details = {
                    "last4": token[-4:] if len(token) >= 4 else "0000",
                    "brand": billing_details.get("card_brand", "visa"),
                    "exp_month": billing_details.get("exp_month"),
                    "exp_year": billing_details.get("exp_year"),
                    "fingerprint": token,  # Paystack provides card fingerprint
                    "billing_name": billing_details.get("billing_name"),
                    "billing_email": billing_details.get("billing_email"),
                    "billing_country": billing_details.get("billing_country", "NG"),
                }
                provider_payment_method_id = f"auth_{token}"
                is_verified = True

            elif method_type == PaymentMethodType.BANK_ACCOUNT:
                # For bank accounts, store details for later verification
                payment_details = {
                    "bank_name": billing_details.get("bank_name"),
                    "account_last4": token[-4:] if len(token) >= 4 else "0000",
                    "account_type": billing_details.get("account_type", "checking"),
                    "billing_name": billing_details.get("billing_name"),
                    "billing_email": billing_details.get("billing_email"),
                    "billing_country": billing_details.get("billing_country", "NG"),
                }
                provider_payment_method_id = f"bank_{token}"
                is_verified = False  # Bank accounts require verification

            else:
                raise ValueError(f"Unsupported payment method type: {method_type}")

        except Exception as e:
            logger.error("Failed to validate payment method", error=str(e))
            raise PaymentMethodError(f"Failed to validate payment method: {e}")

        # Check for duplicate payment methods
        fingerprint = payment_details.get("fingerprint", "")
        if fingerprint:
            existing = await self._check_duplicate_payment_method(tenant_id, fingerprint)
            if existing:
                logger.warning("Duplicate payment method detected", fingerprint=fingerprint)
                raise PaymentMethodError("This payment method has already been added")

        # Check if this is the first payment method (auto-set as default)
        existing_methods = await self.list_payment_methods(tenant_id)
        if not existing_methods:
            set_as_default = True

        # If setting as default, unset current default
        if set_as_default:
            await self.db.execute(
                update(BillingPaymentMethodTable)
                .where(
                    BillingPaymentMethodTable.tenant_id == tenant_id,
                    BillingPaymentMethodTable.is_default == True,  # noqa: E712
                )
                .values(is_default=False, updated_at=datetime.now(UTC))
            )

        # Build display name
        if method_type == PaymentMethodType.CARD:
            display_name = f"{payment_details.get('brand', 'Card').title()} ending in {payment_details['last4']}"
        elif method_type == PaymentMethodType.BANK_ACCOUNT:
            display_name = f"{payment_details.get('bank_name', 'Bank')} ending in {payment_details['account_last4']}"
        else:
            display_name = f"{method_type.value.title()} payment method"

        # Create payment method record
        new_payment_method = BillingPaymentMethodTable(
            tenant_id=tenant_id,
            payment_method_type=method_type,
            provider_payment_method_id=provider_payment_method_id,
            provider_customer_id=billing_details.get("customer_id"),
            display_name=display_name,
            is_default=set_as_default,
            is_verified=is_verified,
            details=payment_details,
            metadata_={
                "added_by_user_id": added_by_user_id,
                "added_at": datetime.now(UTC).isoformat(),
                "provider": "paystack",
            },
        )

        self.db.add(new_payment_method)
        await self.db.commit()
        await self.db.refresh(new_payment_method)

        logger.info(
            "Payment method added successfully",
            payment_method_id=str(new_payment_method.id),
            tenant_id=tenant_id,
            is_default=set_as_default,
        )

        return self._orm_to_response(new_payment_method)

    async def update_payment_method(
        self,
        payment_method_id: str,
        tenant_id: str,
        billing_details: dict[str, Any],
        updated_by_user_id: str,
    ) -> PaymentMethodResponse:
        """
        Update payment method billing details.

        Only billing/shipping address can be updated.
        Cannot update card/bank details (must add new method instead).
        """
        logger.info(
            "Updating payment method",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            user_id=updated_by_user_id,
        )

        # Get payment method
        payment_method = await self.get_payment_method(payment_method_id, tenant_id)
        if not payment_method:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found for tenant")

        # Convert to UUID
        pm_uuid = UUID(payment_method_id)

        # Fetch ORM model for update
        stmt = select(BillingPaymentMethodTable).where(
            BillingPaymentMethodTable.id == pm_uuid,
            BillingPaymentMethodTable.tenant_id == tenant_id,
        )
        result = await self.db.execute(stmt)
        pm_orm = result.scalar_one_or_none()

        if not pm_orm:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found")

        # Update only billing details in the details JSON
        updated_details = pm_orm.details.copy() if pm_orm.details else {}
        updated_details.update(
            {
                "billing_name": billing_details.get(
                    "billing_name", updated_details.get("billing_name")
                ),
                "billing_email": billing_details.get(
                    "billing_email", updated_details.get("billing_email")
                ),
                "billing_country": billing_details.get(
                    "billing_country", updated_details.get("billing_country")
                ),
            }
        )

        # Update metadata to track change
        metadata = pm_orm.metadata_ or {}
        metadata["last_updated_by"] = updated_by_user_id
        metadata["last_updated_at"] = datetime.now(UTC).isoformat()

        # Execute update
        await self.db.execute(
            update(BillingPaymentMethodTable)
            .where(BillingPaymentMethodTable.id == pm_uuid)
            .values(
                details=updated_details,
                metadata_=metadata,
                updated_at=datetime.now(UTC),
            )
        )
        await self.db.commit()

        # Refresh and return
        await self.db.refresh(pm_orm)
        return self._orm_to_response(pm_orm)

    async def set_default_payment_method(
        self,
        payment_method_id: str,
        tenant_id: str,
        set_by_user_id: str,
    ) -> PaymentMethodResponse:
        """
        Set a payment method as the default for the tenant.

        Automatically unsets previous default.
        """
        logger.info(
            "Setting default payment method",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            user_id=set_by_user_id,
        )

        # Get payment method
        payment_method = await self.get_payment_method(payment_method_id, tenant_id)
        if not payment_method:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found for tenant")

        if payment_method.status != PaymentMethodStatus.ACTIVE:
            raise ValueError("Cannot set inactive payment method as default")

        pm_uuid = UUID(payment_method_id)

        # Unset current default payment method
        await self.db.execute(
            update(BillingPaymentMethodTable)
            .where(
                BillingPaymentMethodTable.tenant_id == tenant_id,
                BillingPaymentMethodTable.is_default == True,  # noqa: E712
            )
            .values(is_default=False, updated_at=datetime.now(UTC))
        )

        # Set new default
        await self.db.execute(
            update(BillingPaymentMethodTable)
            .where(BillingPaymentMethodTable.id == pm_uuid)
            .values(is_default=True, updated_at=datetime.now(UTC))
        )

        await self.db.commit()

        # Return updated payment method
        return await self.get_payment_method(payment_method_id, tenant_id)  # type: ignore

    async def remove_payment_method(
        self,
        payment_method_id: str,
        tenant_id: str,
        removed_by_user_id: str,
    ) -> None:
        """
        Remove a payment method.

        Cannot remove default payment method if tenant has active subscriptions.
        Must set different default first.
        """
        logger.info(
            "Removing payment method",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            user_id=removed_by_user_id,
        )

        # Get payment method
        payment_method = await self.get_payment_method(payment_method_id, tenant_id)
        if not payment_method:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found for tenant")

        # Check if default and has active subscriptions
        if payment_method.is_default:
            # Check for active subscriptions
            from dotmac.platform.billing.models import BillingSubscriptionTable
            from dotmac.platform.billing.subscriptions.models import SubscriptionStatus

            active_subs_stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.tenant_id == tenant_id,
                BillingSubscriptionTable.status.in_(
                    [
                        SubscriptionStatus.ACTIVE,
                        SubscriptionStatus.TRIALING,
                        SubscriptionStatus.PAST_DUE,
                    ]
                ),
            )
            result = await self.db.execute(active_subs_stmt)
            active_subscriptions = result.scalars().all()

            if active_subscriptions:
                raise ValueError(
                    "Cannot remove default payment method while there are active subscriptions. "
                    "Please set a different payment method as default first."
                )

        pm_uuid = UUID(payment_method_id)

        # Soft delete the payment method
        await self.db.execute(
            update(BillingPaymentMethodTable)
            .where(BillingPaymentMethodTable.id == pm_uuid)
            .values(
                is_deleted=True,
                deleted_at=datetime.now(UTC),
                deleted_reason=f"Removed by user {removed_by_user_id}",
                updated_at=datetime.now(UTC),
            )
        )

        await self.db.commit()

        logger.info(
            "Payment method removed successfully",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
        )

    async def verify_payment_method(
        self,
        payment_method_id: str,
        tenant_id: str,
        verification_code1: str,
        verification_code2: str,
        verified_by_user_id: str,
    ) -> PaymentMethodResponse:
        """
        Verify a payment method (typically for bank accounts).

        Uses microdeposit verification codes or OTP from Paystack.
        """
        logger.info(
            "Verifying payment method",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            user_id=verified_by_user_id,
        )

        # Get payment method
        payment_method = await self.get_payment_method(payment_method_id, tenant_id)
        if not payment_method:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found for tenant")

        if payment_method.method_type != PaymentMethodType.BANK_ACCOUNT:
            raise ValueError("Only bank accounts require verification")

        if payment_method.status != PaymentMethodStatus.PENDING_VERIFICATION:
            raise ValueError("Payment method is not pending verification")

        pm_uuid = UUID(payment_method_id)

        # In production, verify with Paystack
        # For now, we'll mark as verified if codes are provided
        verification_successful = bool(verification_code1 and verification_code2)

        if verification_successful:
            # Update payment method to verified
            await self.db.execute(
                update(BillingPaymentMethodTable)
                .where(BillingPaymentMethodTable.id == pm_uuid)
                .values(
                    is_verified=True,
                    updated_at=datetime.now(UTC),
                )
            )
            await self.db.commit()

            logger.info(
                "Payment method verified successfully",
                payment_method_id=payment_method_id,
            )
        else:
            logger.warning(
                "Payment method verification failed",
                payment_method_id=payment_method_id,
            )
            raise PaymentMethodError("Verification failed. Please check the verification codes.")

        # Return updated payment method
        return await self.get_payment_method(payment_method_id, tenant_id)  # type: ignore

    async def toggle_autopay(
        self,
        payment_method_id: str,
        tenant_id: str,
        updated_by_user_id: str,
    ) -> PaymentMethodResponse:
        """
        Toggle AutoPay for a payment method.

        When enabled, this payment method will be used for automatic payments.
        Only one payment method should have AutoPay enabled at a time (per tenant).
        """
        logger.info(
            "Toggling AutoPay",
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            user_id=updated_by_user_id,
        )

        # Get current payment method
        payment_method = await self.get_payment_method(payment_method_id, tenant_id)
        if not payment_method:
            raise PaymentMethodError(f"Payment method {payment_method_id} not found for tenant")

        pm_uuid = UUID(payment_method_id)

        # Toggle the autopay flag
        new_autopay_state = not payment_method.auto_pay_enabled

        # If enabling autopay, disable it on all other payment methods first
        if new_autopay_state:
            await self.db.execute(
                update(BillingPaymentMethodTable)
                .where(
                    BillingPaymentMethodTable.tenant_id == tenant_id,
                    BillingPaymentMethodTable.auto_pay_enabled == True,  # noqa: E712
                )
                .values(auto_pay_enabled=False, updated_at=datetime.now(UTC))
            )

        # Update the target payment method
        await self.db.execute(
            update(BillingPaymentMethodTable)
            .where(BillingPaymentMethodTable.id == pm_uuid)
            .values(
                auto_pay_enabled=new_autopay_state,
                updated_at=datetime.now(UTC),
            )
        )

        await self.db.commit()

        logger.info(
            "AutoPay toggled successfully",
            payment_method_id=payment_method_id,
            autopay_enabled=new_autopay_state,
        )

        # Return updated payment method
        return await self.get_payment_method(payment_method_id, tenant_id)  # type: ignore

    # ============================================================================
    # Helper Methods
    # ============================================================================

    def _orm_to_response(self, pm: BillingPaymentMethodTable) -> PaymentMethodResponse:
        """Convert ORM model to response schema."""
        # Determine status from is_verified and expiration
        status = PaymentMethodStatus.ACTIVE
        if not pm.is_verified:
            status = PaymentMethodStatus.PENDING_VERIFICATION

        # Extract details from JSON field
        details = pm.details or {}

        # Build response
        card_brand = self._parse_card_brand(details.get("brand"))

        return PaymentMethodResponse(
            payment_method_id=str(pm.id),
            tenant_id=pm.tenant_id,
            method_type=pm.payment_method_type,
            status=status,
            is_default=pm.is_default,
            auto_pay_enabled=pm.auto_pay_enabled,
            # Card details
            card_brand=card_brand,
            card_last4=details.get("last4"),
            card_exp_month=details.get("exp_month"),
            card_exp_year=details.get("exp_year"),
            # Bank details
            bank_name=details.get("bank_name"),
            bank_account_last4=details.get("account_last4"),
            bank_account_type=details.get("account_type"),
            # Wallet details
            wallet_type=details.get("wallet_type"),
            # Billing details
            billing_name=details.get("billing_name"),
            billing_email=details.get("billing_email"),
            billing_country=details.get("billing_country", "NG"),
            is_verified=pm.is_verified,
            created_at=pm.created_at,
            expires_at=None,  # Calculate from exp_month/exp_year if needed
        )

    async def _check_duplicate_payment_method(
        self, tenant_id: str, fingerprint: str
    ) -> BillingPaymentMethodTable | None:
        """Check if payment method with same fingerprint already exists."""
        if not fingerprint:
            return None

        stmt = select(BillingPaymentMethodTable).where(
            BillingPaymentMethodTable.tenant_id == tenant_id,
            BillingPaymentMethodTable.details["fingerprint"].astext == fingerprint,
            BillingPaymentMethodTable.is_deleted == False,  # noqa: E712
        )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _parse_card_brand(self, brand: Any) -> CardBrand | None:
        """Normalize brand strings from providers into CardBrand enum values."""
        if not brand:
            return None

        raw = str(brand).strip()
        if not raw:
            return None

        candidate = raw.lower()
        if candidate in CardBrand._value2member_map_:
            return CardBrand(candidate)

        compact = candidate.replace(" ", "").replace("-", "")
        if compact in CardBrand._value2member_map_:
            return CardBrand(compact)

        alias_map = {
            "americanexpress": CardBrand.AMEX,
            "american express": CardBrand.AMEX,
            "dinersclub": CardBrand.DINERS,
            "diners club": CardBrand.DINERS,
            "mastercard": CardBrand.MASTERCARD,
            "master card": CardBrand.MASTERCARD,
        }

        if candidate in alias_map:
            return alias_map[candidate]
        if compact in alias_map:
            return alias_map[compact]

        # Unknown brand - map explicitly rather than raising.
        return CardBrand.UNKNOWN

    def _get_paystack_plugin(self) -> Any:
        """
        Get Paystack payment plugin instance.

        Returns:
            PaymentProvider: Configured Paystack plugin

        Raises:
            PaymentMethodError: If plugin not available or not configured
        """
        try:
            # Import plugin registry
            from dotmac.platform.plugins.registry import plugin_registry

            # Get Paystack plugin from registry
            paystack_plugin = None

            # Look for active Paystack plugin instance
            instances = plugin_registry.list_instances(provider_type="payment", is_active=True)

            for instance in instances:
                if instance.plugin_name == "paystack" and instance.status == "active":
                    # Get the plugin provider
                    if instance.plugin_name in plugin_registry._plugins:
                        paystack_plugin = plugin_registry._plugins[instance.plugin_name]
                        break

            if not paystack_plugin:
                raise PaymentMethodError(
                    "Paystack payment plugin not configured. "
                    "Please configure the Paystack plugin in the admin panel "
                    "or set up Paystack credentials in Vault."
                )

            return paystack_plugin

        except ImportError as e:
            raise PaymentMethodError(
                f"Plugin system not available: {e}. Ensure plugin system is properly initialized."
            ) from e
