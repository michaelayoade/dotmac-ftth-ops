"""
Shared fixtures for customer management tests.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.customer_management.models import (
    CommunicationChannel,
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.customer_management.service import CustomerService


@pytest.fixture
def mock_session():
    """Create a mock async database session with proper async mocking."""
    from unittest.mock import MagicMock

    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    session.delete = MagicMock()

    # Mock execute() to return proper result chain
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all = MagicMock(return_value=[])
    mock_scalars.first = MagicMock(return_value=None)
    mock_scalars.one = MagicMock(return_value=None)
    mock_result.scalars = MagicMock(return_value=mock_scalars)
    mock_result.scalar_one = MagicMock(return_value=0)
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_result.all = MagicMock(return_value=[])
    session.execute = AsyncMock(return_value=mock_result)

    return session


@pytest.fixture
def mock_service():
    """Create a mock customer service."""
    service = AsyncMock(spec=CustomerService)
    return service


@pytest.fixture
def mock_user():
    """Create a mock current user."""
    return UserInfo(
        user_id=str(uuid4()),  # Use valid UUID format
        username="testuser",
        email="test@example.com",
        roles=["user"],
        tenant_id="test-tenant",
    )


@pytest.fixture
def sample_customer():
    """Create a sample customer with all required fields."""
    return Customer(
        id=uuid4(),
        tenant_id="test-tenant",
        customer_number="CUST-001",
        email="customer@example.com",
        first_name="John",
        last_name="Doe",
        phone="+1234567890",
        company_name="Test Corp",
        status=CustomerStatus.ACTIVE,
        tier=CustomerTier.STANDARD,
        customer_type=CustomerType.INDIVIDUAL,
        preferred_channel=CommunicationChannel.EMAIL,
        preferred_language="en",
        timezone="UTC",
        opt_in_marketing=False,
        opt_in_updates=True,
        email_verified=True,
        phone_verified=False,
        lifetime_value=Decimal("1000.00"),
        average_order_value=Decimal("200.00"),
        total_purchases=5,
        risk_score=50,
        acquisition_date=datetime.now(UTC),
        tags=[],
        metadata_={},
        custom_fields={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def sample_customers():
    """Create multiple sample customers for list tests."""
    customers = []
    for i in range(3):
        customer = Customer(
            id=uuid4(),
            tenant_id="test-tenant",
            customer_number=f"CUST-{i + 1:03d}",
            email=f"customer{i + 1}@example.com",
            first_name=f"Customer{i + 1}",
            last_name="Test",
            phone=f"+123456789{i}",
            status=CustomerStatus.ACTIVE,
            tier=CustomerTier.STANDARD,
            customer_type=CustomerType.INDIVIDUAL,
            preferred_channel=CommunicationChannel.EMAIL,
            preferred_language="en",
            timezone="UTC",
            opt_in_marketing=False,
            opt_in_updates=True,
            email_verified=True,
            phone_verified=False,
            lifetime_value=Decimal("1000.00"),
            average_order_value=Decimal("200.00"),
            total_purchases=5,
            risk_score=50,
            acquisition_date=datetime.now(UTC),
            tags=[],
            metadata_={},
            custom_fields={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        customers.append(customer)
    return customers


@pytest.fixture
def customer_service(mock_session):
    """Create customer service with mocked session."""
    return CustomerService(session=mock_session)


@pytest.fixture
def existing_customer(sample_customer):
    """Provide an existing customer for tests."""
    return sample_customer
