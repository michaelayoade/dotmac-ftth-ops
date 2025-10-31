"""
Tests for billing event emission helpers.

Tests all event emission functions with proper mocking.
"""

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.billing.events import (
    BillingEvents,
    emit_invoice_created,
    emit_invoice_paid,
    emit_payment_failed,
    emit_subscription_cancelled,
    emit_subscription_created,
)
from dotmac.platform.events import EventPriority


@pytest.mark.unit
class TestBillingEvents:
    """Test BillingEvents constant class."""

    def test_invoice_event_types(self):
        """Test invoice event type constants."""
        assert BillingEvents.INVOICE_CREATED == "invoice.created"
        assert BillingEvents.INVOICE_UPDATED == "invoice.updated"
        assert BillingEvents.INVOICE_SENT == "invoice.sent"
        assert BillingEvents.INVOICE_PAID == "invoice.paid"
        assert BillingEvents.INVOICE_OVERDUE == "invoice.overdue"
        assert BillingEvents.INVOICE_VOID == "invoice.void"
        assert BillingEvents.INVOICE_FAILED == "invoice.failed"

    def test_payment_event_types(self):
        """Test payment event type constants."""
        assert BillingEvents.PAYMENT_CREATED == "payment.created"
        assert BillingEvents.PAYMENT_SUCCEEDED == "payment.succeeded"
        assert BillingEvents.PAYMENT_FAILED == "payment.failed"
        assert BillingEvents.PAYMENT_REFUNDED == "payment.refunded"

    def test_subscription_event_types(self):
        """Test subscription event type constants."""
        assert BillingEvents.SUBSCRIPTION_CREATED == "subscription.created"
        assert BillingEvents.SUBSCRIPTION_UPDATED == "subscription.updated"
        assert BillingEvents.SUBSCRIPTION_CANCELLED == "subscription.cancelled"
        assert BillingEvents.SUBSCRIPTION_RENEWED == "subscription.renewed"
        assert BillingEvents.SUBSCRIPTION_TRIAL_ENDING == "subscription.trial_ending"
        assert BillingEvents.SUBSCRIPTION_TRIAL_ENDED == "subscription.trial_ended"

    def test_customer_event_types(self):
        """Test customer event type constants."""
        assert BillingEvents.CUSTOMER_CREATED == "customer.created"
        assert BillingEvents.CUSTOMER_UPDATED == "customer.updated"
        assert BillingEvents.CUSTOMER_DELETED == "customer.deleted"

    def test_product_event_types(self):
        """Test product event type constants."""
        assert BillingEvents.PRODUCT_CREATED == "product.created"
        assert BillingEvents.PRODUCT_UPDATED == "product.updated"
        assert BillingEvents.PRODUCT_DELETED == "product.deleted"

    def test_credit_note_event_types(self):
        """Test credit note event type constants."""
        assert BillingEvents.CREDIT_NOTE_CREATED == "credit_note.created"
        assert BillingEvents.CREDIT_NOTE_ISSUED == "credit_note.issued"


@pytest.mark.unit
class TestInvoiceEventEmission:
    """Test invoice event emission functions."""

    @pytest.mark.asyncio
    async def test_emit_invoice_created(self):
        """Test emitting invoice created event."""
        mock_event_bus = AsyncMock()
        mock_event_bus.publish = AsyncMock()

        await emit_invoice_created(
            invoice_id="inv-123",
            customer_id="cust-456",
            amount=100.50,
            currency="USD",
            tenant_id="tenant-789",
            user_id="user-001",
            event_bus=mock_event_bus,
            extra_field="extra_value",
        )

        # Verify publish was called
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args

        # Check event type
        assert call_args.kwargs["event_type"] == BillingEvents.INVOICE_CREATED

        # Check payload
        payload = call_args.kwargs["payload"]
        assert payload["invoice_id"] == "inv-123"
        assert payload["customer_id"] == "cust-456"
        assert payload["amount"] == 100.50
        assert payload["currency"] == "USD"
        assert payload["extra_field"] == "extra_value"

        # Check metadata
        metadata = call_args.kwargs["metadata"]
        assert metadata["tenant_id"] == "tenant-789"
        assert metadata["user_id"] == "user-001"
        assert metadata["source"] == "billing"

        # Check priority
        assert call_args.kwargs["priority"] == EventPriority.HIGH

    @pytest.mark.asyncio
    async def test_emit_invoice_created_without_optional_params(self):
        """Test emitting invoice created event without optional parameters."""
        mock_event_bus = AsyncMock()

        await emit_invoice_created(
            invoice_id="inv-123",
            customer_id="cust-456",
            amount=100.50,
            currency="USD",
            event_bus=mock_event_bus,
        )

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        metadata = call_args.kwargs["metadata"]
        assert metadata["tenant_id"] is None
        assert metadata["user_id"] is None

    @pytest.mark.asyncio
    async def test_emit_invoice_paid(self):
        """Test emitting invoice paid event."""
        mock_event_bus = AsyncMock()

        await emit_invoice_paid(
            invoice_id="inv-123",
            customer_id="cust-456",
            amount=100.50,
            payment_id="pay-789",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
        )

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args

        assert call_args.kwargs["event_type"] == BillingEvents.INVOICE_PAID
        payload = call_args.kwargs["payload"]
        assert payload["invoice_id"] == "inv-123"
        assert payload["payment_id"] == "pay-789"
        assert call_args.kwargs["priority"] == EventPriority.HIGH


@pytest.mark.unit
class TestPaymentEventEmission:
    """Test payment event emission functions."""

    @pytest.mark.asyncio
    async def test_emit_payment_failed(self):
        """Test emitting payment failed event."""
        mock_event_bus = AsyncMock()

        await emit_payment_failed(
            payment_id="pay-123",
            invoice_id="inv-456",
            customer_id="cust-789",
            amount=250.00,
            error_message="Insufficient funds",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
        )

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args

        # Check event type
        assert call_args.kwargs["event_type"] == BillingEvents.PAYMENT_FAILED

        # Check payload
        payload = call_args.kwargs["payload"]
        assert payload["payment_id"] == "pay-123"
        assert payload["invoice_id"] == "inv-456"
        assert payload["customer_id"] == "cust-789"
        assert payload["amount"] == 250.00
        assert payload["error_message"] == "Insufficient funds"

        # Check priority is CRITICAL for failures
        assert call_args.kwargs["priority"] == EventPriority.CRITICAL

    @pytest.mark.asyncio
    async def test_emit_payment_failed_with_extra_data(self):
        """Test emitting payment failed event with extra data."""
        mock_event_bus = AsyncMock()

        await emit_payment_failed(
            payment_id="pay-123",
            invoice_id="inv-456",
            customer_id="cust-789",
            amount=250.00,
            error_message="Card declined",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
            decline_code="insufficient_funds",
            retry_count=3,
        )

        call_args = mock_event_bus.publish.call_args
        payload = call_args.kwargs["payload"]
        assert payload["decline_code"] == "insufficient_funds"
        assert payload["retry_count"] == 3


@pytest.mark.unit
class TestSubscriptionEventEmission:
    """Test subscription event emission functions."""

    @pytest.mark.asyncio
    async def test_emit_subscription_created(self):
        """Test emitting subscription created event."""
        mock_event_bus = AsyncMock()

        await emit_subscription_created(
            subscription_id="sub-123",
            customer_id="cust-456",
            plan_id="plan-789",
            tenant_id="tenant-001",
            user_id="user-002",
            event_bus=mock_event_bus,
        )

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args

        assert call_args.kwargs["event_type"] == BillingEvents.SUBSCRIPTION_CREATED
        payload = call_args.kwargs["payload"]
        assert payload["subscription_id"] == "sub-123"
        assert payload["customer_id"] == "cust-456"
        assert payload["plan_id"] == "plan-789"

    @pytest.mark.asyncio
    async def test_emit_subscription_created_with_extra_data(self):
        """Test emitting subscription created event with extra data."""
        mock_event_bus = AsyncMock()

        await emit_subscription_created(
            subscription_id="sub-123",
            customer_id="cust-456",
            plan_id="plan-789",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
            trial_days=14,
            billing_cycle="monthly",
        )

        call_args = mock_event_bus.publish.call_args
        payload = call_args.kwargs["payload"]
        assert payload["trial_days"] == 14
        assert payload["billing_cycle"] == "monthly"

    @pytest.mark.asyncio
    async def test_emit_subscription_cancelled(self):
        """Test emitting subscription cancelled event."""
        mock_event_bus = AsyncMock()

        await emit_subscription_cancelled(
            subscription_id="sub-123",
            customer_id="cust-456",
            reason="Customer request",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
        )

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args

        assert call_args.kwargs["event_type"] == BillingEvents.SUBSCRIPTION_CANCELLED
        payload = call_args.kwargs["payload"]
        assert payload["subscription_id"] == "sub-123"
        assert payload["customer_id"] == "cust-456"
        assert payload["reason"] == "Customer request"

    @pytest.mark.asyncio
    async def test_emit_subscription_cancelled_without_reason(self):
        """Test emitting subscription cancelled event without reason."""
        mock_event_bus = AsyncMock()

        await emit_subscription_cancelled(
            subscription_id="sub-123",
            customer_id="cust-456",
            tenant_id="tenant-001",
            event_bus=mock_event_bus,
        )

        call_args = mock_event_bus.publish.call_args
        payload = call_args.kwargs["payload"]
        assert payload["reason"] is None


@pytest.mark.unit
class TestEventBusIntegration:
    """Test event bus integration (using global event bus)."""

    @pytest.mark.asyncio
    async def test_emit_invoice_created_with_global_event_bus(self, monkeypatch):
        """Test emitting invoice created event with global event bus."""
        mock_global_bus = AsyncMock()

        # Mock get_event_bus to return our mock
        def mock_get_event_bus():
            return mock_global_bus

        monkeypatch.setattr("dotmac.platform.billing.events.get_event_bus", mock_get_event_bus)

        # Call without event_bus parameter
        await emit_invoice_created(
            invoice_id="inv-123",
            customer_id="cust-456",
            amount=100.0,
            currency="USD",
        )

        # Should have used the global event bus
        mock_global_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_invoice_paid_with_global_event_bus(self, monkeypatch):
        """Test emitting invoice paid event with global event bus."""
        mock_global_bus = AsyncMock()

        def mock_get_event_bus():
            return mock_global_bus

        monkeypatch.setattr("dotmac.platform.billing.events.get_event_bus", mock_get_event_bus)

        await emit_invoice_paid(
            invoice_id="inv-123",
            customer_id="cust-456",
            amount=100.0,
            payment_id="pay-123",
        )

        mock_global_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_payment_failed_with_global_event_bus(self, monkeypatch):
        """Test emitting payment failed event with global event bus."""
        mock_global_bus = AsyncMock()

        def mock_get_event_bus():
            return mock_global_bus

        monkeypatch.setattr("dotmac.platform.billing.events.get_event_bus", mock_get_event_bus)

        await emit_payment_failed(
            payment_id="pay-123",
            invoice_id="inv-456",
            customer_id="cust-789",
            amount=250.0,
            error_message="Insufficient funds",
        )

        mock_global_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_subscription_created_with_global_event_bus(self, monkeypatch):
        """Test emitting subscription created event with global event bus."""
        mock_global_bus = AsyncMock()

        def mock_get_event_bus():
            return mock_global_bus

        monkeypatch.setattr("dotmac.platform.billing.events.get_event_bus", mock_get_event_bus)

        await emit_subscription_created(
            subscription_id="sub-123",
            customer_id="cust-456",
            plan_id="plan-789",
        )

        mock_global_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_subscription_cancelled_with_global_event_bus(self, monkeypatch):
        """Test emitting subscription cancelled event with global event bus."""
        mock_global_bus = AsyncMock()

        def mock_get_event_bus():
            return mock_global_bus

        monkeypatch.setattr("dotmac.platform.billing.events.get_event_bus", mock_get_event_bus)

        await emit_subscription_cancelled(
            subscription_id="sub-123",
            customer_id="cust-456",
            reason="Customer request",
        )

        mock_global_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_all_events_use_billing_source(self):
        """Test that all event emissions set source as 'billing'."""
        mock_event_bus = AsyncMock()

        # Test invoice created
        await emit_invoice_created(
            invoice_id="inv-1",
            customer_id="cust-1",
            amount=100.0,
            currency="USD",
            event_bus=mock_event_bus,
        )
        metadata = mock_event_bus.publish.call_args.kwargs["metadata"]
        assert metadata["source"] == "billing"

        # Test payment failed
        await emit_payment_failed(
            payment_id="pay-1",
            invoice_id="inv-1",
            customer_id="cust-1",
            amount=100.0,
            error_message="Error",
            event_bus=mock_event_bus,
        )
        metadata = mock_event_bus.publish.call_args.kwargs["metadata"]
        assert metadata["source"] == "billing"

        # Test subscription created
        await emit_subscription_created(
            subscription_id="sub-1",
            customer_id="cust-1",
            plan_id="plan-1",
            event_bus=mock_event_bus,
        )
        metadata = mock_event_bus.publish.call_args.kwargs["metadata"]
        assert metadata["source"] == "billing"
