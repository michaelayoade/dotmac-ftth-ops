"""
Integration tests showing domain events working with billing module.

This demonstrates how domain events can enhance the existing billing
infrastructure without replacing the integration event bus.
"""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.core import (
    AggregateRoot,
    DomainEvent,
    InvoiceCreatedEvent,
    InvoicePaymentReceivedEvent,
    InvoiceVoidedEvent,
    Money,
    get_domain_event_dispatcher,
    get_domain_event_publisher,
    reset_domain_event_dispatcher,
    reset_domain_event_publisher,
)
from dotmac.platform.events import EventPriority

# ============================================================================
# Example Domain Aggregates (for demonstration)
# ============================================================================


class InvoiceAggregate(AggregateRoot):
    """
    Example Invoice aggregate using domain events.

    This demonstrates how billing entities could be refactored
    to use domain-driven design patterns.
    """

    invoice_number: str
    customer_id: str
    amount: float
    currency: str = "USD"
    status: str = "draft"

    @classmethod
    def create(
        cls,
        tenant_id: str,
        customer_id: str,
        amount: float,
        currency: str = "USD",
    ) -> "InvoiceAggregate":
        """Create new invoice - raises InvoiceCreatedEvent."""
        invoice = cls(
            id=str(uuid4()),
            tenant_id=tenant_id,
            invoice_number=f"INV-{str(uuid4())[:8].upper()}",
            customer_id=customer_id,
            amount=amount,
            currency=currency,
        )

        invoice.raise_event(
            InvoiceCreatedEvent(
                aggregate_id=invoice.id,
                tenant_id=invoice.tenant_id,
                invoice_number=invoice.invoice_number,
                customer_id=invoice.customer_id,
                amount=invoice.amount,
                currency=invoice.currency,
            )
        )

        return invoice

    def pay(self, payment_id: str, amount: float) -> None:
        """Record payment for invoice - raises InvoicePaymentReceivedEvent."""
        from dotmac.platform.core.exceptions import BusinessRuleError

        if self.status == "paid":
            raise BusinessRuleError("Invoice already paid")

        if self.status == "void":
            raise BusinessRuleError("Cannot pay voided invoice")

        if amount != self.amount:
            raise BusinessRuleError(
                f"Payment amount {amount} does not match invoice amount {self.amount}"
            )

        self.status = "paid"

        self.raise_event(
            InvoicePaymentReceivedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                invoice_number=self.invoice_number,
                payment_id=payment_id,
                amount=amount,
                payment_method="card",
            )
        )

    def void(self, reason: str | None = None) -> None:
        """Void invoice - raises InvoiceVoidedEvent."""
        from dotmac.platform.core.exceptions import BusinessRuleError

        if self.status == "paid":
            raise BusinessRuleError("Cannot void paid invoice")

        self.status = "void"

        self.raise_event(
            InvoiceVoidedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                invoice_number=self.invoice_number,
                reason=reason,
            )
        )


# ============================================================================
# Domain Event Handler Tests
# ============================================================================


@pytest.mark.unit
class TestDomainEventBillingIntegration:
    """Test domain events integration with billing patterns."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_dispatcher()
        reset_domain_event_publisher()
        yield
        reset_domain_event_dispatcher()
        reset_domain_event_publisher()

    def test_invoice_aggregate_raises_created_event(self):
        """Test invoice aggregate raises InvoiceCreatedEvent."""
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.50,
            currency="USD",
        )

        events = invoice.get_domain_events()

        assert len(events) == 1
        assert isinstance(events[0], InvoiceCreatedEvent)
        assert events[0].invoice_number == invoice.invoice_number
        assert events[0].customer_id == "cust-123"
        assert events[0].amount == 100.50
        assert events[0].currency == "USD"
        assert events[0].tenant_id == "tenant-1"

    def test_invoice_aggregate_raises_payment_event(self):
        """Test invoice payment raises InvoicePaymentReceivedEvent."""
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        # Clear creation event
        invoice.clear_domain_events()

        # Pay invoice
        invoice.pay(payment_id="pay-456", amount=100.00)

        events = invoice.get_domain_events()

        assert len(events) == 1
        assert isinstance(events[0], InvoicePaymentReceivedEvent)
        assert events[0].payment_id == "pay-456"
        assert events[0].amount == 100.00
        assert invoice.status == "paid"

    def test_invoice_payment_business_rule_enforcement(self):
        """Test business rules are enforced when paying invoice."""
        from dotmac.platform.core.exceptions import BusinessRuleError

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        # Pay once - should succeed
        invoice.pay(payment_id="pay-1", amount=100.00)

        # Try to pay again - should fail
        with pytest.raises(BusinessRuleError, match="already paid"):
            invoice.pay(payment_id="pay-2", amount=100.00)

    def test_invoice_void_raises_event(self):
        """Test voiding invoice raises InvoiceVoidedEvent."""
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.clear_domain_events()

        invoice.void(reason="Customer cancelled order")

        events = invoice.get_domain_events()

        assert len(events) == 1
        assert isinstance(events[0], InvoiceVoidedEvent)
        assert events[0].reason == "Customer cancelled order"
        assert invoice.status == "void"

    def test_multiple_events_have_sequence_numbers(self):
        """Test multiple events have correct sequence numbers."""
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.pay(payment_id="pay-1", amount=100.00)

        events = invoice.get_domain_events()

        assert len(events) == 2
        assert events[0].sequence == 1  # InvoiceCreatedEvent
        assert events[1].sequence == 2  # InvoicePaymentReceivedEvent


@pytest.mark.asyncio
@pytest.mark.unit
class TestDomainEventDispatcherBilling:
    """Test domain event dispatcher with billing events."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_dispatcher()
        yield
        reset_domain_event_dispatcher()

    async def test_subscribe_to_invoice_created_event(self):
        """Test subscribing to invoice created events."""
        dispatcher = get_domain_event_dispatcher()
        handler_called = False
        received_event = None

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handle_invoice_created(event: InvoiceCreatedEvent):
            nonlocal handler_called, received_event
            handler_called = True
            received_event = event

        # Create invoice
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=299.99,
        )

        # Dispatch events
        events = invoice.get_domain_events()
        await dispatcher.dispatch_all(list(events))

        assert handler_called
        assert received_event.invoice_number == invoice.invoice_number
        assert received_event.amount == 299.99

    async def test_multiple_handlers_for_invoice_event(self):
        """Test multiple handlers can subscribe to same event."""
        dispatcher = get_domain_event_dispatcher()
        handler1_called = False
        handler2_called = False

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def send_notification(event: InvoiceCreatedEvent):
            nonlocal handler1_called
            handler1_called = True

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def update_analytics(event: InvoiceCreatedEvent):
            nonlocal handler2_called
            handler2_called = True

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        events = invoice.get_domain_events()
        await dispatcher.dispatch_all(list(events))

        assert handler1_called
        assert handler2_called

    async def test_global_handler_receives_all_billing_events(self):
        """Test global handler receives all billing events."""
        dispatcher = get_domain_event_dispatcher()
        events_received = []

        async def audit_all_events(event: DomainEvent):
            events_received.append(event.event_type)

        dispatcher.subscribe_all(audit_all_events)

        # Create and pay invoice
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.pay(payment_id="pay-1", amount=100.00)

        events = invoice.get_domain_events()
        await dispatcher.dispatch_all(list(events))

        assert "InvoiceCreatedEvent" in events_received
        assert "InvoicePaymentReceivedEvent" in events_received


@pytest.mark.asyncio
@pytest.mark.unit
class TestDomainEventPublisherIntegration:
    """Test domain event publisher integration with event bus."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_publisher()
        reset_domain_event_dispatcher()
        yield
        reset_domain_event_publisher()
        reset_domain_event_dispatcher()

    async def test_domain_events_publish_to_integration_bus(self):
        """Test domain events are published to integration event bus."""
        mock_event_bus = AsyncMock()

        publisher = get_domain_event_publisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        await publisher.publish_from_aggregate(invoice)

        # Verify integration event was published
        assert mock_event_bus.publish.called
        call_args = mock_event_bus.publish.call_args

        assert call_args.kwargs["event_type"] == "invoice.invoice_created"
        assert call_args.kwargs["payload"]["invoice_number"] == invoice.invoice_number
        assert call_args.kwargs["metadata"]["tenant_id"] == "tenant-1"

    async def test_domain_events_mapped_to_correct_integration_type(self):
        """Test domain event type mapping to integration event types."""
        mock_event_bus = AsyncMock()

        publisher = get_domain_event_publisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.pay(payment_id="pay-1", amount=100.00)

        await publisher.publish_from_aggregate(invoice)

        # Should have published 2 events
        assert mock_event_bus.publish.call_count == 2

        # Get all calls
        calls = mock_event_bus.publish.call_args_list

        # First event: InvoiceCreatedEvent → invoice.invoice_created
        assert calls[0].kwargs["event_type"] == "invoice.invoice_created"

        # Second event: InvoicePaymentReceivedEvent → invoice.invoice_payment_received
        assert calls[1].kwargs["event_type"] == "invoice.invoice_payment_received"

    async def test_domain_events_have_correct_priority(self):
        """Test domain events are mapped to correct priority."""
        mock_event_bus = AsyncMock()

        publisher = get_domain_event_publisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.pay(payment_id="pay-1", amount=100.00)

        await publisher.publish_from_aggregate(invoice)

        calls = mock_event_bus.publish.call_args_list

        # Payment events should be HIGH priority
        assert calls[1].kwargs["priority"] == EventPriority.HIGH

    async def test_aggregate_version_increments_after_publishing(self):
        """Test aggregate version increments after publishing events."""
        mock_event_bus = AsyncMock()

        publisher = get_domain_event_publisher(event_bus=mock_event_bus)

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        initial_version = invoice.version

        await publisher.publish_from_aggregate(invoice)

        assert invoice.version == initial_version + 1

    async def test_events_cleared_after_publishing(self):
        """Test events are cleared from aggregate after publishing."""
        mock_event_bus = AsyncMock()

        publisher = get_domain_event_publisher(event_bus=mock_event_bus)

        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        assert len(invoice.get_domain_events()) == 1

        await publisher.publish_from_aggregate(invoice, clear_events=True)

        assert len(invoice.get_domain_events()) == 0


@pytest.mark.unit
class TestMoneyValueObjectWithBilling:
    """Test Money value object with billing scenarios."""

    def test_money_in_invoice_amounts(self):
        """Test Money value object for invoice amounts."""
        subtotal = Money(amount=100.00, currency="USD")
        tax = Money(amount=10.00, currency="USD")

        total = subtotal.add(tax)

        assert total.amount == 110.00
        assert total.currency == "USD"

    def test_money_prevents_currency_mismatch(self):
        """Test Money prevents adding different currencies."""
        usd_amount = Money(amount=100.00, currency="USD")
        eur_amount = Money(amount=100.00, currency="EUR")

        with pytest.raises(ValueError, match="Cannot add USD and EUR"):
            usd_amount.add(eur_amount)

    def test_money_immutability(self):
        """Test Money is immutable."""
        price = Money(amount=99.99, currency="USD")

        with pytest.raises(Exception):  # ValidationError for frozen model  # noqa: B017
            price.amount = 100.00


# ============================================================================
# Integration Pattern Examples
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.unit
class TestBillingWorkflowWithDomainEvents:
    """Test complete billing workflows using domain events."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_dispatcher()
        reset_domain_event_publisher()
        yield
        reset_domain_event_dispatcher()
        reset_domain_event_publisher()

    async def test_invoice_creation_workflow(self):
        """Test invoice creation workflow with domain events."""
        dispatcher = get_domain_event_dispatcher()
        workflow_steps = []

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def send_invoice_notification(event: InvoiceCreatedEvent):
            workflow_steps.append("notification_sent")

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def update_customer_stats(event: InvoiceCreatedEvent):
            workflow_steps.append("stats_updated")

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def trigger_webhook(event: InvoiceCreatedEvent):
            workflow_steps.append("webhook_triggered")

        # Create invoice
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        # Dispatch events
        events = invoice.get_domain_events()
        await dispatcher.dispatch_all(list(events))

        # Verify all workflow steps executed
        assert "notification_sent" in workflow_steps
        assert "stats_updated" in workflow_steps
        assert "webhook_triggered" in workflow_steps

    async def test_payment_workflow_with_both_event_systems(self):
        """Test payment workflow using both domain and integration events."""
        # Setup domain event dispatcher
        domain_dispatcher = get_domain_event_dispatcher()
        domain_events_received = []

        @domain_dispatcher.subscribe(InvoicePaymentReceivedEvent)
        async def handle_domain_payment(event: InvoicePaymentReceivedEvent):
            domain_events_received.append(event)

        # Setup integration event bus
        mock_integration_bus = AsyncMock()

        publisher = get_domain_event_publisher(
            event_bus=mock_integration_bus,
            publish_to_integration_bus=True,
        )

        # Create and pay invoice
        invoice = InvoiceAggregate.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            amount=100.00,
        )

        invoice.pay(payment_id="pay-1", amount=100.00)

        # Publish events (triggers both systems)
        await publisher.publish_from_aggregate(invoice)

        # Verify domain events were dispatched
        assert len(domain_events_received) == 1
        assert domain_events_received[0].payment_id == "pay-1"

        # Verify integration events were published
        assert mock_integration_bus.publish.call_count == 2
        integration_calls = mock_integration_bus.publish.call_args_list

        event_types = [call.kwargs["event_type"] for call in integration_calls]
        assert "invoice.invoice_created" in event_types
        assert "invoice.invoice_payment_received" in event_types
