"""Billing-specific fixtures used in integration tests."""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

import pytest

from tests.fixtures.environment import HAS_SQLALCHEMY

if HAS_SQLALCHEMY:
    from sqlalchemy.ext.asyncio import async_sessionmaker

    try:
        import pytest_asyncio
    except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
        pytest_asyncio = None

    AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture

    @AsyncFixture
    async def test_payment_method(async_session) -> AsyncIterator[object]:
        """Persist a payment method entity for integration tests."""
        from uuid import uuid4

        from dotmac.platform.billing.core.entities import PaymentMethodEntity
        from dotmac.platform.billing.core.enums import PaymentMethodStatus, PaymentMethodType

        payment_method = PaymentMethodEntity(
            payment_method_id=str(uuid4()),
            tenant_id="test-tenant",
            customer_id="cust_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            provider="stripe",
            provider_payment_method_id="stripe_pm_123",
            display_name="Visa ending in 4242",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2030,
        )
        async_session.add(payment_method)
        await async_session.commit()
        await async_session.refresh(payment_method)
        return payment_method

    @pytest.fixture
    def mock_stripe_provider():
        """Mock Stripe payment provider."""
        from unittest.mock import AsyncMock

        provider = AsyncMock()
        provider.charge_payment_method = AsyncMock()
        return provider

    @AsyncFixture
    async def test_subscription_plan(async_session):
        """Create a subscription plan in the test database."""
        from decimal import Decimal

        from dotmac.platform.billing.models import BillingSubscriptionPlanTable
        from dotmac.platform.billing.subscriptions.models import BillingCycle

        plan = BillingSubscriptionPlanTable(
            plan_id="plan_test_123",
            tenant_id="test-tenant",
            product_id="prod_123",
            name="Test Plan",
            description="Test subscription plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("29.99"),
            currency="usd",
            trial_days=14,
            is_active=True,
        )
        async_session.add(plan)
        await async_session.commit()
        await async_session.refresh(plan)
        return plan

    @AsyncFixture
    async def client(test_app):
        """Async HTTP client used in billing integration tests."""
        from httpx import ASGITransport, AsyncClient

        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client

    @pytest.fixture
    def auth_headers():
        """Standard auth headers for billing tests."""
        from dotmac.platform.auth.core import jwt_service

        test_token = jwt_service.create_access_token(
            subject="550e8400-e29b-41d4-a716-446655440000",
            additional_claims={
                "scopes": ["read", "write", "admin"],
                "tenant_id": "test-tenant",
                "email": "test@example.com",
            },
        )

        return {
            "Authorization": f"Bearer {test_token}",
            "X-Tenant-ID": "test-tenant",
        }

    __all__ = [
        "auth_headers",
        "client",
        "mock_stripe_provider",
        "test_payment_method",
        "test_subscription_plan",
    ]

else:  # pragma: no cover - SQLAlchemy unavailable
    __all__: list[str] = []
