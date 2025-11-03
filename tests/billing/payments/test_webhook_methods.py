"""Unit tests for new PaymentService webhook methods."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.core.exceptions import PaymentError, PaymentNotFoundError
from dotmac.platform.billing.payments.service import PaymentService


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def payment_service(mock_db_session):
    """Create PaymentService instance."""
    return PaymentService(db_session=mock_db_session)


@pytest.fixture
def sample_payment_entity():
    """Create sample payment entity (mocked)."""
    entity = MagicMock()
    entity.payment_id = "pay_123"
    entity.tenant_id = "tenant_456"
    entity.customer_id = "cust_789"
    entity.amount = Decimal("100.00")
    entity.currency = "USD"
    entity.status = PaymentStatus.PENDING
    entity.provider = "stripe"
    entity.payment_method_type = "card"
    entity.payment_method_details = {"type": "card"}
    entity.provider_payment_data = {}
    entity.provider_payment_id = "pi_123"
    entity.idempotency_key = "idem_123"
    entity.extra_data = {}
    entity.refund_amount = Decimal("0")
    entity.processed_at = None
    entity.refunded_at = None
    entity.failure_reason = None
    entity.created_at = datetime.now(UTC)
    entity.updated_at = datetime.now(UTC)
    return entity


@pytest.mark.unit
class TestGetPayment:
    """Test get_payment method."""

    async def test_get_payment_success(
        self, payment_service, mock_db_session, sample_payment_entity
    ):
        """Test successfully retrieving a payment."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Execute
        result = await payment_service.get_payment("tenant_456", "pay_123")

        # Verify
        assert result is not None
        assert result.payment_id == "pay_123"
        assert result.tenant_id == "tenant_456"
        assert result.amount == Decimal("100.00")

    async def test_get_payment_not_found(self, payment_service, mock_db_session):
        """Test getting non-existent payment."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute
        result = await payment_service.get_payment("tenant_456", "pay_nonexistent")

        # Verify
        assert result is None


@pytest.mark.unit
class TestUpdatePaymentStatus:
    """Test update_payment_status method."""

    async def test_update_status_to_succeeded(
        self, payment_service, mock_db_session, sample_payment_entity
    ):
        """Test updating payment status to succeeded."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Execute
        await payment_service.update_payment_status(
            tenant_id="tenant_456",
            payment_id="pay_123",
            new_status=PaymentStatus.SUCCEEDED,
            provider_data={"stripe_charge_id": "ch_123"},
        )

        # Verify
        assert sample_payment_entity.status == PaymentStatus.SUCCEEDED
        assert sample_payment_entity.processed_at is not None
        assert sample_payment_entity.provider_payment_data["stripe_charge_id"] == "ch_123"
        assert mock_db_session.commit.called
        assert mock_db_session.refresh.called

    async def test_update_status_to_failed_with_error(
        self, payment_service, mock_db_session, sample_payment_entity
    ):
        """Test updating payment status to failed with error message."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Execute
        await payment_service.update_payment_status(
            tenant_id="tenant_456",
            payment_id="pay_123",
            new_status=PaymentStatus.FAILED,
            error_message="Card declined",
        )

        # Verify
        assert sample_payment_entity.status == PaymentStatus.FAILED
        assert sample_payment_entity.failure_reason == "Card declined"
        assert sample_payment_entity.processed_at is not None
        assert mock_db_session.commit.called

    async def test_update_status_payment_not_found(self, payment_service, mock_db_session):
        """Test updating status for non-existent payment."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute & Verify
        with pytest.raises(PaymentNotFoundError, match="Payment pay_123 not found"):
            await payment_service.update_payment_status(
                tenant_id="tenant_456",
                payment_id="pay_123",
                new_status=PaymentStatus.SUCCEEDED,
            )

    async def test_update_status_merges_provider_data(
        self, payment_service, mock_db_session, sample_payment_entity
    ):
        """Test that provider data is merged, not replaced."""
        # Setup - payment already has some provider data
        sample_payment_entity.provider_payment_data = {"existing_key": "existing_value"}

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Execute
        await payment_service.update_payment_status(
            tenant_id="tenant_456",
            payment_id="pay_123",
            new_status=PaymentStatus.SUCCEEDED,
            provider_data={"new_key": "new_value"},
        )

        # Verify - both old and new data should be present
        assert sample_payment_entity.provider_payment_data["existing_key"] == "existing_value"
        assert sample_payment_entity.provider_payment_data["new_key"] == "new_value"


@pytest.mark.unit
class TestProcessRefundNotification:
    """Test process_refund_notification method."""

    async def test_process_full_refund(
        self, payment_service, mock_db_session, sample_payment_entity, mocker
    ):
        """Test processing a full refund."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Mock the transaction creation
        mocker.patch.object(payment_service, "_create_transaction", new_callable=AsyncMock)

        # Execute - refund full amount
        await payment_service.process_refund_notification(
            tenant_id="tenant_456",
            payment_id="pay_123",
            refund_amount=Decimal("100.00"),
            provider_refund_id="re_123",
            reason="Customer requested refund",
        )

        # Verify
        assert sample_payment_entity.status == PaymentStatus.REFUNDED
        assert sample_payment_entity.refund_amount == Decimal("100.00")
        assert sample_payment_entity.refunded_at is not None
        assert "refunds" in sample_payment_entity.provider_payment_data
        assert len(sample_payment_entity.provider_payment_data["refunds"]) == 1
        assert (
            sample_payment_entity.provider_payment_data["refunds"][0]["provider_refund_id"]
            == "re_123"
        )
        assert mock_db_session.commit.called
        assert payment_service._create_transaction.called

    async def test_process_partial_refund(
        self, payment_service, mock_db_session, sample_payment_entity, mocker
    ):
        """Test processing a partial refund."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Mock the transaction creation
        mocker.patch.object(payment_service, "_create_transaction", new_callable=AsyncMock)

        # Execute - refund partial amount
        await payment_service.process_refund_notification(
            tenant_id="tenant_456",
            payment_id="pay_123",
            refund_amount=Decimal("50.00"),
            provider_refund_id="re_123",
        )

        # Verify
        assert sample_payment_entity.status == PaymentStatus.PARTIALLY_REFUNDED
        assert sample_payment_entity.refund_amount == Decimal("50.00")
        assert sample_payment_entity.refunded_at is None  # Not fully refunded
        assert mock_db_session.commit.called

    async def test_process_multiple_refunds(
        self, payment_service, mock_db_session, sample_payment_entity, mocker
    ):
        """Test processing multiple partial refunds."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Mock the transaction creation
        mocker.patch.object(payment_service, "_create_transaction", new_callable=AsyncMock)

        # Execute first refund
        await payment_service.process_refund_notification(
            tenant_id="tenant_456",
            payment_id="pay_123",
            refund_amount=Decimal("30.00"),
            provider_refund_id="re_1",
        )

        # Reset mock calls
        mock_db_session.reset_mock()

        # Execute second refund
        await payment_service.process_refund_notification(
            tenant_id="tenant_456",
            payment_id="pay_123",
            refund_amount=Decimal("70.00"),
            provider_refund_id="re_2",
        )

        # Verify - should be fully refunded now
        assert sample_payment_entity.refund_amount == Decimal("100.00")
        assert sample_payment_entity.status == PaymentStatus.REFUNDED
        assert len(sample_payment_entity.provider_payment_data["refunds"]) == 2

    async def test_process_refund_exceeds_payment_amount(
        self, payment_service, mock_db_session, sample_payment_entity
    ):
        """Test that refund exceeding payment amount raises error."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        # Execute & Verify
        with pytest.raises(PaymentError, match="Refund amount .* exceeds payment amount"):
            await payment_service.process_refund_notification(
                tenant_id="tenant_456",
                payment_id="pay_123",
                refund_amount=Decimal("150.00"),  # More than payment amount
            )

    async def test_process_refund_payment_not_found(self, payment_service, mock_db_session):
        """Test refund for non-existent payment."""
        # Setup mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute & Verify
        with pytest.raises(PaymentNotFoundError, match="Payment pay_123 not found"):
            await payment_service.process_refund_notification(
                tenant_id="tenant_456",
                payment_id="pay_123",
                refund_amount=Decimal("50.00"),
            )


@pytest.mark.unit
class TestWebhookIntegration:
    """Integration-style tests for webhook scenarios."""

    async def test_complete_payment_webhook_flow(
        self, payment_service, mock_db_session, sample_payment_entity, mocker
    ):
        """Test complete payment success webhook flow."""
        # Setup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        mocker.patch.object(payment_service, "_create_transaction", new_callable=AsyncMock)

        # Simulate payment creation (already exists)
        assert sample_payment_entity.status == PaymentStatus.PENDING

        # Webhook: Payment succeeded
        await payment_service.update_payment_status(
            tenant_id="tenant_456",
            payment_id="pay_123",
            new_status=PaymentStatus.SUCCEEDED,
            provider_data={"stripe_charge_id": "ch_123"},
        )

        # Verify final state
        assert sample_payment_entity.status == PaymentStatus.SUCCEEDED
        assert sample_payment_entity.processed_at is not None

    async def test_failed_then_refunded_flow(
        self, payment_service, mock_db_session, sample_payment_entity, mocker
    ):
        """Test payment that succeeds then gets refunded."""
        # Setup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_payment_entity
        mock_db_session.execute.return_value = mock_result

        mocker.patch.object(payment_service, "_create_transaction", new_callable=AsyncMock)

        # Webhook 1: Payment succeeded
        await payment_service.update_payment_status(
            tenant_id="tenant_456",
            payment_id="pay_123",
            new_status=PaymentStatus.SUCCEEDED,
        )

        assert sample_payment_entity.status == PaymentStatus.SUCCEEDED

        # Webhook 2: Payment refunded
        await payment_service.process_refund_notification(
            tenant_id="tenant_456",
            payment_id="pay_123",
            refund_amount=Decimal("100.00"),
            reason="Customer dispute",
        )

        # Verify final state
        assert sample_payment_entity.status == PaymentStatus.REFUNDED
        assert sample_payment_entity.refund_amount == Decimal("100.00")
