"""Tests for domain event integration with event bus."""

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.core import (
    AggregateRoot,
    DomainEventPublisher,
    InvoiceCreatedEvent,
    InvoicePaymentReceivedEvent,
    get_domain_event_publisher,
    reset_domain_event_publisher,
)
from dotmac.platform.events import EventBus, EventPriority


@pytest.mark.unit
class TestDomainEventPublisher:
    """Test domain event publisher."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_domain_event_publisher()
        yield
        reset_domain_event_publisher()

    @pytest.mark.asyncio
    async def test_publish_from_aggregate(self):
        """Test publishing events from aggregate."""

        @pytest.mark.unit
        class TestInvoice(AggregateRoot):
            invoice_number: str
            amount: float

            def create(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number=self.invoice_number,
                        customer_id="cust-1",
                        amount=self.amount,
                        currency="USD",
                    )
                )

        # Create mock event bus
        mock_event_bus = AsyncMock(spec=EventBus)

        publisher = DomainEventPublisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        # Create invoice and raise event
        invoice = TestInvoice(
            id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            amount=100.0,
        )

        invoice.create()

        # Publish events
        await publisher.publish_from_aggregate(invoice)

        # Verify integration event was published
        assert mock_event_bus.publish.called
        call_args = mock_event_bus.publish.call_args

        assert call_args.kwargs["event_type"] == "invoice.invoice_created"
        assert call_args.kwargs["payload"]["invoice_number"] == "INV-001"
        assert call_args.kwargs["metadata"]["tenant_id"] == "tenant-1"

    @pytest.mark.asyncio
    async def test_publish_without_integration_bus(self):
        """Test publishing events without integration bus."""
        mock_event_bus = AsyncMock(spec=EventBus)

        publisher = DomainEventPublisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=False,  # Disabled
        )

        @pytest.mark.unit
        class TestAggregate(AggregateRoot):
            def action(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number="INV-001",
                        customer_id="cust-1",
                        amount=100.0,
                        currency="USD",
                    )
                )

        aggregate = TestAggregate(id="agg-1", tenant_id="tenant-1")
        aggregate.action()

        await publisher.publish_from_aggregate(aggregate)

        # Integration bus should NOT be called
        assert not mock_event_bus.publish.called

    @pytest.mark.asyncio
    async def test_publish_single_domain_event(self):
        """Test publishing single domain event."""
        mock_event_bus = AsyncMock(spec=EventBus)

        publisher = DomainEventPublisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
        )

        await publisher.publish_domain_event(event)

        assert mock_event_bus.publish.called

    @pytest.mark.asyncio
    async def test_event_type_mapping(self):
        """Test that domain event types are mapped correctly."""
        mock_event_bus = AsyncMock(spec=EventBus)

        publisher = DomainEventPublisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        # Test different event types
        events_to_test = [
            (
                InvoiceCreatedEvent(
                    aggregate_id="inv-1",
                    tenant_id="tenant-1",
                    invoice_number="INV-001",
                    customer_id="cust-1",
                    amount=100.0,
                    currency="USD",
                ),
                "invoice.invoice_created",
            ),
            (
                InvoicePaymentReceivedEvent(
                    aggregate_id="inv-1",
                    tenant_id="tenant-1",
                    invoice_number="INV-001",
                    payment_id="pay-1",
                    amount=100.0,
                    payment_method="card",
                ),
                "invoice.invoice_payment_received",
            ),
        ]

        for event, expected_type in events_to_test:
            mock_event_bus.reset_mock()
            await publisher.publish_domain_event(event)

            call_args = mock_event_bus.publish.call_args
            assert call_args.kwargs["event_type"] == expected_type

    @pytest.mark.asyncio
    async def test_event_priority_mapping(self):
        """Test that event priorities are mapped correctly."""
        mock_event_bus = AsyncMock(spec=EventBus)

        publisher = DomainEventPublisher(
            event_bus=mock_event_bus,
            publish_to_integration_bus=True,
        )

        # Payment events should be HIGH priority
        payment_event = InvoicePaymentReceivedEvent(
            aggregate_id="inv-1",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            payment_id="pay-1",
            amount=100.0,
            payment_method="card",
        )

        await publisher.publish_domain_event(payment_event)

        call_args = mock_event_bus.publish.call_args
        assert call_args.kwargs["priority"] == EventPriority.HIGH

    @pytest.mark.asyncio
    async def test_aggregate_version_increment(self):
        """Test that aggregate version increments after publishing."""

        class TestAggregate(AggregateRoot):
            def action(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number="INV-001",
                        customer_id="cust-1",
                        amount=100.0,
                        currency="USD",
                    )
                )

        mock_event_bus = AsyncMock(spec=EventBus)
        publisher = DomainEventPublisher(event_bus=mock_event_bus)

        aggregate = TestAggregate(id="agg-1", tenant_id="tenant-1")
        initial_version = aggregate.version

        aggregate.action()
        await publisher.publish_from_aggregate(aggregate)

        assert aggregate.version == initial_version + 1

    @pytest.mark.asyncio
    async def test_events_cleared_after_publishing(self):
        """Test that events are cleared from aggregate after publishing."""

        class TestAggregate(AggregateRoot):
            def action(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number="INV-001",
                        customer_id="cust-1",
                        amount=100.0,
                        currency="USD",
                    )
                )

        mock_event_bus = AsyncMock(spec=EventBus)
        publisher = DomainEventPublisher(event_bus=mock_event_bus)

        aggregate = TestAggregate(id="agg-1", tenant_id="tenant-1")
        aggregate.action()

        assert len(aggregate.get_domain_events()) == 1

        await publisher.publish_from_aggregate(aggregate, clear_events=True)

        assert len(aggregate.get_domain_events()) == 0

    @pytest.mark.asyncio
    async def test_events_not_cleared_when_disabled(self):
        """Test that events are not cleared when clear_events=False."""

        class TestAggregate(AggregateRoot):
            def action(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number="INV-001",
                        customer_id="cust-1",
                        amount=100.0,
                        currency="USD",
                    )
                )

        mock_event_bus = AsyncMock(spec=EventBus)
        publisher = DomainEventPublisher(event_bus=mock_event_bus)

        aggregate = TestAggregate(id="agg-1", tenant_id="tenant-1")
        aggregate.action()

        await publisher.publish_from_aggregate(aggregate, clear_events=False)

        assert len(aggregate.get_domain_events()) == 1

    def test_get_global_publisher(self):
        """Test getting global publisher instance."""
        publisher1 = get_domain_event_publisher()
        publisher2 = get_domain_event_publisher()

        assert publisher1 is publisher2
