"""
Pytest fixtures for billing subscriptions router tests.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionPlanCreateRequest,
    SubscriptionStatus,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService


class MockObject:
    """Helper class to convert dict to object with attributes."""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def mock_subscription_service():
    """Mock SubscriptionService for testing."""
    service = MagicMock()

    # Make all methods async
    service.create_plan = AsyncMock()
    service.list_plans = AsyncMock()
    service.get_plan = AsyncMock()
    service.create_subscription = AsyncMock()
    service.list_subscriptions = AsyncMock()
    service.get_subscription = AsyncMock()
    service.update_subscription = AsyncMock()
    service.cancel_subscription = AsyncMock()
    service.reactivate_subscription = AsyncMock()
    service.change_plan = AsyncMock()
    service.record_usage = AsyncMock()
    service.get_usage = AsyncMock()
    service.calculate_proration_preview = AsyncMock()
    service.check_renewal_eligibility = AsyncMock()
    service.extend_subscription = AsyncMock()
    service.process_renewal_payment = AsyncMock()

    return service


@pytest.fixture
def mock_current_user():
    """Mock current user for authentication."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="00000000-0000-0000-0000-000000000001",
        email="test@example.com",
        tenant_id="1",
        roles=["admin"],
        permissions=[
            "billing.subscriptions.read",
            "billing.subscriptions.create",
            "billing.subscriptions.update",
            "billing.subscriptions.delete",
            "billing.plans.read",
            "billing.plans.create",
            "billing.plans.update",
        ],
        is_platform_admin=False,
    )


@pytest.fixture
def mock_rbac_service():
    """Mock RBAC service that always allows access."""
    from dotmac.platform.auth.rbac_service import RBACService

    mock_rbac = MagicMock(spec=RBACService)
    mock_rbac.user_has_all_permissions = AsyncMock(return_value=True)
    mock_rbac.user_has_any_permission = AsyncMock(return_value=True)
    mock_rbac.get_user_permissions = AsyncMock(return_value=set())
    mock_rbac.get_user_roles = AsyncMock(return_value=[])
    return mock_rbac


@pytest.fixture
def sample_subscription_plan():
    """Sample subscription plan for testing."""
    return MockObject(
        plan_id="plan-123",
        tenant_id="1",
        product_id="product-456",
        name="Premium Plan",
        description="Premium subscription plan",
        billing_cycle=BillingCycle.MONTHLY,
        price=Decimal("99.99"),
        currency="USD",
        setup_fee=Decimal("50.00"),
        trial_days=14,
        included_usage={"api_calls": 1000},
        overage_rates={"api_calls": Decimal("0.01")},
        is_active=True,
        metadata={},
        created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        updated_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        # Add methods for response serialization
        model_dump=lambda mode=None: {
            "plan_id": "plan-123",
            "tenant_id": "1",
            "product_id": "product-456",
            "name": "Premium Plan",
            "description": "Premium subscription plan",
            "billing_cycle": "monthly",
            "price": "99.99",
            "currency": "USD",
            "setup_fee": "50.00",
            "trial_days": 14,
            "included_usage": {"api_calls": 1000},
            "overage_rates": {"api_calls": "0.01"},
            "is_active": True,
            "metadata": {},
            "created_at": "2025-01-01T12:00:00",
            "updated_at": "2025-01-01T12:00:00",
        },
    )


@pytest.fixture
def sample_subscription():
    """Sample subscription for testing."""
    now = datetime.utcnow()
    period_end = now + timedelta(days=30)
    trial_end = now + timedelta(days=14)

    return MockObject(
        subscription_id="sub-789",
        tenant_id="1",
        customer_id="cust-123",
        plan_id="plan-123",
        current_period_start=now,
        current_period_end=period_end,
        status=SubscriptionStatus.ACTIVE,
        trial_end=trial_end,
        cancel_at_period_end=False,
        canceled_at=None,
        ended_at=None,
        custom_price=None,
        usage_records={},
        metadata={},
        created_at=now,
        updated_at=now,
        # Add methods
        is_in_trial=lambda: True,
        days_until_renewal=lambda: 30,
        is_active=lambda: True,
        model_dump=lambda mode=None: {
            "subscription_id": "sub-789",
            "tenant_id": "1",
            "customer_id": "cust-123",
            "plan_id": "plan-123",
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "status": "active",
            "trial_end": trial_end.isoformat(),
            "cancel_at_period_end": False,
            "canceled_at": None,
            "ended_at": None,
            "custom_price": None,
            "usage_records": {},
            "metadata": {},
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
    )


@pytest.fixture
def sample_proration_result():
    """Sample proration result for testing."""
    return MockObject(
        proration_amount=Decimal("25.50"),
        proration_description="Prorated charge for plan upgrade",
        old_plan_unused_amount=Decimal("49.50"),
        new_plan_prorated_amount=Decimal("75.00"),
        days_remaining=15,
        model_dump=lambda mode=None: {
            "proration_amount": "25.50",
            "proration_description": "Prorated charge for plan upgrade",
            "old_plan_unused_amount": "49.50",
            "new_plan_prorated_amount": "75.00",
            "days_remaining": 15,
        },
    )


@pytest_asyncio.fixture
async def async_client(
    mock_subscription_service, mock_current_user, mock_rbac_service, monkeypatch
):
    """Async HTTP client with billing subscriptions router registered and dependencies mocked."""
    import dotmac.platform.auth.rbac_dependencies
    from dotmac.platform.auth.core import get_current_user as core_get_current_user
    from dotmac.platform.auth.dependencies import get_current_user as dep_get_current_user
    from dotmac.platform.billing.subscriptions.router import router as subscriptions_router
    from dotmac.platform.db import get_async_session
    from dotmac.platform.tenant import get_current_tenant_id

    # Monkeypatch RBACService class to return our mock instance
    monkeypatch.setattr(
        dotmac.platform.auth.rbac_dependencies, "RBACService", lambda db: mock_rbac_service
    )

    app = FastAPI()

    # Override dependencies
    def override_get_subscription_service():
        return mock_subscription_service

    def override_get_current_user():
        return mock_current_user

    async def override_get_async_session():
        from unittest.mock import AsyncMock

        from sqlalchemy.ext.asyncio import AsyncSession

        session = AsyncMock(spec=AsyncSession)
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.refresh = AsyncMock()
        session.execute = AsyncMock()
        session.add = AsyncMock()
        return session

    def override_get_tenant_id():
        return "1"

    # We need to patch the service creation in the router
    # Since the router creates service inline, we'll mock at router module level
    from dotmac.platform.billing.subscriptions import router as router_module

    monkeypatch.setattr(router_module, "SubscriptionService", lambda db: mock_subscription_service)

    app.dependency_overrides[core_get_current_user] = override_get_current_user
    app.dependency_overrides[dep_get_current_user] = override_get_current_user
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_current_tenant_id] = override_get_tenant_id

    # The subscriptions router has prefix="/subscriptions", so we include it under /api/v1/billing
    # to get the full path: /api/v1/billing/subscriptions/...
    app.include_router(subscriptions_router, prefix="/api/v1/billing")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# ---------------------------------------------------------------------------
# Shared fixtures for service-level tests
# ---------------------------------------------------------------------------


@pytest.fixture
def tenant_id(test_tenant_id):
    """Alias to reuse the tenant fixture name expected by service tests."""
    return test_tenant_id


@pytest_asyncio.fixture
async def subscription_service(async_session):
    """Create a real SubscriptionService backed by the async session fixture."""
    return SubscriptionService(async_session)


@pytest.fixture
def sample_plan_data() -> SubscriptionPlanCreateRequest:
    """Sample plan payload used across plan CRUD tests."""
    return SubscriptionPlanCreateRequest(
        product_id="product-456",
        name="Basic Plan",
        description="Basic subscription plan",
        billing_cycle=BillingCycle.MONTHLY,
        price=Decimal("29.99"),
        currency="USD",
        setup_fee=Decimal("10.00"),
        trial_days=14,
        included_usage={"api_calls": 1000},
        overage_rates={"api_calls": Decimal("0.01")},
        metadata={},
    )
