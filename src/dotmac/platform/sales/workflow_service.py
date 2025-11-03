"""
Sales Workflow Service

Provides workflow-compatible methods for sales operations.
"""
# mypy: disable-error-code="arg-type,misc,type-arg,valid-type"

import logging
import secrets
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class SalesService:
    """
    Sales service for workflow integration.

    Provides order creation and management methods for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_order_from_quote(
        self,
        quote_id: int | str,
        tenant_id: str,
    ) -> dict[str, Any]:
        """
        Create an order from an accepted quote.

        Args:
            quote_id: Quote ID (UUID string)
            tenant_id: Tenant ID

        Returns:
            Dict with order details including order_id, customer_id, customer_email, total_amount
        """
        from ..crm.models import Lead, Quote, QuoteStatus
        from .models import Order, OrderItem, OrderStatus, OrderType

        logger.info(f"Creating order from quote {quote_id} for tenant {tenant_id}")

        # Convert quote_id to UUID
        if isinstance(quote_id, int):
            raise ValueError("Quote ID must be UUID string, not int")

        quote_uuid = UUID(str(quote_id)) if not isinstance(quote_id, UUID) else quote_id

        # Fetch the quote with lead relationship
        stmt = select(Quote).where(Quote.id == quote_uuid, Quote.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        quote = result.scalar_one_or_none()

        if not quote:
            raise ValueError(f"Quote {quote_id} not found in tenant {tenant_id}")

        # Verify quote is accepted
        if quote.status != QuoteStatus.ACCEPTED:
            raise ValueError(
                f"Quote {quote.quote_number} is not accepted (status: {quote.status.value})"
            )

        # Fetch the associated lead for customer details
        lead_stmt = select(Lead).where(Lead.id == quote.lead_id)
        lead_result = await self.db.execute(lead_stmt)
        lead = lead_result.scalar_one_or_none()

        if not lead:
            raise ValueError(f"Lead {quote.lead_id} not found for quote {quote_id}")

        # Check if order already exists for this quote
        existing_order_stmt = select(Order).where(Order.external_order_id == str(quote.id))
        existing_result = await self.db.execute(existing_order_stmt)
        existing_order = existing_result.scalar_one_or_none()

        if existing_order:
            if tenant_id and not existing_order.tenant_id:
                existing_order.tenant_id = tenant_id  # type: ignore[assignment]
                await self.db.flush()
            logger.info(f"Order already exists for quote {quote_id}: {existing_order.order_number}")
            return {
                "order_id": existing_order.id,
                "customer_id": lead.id,
                "customer_email": lead.email,
                "total_amount": existing_order.total_amount,
                "status": existing_order.status.value,
                "created_at": existing_order.created_at.isoformat()
                if existing_order.created_at
                else None,
                "order_number": existing_order.order_number,
            }

        # Generate unique order number
        order_number = self._generate_order_number()

        # Create the order
        order = Order(
            order_number=order_number,
            order_type=OrderType.NEW_TENANT,
            status=OrderStatus.SUBMITTED,
            customer_email=lead.email,
            customer_name=f"{lead.first_name} {lead.last_name}".strip(),
            customer_phone=lead.phone,
            company_name=lead.company or f"{lead.first_name} {lead.last_name}",
            organization_name=lead.company or f"{lead.first_name} {lead.last_name}",
            billing_address={"address": lead.address} if lead.address else None,
            currency="USD",
            total_amount=quote.total_upfront_cost + quote.monthly_recurring_charge,
            billing_cycle="monthly",
            external_order_id=str(quote.id),
            source="quote",
            notes=f"Order created from quote {quote.quote_number}",
            tenant_id=tenant_id,
        )

        self.db.add(order)
        await self.db.flush()

        # Create order items from quote details
        # Main service item
        service_item = OrderItem(
            order_id=order.id,
            item_type="service",
            service_code="ISP_SERVICE",
            name=quote.service_plan_name,
            description=f"{quote.bandwidth} - {quote.service_plan_name}",
            quantity=1,
            unit_price=quote.monthly_recurring_charge,
            total_amount=quote.monthly_recurring_charge,
            billing_cycle="monthly",
            configuration={
                "bandwidth": quote.bandwidth,
                "contract_term_months": quote.contract_term_months,
            },
        )
        self.db.add(service_item)

        # Installation fee item (if applicable)
        if quote.installation_fee > 0:
            installation_item = OrderItem(
                order_id=order.id,
                item_type="setup_fee",
                service_code="INSTALLATION",
                name="Installation Fee",
                description="One-time installation fee",
                quantity=1,
                unit_price=quote.installation_fee,
                total_amount=quote.installation_fee,
                billing_cycle="one_time",
            )
            self.db.add(installation_item)

        # Equipment fee item (if applicable)
        if quote.equipment_fee > 0:
            equipment_item = OrderItem(
                order_id=order.id,
                item_type="equipment",
                service_code="EQUIPMENT",
                name="Equipment Fee",
                description="Customer premises equipment",
                quantity=1,
                unit_price=quote.equipment_fee,
                total_amount=quote.equipment_fee,
                billing_cycle="one_time",
            )
            self.db.add(equipment_item)

        # Activation fee item (if applicable)
        if quote.activation_fee > 0:
            activation_item = OrderItem(
                order_id=order.id,
                item_type="setup_fee",
                service_code="ACTIVATION",
                name="Activation Fee",
                description="Service activation fee",
                quantity=1,
                unit_price=quote.activation_fee,
                total_amount=quote.activation_fee,
                billing_cycle="one_time",
            )
            self.db.add(activation_item)

        await self.db.commit()
        await self.db.refresh(order)

        logger.info(f"Created order {order.order_number} from quote {quote.quote_number}")

        return {
            "order_id": order.id,
            "customer_id": lead.id,
            "customer_email": lead.email,
            "total_amount": order.total_amount,
            "status": order.status.value,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "order_number": order.order_number,
        }

    def _generate_order_number(self) -> str:
        """Generate a unique order number."""
        # Format: ORD-YYYYMMDD-XXXX (where XXXX is random hex)
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        random_suffix = secrets.token_hex(2).upper()
        return f"ORD-{timestamp}-{random_suffix}"
