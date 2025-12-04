"""
Partner Management Workflow Service

Provides workflow-compatible methods for partner management operations.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    CommissionStatus,
    Partner,
    PartnerAccount,
    PartnerCommissionEvent,
    PartnerStatus,
)

logger = logging.getLogger(__name__)


class PartnerService:
    """
    Partner service for workflow integration.

    Provides partner quota and commission management for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_license_quota(
        self,
        partner_id: int | str,
        requested_licenses: int,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Check if partner has sufficient license quota.

        This method checks partner's allocated license quota vs current usage.
        Partners can have license allocations that limit how many licenses
        they can distribute to their customers.

        Args:
            partner_id: Partner ID (UUID or string)
            requested_licenses: Number of licenses being requested
            tenant_id: Tenant ID for multi-tenant isolation

        Returns:
            Dict with quota check results:
            {
                "available": bool,  # Whether quota is available
                "quota_remaining": int,  # Licenses remaining
                "quota_allocated": int,  # Total allocated to partner
                "quota_used": int,  # Currently in use
                "requested_licenses": int,  # Amount requested
                "partner_id": str,  # Partner UUID
                "partner_status": str,  # Partner status
                "can_allocate": bool,  # Whether allocation would succeed
            }

        Raises:
            ValueError: If partner not found or invalid parameters
            RuntimeError: If quota check fails
        """
        if tenant_id is None:
            raise ValueError("tenant_id is required for quota checks")

        logger.info(
            "Checking license quota",
            partner_id=partner_id,
            tenant_id=tenant_id,
            requested=requested_licenses,
        )

        if requested_licenses < 0:
            raise ValueError(f"Invalid requested_licenses: {requested_licenses} (must be >= 0)")

        try:
            partner_uuid = UUID(str(partner_id))
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid partner_id: {partner_id}") from e

        try:
            # Fetch partner
            result = await self.db.execute(
                select(Partner).where(
                    Partner.id == partner_uuid,
                    Partner.tenant_id == tenant_id,
                    Partner.deleted_at.is_(None),
                )
            )
            partner = result.scalar_one_or_none()

            if not partner:
                raise ValueError(f"Partner not found for tenant {tenant_id}: {partner_id}")

            # Check partner status
            if partner.status not in [PartnerStatus.ACTIVE]:
                logger.warning(
                    f"Partner {partner_id} status is {partner.status.value}, "
                    f"not active - quota check may fail"
                )

            # Get partner's license allocation from metadata
            # Partners can have quota defined in metadata like:
            # {"license_quota": {"allocated": 100, "used": 50}}
            metadata = partner.metadata_ or {}
            license_quota = metadata.get("license_quota", {})

            # Get allocated quota (default to unlimited if not set)
            quota_allocated = license_quota.get("allocated")
            is_unlimited = quota_allocated is None

            # Count current usage - active customers managed by this partner
            from sqlalchemy import func

            usage_result = await self.db.execute(
                select(func.count(PartnerAccount.id)).where(
                    PartnerAccount.partner_id == partner_uuid,
                    PartnerAccount.tenant_id == tenant_id,
                    PartnerAccount.is_active == True,  # noqa: E712
                )
            )
            quota_used = usage_result.scalar() or 0

            # Calculate remaining quota
            if is_unlimited:
                quota_remaining = 999999  # Effectively unlimited
                can_allocate = True
            else:
                quota_remaining = quota_allocated - quota_used
                can_allocate = quota_remaining >= requested_licenses

            available = can_allocate and partner.status == PartnerStatus.ACTIVE

            logger.info(
                f"Quota check for partner {partner_id}: "
                f"allocated={quota_allocated or 'unlimited'}, "
                f"used={quota_used}, "
                f"remaining={quota_remaining}, "
                f"requested={requested_licenses}, "
                f"available={available}"
            )

            return {
                "available": available,
                "quota_remaining": quota_remaining,
                "quota_allocated": quota_allocated or "unlimited",
                "quota_used": quota_used,
                "requested_licenses": requested_licenses,
                "partner_id": str(partner_uuid),
                "partner_number": partner.partner_number,
                "partner_name": partner.company_name,
                "partner_status": partner.status.value,
                "partner_tier": partner.tier.value,
                "can_allocate": can_allocate,
                "is_unlimited": is_unlimited,
                "checked_at": datetime.now(UTC).isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error checking license quota: {e}", exc_info=True)
            raise RuntimeError(f"Failed to check license quota: {e}") from e

    async def record_commission(
        self,
        partner_id: int | str,
        customer_id: int | str,
        commission_type: str,
        amount: Decimal | str | float,
        invoice_id: str | None = None,
        tenant_id: str | None = None,
        currency: str = "USD",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Record a commission event for a partner.

        This method creates a commission record when partners earn commissions
        from customer transactions (new sales, renewals, upgrades, etc).
        Commissions are tracked separately from payments and batched for payouts.

        Args:
            partner_id: Partner ID (UUID or string)
            customer_id: Customer ID that generated the commission
            commission_type: Type of commission event:
                - "new_customer": New customer signup
                - "renewal": Subscription renewal
                - "upgrade": Plan upgrade
                - "usage": Usage-based commission
                - "referral": Referral commission
            amount: Commission amount (Decimal, string, or float)
            invoice_id: Invoice ID that triggered commission (optional)
            tenant_id: Tenant ID for multi-tenant isolation
            currency: Currency code (ISO 4217, default USD)
            metadata: Additional metadata for the commission event

        Returns:
            Dict with commission details:
            {
                "commission_id": str,  # UUID of commission event
                "partner_id": str,  # Partner UUID
                "customer_id": str,  # Customer UUID
                "commission_type": str,  # Event type
                "amount": str,  # Commission amount
                "currency": str,  # Currency code
                "status": str,  # Commission status (pending, approved, paid)
                "event_date": str,  # ISO timestamp
                "invoice_id": str,  # Invoice reference (if applicable)
                "partner_balance": str,  # Updated partner balance
            }

        Raises:
            ValueError: If partner/customer not found or invalid parameters
            RuntimeError: If commission recording fails
        """
        # Convert amount to Decimal
        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount

        if amount_decimal < 0:
            raise ValueError(f"Invalid commission amount: {amount_decimal} (must be >= 0)")

        if tenant_id is None:
            raise ValueError("tenant_id is required for commission recording")

        logger.info(
            "Recording commission",
            partner_id=partner_id,
            customer_id=customer_id,
            tenant_id=tenant_id,
            commission_type=commission_type,
            amount=str(amount_decimal),
            currency=currency,
        )

        # Convert IDs to UUIDs
        try:
            partner_uuid = (
                UUID(partner_id) if isinstance(partner_id, str) else UUID(str(partner_id))
            )
            customer_uuid = (
                UUID(customer_id) if isinstance(customer_id, str) else UUID(str(customer_id))
            )
            invoice_uuid = UUID(invoice_id) if invoice_id else None
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid ID format: {e}") from e

        try:
            # Fetch partner to verify it exists and is active
            partner_result = await self.db.execute(
                select(Partner).where(
                    Partner.id == partner_uuid,
                    Partner.tenant_id == tenant_id,
                    Partner.deleted_at.is_(None),
                )
            )
            partner = partner_result.scalar_one_or_none()

            if not partner:
                raise ValueError(f"Partner not found for tenant {tenant_id}: {partner_id}")

            if partner.status != PartnerStatus.ACTIVE:
                logger.warning(
                    f"Partner {partner_id} status is {partner.status.value}, "
                    f"commission recorded but partner is not active"
                )

            # Create commission event
            commission_event = PartnerCommissionEvent(
                partner_id=partner_uuid,
                customer_id=customer_uuid,
                invoice_id=invoice_uuid,
                commission_amount=amount_decimal,
                currency=currency,
                base_amount=None,  # Could be set if calculating percentage
                commission_rate=None,  # Could be set if using partner's rate
                status=CommissionStatus.PENDING,
                event_type=commission_type,
                event_date=datetime.now(UTC),
                metadata_=metadata or {},
            )

            self.db.add(commission_event)

            # Update partner's commission metrics
            partner.total_commissions_earned += amount_decimal

            # Commit the transaction
            await self.db.flush()
            await self.db.commit()

            logger.info(
                f"Commission recorded successfully: {commission_event.id}, "
                f"partner {partner_id}, amount {amount_decimal}, "
                f"new balance: {partner.total_commissions_earned}"
            )

            return {
                "commission_id": str(commission_event.id),
                "partner_id": str(partner_uuid),
                "partner_number": partner.partner_number,
                "partner_name": partner.company_name,
                "customer_id": str(customer_uuid),
                "commission_type": commission_type,
                "amount": str(amount_decimal),
                "currency": currency,
                "status": commission_event.status.value,
                "event_date": commission_event.event_date.isoformat(),
                "invoice_id": str(invoice_uuid) if invoice_uuid else None,
                "partner_balance": str(partner.total_commissions_earned),
                "partner_outstanding_balance": str(partner.outstanding_commission_balance),
                "metadata": commission_event.metadata_,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error recording commission: {e}", exc_info=True)
            await self.db.rollback()
            raise RuntimeError(f"Failed to record commission: {e}") from e
