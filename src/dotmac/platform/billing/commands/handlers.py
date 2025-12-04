"""
Command Handlers - Execute commands and coordinate business logic

Handlers are responsible for:
1. Validating business rules
2. Coordinating with domain services
3. Persisting state changes
4. Publishing domain events
"""

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.invoicing.service import InvoiceService
from dotmac.platform.billing.models import Invoice, Payment
from dotmac.platform.billing.payments.service import PaymentService
from dotmac.platform.billing.subscriptions.models import (
    Subscription,
    SubscriptionCreateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService
from dotmac.platform.events import EventPriority, get_event_bus

from .invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    CreateInvoiceCommand,
    FinalizeInvoiceCommand,
    MarkInvoiceAsPaidCommand,
    SendInvoiceCommand,
    UpdateInvoiceCommand,
    VoidInvoiceCommand,
)
from .payment_commands import (
    CancelPaymentCommand,
    CreatePaymentCommand,
    RecordOfflinePaymentCommand,
    RefundPaymentCommand,
)
from .subscription_commands import (
    CancelSubscriptionCommand,
    CreateSubscriptionCommand,
)

logger = structlog.get_logger(__name__)


class InvoiceCommandHandler:
    """
    Handles invoice-related commands.

    Coordinates between InvoiceService and event publishing.
    """

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.invoice_service = InvoiceService(db_session)
        self.event_bus = get_event_bus()

    async def handle_create_invoice(self, command: CreateInvoiceCommand) -> Invoice:
        """
        Handle CreateInvoiceCommand.

        Creates invoice and publishes invoice.created event.
        """
        logger.info(
            "Handling CreateInvoiceCommand",
            command_id=command.command_id,
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
        )

        # Create invoice using service
        invoice = await self.invoice_service.create_invoice(
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
            billing_email=command.billing_email,
            billing_address=command.billing_address,
            line_items=command.line_items,
            currency=command.currency,
            due_days=command.due_days,
            due_date=command.due_date,
            notes=command.notes,
            internal_notes=command.internal_notes,
            subscription_id=command.subscription_id,
            created_by=command.user_id or "system",
            idempotency_key=command.idempotency_key,
            extra_data=command.extra_data,
        )

        # Publish domain event
        await self.event_bus.publish(
            event_type="billing.invoice.created",
            payload={
                "invoice_id": invoice.invoice_id,
                "invoice_number": invoice.invoice_number,
                "customer_id": invoice.customer_id,
                "amount": invoice.total_amount,
                "currency": invoice.currency,
                "status": invoice.status,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
                "correlation_id": command.command_id,
            },
            priority=EventPriority.NORMAL,
        )

        # Auto-finalize if requested
        if command.auto_finalize and invoice.invoice_id:
            await self.handle_finalize_invoice(
                FinalizeInvoiceCommand(
                    tenant_id=command.tenant_id,
                    user_id=command.user_id,
                    invoice_id=invoice.invoice_id,
                    send_email=False,
                    idempotency_key=f"{command.idempotency_key}_finalize",
                )
            )

        logger.info(
            "Invoice created successfully",
            invoice_id=invoice.invoice_id,
            invoice_number=invoice.invoice_number,
        )

        return invoice

    async def handle_update_invoice(self, command: UpdateInvoiceCommand) -> Invoice:
        """Handle UpdateInvoiceCommand"""
        logger.info(
            "Handling UpdateInvoiceCommand",
            command_id=command.command_id,
            invoice_id=command.invoice_id,
        )

        # Get the invoice first
        invoice = await self.invoice_service.get_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
        )

        if invoice is None:
            raise ValueError(f"Invoice {command.invoice_id} not found")

        # Update invoice using the service method
        invoice = await self.invoice_service.update_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
            due_date=command.due_date,
            notes=command.notes,
            metadata=command.extra_data,
        )

        await self.event_bus.publish(
            event_type="billing.invoice.updated",
            payload={
                "invoice_id": invoice.invoice_id,
                "changes": command.model_dump(
                    exclude_none=True, exclude={"tenant_id", "command_id"}
                ),
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        return invoice

    async def handle_void_invoice(self, command: VoidInvoiceCommand) -> Invoice:
        """Handle VoidInvoiceCommand"""
        logger.info(
            "Handling VoidInvoiceCommand",
            invoice_id=command.invoice_id,
            reason=command.void_reason,
        )

        invoice = await self.invoice_service.void_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
            reason=command.void_reason,
        )

        await self.event_bus.publish(
            event_type="billing.invoice.voided",
            payload={
                "invoice_id": invoice.invoice_id,
                "reason": command.void_reason,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        return invoice

    async def handle_finalize_invoice(self, command: FinalizeInvoiceCommand) -> Invoice:
        """Handle FinalizeInvoiceCommand"""
        logger.info(
            "Handling FinalizeInvoiceCommand",
            invoice_id=command.invoice_id,
        )

        invoice = await self.invoice_service.finalize_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
        )

        await self.event_bus.publish(
            event_type="billing.invoice.finalized",
            payload={
                "invoice_id": invoice.invoice_id,
                "invoice_number": invoice.invoice_number,
                "total_amount": invoice.total_amount,
                "customer_id": invoice.customer_id,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        if command.send_email and invoice.invoice_id:
            await self.handle_send_invoice(
                SendInvoiceCommand(
                    tenant_id=command.tenant_id,
                    user_id=command.user_id,
                    invoice_id=invoice.invoice_id,
                    idempotency_key=f"{command.idempotency_key}_send",
                    recipient_email=None,
                    custom_message=None,
                )
            )

        return invoice

    async def handle_send_invoice(self, command: SendInvoiceCommand) -> Invoice:
        """Handle SendInvoiceCommand"""
        logger.info(
            "Handling SendInvoiceCommand",
            invoice_id=command.invoice_id,
        )

        # Get invoice and send notification
        invoice = await self.invoice_service.get_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
        )

        if invoice is None:
            raise ValueError(f"Invoice {command.invoice_id} not found")

        # Send invoice email using the service method
        success = await self.invoice_service.send_invoice_email(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
            recipient_email=command.recipient_email,
        )

        if not success:
            logger.warning(
                "Failed to send invoice email",
                invoice_id=command.invoice_id,
                recipient=command.recipient_email,
            )

        await self.event_bus.publish(
            event_type="billing.invoice.sent",
            payload={
                "invoice_id": invoice.invoice_id,
                "recipient_email": command.recipient_email or invoice.billing_email,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        return invoice

    async def handle_apply_payment(self, command: ApplyPaymentToInvoiceCommand) -> Invoice:
        """Handle ApplyPaymentToInvoiceCommand"""
        logger.info(
            "Handling ApplyPaymentToInvoiceCommand",
            invoice_id=command.invoice_id,
            payment_id=command.payment_id,
        )

        # Get invoice first
        invoice = await self.invoice_service.get_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
        )

        if invoice is None:
            raise ValueError(f"Invoice {command.invoice_id} not found")

        # Apply payment to invoice using the service method
        invoice = await self.invoice_service.apply_payment_to_invoice(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
            payment_id=command.payment_id,
            amount=command.amount,
        )

        await self.event_bus.publish(
            event_type="billing.invoice.payment_applied",
            payload={
                "invoice_id": invoice.invoice_id,
                "payment_id": command.payment_id,
                "amount": command.amount,
                "remaining_balance": invoice.remaining_balance,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        # If fully paid, publish paid event
        if invoice.remaining_balance == 0:
            await self.event_bus.publish(
                event_type="billing.invoice.paid",
                payload={
                    "invoice_id": invoice.invoice_id,
                    "invoice_number": invoice.invoice_number,
                    "total_amount": invoice.total_amount,
                    "customer_id": invoice.customer_id,
                },
                metadata={
                    "tenant_id": command.tenant_id,
                    "user_id": command.user_id,
                },
                priority=EventPriority.HIGH,
            )

        return invoice

    async def handle_mark_as_paid(self, command: MarkInvoiceAsPaidCommand) -> Invoice:
        """Handle MarkInvoiceAsPaidCommand"""
        logger.info(
            "Handling MarkInvoiceAsPaidCommand",
            invoice_id=command.invoice_id,
            payment_method=command.payment_method,
        )

        invoice = await self.invoice_service.mark_invoice_paid(
            tenant_id=command.tenant_id,
            invoice_id=command.invoice_id,
        )

        await self.event_bus.publish(
            event_type="billing.invoice.manually_paid",
            payload={
                "invoice_id": invoice.invoice_id,
                "payment_method": command.payment_method,
                "payment_reference": command.payment_reference,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        return invoice


class PaymentCommandHandler:
    """Handles payment-related commands"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.payment_service = PaymentService(db_session)
        self.event_bus = get_event_bus()

    async def handle_create_payment(self, command: CreatePaymentCommand) -> Payment:
        """Handle CreatePaymentCommand"""
        logger.info(
            "Handling CreatePaymentCommand",
            command_id=command.command_id,
            customer_id=command.customer_id,
            amount=command.amount,
        )

        payment = await self.payment_service.create_payment(
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
            amount=command.amount,
            currency=command.currency,
            payment_method_id=command.payment_method_id,
            invoice_ids=[command.invoice_id] if command.invoice_id else None,
            metadata=command.metadata,
        )

        await self.event_bus.publish(
            event_type="billing.payment.created",
            payload={
                "payment_id": payment.payment_id,
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

        return payment

    async def handle_refund_payment(self, command: RefundPaymentCommand) -> Payment:
        """Handle RefundPaymentCommand"""
        logger.info(
            "Handling RefundPaymentCommand",
            payment_id=command.payment_id,
            amount=command.amount,
        )

        refund = await self.payment_service.refund_payment(
            tenant_id=command.tenant_id,
            payment_id=command.payment_id,
            amount=command.amount,
            reason=command.reason,
        )

        await self.event_bus.publish(
            event_type="billing.payment.refunded",
            payload={
                "payment_id": command.payment_id,
                "amount": command.amount,
                "reason": command.reason,
                "status": refund.status,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        return refund

    async def handle_cancel_payment(self, command: CancelPaymentCommand) -> Payment:
        """Handle CancelPaymentCommand"""
        logger.info(
            "Handling CancelPaymentCommand",
            payment_id=command.payment_id,
        )

        # Cancel payment using the service method
        payment = await self.payment_service.cancel_payment(
            tenant_id=command.tenant_id,
            payment_id=command.payment_id,
            cancellation_reason=command.cancellation_reason,
        )

        await self.event_bus.publish(
            event_type="billing.payment.cancelled",
            payload={
                "payment_id": command.payment_id,
                "reason": command.cancellation_reason,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        return payment

    async def handle_record_offline_payment(self, command: RecordOfflinePaymentCommand) -> Payment:
        """Handle RecordOfflinePaymentCommand"""
        logger.info(
            "Handling RecordOfflinePaymentCommand",
            invoice_id=command.invoice_id,
            payment_method=command.payment_method,
        )

        # Record offline payment using the service method
        payment = await self.payment_service.record_offline_payment(
            tenant_id=command.tenant_id,
            customer_id=command.customer_id,
            amount=command.amount,
            currency=command.currency,
            payment_method=command.payment_method,
            invoice_id=command.invoice_id,
            reference_number=command.reference_number,
            notes=command.notes,
        )

        await self.event_bus.publish(
            event_type="billing.payment.offline_recorded",
            payload={
                "payment_id": payment.payment_id,
                "invoice_id": command.invoice_id,
                "payment_method": command.payment_method,
                "amount": command.amount,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
        )

        return payment


class SubscriptionCommandHandler:
    """Handles subscription-related commands"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.subscription_service = SubscriptionService(db_session)
        self.event_bus = get_event_bus()

    async def handle_create_subscription(self, command: CreateSubscriptionCommand) -> Subscription:
        """Handle CreateSubscriptionCommand"""
        logger.info(
            "Handling CreateSubscriptionCommand",
            command_id=command.command_id,
            customer_id=command.customer_id,
            plan_id=command.plan_id,
        )

        subscription_request = SubscriptionCreateRequest(
            customer_id=command.customer_id,
            plan_id=command.plan_id,
            start_date=command.start_date,
            custom_price=None,
            trial_end_override=command.trial_end,
            metadata=command.metadata or {},
        )

        subscription = await self.subscription_service.create_subscription(
            subscription_data=subscription_request,
            tenant_id=command.tenant_id,
        )

        await self.event_bus.publish(
            event_type="billing.subscription.created",
            payload={
                "subscription_id": subscription.subscription_id,
                "customer_id": command.customer_id,
                "plan_id": command.plan_id,
                "status": subscription.status,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        return subscription

    async def handle_cancel_subscription(self, command: CancelSubscriptionCommand) -> Subscription:
        """Handle CancelSubscriptionCommand"""
        logger.info(
            "Handling CancelSubscriptionCommand",
            subscription_id=command.subscription_id,
            cancel_at_period_end=command.cancel_at_period_end,
        )

        subscription = await self.subscription_service.cancel_subscription(
            subscription_id=command.subscription_id,
            tenant_id=command.tenant_id,
            at_period_end=command.cancel_at_period_end,
            user_id=command.user_id,
        )

        await self.event_bus.publish(
            event_type="billing.subscription.cancelled",
            payload={
                "subscription_id": command.subscription_id,
                "cancel_at_period_end": command.cancel_at_period_end,
                "reason": command.cancellation_reason,
            },
            metadata={
                "tenant_id": command.tenant_id,
                "user_id": command.user_id,
            },
            priority=EventPriority.HIGH,
        )

        return subscription
