"""
Tests for payment method management functionality.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from dotmac.platform.billing.core.entities import PaymentMethodEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentMethodType,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentMethodNotFoundError,
)
from dotmac.platform.billing.core.models import PaymentMethod
from tests.billing.payments.conftest import (
    setup_mock_db_result,
    setup_mock_refresh,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestPaymentMethodManagement:
    """Test payment method management functionality"""

    async def test_add_payment_method_card(self, payment_service, mock_payment_db_session):
        """Test adding a card payment method"""
        # Setup
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = []
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.add_payment_method(
            tenant_id="test-tenant",
            customer_id="customer_456",
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            provider_payment_method_id="stripe_pm_123",
            display_name="Visa ending in 4242",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
            set_as_default=True,
        )

        # Verify
        assert isinstance(result, PaymentMethod)
        assert result.type == PaymentMethodType.CARD
        assert result.last_four == "4242"
        assert result.is_default is True
        mock_payment_db_session.add.assert_called_once()
        mock_payment_db_session.commit.assert_called()

    async def test_add_payment_method_bank_account(self, payment_service, mock_payment_db_session):
        """Test adding a bank account payment method"""
        # Setup
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = []
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.add_payment_method(
            tenant_id="test-tenant",
            customer_id="customer_456",
            payment_method_type=PaymentMethodType.BANK_ACCOUNT,
            provider="stripe",
            provider_payment_method_id="stripe_ba_123",
            display_name="Chase ending in 6789",
            last_four="6789",
            bank_name="Chase Bank",
            account_type="checking",
        )

        # Verify
        assert result.type == PaymentMethodType.BANK_ACCOUNT
        assert result.bank_name == "Chase Bank"

    async def test_add_first_payment_method_sets_default(
        self, payment_service, mock_payment_db_session
    ):
        """Test that first payment method is automatically set as default"""
        # Setup - no existing payment methods
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = []
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.add_payment_method(
            tenant_id="test-tenant",
            customer_id="customer_456",
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            provider_payment_method_id="stripe_pm_123",
            display_name="First card",
            set_as_default=False,  # Not explicitly setting as default
        )

        # Verify - should be default anyway
        assert result.is_default is True

    async def test_set_default_payment_method(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test setting a payment method as default"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = [
            sample_payment_method_entity
        ]

        # Execute
        result = await payment_service.set_default_payment_method(
            tenant_id="test-tenant",
            customer_id="customer_456",
            payment_method_id="pm_789",
        )

        # Verify
        assert result.is_default is True
        mock_payment_db_session.commit.assert_called()

    async def test_set_default_payment_method_not_found(
        self, payment_service, mock_payment_db_session
    ):
        """Test setting non-existent payment method as default"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute & Verify
        with pytest.raises(PaymentMethodNotFoundError, match="Payment method pm_789 not found"):
            await payment_service.set_default_payment_method(
                tenant_id="test-tenant",
                customer_id="customer_456",
                payment_method_id="pm_789",
            )

    async def test_set_default_payment_method_wrong_customer(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test setting payment method as default for wrong customer"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)

        # Execute & Verify
        with pytest.raises(PaymentError, match="Payment method does not belong to customer"):
            await payment_service.set_default_payment_method(
                tenant_id="test-tenant",
                customer_id="wrong_customer",
                payment_method_id="pm_789",
            )

    async def test_list_payment_methods(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test listing customer payment methods"""
        # Setup
        payment_methods = [sample_payment_method_entity]
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = (
            payment_methods
        )

        # Execute
        result = await payment_service.list_payment_methods(
            tenant_id="test-tenant",
            customer_id="customer_456",
        )

        # Verify
        assert len(result) == 1
        assert result[0].payment_method_id == "pm_789"
        assert result[0].is_default is True

    async def test_list_payment_methods_include_inactive(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test listing payment methods including inactive ones"""
        # Setup
        now = datetime.now(UTC)
        inactive_method = MagicMock(spec=PaymentMethodEntity)
        inactive_method.tenant_id = "test-tenant"
        inactive_method.payment_method_id = "pm_inactive"
        inactive_method.customer_id = "customer_456"
        inactive_method.type = PaymentMethodType.CARD
        inactive_method.status = PaymentMethodStatus.INACTIVE
        inactive_method.provider = "stripe"
        inactive_method.provider_payment_method_id = "stripe_pm_456"
        inactive_method.display_name = "Inactive card"
        inactive_method.is_active = True
        inactive_method.is_default = False
        inactive_method.last_four = None
        inactive_method.brand = None
        inactive_method.expiry_month = None
        inactive_method.expiry_year = None
        inactive_method.bank_name = None
        inactive_method.account_type = None
        inactive_method.routing_number_last_four = None
        inactive_method.auto_pay_enabled = False
        inactive_method.verified_at = None
        inactive_method.created_at = now
        inactive_method.updated_at = now
        inactive_method.deleted_at = None
        inactive_method.extra_data = {}
        inactive_method.events = []

        payment_methods = [sample_payment_method_entity, inactive_method]
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = (
            payment_methods
        )

        # Execute
        result = await payment_service.list_payment_methods(
            tenant_id="test-tenant",
            customer_id="customer_456",
            include_inactive=True,
        )

        # Verify
        assert len(result) == 2

    async def test_get_payment_method(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test getting a specific payment method"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)

        # Execute
        result = await payment_service.get_payment_method(
            tenant_id="test-tenant",
            payment_method_id="pm_789",
        )

        # Verify
        assert result is not None
        assert result.payment_method_id == "pm_789"

    async def test_get_payment_method_not_found(self, payment_service, mock_payment_db_session):
        """Test getting non-existent payment method"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute
        result = await payment_service.get_payment_method(
            tenant_id="test-tenant",
            payment_method_id="nonexistent",
        )

        # Verify
        assert result is None

    async def test_delete_payment_method(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test soft deleting a payment method"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)

        # Execute
        result = await payment_service.delete_payment_method(
            tenant_id="test-tenant",
            payment_method_id="pm_789",
        )

        # Verify
        assert result is True
        assert sample_payment_method_entity.is_active is False
        assert sample_payment_method_entity.status == PaymentMethodStatus.INACTIVE
        assert sample_payment_method_entity.deleted_at is not None
        mock_payment_db_session.commit.assert_called()

    async def test_delete_payment_method_not_found(self, payment_service, mock_payment_db_session):
        """Test deleting non-existent payment method"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute & Verify
        with pytest.raises(PaymentMethodNotFoundError, match="Payment method pm_789 not found"):
            await payment_service.delete_payment_method(
                tenant_id="test-tenant",
                payment_method_id="pm_789",
            )
