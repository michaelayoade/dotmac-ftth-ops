"""Tests for billing event integration."""

import pytest

from dotmac.platform.billing.events import (
    BillingEvents,
    emit_invoice_created,
    emit_invoice_paid,
    emit_payment_failed,
    emit_subscription_cancelled,
    emit_subscription_created,
)
from dotmac.platform.events import Event, get_event_bus, reset_event_bus

pytestmark = pytest.mark.unit


class TestBillingEventEmission:
    """Test billing event emission."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown for each test."""
        reset_event_bus()
        yield
        reset_event_bus()

    @pytest.mark.asyncio
    async def test_emit_invoice_created(self):
        """Test emitting invoice created event."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        handler_called = False
        received_event = None

        async def handler(event: Event):
            nonlocal handler_called, received_event
            handler_called = True
            received_event = event

        event_bus.subscribe(BillingEvents.INVOICE_CREATED, handler)

        await emit_invoice_created(
            invoice_id="INV-001",
            customer_id="CUST-001",
            amount=100.50,
            currency="USD",
            tenant_id="tenant-1",
            user_id="user-1",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert handler_called
        assert received_event.event_type == BillingEvents.INVOICE_CREATED
        assert received_event.payload["invoice_id"] == "INV-001"
        assert received_event.payload["customer_id"] == "CUST-001"
        assert received_event.payload["amount"] == 100.50
        assert received_event.payload["currency"] == "USD"
        assert received_event.metadata.tenant_id == "tenant-1"
        assert received_event.metadata.user_id == "user-1"

    @pytest.mark.asyncio
    async def test_emit_invoice_paid(self):
        """Test emitting invoice paid event."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        handler_called = False

        async def handler(event: Event):
            nonlocal handler_called
            handler_called = True

        event_bus.subscribe(BillingEvents.INVOICE_PAID, handler)

        await emit_invoice_paid(
            invoice_id="INV-001",
            customer_id="CUST-001",
            amount=100.50,
            payment_id="PAY-001",
            tenant_id="tenant-1",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert handler_called

    @pytest.mark.asyncio
    async def test_emit_payment_failed(self):
        """Test emitting payment failed event."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        received_event = None

        async def handler(event: Event):
            nonlocal received_event
            received_event = event

        event_bus.subscribe(BillingEvents.PAYMENT_FAILED, handler)

        await emit_payment_failed(
            payment_id="PAY-001",
            invoice_id="INV-001",
            customer_id="CUST-001",
            amount=100.50,
            error_message="Insufficient funds",
            tenant_id="tenant-1",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert received_event is not None
        assert received_event.payload["error_message"] == "Insufficient funds"

    @pytest.mark.asyncio
    async def test_emit_subscription_created(self):
        """Test emitting subscription created event."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        received_event = None

        async def handler(event: Event):
            nonlocal received_event
            received_event = event

        event_bus.subscribe(BillingEvents.SUBSCRIPTION_CREATED, handler)

        await emit_subscription_created(
            subscription_id="SUB-001",
            customer_id="CUST-001",
            plan_id="PLAN-PRO",
            tenant_id="tenant-1",
            user_id="user-1",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert received_event is not None
        assert received_event.payload["subscription_id"] == "SUB-001"
        assert received_event.payload["plan_id"] == "PLAN-PRO"

    @pytest.mark.asyncio
    async def test_emit_subscription_cancelled(self):
        """Test emitting subscription cancelled event."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        received_event = None

        async def handler(event: Event):
            nonlocal received_event
            received_event = event

        event_bus.subscribe(BillingEvents.SUBSCRIPTION_CANCELLED, handler)

        await emit_subscription_cancelled(
            subscription_id="SUB-001",
            customer_id="CUST-001",
            reason="User request",
            tenant_id="tenant-1",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert received_event is not None
        assert received_event.payload["reason"] == "User request"


class TestBillingEventFlow:
    """Test complete billing event flows."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown for each test."""
        reset_event_bus()
        yield
        reset_event_bus()

    @pytest.mark.asyncio
    async def test_invoice_lifecycle_events(self):
        """Test invoice lifecycle event chain."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        events_received = []

        async def track_events(event: Event):
            events_received.append(event.event_type)

        # Subscribe to all invoice events
        event_bus.subscribe(BillingEvents.INVOICE_CREATED, track_events)
        event_bus.subscribe(BillingEvents.INVOICE_SENT, track_events)
        event_bus.subscribe(BillingEvents.INVOICE_PAID, track_events)

        # Simulate invoice lifecycle
        await emit_invoice_created(
            invoice_id="INV-001",
            customer_id="CUST-001",
            amount=100.0,
            currency="USD",
            event_bus=event_bus,
        )

        await event_bus.publish(
            event_type=BillingEvents.INVOICE_SENT,
            payload={"invoice_id": "INV-001"},
        )

        await emit_invoice_paid(
            invoice_id="INV-001",
            customer_id="CUST-001",
            amount=100.0,
            payment_id="PAY-001",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert BillingEvents.INVOICE_CREATED in events_received
        assert BillingEvents.INVOICE_SENT in events_received
        assert BillingEvents.INVOICE_PAID in events_received

    @pytest.mark.asyncio
    async def test_subscription_with_payment_flow(self):
        """Test subscription with payment event flow."""
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)
        flow_events = []

        async def track_flow(event: Event):
            flow_events.append(
                {
                    "type": event.event_type,
                    "payload": event.payload,
                }
            )

        event_bus.subscribe(BillingEvents.SUBSCRIPTION_CREATED, track_flow)
        event_bus.subscribe(BillingEvents.INVOICE_CREATED, track_flow)
        event_bus.subscribe(BillingEvents.INVOICE_PAID, track_flow)

        # Create subscription
        await emit_subscription_created(
            subscription_id="SUB-001",
            customer_id="CUST-001",
            plan_id="PLAN-PRO",
            event_bus=event_bus,
        )

        # Generate invoice for subscription
        await emit_invoice_created(
            invoice_id="INV-SUB-001",
            customer_id="CUST-001",
            amount=99.00,
            currency="USD",
            subscription_id="SUB-001",
            event_bus=event_bus,
        )

        # Pay invoice
        await emit_invoice_paid(
            invoice_id="INV-SUB-001",
            customer_id="CUST-001",
            amount=99.00,
            payment_id="PAY-001",
            event_bus=event_bus,
        )

        import asyncio

        await asyncio.sleep(0.1)

        assert len(flow_events) == 3
        assert flow_events[0]["type"] == BillingEvents.SUBSCRIPTION_CREATED
        assert flow_events[1]["type"] == BillingEvents.INVOICE_CREATED
        assert flow_events[2]["type"] == BillingEvents.INVOICE_PAID
