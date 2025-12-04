"""
Tests for Payment Methods Service - Add, Update, Remove operations.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.billing.exceptions import PaymentMethodError
from dotmac.platform.billing.payment_methods.models import (
    CardBrand,
    PaymentMethodResponse,
    PaymentMethodStatus,
    PaymentMethodType,
)
from dotmac.platform.billing.payment_methods.service import PaymentMethodService
from tests.billing.payment_methods.conftest import build_mock_result

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestAddPaymentMethod:
    """Test adding payment methods."""

    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._get_paystack_plugin"
    )
    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._check_duplicate_payment_method"
    )
    async def test_add_card_as_first_payment_method(
        self, mock_check_dup, mock_plugin, mock_db_session
    ):
        """Test adding first card payment method (auto-default)."""
        from tests.billing.payment_methods.conftest import create_payment_method_orm

        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_plugin.return_value = MagicMock()
        mock_check_dup.return_value = None  # No duplicate

        # Mock list_payment_methods to return empty (first method)
        with patch.object(service, "list_payment_methods", return_value=[]):
            # Mock refresh to set the ORM object attributes
            async def mock_refresh(obj):
                # Set all attributes that _orm_to_response needs
                test_orm = create_payment_method_orm()
                obj.id = test_orm.id
                obj.created_at = test_orm.created_at
                obj.updated_at = test_orm.updated_at
                obj.auto_pay_enabled = test_orm.auto_pay_enabled

            mock_db_session.refresh.side_effect = mock_refresh

            # Execute
            result = await service.add_payment_method(
                tenant_id="tenant-123",
                method_type=PaymentMethodType.CARD,
                token="auth_test1234",
                billing_details={
                    "card_brand": "visa",
                    "exp_month": 12,
                    "exp_year": 2025,
                    "billing_name": "John Doe",
                    "billing_email": "john@example.com",
                },
                set_as_default=False,  # Should be overridden to True
                added_by_user_id="user-123",
            )

            # Verify
            assert isinstance(result, PaymentMethodResponse)
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()
            # Verify the added object has is_default=True
            added_obj = mock_db_session.add.call_args[0][0]
            assert added_obj.is_default is True

    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._get_paystack_plugin"
    )
    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._check_duplicate_payment_method"
    )
    async def test_add_bank_account(self, mock_check_dup, mock_plugin, mock_db_session):
        """Test adding bank account payment method."""
        from tests.billing.payment_methods.conftest import create_payment_method_orm

        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_plugin.return_value = MagicMock()
        mock_check_dup.return_value = None

        with patch.object(service, "list_payment_methods", return_value=[]):

            async def mock_refresh(obj):
                test_orm = create_payment_method_orm(
                    payment_method_type=PaymentMethodType.BANK_ACCOUNT,
                    is_verified=False,
                    details={
                        "bank_name": "First Bank",
                        "account_last4": "5678",
                        "account_type": "savings",
                        "billing_name": "Jane Doe",
                        "billing_email": "jane@example.com",
                        "billing_country": "NG",
                    },
                )
                obj.id = test_orm.id
                obj.created_at = test_orm.created_at
                obj.updated_at = test_orm.updated_at
                obj.auto_pay_enabled = test_orm.auto_pay_enabled

            mock_db_session.refresh.side_effect = mock_refresh

            # Execute
            result = await service.add_payment_method(
                tenant_id="tenant-123",
                method_type=PaymentMethodType.BANK_ACCOUNT,
                token="bank_test5678",
                billing_details={
                    "bank_name": "First Bank",
                    "account_type": "savings",
                    "billing_name": "Jane Doe",
                },
                set_as_default=False,
                added_by_user_id="user-456",
            )

            # Verify
            assert isinstance(result, PaymentMethodResponse)
            added_obj = mock_db_session.add.call_args[0][0]
            assert added_obj.is_verified is False  # Bank accounts need verification

    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._get_paystack_plugin"
    )
    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._check_duplicate_payment_method"
    )
    async def test_add_duplicate_payment_method(self, mock_check_dup, mock_plugin, mock_db_session):
        """Test adding duplicate payment method raises error."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_plugin.return_value = MagicMock()
        mock_check_dup.return_value = MagicMock()  # Duplicate found

        with patch.object(service, "list_payment_methods", return_value=[]):
            # Execute & Verify
            with pytest.raises(PaymentMethodError, match="already been added"):
                await service.add_payment_method(
                    tenant_id="tenant-123",
                    method_type=PaymentMethodType.CARD,
                    token="duplicate_token",
                    billing_details={},
                    set_as_default=False,
                    added_by_user_id="user-123",
                )

    @patch(
        "dotmac.platform.billing.payment_methods.service.PaymentMethodService._get_paystack_plugin"
    )
    async def test_add_unsupported_payment_method_type(self, mock_plugin, mock_db_session):
        """Test adding unsupported payment method type."""
        # Setup
        service = PaymentMethodService(mock_db_session)
        mock_plugin.return_value = MagicMock()

        with patch.object(service, "list_payment_methods", return_value=[]):
            # Execute & Verify
            with pytest.raises(PaymentMethodError, match="Unsupported payment method type"):
                await service.add_payment_method(
                    tenant_id="tenant-123",
                    method_type="invalid_type",  # Invalid
                    token="test_token",
                    billing_details={},
                    set_as_default=False,
                    added_by_user_id="user-123",
                )


@pytest.mark.integration
class TestUpdatePaymentMethod:
    """Test updating payment methods."""

    async def test_update_payment_method_billing_details(self, mock_db_session):
        """Test updating payment method billing details."""
        from tests.billing.payment_methods.conftest import create_payment_method_orm

        # Setup
        service = PaymentMethodService(mock_db_session)
        test_orm = create_payment_method_orm()

        # Mock get_payment_method
        with patch.object(
            service,
            "get_payment_method",
            return_value=PaymentMethodResponse(
                payment_method_id=str(test_orm.id),
                tenant_id="tenant-123",
                method_type=PaymentMethodType.CARD,
                status=PaymentMethodStatus.ACTIVE,
                is_default=True,
                card_brand=None,
                card_last4=None,
                card_exp_month=None,
                card_exp_year=None,
                bank_name=None,
                bank_account_last4=None,
                bank_account_type=None,
                wallet_type=None,
                billing_name=None,
                billing_email=None,
                billing_country="NG",
                is_verified=True,
                auto_pay_enabled=False,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                expires_at=None,
            ),
        ):
            # Mock the ORM fetch
            mock_db_session.execute.return_value = build_mock_result(scalar_value=test_orm)

            # Mock refresh
            async def mock_refresh(obj):
                pass

            mock_db_session.refresh.side_effect = mock_refresh

            # Execute
            result = await service.update_payment_method(
                payment_method_id=str(test_orm.id),
                tenant_id="tenant-123",
                billing_details={
                    "billing_name": "Updated Name",
                    "billing_email": "updated@example.com",
                },
                updated_by_user_id="user-789",
            )

            # Verify
            assert isinstance(result, PaymentMethodResponse)
            mock_db_session.commit.assert_called_once()

    async def test_update_payment_method_not_found(self, mock_db_session):
        """Test updating non-existent payment method."""
        # Setup
        service = PaymentMethodService(mock_db_session)

        with patch.object(service, "get_payment_method", return_value=None):
            # Execute & Verify
            with pytest.raises(PaymentMethodError, match="not found"):
                await service.update_payment_method(
                    payment_method_id=str(uuid4()),
                    tenant_id="tenant-123",
                    billing_details={},
                    updated_by_user_id="user-123",
                )


@pytest.mark.integration
class TestSetDefaultPaymentMethod:
    """Test setting default payment method."""

    async def test_set_default_success(self, mock_db_session):
        """Test successfully setting default payment method."""
        from tests.billing.payment_methods.conftest import (
            create_payment_method_orm,
            create_payment_method_response,
        )

        # Setup
        service = PaymentMethodService(mock_db_session)
        test_orm = create_payment_method_orm(is_default=False)

        with patch.object(
            service,
            "get_payment_method",
            return_value=create_payment_method_response(id=test_orm.id, is_default=False),
        ):
            mock_db_session.execute.return_value = build_mock_result(scalar_value=test_orm)

            # Execute
            result = await service.set_default_payment_method(
                payment_method_id=str(test_orm.id),
                tenant_id="tenant-123",
                set_by_user_id="user-123",
            )

            # Verify
            assert isinstance(result, PaymentMethodResponse)
            mock_db_session.commit.assert_called_once()

    async def test_set_default_not_found(self, mock_db_session):
        """Test setting non-existent payment method as default."""
        # Setup
        service = PaymentMethodService(mock_db_session)

        with patch.object(service, "get_payment_method", return_value=None):
            # Execute & Verify
            with pytest.raises(PaymentMethodError, match="not found"):
                await service.set_default_payment_method(
                    payment_method_id=str(uuid4()),
                    tenant_id="tenant-123",
                    set_by_user_id="user-123",
                )


@pytest.mark.integration
class TestRemovePaymentMethod:
    """Test removing payment methods."""

    async def test_remove_non_default_payment_method(self, mock_db_session):
        """Test removing non-default payment method."""
        from tests.billing.payment_methods.conftest import (
            create_payment_method_orm,
            create_payment_method_response,
        )

        # Setup
        service = PaymentMethodService(mock_db_session)
        test_orm = create_payment_method_orm(is_default=False)

        with patch.object(
            service,
            "get_payment_method",
            return_value=create_payment_method_response(id=test_orm.id, is_default=False),
        ):
            # Mock the ORM fetch
            mock_db_session.execute.return_value = build_mock_result(scalar_value=test_orm)

            # Execute
            await service.remove_payment_method(
                payment_method_id=str(test_orm.id),
                tenant_id="tenant-123",
                removed_by_user_id="user-123",
            )

            # Verify
            mock_db_session.commit.assert_called_once()

    async def test_remove_payment_method_not_found(self, mock_db_session):
        """Test removing non-existent payment method."""
        # Setup
        service = PaymentMethodService(mock_db_session)

        with patch.object(service, "get_payment_method", return_value=None):
            # Execute & Verify
            with pytest.raises(PaymentMethodError, match="not found"):
                await service.remove_payment_method(
                    payment_method_id=str(uuid4()),
                    tenant_id="tenant-123",
                    removed_by_user_id="user-123",
                )

    async def test_remove_default_with_active_subscriptions(self, mock_db_session):
        """Test removing default payment method with active subscriptions fails."""
        from tests.billing.payment_methods.conftest import (
            create_payment_method_orm,
            create_payment_method_response,
        )

        # Setup
        service = PaymentMethodService(mock_db_session)
        test_orm = create_payment_method_orm(is_default=True)

        with patch.object(
            service,
            "get_payment_method",
            return_value=create_payment_method_response(id=test_orm.id, is_default=True),
        ):
            # Mock the database execute to return active subscriptions
            # This will be called twice:
            # 1. First call (implicit) - already handled by fixture
            # 2. Second call for subscription check - need to setup here
            mock_subs = [MagicMock()]  # Active subscriptions exist

            # Setup sequential return values for execute calls
            mock_db_session.execute.return_value = build_mock_result(all_values=mock_subs)

            # Execute & Verify
            with pytest.raises(ValueError, match="Cannot remove default"):
                await service.remove_payment_method(
                    payment_method_id=str(test_orm.id),
                    tenant_id="tenant-123",
                    removed_by_user_id="user-123",
                )


@pytest.mark.integration
class TestPaymentMethodBrandParsing:
    """Ensure card brand parsing is resilient."""

    def test_card_brand_normalization(self, mock_db_session):
        """Uppercase provider responses should map to enum values."""
        from tests.billing.payment_methods.conftest import create_payment_method_orm

        service = PaymentMethodService(mock_db_session)
        pm = create_payment_method_orm(
            details={
                "last4": "1111",
                "brand": "VISA",
                "exp_month": 5,
                "exp_year": 2030,
                "billing_name": "Case Normalize",
                "billing_email": "case@example.com",
                "billing_country": "US",
            }
        )

        response = service._orm_to_response(pm)
        assert response.card_brand == CardBrand.VISA

    def test_unknown_card_brand_maps_to_unknown(self, mock_db_session):
        """Unexpected brands should not crash and return UNKNOWN."""
        from tests.billing.payment_methods.conftest import create_payment_method_orm

        service = PaymentMethodService(mock_db_session)
        pm = create_payment_method_orm(
            details={
                "last4": "2222",
                "brand": "Verve",
                "exp_month": 6,
                "exp_year": 2031,
                "billing_name": "Unknown Brand",
                "billing_email": "unknown@example.com",
                "billing_country": "NG",
            }
        )

        response = service._orm_to_response(pm)
        assert response.card_brand == CardBrand.UNKNOWN
