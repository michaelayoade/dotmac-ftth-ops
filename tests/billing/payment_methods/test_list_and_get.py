"""
Tests for Payment Methods Service - List and Get operations.
"""

from uuid import uuid4

import pytest

from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse
from dotmac.platform.billing.payment_methods.service import PaymentMethodService
from tests.billing.payment_methods.conftest import build_mock_result

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestListPaymentMethods:
    """Test listing payment methods."""

    async def test_list_payment_methods_success(self, mock_db_session, sample_payment_method_orm):
        """Test successfully listing payment methods."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(
            all_values=[sample_payment_method_orm]
        )

        # Execute
        result = await service.list_payment_methods("tenant-123")

        # Verify
        assert len(result) == 1
        assert isinstance(result[0], PaymentMethodResponse)
        mock_db_session.execute.assert_called_once()

    async def test_list_payment_methods_empty(self, mock_db_session):
        """Test listing when no payment methods exist."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(all_values=[])

        # Execute
        result = await service.list_payment_methods("tenant-123")

        # Verify
        assert len(result) == 0
        assert isinstance(result, list)

    async def test_list_payment_methods_multiple(self, mock_db_session, sample_payment_method_orm):
        """Test listing multiple payment methods."""
        # Setup
        service = PaymentMethodService(mock_db_session)

        pm2 = sample_payment_method_orm
        pm2.id = uuid4()
        pm2.is_default = False

        mock_db_session.execute.return_value = build_mock_result(
            all_values=[sample_payment_method_orm, pm2]
        )

        # Execute
        result = await service.list_payment_methods("tenant-123")

        # Verify
        assert len(result) == 2


@pytest.mark.integration
class TestGetPaymentMethod:
    """Test getting specific payment method."""

    async def test_get_payment_method_success(self, mock_db_session, sample_payment_method_orm):
        """Test successfully getting a payment method."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(
            scalar_value=sample_payment_method_orm
        )

        # Execute
        result = await service.get_payment_method(str(sample_payment_method_orm.id), "tenant-123")

        # Verify
        assert result is not None
        assert isinstance(result, PaymentMethodResponse)
        assert result.tenant_id == "tenant-123"

    async def test_get_payment_method_not_found(self, mock_db_session):
        """Test getting non-existent payment method."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(scalar_value=None)

        # Execute
        result = await service.get_payment_method(str(uuid4()), "tenant-123")

        # Verify
        assert result is None

    async def test_get_payment_method_invalid_uuid(self, mock_db_session):
        """Test getting payment method with invalid UUID."""
        # Setup
        service = PaymentMethodService(mock_db_session)

        # Execute
        result = await service.get_payment_method("invalid-uuid", "tenant-123")

        # Verify
        assert result is None


@pytest.mark.integration
class TestGetDefaultPaymentMethod:
    """Test getting default payment method."""

    async def test_get_default_success(self, mock_db_session, sample_payment_method_orm):
        """Test successfully getting default payment method."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(
            scalar_value=sample_payment_method_orm
        )

        # Execute
        result = await service.get_default_payment_method("tenant-123")

        # Verify
        assert result is not None
        assert result.is_default is True

    async def test_get_default_none_exists(self, mock_db_session):
        """Test getting default when none exists."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_db_session.execute.return_value = build_mock_result(scalar_value=None)

        # Execute
        result = await service.get_default_payment_method("tenant-123")

        # Verify
        assert result is None
