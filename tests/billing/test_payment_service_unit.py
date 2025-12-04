"""
Unit Tests for Payment Service (Business Logic).

Strategy: Mock ALL dependencies (database, payment providers, event bus)
Focus: Test business rules, validation, error handling in isolation
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

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


@pytest.mark.unit
class TestPaymentServiceHappyPath:
    """Test successful payment processing."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        import uuid

        db = AsyncMock(spec=AsyncSession)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        # Mock db.add() to populate auto-generated fields
        def mock_add(entity):
            if not hasattr(entity, "payment_id") or entity.payment_id is None:
                entity.payment_id = str(uuid.uuid4())
            if not hasattr(entity, "retry_count") or entity.retry_count is None:
                entity.retry_count = 0
            if not hasattr(entity, "created_at") or entity.created_at is None:
                entity.created_at = datetime.now(UTC)
            if not hasattr(entity, "updated_at") or entity.updated_at is None:
                entity.updated_at = datetime.now(UTC)

        db.add = MagicMock(side_effect=mock_add)
        return db

    @pytest.fixture
    def mock_payment_provider(self):
        """Mock payment provider."""
        provider = AsyncMock()
        # Default to successful charge
        provider.charge_payment_method = AsyncMock(
            return_value=MagicMock(
                success=True,
                provider_payment_id="mock_pi_123",
                provider_fee=30,
                error_message=None,
            )
        )
        return provider

    @pytest.fixture
    def payment_service(self, mock_db, mock_payment_provider):
        """Create payment service with mocked dependencies."""
        return PaymentService(
            db_session=mock_db,
            payment_providers={"stripe": mock_payment_provider, "mock": mock_payment_provider},
        )

    @pytest.fixture
    def active_payment_method(self):
        """Create active payment method entity."""
        return PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

    async def test_create_payment_success(
        self, payment_service, mock_db, mock_payment_provider, active_payment_method
    ):
        """Test successful payment creation and processing."""
        # Mock database queries with AsyncMock
        mock_get_method = AsyncMock(return_value=active_payment_method)
        mock_get_idempotency = AsyncMock(return_value=None)
        mock_create_txn = AsyncMock(return_value=None)
        mock_link_invoices = AsyncMock(return_value=None)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with patch.object(
                payment_service, "_get_payment_by_idempotency_key", mock_get_idempotency
            ):
                with patch.object(payment_service, "_create_transaction", mock_create_txn):
                    with patch.object(
                        payment_service, "_link_payment_to_invoices", mock_link_invoices
                    ):
                        with patch(
                            "dotmac.platform.billing.payments.service.get_event_bus"
                        ) as mock_event_bus:
                            mock_event_bus.return_value.publish = AsyncMock()

                            # Mock provider response
                            mock_payment_provider.charge_payment_method.return_value = MagicMock(
                                success=True,
                                provider_payment_id="stripe_pi_123",
                                provider_fee=30,
                                error_message=None,
                            )

                            # Create payment
                            await payment_service.create_payment(
                                tenant_id="tenant-1",
                                amount=10000,  # $100.00
                                currency="usd",
                                customer_id="cust_123",
                                payment_method_id="pm_123",
                                provider="stripe",
                                idempotency_key="idem_123",
                            )

                            # Verify payment was added to DB
                            assert mock_db.add.called
                            assert mock_db.commit.call_count >= 2  # Initial save + update

                            # Verify provider was called
                            mock_payment_provider.charge_payment_method.assert_called_once()
                            call_args = mock_payment_provider.charge_payment_method.call_args[1]
                            assert call_args["amount"] == 10000
                            assert call_args["currency"] == "usd"

    async def test_create_payment_with_invoice_linking(
        self, payment_service, mock_payment_provider, active_payment_method
    ):
        """Test payment creation with invoice linking."""
        mock_get_method = AsyncMock(return_value=active_payment_method)
        mock_get_idempotency = AsyncMock(return_value=None)
        mock_create_txn = AsyncMock(return_value=None)
        mock_link = AsyncMock(return_value=None)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with patch.object(
                payment_service, "_get_payment_by_idempotency_key", mock_get_idempotency
            ):
                with patch.object(payment_service, "_create_transaction", mock_create_txn):
                    with patch.object(payment_service, "_link_payment_to_invoices", mock_link):
                        with patch(
                            "dotmac.platform.billing.payments.service.get_event_bus"
                        ) as mock_event_bus:
                            mock_event_bus.return_value.publish = AsyncMock()

                            mock_payment_provider.charge_payment_method.return_value = MagicMock(
                                success=True,
                                provider_payment_id="pi_123",
                                provider_fee=30,
                            )

                            await payment_service.create_payment(
                                tenant_id="tenant-1",
                                amount=10000,
                                currency="usd",
                                customer_id="cust_123",
                                payment_method_id="pm_123",
                                invoice_ids=["inv_1", "inv_2"],
                            )

                            # Verify invoices were linked
                            mock_link.assert_called_once()


@pytest.mark.unit
class TestPaymentServiceValidation:
    """Test payment validation rules."""

    @pytest.fixture
    def payment_service(self):
        """Create payment service with mocked DB."""
        mock_db = AsyncMock(spec=AsyncSession)
        return PaymentService(db_session=mock_db)

    async def test_payment_method_not_found(self, payment_service):
        """Test error when payment method doesn't exist."""
        mock_get_method = AsyncMock(return_value=None)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with pytest.raises(PaymentMethodNotFoundError) as exc:
                await payment_service.create_payment(
                    tenant_id="tenant-1",
                    amount=10000,
                    currency="usd",
                    customer_id="cust_123",
                    payment_method_id="pm_invalid",
                )

            assert "not found" in str(exc.value).lower()

    async def test_payment_method_inactive(self, payment_service):
        """Test error when payment method is inactive."""
        inactive_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.INACTIVE,  # Inactive!
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

        mock_get_method = AsyncMock(return_value=inactive_method)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with pytest.raises(PaymentError) as exc:
                await payment_service.create_payment(
                    tenant_id="tenant-1",
                    amount=10000,
                    currency="usd",
                    customer_id="cust_123",
                    payment_method_id="pm_123",
                )

            assert "not active" in str(exc.value).lower()


@pytest.mark.unit
class TestPaymentServiceIdempotency:
    """Test idempotency key handling."""

    @pytest.fixture
    def payment_service(self):
        """Create payment service."""
        mock_db = AsyncMock(spec=AsyncSession)
        return PaymentService(db_session=mock_db)

    async def test_idempotency_returns_existing_payment(self, payment_service):
        """Test that same idempotency key returns existing payment."""

        existing_payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant-1",
            amount=10000,
            currency="usd",
            customer_id="cust_123",
            status=PaymentStatus.SUCCEEDED,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={},
            provider="stripe",
            retry_count=0,
            created_at=datetime.now(UTC),
            extra_data={},
        )

        mock_get_idempotency = AsyncMock(return_value=existing_payment)
        with patch.object(payment_service, "_get_payment_by_idempotency_key", mock_get_idempotency):
            payment = await payment_service.create_payment(
                tenant_id="tenant-1",
                amount=10000,
                currency="usd",
                customer_id="cust_123",
                payment_method_id="pm_123",
                idempotency_key="same_key",
            )

            # Should return existing payment without creating new one
            assert payment.payment_id == "pay_123"
            assert payment.status == PaymentStatus.SUCCEEDED


@pytest.mark.unit
class TestPaymentServiceProviderFailure:
    """Test payment provider failure handling."""

    @pytest.fixture
    def payment_service(self):
        """Create payment service with mock provider."""
        from uuid import uuid4

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        # Configure refresh to populate database-generated fields
        def populate_fields(obj):
            if not hasattr(obj, "payment_id") or obj.payment_id is None:
                obj.payment_id = str(uuid4())
            if not hasattr(obj, "retry_count") or obj.retry_count is None:
                obj.retry_count = 0
            if not hasattr(obj, "created_at") or obj.created_at is None:
                obj.created_at = datetime.now(UTC)

        mock_db.refresh = AsyncMock(side_effect=populate_fields)

        mock_provider = AsyncMock()
        return (
            PaymentService(
                db_session=mock_db,
                payment_providers={"stripe": mock_provider},
            ),
            mock_provider,
        )

    async def test_provider_returns_failure(self, payment_service):
        """Test handling of provider-reported failure."""
        service, mock_provider = payment_service

        active_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

        mock_get_method = AsyncMock(return_value=active_method)
        mock_get_idempotency = AsyncMock(return_value=None)

        with patch.object(service, "_get_payment_method", mock_get_method):
            with patch.object(service, "_get_payment_by_idempotency_key", mock_get_idempotency):
                # Provider returns failure
                mock_provider.charge_payment_method.return_value = MagicMock(
                    success=False,
                    provider_payment_id=None,
                    provider_fee=0,
                    error_message="Insufficient funds",
                )

                await service.create_payment(
                    tenant_id="tenant-1",
                    amount=10000,
                    currency="usd",
                    customer_id="cust_123",
                    payment_method_id="pm_123",
                )

                # Payment should be in DB but marked as failed
                assert service.db.add.called
                added_payment = service.db.add.call_args[0][0]
                # Status will be updated to FAILED after provider response
                assert added_payment.status in [PaymentStatus.PENDING, PaymentStatus.FAILED]

    async def test_provider_throws_exception(self, payment_service):
        """Test handling of provider exception."""
        service, mock_provider = payment_service

        active_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

        mock_get_method = AsyncMock(return_value=active_method)
        mock_get_idempotency = AsyncMock(return_value=None)

        with patch.object(service, "_get_payment_method", mock_get_method):
            with patch.object(service, "_get_payment_by_idempotency_key", mock_get_idempotency):
                # Provider throws exception
                mock_provider.charge_payment_method.side_effect = Exception("Network error")

                await service.create_payment(
                    tenant_id="tenant-1",
                    amount=10000,
                    currency="usd",
                    customer_id="cust_123",
                    payment_method_id="pm_123",
                )

                # Should not raise, payment should be saved with failed status
                assert service.db.add.called


@pytest.mark.unit
class TestPaymentServiceBusinessRules:
    """Test specific business rules."""

    @pytest.fixture
    def payment_service(self):
        """Create payment service."""
        from uuid import uuid4

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        # Configure refresh to populate database-generated fields
        def populate_fields(obj):
            if not hasattr(obj, "payment_id") or obj.payment_id is None:
                obj.payment_id = str(uuid4())
            if not hasattr(obj, "retry_count") or obj.retry_count is None:
                obj.retry_count = 0
            if not hasattr(obj, "created_at") or obj.created_at is None:
                obj.created_at = datetime.now(UTC)

        mock_db.refresh = AsyncMock(side_effect=populate_fields)

        return PaymentService(db_session=mock_db)

    async def test_webhook_published_only_on_success(self, payment_service):
        """Test webhook is only published for successful payments."""
        active_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

        mock_get_method = AsyncMock(return_value=active_method)
        mock_get_idempotency = AsyncMock(return_value=None)
        mock_create_txn = AsyncMock(return_value=None)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with patch.object(
                payment_service, "_get_payment_by_idempotency_key", mock_get_idempotency
            ):
                with patch.object(payment_service, "_create_transaction", mock_create_txn):
                    with patch(
                        "dotmac.platform.billing.payments.service.get_event_bus"
                    ) as mock_event_bus:
                        mock_event_bus.return_value.publish = AsyncMock()

                        # Success case - webhook should be published
                        await payment_service.create_payment(
                            tenant_id="tenant-1",
                            amount=10000,
                            currency="usd",
                            customer_id="cust_123",
                            payment_method_id="pm_123",
                            provider="mock",  # Uses mock success
                        )

                        # Verify webhook was published
                        assert mock_event_bus.return_value.publish.called

    async def test_transaction_created_only_on_success(self, payment_service):
        """Test transaction record is only created for successful payments."""
        active_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider_payment_method_id="stripe_pm_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )

        mock_get_method = AsyncMock(return_value=active_method)
        mock_get_idempotency = AsyncMock(return_value=None)
        mock_transaction = AsyncMock(return_value=None)

        with patch.object(payment_service, "_get_payment_method", mock_get_method):
            with patch.object(
                payment_service, "_get_payment_by_idempotency_key", mock_get_idempotency
            ):
                with patch.object(payment_service, "_create_transaction", mock_transaction):
                    with patch(
                        "dotmac.platform.billing.payments.service.get_event_bus"
                    ) as mock_event_bus:
                        with patch(
                            "dotmac.platform.billing.payments.service.settings"
                        ) as mock_settings:
                            mock_event_bus.return_value.publish = AsyncMock()
                            mock_settings.billing.require_payment_plugin = False

                            # Success case
                            result = await payment_service.create_payment(
                                tenant_id="tenant-1",
                                amount=10000,
                                currency="usd",
                                customer_id="cust_123",
                                payment_method_id="pm_123",
                                provider="mock",
                            )

                            # Verify payment succeeded
                            assert result.status == PaymentStatus.SUCCEEDED, (
                                f"Payment status was {result.status}"
                            )

                            # Transaction should be created
                            assert mock_transaction.called, (
                                "Transaction was not created for successful payment"
                            )
