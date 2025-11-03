"""Tests for domain events infrastructure."""

from datetime import UTC, datetime

import pytest

from dotmac.platform.core import (
    AggregateRoot,
    EmailAddress,
    InvoiceCreatedEvent,
    InvoicePaymentReceivedEvent,
    Money,
)


@pytest.mark.unit
class TestDomainEvent:
    """Test domain event base class."""

    def test_create_domain_event(self):
        """Test creating a domain event."""
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
        )

        assert event.event_id is not None
        assert event.event_type == "InvoiceCreatedEvent"
        assert event.aggregate_id == "inv-123"
        assert event.tenant_id == "tenant-1"
        assert event.invoice_number == "INV-2024-001"
        assert event.timestamp is not None

    def test_domain_event_immutability(self):
        """Test that domain events are immutable."""
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
        )

        # Should not be able to modify frozen event
        with pytest.raises(Exception):  # ValidationError in Pydantic v2  # noqa: B017
            event.invoice_number = "INV-2024-002"

    def test_domain_event_to_dict(self):
        """Test converting event to dictionary."""
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
        )

        event_dict = event.to_dict()

        assert event_dict["event_type"] == "InvoiceCreatedEvent"
        assert event_dict["aggregate_id"] == "inv-123"
        assert event_dict["invoice_number"] == "INV-2024-001"

    def test_domain_event_from_dict(self):
        """Test creating event from dictionary."""
        event_dict = {
            "event_id": "event-123",
            "event_type": "InvoiceCreatedEvent",
            "aggregate_id": "inv-123",
            "tenant_id": "tenant-1",
            "invoice_number": "INV-2024-001",
            "customer_id": "cust-456",
            "amount": 299.99,
            "currency": "USD",
            "timestamp": datetime.now(UTC).isoformat(),
        }

        event = InvoiceCreatedEvent.from_dict(event_dict)

        assert event.event_id == "event-123"
        assert event.invoice_number == "INV-2024-001"

    def test_domain_event_with_metadata(self):
        """Test domain event with metadata."""
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
            metadata={
                "correlation_id": "request-123",
                "user_id": "user-456",
                "source": "api",
            },
        )

        assert event.metadata["correlation_id"] == "request-123"
        assert event.metadata["user_id"] == "user-456"

    def test_domain_event_sequence(self):
        """Test domain event sequence numbers."""
        event1 = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust-456",
            amount=299.99,
            currency="USD",
            sequence=1,
        )

        event2 = InvoicePaymentReceivedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            payment_id="pay-789",
            amount=299.99,
            payment_method="credit_card",
            sequence=2,
        )

        assert event1.sequence == 1
        assert event2.sequence == 2


@pytest.mark.unit
class TestAggregateRoot:
    """Test aggregate root functionality."""

    def test_aggregate_root_raises_events(self):
        """Test that aggregate root can raise domain events."""

        @pytest.mark.unit
        class TestInvoice(AggregateRoot):
            """Test invoice aggregate."""

            invoice_number: str
            amount: float
            status: str = "pending"

            def pay(self, payment_id: str):
                """Pay the invoice."""
                self.status = "paid"

                self.raise_event(
                    InvoicePaymentReceivedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number=self.invoice_number,
                        payment_id=payment_id,
                        amount=self.amount,
                        payment_method="credit_card",
                    )
                )

        # Create invoice
        invoice = TestInvoice(
            id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            amount=299.99,
        )

        # Pay invoice - raises event
        invoice.pay("pay-789")

        # Check events
        events = invoice.get_domain_events()
        assert len(events) == 1
        assert events[0].event_type == "InvoicePaymentReceivedEvent"
        assert events[0].payment_id == "pay-789"
        assert events[0].sequence == 1

    def test_aggregate_root_clear_events(self):
        """Test clearing domain events from aggregate."""

        @pytest.mark.unit
        class TestInvoice(AggregateRoot):
            invoice_number: str

            def void(self):
                self.raise_event(
                    InvoiceCreatedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number=self.invoice_number,
                        customer_id="cust-123",
                        amount=100.0,
                        currency="USD",
                    )
                )

        invoice = TestInvoice(
            id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
        )

        invoice.void()
        assert len(invoice.get_domain_events()) == 1

        invoice.clear_domain_events()
        assert len(invoice.get_domain_events()) == 0

    def test_aggregate_root_version_increment(self):
        """Test aggregate version increments."""

        @pytest.mark.unit
        class TestAggregate(AggregateRoot):
            pass

        aggregate = TestAggregate(id="agg-123", tenant_id="tenant-1")

        assert aggregate.version == 1

        aggregate.increment_version()
        assert aggregate.version == 2

        aggregate.increment_version()
        assert aggregate.version == 3


@pytest.mark.unit
class TestValueObjects:
    """Test value objects."""

    def test_money_value_object(self):
        """Test Money value object."""
        money = Money(amount=100.50, currency="USD")

        assert money.amount == 100.50
        assert money.currency == "USD"
        assert money.is_positive()
        assert not money.is_zero()

    def test_money_addition(self):
        """Test adding money values."""
        money1 = Money(amount=100.00, currency="USD")
        money2 = Money(amount=50.00, currency="USD")

        result = money1.add(money2)

        assert result.amount == 150.00
        assert result.currency == "USD"

    def test_money_subtraction(self):
        """Test subtracting money values."""
        money1 = Money(amount=100.00, currency="USD")
        money2 = Money(amount=30.00, currency="USD")

        result = money1.subtract(money2)

        assert result.amount == 70.00

    def test_money_multiplication(self):
        """Test multiplying money."""
        money = Money(amount=50.00, currency="USD")
        result = money.multiply(2)

        assert result.amount == 100.00

    def test_money_currency_mismatch(self):
        """Test that adding different currencies raises error."""
        usd = Money(amount=100.00, currency="USD")
        eur = Money(amount=100.00, currency="EUR")

        with pytest.raises(ValueError, match="Cannot add"):
            usd.add(eur)

    def test_money_immutability(self):
        """Test that Money is immutable."""
        money = Money(amount=100.00, currency="USD")

        with pytest.raises(Exception):  # noqa: B017
            money.amount = 200.00

    def test_email_value_object(self):
        """Test EmailAddress value object."""
        email = EmailAddress(value="user@example.com")

        assert email.value == "user@example.com"
        assert email.domain == "example.com"
        assert email.local_part == "user"

    def test_email_immutability(self):
        """Test that EmailAddress is immutable."""
        email = EmailAddress(value="user@example.com")

        with pytest.raises(Exception):  # noqa: B017
            email.value = "other@example.com"


@pytest.mark.unit
class TestDomainEventSequencing:
    """Test domain event sequencing and ordering."""

    def test_multiple_events_sequence(self):
        """Test that multiple events get proper sequence numbers."""

        @pytest.mark.unit
        class TestAggregate(AggregateRoot):
            def action1(self):
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

            def action2(self):
                self.raise_event(
                    InvoicePaymentReceivedEvent(
                        aggregate_id=self.id,
                        tenant_id=self.tenant_id,
                        invoice_number="INV-001",
                        payment_id="pay-1",
                        amount=100.0,
                        payment_method="card",
                    )
                )

        aggregate = TestAggregate(id="agg-1", tenant_id="tenant-1")

        aggregate.action1()
        aggregate.action2()

        events = aggregate.get_domain_events()

        assert len(events) == 2
        assert events[0].sequence == 1
        assert events[1].sequence == 2
        assert events[0].event_type == "InvoiceCreatedEvent"
        assert events[1].event_type == "InvoicePaymentReceivedEvent"


@pytest.mark.unit
class TestDomainEventTypes:
    """Test all domain event types."""

    def test_invoice_voided_event(self):
        """Test InvoiceVoidedEvent."""
        from dotmac.platform.core.events import InvoiceVoidedEvent

        event = InvoiceVoidedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            reason="Customer request",
        )

        assert event.event_type == "InvoiceVoidedEvent"
        assert event.reason == "Customer request"
        assert event._aggregate_type == "Invoice"

    def test_invoice_overdue_event(self):
        """Test InvoiceOverdueEvent."""
        from dotmac.platform.core.events import InvoiceOverdueEvent

        event = InvoiceOverdueEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            days_overdue=30,
            amount_due=500.00,
        )

        assert event.days_overdue == 30
        assert event.amount_due == 500.00

    def test_subscription_created_event(self):
        """Test SubscriptionCreatedEvent."""
        from datetime import datetime

        from dotmac.platform.core.events import SubscriptionCreatedEvent

        now = datetime.now(UTC)
        event = SubscriptionCreatedEvent(
            aggregate_id="sub-123",
            tenant_id="tenant-1",
            subscription_id="sub-123",
            customer_id="cust-456",
            plan_id="plan-premium",
            start_date=now,
        )

        assert event.subscription_id == "sub-123"
        assert event.plan_id == "plan-premium"
        assert event._aggregate_type == "Subscription"

    def test_subscription_renewed_event(self):
        """Test SubscriptionRenewedEvent."""
        from datetime import datetime

        from dotmac.platform.core.events import SubscriptionRenewedEvent

        now = datetime.now(UTC)
        event = SubscriptionRenewedEvent(
            aggregate_id="sub-123",
            tenant_id="tenant-1",
            subscription_id="sub-123",
            renewal_date=now,
            next_billing_date=now,
        )

        assert event.subscription_id == "sub-123"

    def test_subscription_cancelled_event(self):
        """Test SubscriptionCancelledEvent."""
        from datetime import datetime

        from dotmac.platform.core.events import SubscriptionCancelledEvent

        now = datetime.now(UTC)
        event = SubscriptionCancelledEvent(
            aggregate_id="sub-123",
            tenant_id="tenant-1",
            subscription_id="sub-123",
            cancellation_reason="Customer request",
            cancelled_at=now,
            end_of_service_date=now,
        )

        assert event.cancellation_reason == "Customer request"

    def test_subscription_upgraded_event(self):
        """Test SubscriptionUpgradedEvent."""
        from datetime import datetime

        from dotmac.platform.core.events import SubscriptionUpgradedEvent

        now = datetime.now(UTC)
        event = SubscriptionUpgradedEvent(
            aggregate_id="sub-123",
            tenant_id="tenant-1",
            subscription_id="sub-123",
            old_plan_id="plan-basic",
            new_plan_id="plan-premium",
            effective_date=now,
        )

        assert event.old_plan_id == "plan-basic"
        assert event.new_plan_id == "plan-premium"

    def test_customer_created_event(self):
        """Test CustomerCreatedEvent."""
        from dotmac.platform.core.events import CustomerCreatedEvent

        event = CustomerCreatedEvent(
            aggregate_id="cust-123",
            tenant_id="tenant-1",
            customer_id="cust-123",
            email="customer@example.com",
            name="John Doe",
        )

        assert event.email == "customer@example.com"
        assert event._aggregate_type == "Customer"

    def test_customer_updated_event(self):
        """Test CustomerUpdatedEvent."""
        from dotmac.platform.core.events import CustomerUpdatedEvent

        event = CustomerUpdatedEvent(
            aggregate_id="cust-123",
            tenant_id="tenant-1",
            customer_id="cust-123",
            updated_fields=["email", "name"],
        )

        assert "email" in event.updated_fields

    def test_customer_deleted_event(self):
        """Test CustomerDeletedEvent."""
        from dotmac.platform.core.events import CustomerDeletedEvent

        event = CustomerDeletedEvent(
            aggregate_id="cust-123",
            tenant_id="tenant-1",
            customer_id="cust-123",
            deletion_reason="Account closed",
        )

        assert event.deletion_reason == "Account closed"

    def test_payment_processed_event(self):
        """Test PaymentProcessedEvent."""
        from dotmac.platform.core.events import PaymentProcessedEvent

        event = PaymentProcessedEvent(
            aggregate_id="pay-123",
            tenant_id="tenant-1",
            payment_id="pay-123",
            amount=100.00,
            currency="USD",
            payment_method="credit_card",
            customer_id="cust-456",
        )

        assert event.payment_id == "pay-123"
        assert event._aggregate_type == "Payment"

    def test_payment_failed_event(self):
        """Test PaymentFailedEvent."""
        from dotmac.platform.core.events import PaymentFailedEvent

        event = PaymentFailedEvent(
            aggregate_id="pay-123",
            tenant_id="tenant-1",
            payment_id="pay-123",
            amount=100.00,
            currency="USD",
            error_code="insufficient_funds",
            error_message="Insufficient funds",
            customer_id="cust-456",
        )

        assert event.error_code == "insufficient_funds"

    def test_payment_refunded_event(self):
        """Test PaymentRefundedEvent."""
        from dotmac.platform.core.events import PaymentRefundedEvent

        event = PaymentRefundedEvent(
            aggregate_id="pay-123",
            tenant_id="tenant-1",
            payment_id="pay-123",
            refund_id="ref-456",
            amount=100.00,
            reason="Customer request",
        )

        assert event.refund_id == "ref-456"
        assert event.reason == "Customer request"

    def test_domain_event_metadata_model(self):
        """Test DomainEventMetadata model."""
        from dotmac.platform.core.events import DomainEventMetadata

        metadata = DomainEventMetadata(
            correlation_id="corr-123",
            causation_id="cause-456",
            user_id="user-789",
            source="api",
            trace_id="trace-abc",
        )

        assert metadata.correlation_id == "corr-123"
        assert metadata.causation_id == "cause-456"
        assert metadata.user_id == "user-789"
        assert metadata.source == "api"
        assert metadata.trace_id == "trace-abc"

    def test_domain_event_str_representation(self):
        """Test DomainEvent string representation."""
        event = InvoiceCreatedEvent(
            aggregate_id="inv-123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
            customer_id="cust-456",
            amount=100.00,
            currency="USD",
        )

        str_repr = str(event)
        assert "InvoiceCreatedEvent" in str_repr
        assert "inv-123" in str_repr
        assert "tenant-1" in str_repr
