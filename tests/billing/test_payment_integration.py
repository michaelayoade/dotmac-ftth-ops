"""
Integration Tests for Payment Service (with Real Database).

Strategy: Use REAL database, mock ONLY external APIs (payment providers)
Focus: Test complete workflows with actual DB operations
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from dotmac.platform.billing.core.entities import PaymentEntity, PaymentMethodEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentMethodNotFoundError,
)
from dotmac.platform.billing.payments.service import PaymentService

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestPaymentCreation:
    """Test payment creation with real database."""

    async def test_create_payment_success(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test successful payment creation with real DB."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Mock provider response
        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_real_123",
            provider_fee=30,
            error_message=None,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create payment with real DB
            payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,  # $100.00
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
                provider="stripe",
            )

            # Verify payment was created
            assert payment.payment_id is not None
            assert payment.status == PaymentStatus.SUCCEEDED
            assert payment.amount == 10000
            assert payment.currency == "usd"

            # Verify in database
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.payment_id == payment.payment_id)
            )
            db_payment = result.scalar_one()
            assert db_payment.amount == 10000
            assert db_payment.status == PaymentStatus.SUCCEEDED
            assert db_payment.provider_payment_id == "pi_real_123"

    async def test_create_payment_with_idempotency(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test idempotency key prevents duplicate payments."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_123",
            provider_fee=30,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create first payment
            payment1 = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
                idempotency_key="idem_duplicate_123",
            )

            # Try to create duplicate with same idempotency key
            payment2 = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
                idempotency_key="idem_duplicate_123",  # Same key
            )

            # Should return same payment
            assert payment1.payment_id == payment2.payment_id

            # Verify only one payment in DB
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.idempotency_key == "idem_duplicate_123")
            )
            payments = result.scalars().all()
            assert len(payments) == 1

    async def test_create_payment_invalid_method(self, async_session, mock_stripe_provider):
        """Test error when payment method doesn't exist."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        with pytest.raises(PaymentMethodNotFoundError):
            await payment_service.create_payment(
                tenant_id=str(uuid4()),
                amount=10000,
                currency="usd",
                customer_id=str(uuid4()),
                payment_method_id=str(uuid4()),
            )

    async def test_create_payment_inactive_method(self, async_session, mock_stripe_provider):
        """Test error when payment method is inactive."""
        # Create inactive payment method
        from uuid import uuid4

        tenant = str(uuid4())
        customer = str(uuid4())

        inactive_method = PaymentMethodEntity(
            payment_method_id=str(uuid4()),  # Generate valid UUID
            tenant_id=tenant,
            customer_id=customer,
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.INACTIVE,  # Inactive
            provider="stripe",  # Required field
            provider_payment_method_id="stripe_pm_inactive",
            display_name="Inactive Visa ending in 4242",  # Required field
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2030,
        )
        async_session.add(inactive_method)
        await async_session.commit()
        await async_session.refresh(inactive_method)

        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        with pytest.raises(PaymentError, match="not active"):
            await payment_service.create_payment(
                tenant_id=tenant,
                amount=10000,
                currency="usd",
                customer_id=customer,
                payment_method_id=inactive_method.payment_method_id,
            )


@pytest.mark.asyncio
class TestPaymentFailureHandling:
    """Test payment provider failure scenarios."""

    async def test_payment_provider_failure(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test handling when provider reports failure."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Provider returns failure
        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Insufficient funds",
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Payment should be marked as failed
            assert payment.status == PaymentStatus.FAILED
            assert payment.failure_reason == "Insufficient funds"

            # Verify in database
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.payment_id == payment.payment_id)
            )
            db_payment = result.scalar_one()
            assert db_payment.status == PaymentStatus.FAILED

    async def test_payment_provider_exception(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test handling when provider throws exception."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Provider throws exception
        mock_stripe_provider.charge_payment_method.side_effect = Exception("Network error")

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Payment should be marked as failed
            assert payment.status == PaymentStatus.FAILED
            assert "Network error" in payment.failure_reason

            # Verify in database
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.payment_id == payment.payment_id)
            )
            db_payment = result.scalar_one()
            assert db_payment.status == PaymentStatus.FAILED


@pytest.mark.asyncio
class TestPaymentWebhooks:
    """Test webhook publishing for payments."""

    async def test_webhook_published_on_success(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test that webhook is published for successful payment."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_123",
            provider_fee=30,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Verify webhook was published
            mock_event_bus.return_value.publish.assert_called_once()
            call_args = mock_event_bus.return_value.publish.call_args[1]
            assert call_args["event_type"] == "payment.succeeded"

    async def test_webhook_published_on_failure(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test that webhook is published for failed payment."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=False,
            error_message="Card declined",
            provider_payment_id=None,  # Must be explicit
            provider_fee=0,  # Must be int, not MagicMock
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Verify webhook was published
            mock_event_bus.return_value.publish.assert_called_once()
            call_args = mock_event_bus.return_value.publish.call_args[1]
            assert call_args["event_type"] == "payment.failed"
            assert call_args["event_data"]["failure_reason"] == "Card declined"


@pytest.mark.asyncio
class TestPaymentRefunds:
    """Test payment refund logic."""

    async def test_refund_payment_full(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test full payment refund."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Create successful payment first
        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_original_123",
            provider_fee=30,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            original_payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Mock refund provider response
            mock_stripe_provider.refund_payment = AsyncMock(
                return_value=MagicMock(
                    success=True,
                    provider_refund_id="re_123",
                    error_message=None,
                )
            )

            # Refund the payment
            refund = await payment_service.refund_payment(
                tenant_id=test_payment_method.tenant_id,
                payment_id=original_payment.payment_id,
                reason="Customer request",
            )

            assert refund.payment_id is not None
            assert refund.status == PaymentStatus.REFUNDED
            assert refund.amount == -10000  # Negative for refund

            # Verify original payment status updated
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.payment_id == original_payment.payment_id)
            )
            original_updated = result.scalar_one()
            assert original_updated.status == PaymentStatus.REFUNDED

    async def test_refund_payment_partial(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test partial payment refund."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Create successful payment
        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_partial_123",
            provider_fee=30,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            original_payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            # Mock refund
            mock_stripe_provider.refund_payment = AsyncMock(
                return_value=MagicMock(
                    success=True,
                    provider_refund_id="re_partial_123",
                )
            )

            # Partial refund
            refund = await payment_service.refund_payment(
                tenant_id=test_payment_method.tenant_id,
                payment_id=original_payment.payment_id,
                amount=5000,  # Half refund
            )

            assert refund.amount == -5000

            # Verify original payment status
            result = await async_session.execute(
                select(PaymentEntity).where(PaymentEntity.payment_id == original_payment.payment_id)
            )
            original_updated = result.scalar_one()
            assert original_updated.status == PaymentStatus.PARTIALLY_REFUNDED

    async def test_cannot_refund_already_refunded_payment(
        self, async_session, test_payment_method, mock_stripe_provider
    ):
        """Test that already refunded payment cannot be refunded again."""
        payment_service = PaymentService(
            db_session=async_session,
            payment_providers={"stripe": mock_stripe_provider},
        )

        # Create and refund a payment
        mock_stripe_provider.charge_payment_method.return_value = MagicMock(
            success=True,
            provider_payment_id="pi_test_double",
            provider_fee=30,
        )

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            payment = await payment_service.create_payment(
                tenant_id=test_payment_method.tenant_id,
                amount=10000,
                currency="usd",
                customer_id=test_payment_method.customer_id,
                payment_method_id=test_payment_method.payment_method_id,
            )

            mock_stripe_provider.refund_payment = AsyncMock(
                return_value=MagicMock(success=True, provider_refund_id="re_123")
            )

            # Refund the payment
            await payment_service.refund_payment(
                tenant_id=test_payment_method.tenant_id,
                payment_id=payment.payment_id,
            )

            # Try to refund again - should fail
            with pytest.raises(
                PaymentError, match="Can only refund successful or partially refunded payments"
            ):
                await payment_service.refund_payment(
                    tenant_id=test_payment_method.tenant_id,
                    payment_id=payment.payment_id,
                )


@pytest.mark.asyncio
class TestPaymentMethods:
    """Test payment method management."""

    async def test_add_payment_method(self, async_session):
        """Test adding new payment method."""
        payment_service = PaymentService(db_session=async_session)

        tenant = str(uuid4())
        customer = str(uuid4())

        payment_method = await payment_service.add_payment_method(
            tenant_id=tenant,
            customer_id=customer,
            payment_method_type=PaymentMethodType.CARD,  # Correct parameter name
            provider="stripe",
            provider_payment_method_id="pm_new_card",
            display_name="New Visa Card",
            last_four="1234",
            brand="visa",
            expiry_month=12,
            expiry_year=2030,
        )

        assert payment_method.payment_method_id is not None
        assert payment_method.status == PaymentMethodStatus.ACTIVE
        assert payment_method.display_name == "New Visa Card"

    async def test_list_payment_methods(self, async_session):
        """Test listing payment methods."""
        payment_service = PaymentService(db_session=async_session)

        tenant_id = f"tenant-{uuid4().hex[:8]}"
        customer_id = f"cust-{uuid4().hex[:8]}"

        pm1 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_list_1",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Primary Card",
            last_four="1111",
        )

        pm2 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_list_2",
            payment_method_type=PaymentMethodType.BANK_ACCOUNT,
            display_name="Bank Account",
            last_four="9999",
        )

        methods = await payment_service.list_payment_methods(
            tenant_id=tenant_id,
            customer_id=customer_id,
        )

        method_ids = {pm.payment_method_id for pm in methods}
        assert {pm1.payment_method_id, pm2.payment_method_id} == method_ids

    async def test_get_payment_method(self, async_session):
        """Test getting specific payment method."""
        payment_service = PaymentService(db_session=async_session)

        tenant_id = f"tenant-{uuid4().hex[:8]}"
        customer_id = f"cust-{uuid4().hex[:8]}"

        created = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_lookup",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Lookup Card",
            last_four="4242",
        )

        method = await payment_service.get_payment_method(
            tenant_id=tenant_id,
            payment_method_id=created.payment_method_id,
        )

        assert method.payment_method_id == created.payment_method_id
        assert method.display_name == "Lookup Card"

    async def test_set_default_payment_method(self, async_session):
        """Test setting default payment method."""
        payment_service = PaymentService(db_session=async_session)

        # Add two payment methods
        from uuid import uuid4

        tenant = str(uuid4())
        customer = str(uuid4())

        pm1 = PaymentMethodEntity(
            payment_method_id=str(uuid4()),
            tenant_id=tenant,
            customer_id=customer,
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider="stripe",
            provider_payment_method_id="pm_first",
            display_name="First Card",
            is_default=True,
        )
        pm2 = PaymentMethodEntity(
            payment_method_id=str(uuid4()),
            tenant_id=tenant,
            customer_id=customer,
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider="stripe",
            provider_payment_method_id="pm_second",
            display_name="Second Card",
        )

        async_session.add(pm1)
        async_session.add(pm2)
        await async_session.commit()

        # Set second as default
        updated = await payment_service.set_default_payment_method(
            tenant_id=tenant,
            customer_id=customer,
            payment_method_id=pm2.payment_method_id,
        )

        assert updated.is_default is True

        # Verify first is no longer default
        result = await async_session.execute(
            select(PaymentMethodEntity).where(
                PaymentMethodEntity.payment_method_id == pm1.payment_method_id
            )
        )
        first_updated = result.scalar_one()
        assert first_updated.is_default is False
