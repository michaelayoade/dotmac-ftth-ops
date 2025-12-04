"""Tests for domain event dispatcher."""

import pytest

from dotmac.platform.core import (
    AggregateRoot,
    DomainEventDispatcher,
    InvoiceCreatedEvent,
    InvoicePaymentReceivedEvent,
    get_domain_event_dispatcher,
    reset_domain_event_dispatcher,
)


@pytest.mark.unit
class TestDomainEventDispatcher:
    """Test domain event dispatcher."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_dispatcher()
        yield
        reset_domain_event_dispatcher()

    @pytest.mark.asyncio
    async def test_subscribe_and_dispatch(self):
        """Test subscribing to and dispatching events."""
        dispatcher = DomainEventDispatcher()
        handler_called = False
        received_event = None

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handle_invoice_created(event):
            nonlocal handler_called, received_event
            handler_called = True
            received_event = event

        # Dispatch event
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
        )

        await dispatcher.dispatch(event)

        assert handler_called
        assert received_event is not None
        assert received_event.invoice_number == "INV-2024-001"

    @pytest.mark.asyncio
    async def test_multiple_handlers(self):
        """Test multiple handlers for same event type."""
        dispatcher = DomainEventDispatcher()
        handler1_called = False
        handler2_called = False

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handler1(event):
            nonlocal handler1_called
            handler1_called = True

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handler2(event):
            nonlocal handler2_called
            handler2_called = True

        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        await dispatcher.dispatch(event)

        assert handler1_called
        assert handler2_called

    @pytest.mark.asyncio
    async def test_global_handler(self):
        """Test global handler that receives all events."""
        dispatcher = DomainEventDispatcher()
        events_received = []

        async def global_handler(event):
            events_received.append(event.event_type)

        dispatcher.subscribe_all(global_handler)

        # Dispatch different event types
        event1 = InvoiceCreatedEvent(
            aggregate_id="inv-1",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        event2 = InvoicePaymentReceivedEvent(
            aggregate_id="inv-1",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            payment_id="pay-1",
            amount=100.0,
            payment_method="card",
        )

        await dispatcher.dispatch(event1)
        await dispatcher.dispatch(event2)

        assert len(events_received) == 2
        assert "InvoiceCreatedEvent" in events_received
        assert "InvoicePaymentReceivedEvent" in events_received

    @pytest.mark.asyncio
    async def test_dispatch_all(self):
        """Test dispatching multiple events."""
        dispatcher = DomainEventDispatcher()
        events_received = []

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handler(event):
            events_received.append(event)

        # Create multiple events
        events = [
            InvoiceCreatedEvent(
                aggregate_id=f"inv-{i}",
                tenant_id="tenant-1",
                invoice_number=f"INV-{i}",
                customer_id="cust-1",
                amount=100.0,
                currency="USD",
            )
            for i in range(3)
        ]

        await dispatcher.dispatch_all(events)

        assert len(events_received) == 3

    @pytest.mark.asyncio
    async def test_unsubscribe(self):
        """Test unsubscribing a handler."""
        dispatcher = DomainEventDispatcher()
        handler_called = False

        async def handler(event):
            nonlocal handler_called
            handler_called = True

        # Subscribe then unsubscribe
        decorator = dispatcher.subscribe(InvoiceCreatedEvent)
        decorated_handler = decorator(handler)
        dispatcher.unsubscribe(InvoiceCreatedEvent, decorated_handler)

        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        await dispatcher.dispatch(event)

        # Handler should not be called
        assert not handler_called

    @pytest.mark.asyncio
    async def test_handler_error_handling(self):
        """Test that handler errors are caught and logged."""
        dispatcher = DomainEventDispatcher()

        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def failing_handler(event):
            raise ValueError("Handler error")

        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        # Should not raise exception (errors are caught)
        await dispatcher.dispatch(event)

    @pytest.mark.asyncio
    async def test_subscribe_by_string(self):
        """Test subscribing using event type string."""
        dispatcher = DomainEventDispatcher()
        handler_called = False

        @dispatcher.subscribe("InvoiceCreatedEvent")
        async def handler(event):
            nonlocal handler_called
            handler_called = True

        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        await dispatcher.dispatch(event)

        assert handler_called

    def test_get_global_dispatcher(self):
        """Test getting global dispatcher instance."""
        dispatcher1 = get_domain_event_dispatcher()
        dispatcher2 = get_domain_event_dispatcher()

        assert dispatcher1 is dispatcher2

    @pytest.mark.asyncio
    async def test_dispatcher_with_aggregate(self):
        """Test dispatcher with aggregate root."""

        @pytest.mark.unit
        class TestInvoice(AggregateRoot):
            invoice_number: str
            amount: float

            def pay(self, payment_id: str):
                self.raise_event(
                    InvoicePaymentReceivedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number=self.invoice_number,
                        payment_id=payment_id,
                        amount=self.amount,
                        payment_method="card",
                    )
                )

        dispatcher = DomainEventDispatcher()
        payment_received = []

        @dispatcher.subscribe(InvoicePaymentReceivedEvent)
        async def handle_payment(event):
            payment_received.append(event.payment_id)

        # Create and pay invoice
        invoice = TestInvoice(
            id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            amount=100.0,
        )

        invoice.pay("pay-456")

        # Dispatch events from aggregate
        events = invoice.get_domain_events()
        await dispatcher.dispatch_all(list(events))

        assert len(payment_received) == 1
        assert payment_received[0] == "pay-456"
