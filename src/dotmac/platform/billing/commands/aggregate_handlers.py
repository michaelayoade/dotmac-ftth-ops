"""
Aggregate-Based Command Handlers - DDD Pattern.

These handlers use domain aggregates instead of services,
enabling proper business rule enforcement and domain event publishing.
"""

from decimal import Decimal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.domain import (
    Invoice,
    Payment,
    SQLAlchemyInvoiceRepository,
    SQLAlchemyPaymentRepository,
)
from dotmac.platform.billing.domain.aggregates import InvoiceLineItem
from dotmac.platform.core import Money
from dotmac.platform.events import EventPriority, get_event_bus

from .invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    CreateInvoiceCommand,
    MarkInvoiceAsPaidCommand,
    VoidInvoiceCommand,
)
from .payment_commands import (
    CreatePaymentCommand,
    RefundPaymentCommand,
)

logger = structlog.get_logger(__name__)


class AggregateInvoiceCommandHandler:
    """
    Invoice command handler using domain aggregates.

    This handler demonstrates DDD pattern:
    1. Load aggregate from repository
    2. Call business method on aggregate (enforces rules + raises events)
    3. Save aggregate back to repository (persists + publishes events)
    """

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.invoice_repo = SQLAlchemyInvoiceRepository(db_session)
        self.event_bus = get_event_bus()

    async def handle_create_invoice(self, command: CreateInvoiceCommand) -> Invoice:
        """
        Handle CreateInvoiceCommand using Invoice aggregate.

        Business rules enforced by aggregate:
        - Must have at least one line item
        - All line items must use same currency
        - Totals calculated correctly

        Domain events raised:
        - InvoiceCreatedEvent
        """
        logger.info(
            "Handling CreateInvoiceCommand (aggregate-based)",
            command_id=command.command_id,
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
        )

        # Convert line items to domain value objects
        line_items = []
        for item in command.line_items:
            quantity = Decimal(str(item["quantity"]))
            unit_price_major = Decimal(str(item["unit_price"])).quantize(Decimal("0.01"))
            total_price_major = (quantity * unit_price_major).quantize(Decimal("0.01"))

            line_items.append(
                InvoiceLineItem(
                    description=item["description"],
                    quantity=int(quantity),
                    unit_price=Money(amount=float(unit_price_major), currency=command.currency),
                    total_price=Money(amount=float(total_price_major), currency=command.currency),
                    product_id=item.get("product_id"),
                )
            )

        # Create invoice aggregate - business logic encapsulated
        invoice = Invoice.create(
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
            billing_email=command.billing_email,
            line_items=line_items,
            due_days=command.due_days or 30,
            notes=command.notes,
            subscription_id=command.subscription_id,
        )

        # Save aggregate - domain events published automatically
        await self.invoice_repo.save(invoice)

        # Also publish integration event for cross-service communication
        await self.event_bus.publish(
            event_type="billing.invoice.created",
            payload={
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "customer_id": invoice.customer_id,
                "total_amount": int(invoice.total_amount.amount * 100),
                "currency": invoice.total_amount.currency,
                "status": invoice.status,
                "issue_date": invoice.issue_date.isoformat(),
                "due_date": invoice.due_date.isoformat(),
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
                "correlation_id": command.command_id,
            },
            priority=EventPriority.NORMAL,
        )

        await self.db.commit()

        logger.info(
            "Invoice created successfully via aggregate",
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            domain_events_count=0,  # Already published and cleared
        )

        return invoice

    async def handle_void_invoice(self, command: VoidInvoiceCommand) -> Invoice:
        """
        Handle VoidInvoiceCommand using Invoice aggregate.

        Business rules enforced by aggregate:
        - Cannot void paid invoice (must refund instead)
        - Can only void draft or finalized invoices

        Domain events raised:
        - InvoiceVoidedEvent
        """
        logger.info(
            "Handling VoidInvoiceCommand (aggregate-based)",
            invoice_id=command.invoice_id,
            reason=command.void_reason,
        )

        # Load invoice aggregate
        invoice = await self.invoice_repo.get(command.invoice_id, command.tenant_id)

        # Call business method - business rules enforced
        invoice.void(reason=command.void_reason)

        # Save aggregate - domain events published automatically
        await self.invoice_repo.save(invoice)

        # Publish integration event
        await self.event_bus.publish(
            event_type="billing.invoice.voided",
            payload={
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "reason": command.void_reason,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        await self.db.commit()

        logger.info(
            "Invoice voided successfully via aggregate",
            invoice_id=invoice.id,
        )

        return invoice

    async def handle_apply_payment(self, command: ApplyPaymentToInvoiceCommand) -> Invoice:
        """
        Handle ApplyPaymentToInvoiceCommand using Invoice aggregate.

        Business rules enforced by aggregate:
        - Cannot pay voided invoice
        - Cannot overpay invoice
        - Currency must match

        Domain events raised:
        - InvoicePaymentReceivedEvent
        """
        logger.info(
            "Handling ApplyPaymentToInvoiceCommand (aggregate-based)",
            invoice_id=command.invoice_id,
            payment_id=command.payment_id,
        )

        # Load invoice aggregate
        invoice = await self.invoice_repo.get(command.invoice_id, command.tenant_id)

        # Apply payment - business rules enforced
        # Note: amount is in minor units (cents) in command
        payment_amount = Money(
            amount=command.amount / 100,  # Convert from cents to dollars
            currency=invoice.total_amount.currency,
        )

        invoice.apply_payment(
            payment_id=command.payment_id,
            amount=payment_amount,
            payment_method="card",  # Would come from payment entity
        )

        # Save aggregate - domain events published automatically
        await self.invoice_repo.save(invoice)

        # Publish integration events
        await self.event_bus.publish(
            event_type="billing.invoice.payment_applied",
            payload={
                "invoice_id": invoice.id,
                "payment_id": command.payment_id,
                "amount": command.amount,
                "remaining_balance": int(
                    invoice.total_amount.amount * 100
                ),  # Convert back to cents
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        # If fully paid, publish paid event
        if invoice.status == "paid":
            await self.event_bus.publish(
                event_type="billing.invoice.paid",
                payload={
                    "invoice_id": invoice.id,
                    "invoice_number": invoice.invoice_number,
                    "total_amount": int(invoice.total_amount.amount * 100),
                    "customer_id": invoice.customer_id,
                },
                metadata={
                    "tenant_id": command.tenant_id,
                    "user_id": command.user_id,
                },
                priority=EventPriority.HIGH,
            )

        await self.db.commit()

        logger.info(
            "Payment applied to invoice successfully via aggregate",
            invoice_id=invoice.id,
            status=invoice.status,
        )

        return invoice

    async def handle_mark_as_paid(self, command: MarkInvoiceAsPaidCommand) -> Invoice:
        """
        Handle MarkInvoiceAsPaidCommand using Invoice aggregate.

        This is for manual/offline payments.

        Business rules enforced by aggregate:
        - Cannot mark voided invoice as paid
        - Amount must match remaining balance

        Domain events raised:
        - InvoicePaymentReceivedEvent
        """
        logger.info(
            "Handling MarkInvoiceAsPaidCommand (aggregate-based)",
            invoice_id=command.invoice_id,
            payment_method=command.payment_method,
        )

        # Load invoice aggregate
        invoice = await self.invoice_repo.get(command.invoice_id, command.tenant_id)

        # Apply full payment
        invoice.apply_payment(
            payment_id=f"manual-{invoice.id[:8]}",
            amount=invoice.total_amount,  # Full amount
            payment_method=command.payment_method,
        )

        # Save aggregate - domain events published automatically
        await self.invoice_repo.save(invoice)

        # Publish integration event
        await self.event_bus.publish(
            event_type="billing.invoice.manually_paid",
            payload={
                "invoice_id": invoice.id,
                "payment_method": command.payment_method,
                "payment_reference": command.payment_reference,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        await self.db.commit()

        logger.info(
            "Invoice marked as paid successfully via aggregate",
            invoice_id=invoice.id,
        )

        return invoice


class AggregatePaymentCommandHandler:
    """
    Payment command handler using domain aggregates.

    Demonstrates DDD pattern for payment processing.
    """

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.payment_repo = SQLAlchemyPaymentRepository(db_session)
        self.event_bus = get_event_bus()

    async def handle_create_payment(self, command: CreatePaymentCommand) -> Payment:
        """
        Handle CreatePaymentCommand using Payment aggregate.

        Business rules enforced by aggregate:
        - Payment amount must be positive
        - Currency must be valid

        Domain events raised:
        - PaymentCreatedEvent (implicit in create)
        """
        logger.info(
            "Handling CreatePaymentCommand (aggregate-based)",
            command_id=command.command_id,
            customer_id=command.customer_id,
            amount=command.amount,
        )

        # Create payment aggregate
        payment = Payment.create(
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
            amount=Money(
                amount=command.amount / 100,  # Convert from cents
                currency=command.currency,
            ),
            payment_method=command.provider,
            invoice_id=command.invoice_id,
        )

        # Optionally process immediately
        if command.capture_immediately:
            transaction_id = command.external_payment_id or f"txn-{payment.id[:12]}"
            payment.process(transaction_id=transaction_id)

        # Save aggregate - domain events published automatically
        await self.payment_repo.save(payment)

        # Publish integration event based on status
        if payment.status == "succeeded":
            await self.event_bus.publish(
                event_type="billing.payment.succeeded",
                payload={
                    "payment_id": payment.id,
                    "invoice_id": command.invoice_id,
                    "customer_id": command.customer_id,
                    "amount": command.amount,
                    "currency": command.currency,
                },
                metadata={
                    "tenant_id": command.tenant_id,
                    "user_id": command.user_id,
                },
            )
        else:
            await self.event_bus.publish(
                event_type="billing.payment.created",
                payload={
                    "payment_id": payment.id,
                    "invoice_id": command.invoice_id,
                    "customer_id": command.customer_id,
                    "amount": command.amount,
                    "status": payment.status,
                },
                metadata={
                    "tenant_id": command.tenant_id,
                    "user_id": command.user_id,
                },
            )

        await self.db.commit()

        logger.info(
            "Payment created successfully via aggregate",
            payment_id=payment.id,
            status=payment.status,
        )

        return payment

    async def handle_refund_payment(self, command: RefundPaymentCommand) -> Payment:
        """
        Handle RefundPaymentCommand using Payment aggregate.

        Business rules enforced by aggregate:
        - Cannot refund unpaid payment
        - Refund amount cannot exceed original amount

        Domain events raised:
        - PaymentRefundedEvent
        """
        logger.info(
            "Handling RefundPaymentCommand (aggregate-based)",
            payment_id=command.payment_id,
            amount=command.amount,
        )

        # Load payment aggregate
        payment = await self.payment_repo.get(command.payment_id, command.tenant_id)

        # Refund payment - business rules enforced
        # Note: Payment aggregate generates its own refund_id and uses full amount
        payment.refund(reason=command.reason)

        # Save aggregate - domain events published automatically
        await self.payment_repo.save(payment)

        # Publish integration event
        await self.event_bus.publish(
            event_type="billing.payment.refunded",
            payload={
                "payment_id": payment.id,
                "amount": int(payment.amount.amount * 100),
                "reason": command.reason,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        await self.db.commit()

        logger.info(
            "Payment refunded successfully via aggregate",
            payment_id=payment.id,
        )

        return payment
