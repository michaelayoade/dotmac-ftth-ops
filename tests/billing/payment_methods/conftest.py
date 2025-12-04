"""
Fixtures and helpers for Payment Methods Service tests.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from dotmac.platform.billing.payment_methods.models import (
    PaymentMethodStatus,
    PaymentMethodType,
)


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    session.execute = AsyncMock()
    return session


def create_payment_method_orm(
    id=None,
    tenant_id="tenant-123",
    payment_method_type=PaymentMethodType.CARD,
    is_default=True,
    is_verified=True,
    is_deleted=False,
    details=None,
):
    """Factory function to create payment method ORM object with all required attributes."""
    pm = MagicMock()
    pm.id = id or uuid4()
    pm.tenant_id = tenant_id
    pm.payment_method_type = payment_method_type
    pm.provider_payment_method_id = "pm_test123"
    pm.provider_customer_id = "cus_test123"
    pm.display_name = "Visa ending in 4242"
    pm.is_default = is_default
    pm.is_verified = is_verified
    pm.is_deleted = is_deleted
    pm.status = PaymentMethodStatus.ACTIVE
    pm.auto_pay_enabled = False

    # Provide complete details dict with all expected keys
    if details is None:
        details = {
            "last4": "4242",
            "brand": "visa",
            "exp_month": 12,
            "exp_year": 2025,
            "billing_name": "John Doe",
            "billing_email": "john@example.com",
            "billing_country": "NG",
        }
    pm.details = details

    pm.metadata_ = {}
    pm.created_at = datetime.now(UTC)
    pm.updated_at = datetime.now(UTC)
    pm.last_used_at = None
    pm.deleted_at = None
    pm.deleted_reason = None

    return pm


@pytest.fixture
def sample_payment_method_orm():
    """Sample payment method ORM object."""
    return create_payment_method_orm()


def build_mock_result(scalar_value="__unset__", all_values=None):
    """Build mock database result.

    Args:
        scalar_value: Value to return from scalar_one_or_none().
                     Use None to return None, or omit to not set.
        all_values: List of values to return from scalars().all()
    """
    result = MagicMock()  # Use MagicMock not AsyncMock

    if all_values is not None:
        # result.scalars() returns a ScalarResult, which has .all()
        scalars_result = MagicMock()
        scalars_result.all.return_value = all_values
        result.scalars.return_value = scalars_result

    if scalar_value != "__unset__":
        result.scalar_one_or_none.return_value = scalar_value

    return result


def create_payment_method_response(id=None, is_default=True):
    """Helper to create PaymentMethodResponse for mocking."""
    from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse

    return PaymentMethodResponse(
        payment_method_id=str(id or uuid4()),
        tenant_id="tenant-123",
        method_type=PaymentMethodType.CARD,
        status=PaymentMethodStatus.ACTIVE,
        is_default=is_default,
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
    )
