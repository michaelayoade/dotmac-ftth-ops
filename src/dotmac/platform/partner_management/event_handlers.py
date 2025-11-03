"""
Partner Management Domain Event Handlers.

Handles domain events for partner commission tracking and revenue share.
These handlers implement commission tracking when billing events occur.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import structlog
from sqlalchemy import and_, select

from dotmac.platform.core import (
    InvoicePaymentReceivedEvent,
    get_domain_event_dispatcher,
)
from dotmac.platform.db import get_async_session
from dotmac.platform.partner_management.models import (
    CommissionStatus,
    Partner,
    PartnerAccount,
    PartnerCommissionEvent,
)

logger = structlog.get_logger(__name__)


def register_partner_event_handlers() -> None:
    """
    Register all partner management domain event handlers.

    Call this during application startup to set up event-driven commission tracking.
    """
    dispatcher = get_domain_event_dispatcher()

    # Subscribe to billing events for commission tracking
    dispatcher.subscribe(InvoicePaymentReceivedEvent)(handle_invoice_payment_for_commission)

    logger.info(
        "Partner management event handlers registered",
        handler_count=1,
    )


async def handle_invoice_payment_for_commission(event: InvoicePaymentReceivedEvent) -> None:
    """
    Handle invoice payment received event to create partner commission.

    When an invoice is paid, check if it's associated with a partner-managed customer,
    calculate the commission, and create a commission event.

    Args:
        event: InvoicePaymentReceivedEvent containing invoice and payment details
    """
    logger.debug(
        "Processing invoice payment for partner commission",
        invoice_number=event.invoice_number,
        customer_id=event.customer_id if hasattr(event, "customer_id") else None,
        amount=event.amount if hasattr(event, "amount") else None,
    )

    try:
        # Get database session
        async for db in get_async_session():
            # Check if customer is managed by a partner
            partner_account_query = select(PartnerAccount).where(
                and_(
                    PartnerAccount.customer_id == getattr(event, "customer_id", None),
                    PartnerAccount.tenant_id == event.tenant_id,
                    PartnerAccount.is_active.is_(True),
                )
            )

            result = await db.execute(partner_account_query)
            partner_account = result.scalar_one_or_none()

            if not partner_account:
                logger.debug(
                    "No active partner account found for customer, skipping commission",
                    customer_id=getattr(event, "customer_id", None),
                )
                return

            # Get partner details
            partner_query = select(Partner).where(
                and_(
                    Partner.id == partner_account.partner_id,
                    Partner.tenant_id == event.tenant_id,
                    Partner.deleted_at.is_(None),
                )
            )

            result = await db.execute(partner_query)
            partner = result.scalar_one_or_none()

            if not partner:
                logger.warning(
                    "Partner not found for partner account",
                    partner_id=partner_account.partner_id,
                )
                return

            # Calculate commission
            invoice_amount = Decimal(str(getattr(event, "amount", 0)))
            commission_rate = (
                partner_account.custom_commission_rate
                or partner.default_commission_rate
                or Decimal("0.10")
            )
            commission_amount = invoice_amount * commission_rate

            # Create commission event
            commission_event = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=partner_account.customer_id,
                invoice_id=getattr(event, "invoice_id", None),
                commission_amount=commission_amount,
                currency=getattr(event, "currency", "USD"),
                status=CommissionStatus.APPROVED,  # Auto-approve for now
                event_type="invoice_payment",
                event_date=datetime.now(UTC),
                metadata_={
                    "invoice_number": event.invoice_number,
                    "invoice_amount": str(invoice_amount),
                    "commission_rate": str(commission_rate),
                    "partner_account_id": str(partner_account.id),
                },
                tenant_id=event.tenant_id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            db.add(commission_event)
            await db.commit()

            logger.info(
                "Partner commission event created",
                commission_id=str(commission_event.id),
                partner_id=str(partner.id),
                customer_id=str(partner_account.customer_id),
                invoice_number=event.invoice_number,
                commission_amount=float(commission_amount),
                commission_rate=float(commission_rate),
            )

            break  # Exit the async generator

    except Exception as e:
        logger.error(
            "Failed to create partner commission event",
            error=str(e),
            invoice_number=event.invoice_number,
            exc_info=True,
        )
        # Don't raise - commission tracking is a side effect and shouldn't break billing
