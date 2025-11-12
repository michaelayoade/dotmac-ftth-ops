"""
Shared fixtures for customer management tests.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.tenant.models import Tenant

try:  # pragma: no cover - imported for type/spec usage in fixtures
    from dotmac.platform.customer_management.service import CustomerService
except Exception:  # pragma: no cover - fallback during partial installs
    CustomerService = object  # type: ignore

# Ensure dependent tables are registered when SQLAlchemy metadata is created in tests
try:  # pragma: no cover - best effort imports for test setup
    import dotmac.platform.billing.models  # noqa: F401
    import dotmac.platform.licensing.models  # noqa: F401
    import dotmac.platform.user_management.models  # noqa: F401
except Exception:  # pragma: no cover - optional during partial installs
    pass


def _build_customer_kwargs(
    *,
    index: int = 1,
    tenant_id: str = "test-tenant",
    customer_id: UUID | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate complete keyword args for constructing Customer objects."""
    from dotmac.platform.customer_management.models import (
        CommunicationChannel,
        CustomerStatus,
        CustomerTier,
        CustomerType,
    )

    now = datetime.now(UTC)
    customer_uuid = customer_id or uuid4()

    base_kwargs: dict[str, Any] = {
        "id": customer_uuid,
        "tenant_id": tenant_id,
        "customer_number": f"CUST-{index:03d}",
        "email": f"customer{index}@example.com",
        "first_name": f"Customer{index}",
        "middle_name": f"Middle{index}",
        "last_name": "Example",
        "display_name": f"Customer{index} Example",
        "company_name": "Test Corp",
        "status": CustomerStatus.ACTIVE,
        "tier": CustomerTier.STANDARD,
        "customer_type": CustomerType.INDIVIDUAL,
        "preferred_channel": CommunicationChannel.EMAIL,
        "preferred_language": "en",
        "timezone": "timezone.utc",
        "opt_in_marketing": False,
        "opt_in_updates": True,
        "email_verified": True,
        "phone_verified": False,
        "phone": f"+12345678{index:02d}",
        "mobile": f"+12345679{index:02d}",
        "address_line1": f"{index} Main St",
        "address_line2": "Suite 100",
        "city": "San Francisco",
        "state_province": "CA",
        "postal_code": "94105",
        "country": "US",
        "tax_id": f"TAX-{index:03d}",
        "vat_number": f"VAT-{index:03d}",
        "industry": "Technology",
        "employee_count": 50 + index,
        "annual_revenue": Decimal("500000.00"),
        "user_id": None,
        "assigned_to": None,
        "segment_id": None,
        "lifetime_value": Decimal("1000.00"),
        "total_purchases": 5 + index,
        "last_purchase_date": now - timedelta(days=7),
        "first_purchase_date": now - timedelta(days=120),
        "average_order_value": Decimal("200.00"),
        "credit_score": 720,
        "risk_score": 45 + index,
        "satisfaction_score": 88,
        "net_promoter_score": 25,
        "acquisition_date": now - timedelta(days=150),
        "last_contact_date": now - timedelta(days=3),
        "birthday": datetime(1990, min(index, 12), 15),
        "service_address_line1": f"{index} Fiber Ave",
        "service_address_line2": "Unit A",
        "service_city": "San Francisco",
        "service_state_province": "CA",
        "service_postal_code": "94105",
        "service_country": "US",
        "service_coordinates": {
            "lat": 37.7749 + (index * 0.001),
            "lon": -122.4194,
        },
        "installation_status": "completed",
        "installation_date": now - timedelta(days=90),
        "scheduled_installation_date": now - timedelta(days=95),
        "installation_technician_id": None,  # Set to None to avoid FK constraint
        "installation_notes": "Installed on schedule",
        "connection_type": "ftth",
        "last_mile_technology": "gpon",
        "service_plan_speed": "1 Gbps",
        "assigned_devices": {
            "onu_serial": f"ONU{index:04d}",
            "router_id": f"RTR{index:04d}",
        },
        "current_bandwidth_profile": "1G/1G",
        "static_ip_assigned": f"198.51.100.{index}",
        "ipv6_prefix": "2001:db8::/48",
        "avg_uptime_percent": Decimal("99.95"),
        "last_outage_date": now - timedelta(days=60),
        "total_outages": 1,
        "total_downtime_minutes": 15,
        "metadata_": {"segment": "test", "index": index},
        "custom_fields": {"account_manager": f"Manager {index}"},
        "tags": ["vip", f"group-{index}"],
        "created_at": now,
        "updated_at": now,
        "external_id": f"crm-{index:03d}",
        "source_system": "crm",
    }

    if overrides:
        base_kwargs.update(overrides)

    return base_kwargs


@pytest_asyncio.fixture
async def test_tenant(async_session):
    """Create a test tenant for customer management tests."""
    from uuid import uuid4

    tenant_id = f"test-tenant-{uuid4().hex[:8]}"
    tenant = Tenant(
        id=tenant_id,
        name=f"Test Tenant {tenant_id}",
        slug=tenant_id,
        timezone="UTC",
        email="tenant@example.com",
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest.fixture
def mock_session():
    """Create a mock async database session with proper async mocking."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    session.delete = MagicMock()

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
    from dotmac.platform.customer_management.service import CustomerService

    return AsyncMock(spec=CustomerService)


@pytest.fixture
def mock_user():
    """Create a mock current user."""
    return UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        roles=["user"],
        tenant_id="test-tenant",
    )


@pytest_asyncio.fixture
async def sample_customer(test_tenant):
    """Create a sample customer with all required fields populated."""
    from dotmac.platform.customer_management.models import Customer

    unique_suffix = uuid4().hex[:8]
    customer_kwargs = _build_customer_kwargs(
        index=1,
        tenant_id=test_tenant.id,  # Use the test tenant's ID
        overrides={
            "customer_number": f"CUST-{unique_suffix.upper()}",
            "email": f"customer_{unique_suffix}@example.com",
            "first_name": "John",
            "middle_name": "Quincy",
            "last_name": "Doe",
            "display_name": f"John Q. Doe {unique_suffix}",
            "metadata_": {"loyalty_level": "gold", "segment": "enterprise"},
            "custom_fields": {"account_manager": "Alice Smith", "csat": 9.8},
            "tags": ["vip", "fiber", unique_suffix],
        },
    )
    return Customer(**customer_kwargs)


@pytest_asyncio.fixture
async def sample_customers(test_tenant):
    """Create multiple sample customers for list tests."""
    from dotmac.platform.customer_management.models import Customer

    return [
        Customer(**_build_customer_kwargs(index=i, tenant_id=test_tenant.id)) for i in range(1, 4)
    ]


@pytest.fixture
def customer_service(mock_session):
    """Create customer service with mocked session."""
    from dotmac.platform.customer_management.service import CustomerService

    return CustomerService(session=mock_session)


@pytest.fixture
def existing_customer(sample_customer):
    """Provide an existing customer for tests."""
    return sample_customer


class MockObject:
    """Helper class to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def sample_customer_dict() -> dict[str, Any]:
    """Sample customer dict for router testing that mirrors API response."""
    customer_id = str(uuid4())
    now = datetime.utcnow()
    earlier = now - timedelta(days=7)
    return {
        "id": customer_id,
        "customer_number": "CUST-2025-001",
        "tenant_id": "1",
        "first_name": "John",
        "middle_name": "Quincy",
        "last_name": "Doe",
        "display_name": "John Q. Doe",
        "email": "john.doe@example.com",
        "phone": "+1-555-0100",
        "mobile": "+1-555-0101",
        "customer_type": "individual",
        "tier": "standard",
        "status": "active",
        "preferred_channel": "email",
        "preferred_language": "en",
        "timezone": "timezone.utc",
        "opt_in_marketing": False,
        "opt_in_updates": True,
        "email_verified": True,
        "phone_verified": False,
        "address_line1": "123 Main St",
        "address_line2": "Suite 100",
        "city": "San Francisco",
        "state_province": "CA",
        "postal_code": "94105",
        "country": "US",
        "lifetime_value": "1000.00",
        "average_order_value": "200.00",
        "total_purchases": 5,
        "risk_score": 50,
        "satisfaction_score": 80,
        "net_promoter_score": 20,
        "credit_score": 720,
        "acquisition_date": (now - timedelta(days=120)).isoformat(),
        "last_contact_date": (now - timedelta(days=3)).isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_purchase_date": earlier.isoformat(),
        "first_purchase_date": (earlier - timedelta(days=60)).isoformat(),
        "birthday": "1990-07-12T00:00:00",
        "user_id": None,
        "assigned_to": None,
        "segment_id": None,
        "tags": ["vip", "fiber"],
        "metadata": {"loyalty_level": "gold", "segment": "enterprise"},
        "metadata_": {"loyalty_level": "gold", "segment": "enterprise"},
        "custom_fields": {"account_manager": "Alice Smith"},
        "service_address_line1": "123 Fiber Ave",
        "service_address_line2": "Unit A",
        "service_city": "San Francisco",
        "service_state_province": "CA",
        "service_postal_code": "94105",
        "service_country": "US",
        "service_coordinates": {"lat": 37.7749, "lon": -122.4194},
        "installation_status": "completed",
        "installation_date": (now - timedelta(days=90)).isoformat(),
        "scheduled_installation_date": (now - timedelta(days=95)).isoformat(),
        "installation_technician_id": str(uuid4()),
        "installation_notes": "Installed on schedule",
        "connection_type": "ftth",
        "last_mile_technology": "gpon",
        "service_plan_speed": "1 Gbps",
        "assigned_devices": {"onu_serial": "ONU0001", "router_id": "RTR0001"},
        "current_bandwidth_profile": "1G/1G",
        "static_ip_assigned": "198.51.100.10",
        "ipv6_prefix": "2001:db8::/48",
        "avg_uptime_percent": "99.95",
        "last_outage_date": (now - timedelta(days=60)).isoformat(),
        "total_outages": 1,
        "total_downtime_minutes": 15,
        "external_id": "crm-123",
        "source_system": "crm",
    }
