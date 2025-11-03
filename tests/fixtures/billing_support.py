"""Billing-specific fixtures used in integration tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING
from uuid import uuid4

import pytest

from tests.fixtures.environment import HAS_SQLALCHEMY

if HAS_SQLALCHEMY:
    try:
        import pytest_asyncio
    except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
        pytest_asyncio = None

    AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture

    if TYPE_CHECKING:
        from unittest.mock import AsyncMock

        from httpx import AsyncClient

        from dotmac.platform.billing.core.entities import PaymentMethodEntity
        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

    @pytest.fixture
    def tenant_id() -> str:
        """Tenant identifier used in billing fixtures."""
        return str(uuid4())

    @pytest.fixture
    def customer_id() -> str:
        """Customer identifier used in billing fixtures."""
        return str(uuid4())

    @pytest.fixture
    def billing_subject_id() -> str:
        """Subject identifier for auth headers."""
        return str(uuid4())

    @AsyncFixture
    async def test_payment_method(
        async_session,
        tenant_id: str,
        customer_id: str,
    ) -> AsyncIterator[PaymentMethodEntity]:
        """Persist a payment method entity for integration tests."""
        from uuid import uuid4

        from dotmac.platform.billing.core.entities import PaymentMethodEntity
        from dotmac.platform.billing.core.enums import PaymentMethodStatus, PaymentMethodType

        payment_method = PaymentMethodEntity(
            payment_method_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
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
        try:
            await async_session.flush()
            await async_session.refresh(payment_method)
        except Exception as exc:  # pragma: no cover - diagnostic aid
            await async_session.rollback()
            raise RuntimeError("Failed to create test payment method") from exc

        try:
            yield payment_method
        finally:
            await async_session.delete(payment_method)
            await async_session.flush()

    @pytest.fixture
    def mock_stripe_provider() -> AsyncMock:
        """Mock Stripe payment provider."""
        from unittest.mock import AsyncMock

        provider = AsyncMock()
        provider.charge_payment_method = AsyncMock()
        return provider

    @AsyncFixture
    async def test_subscription_plan(
        async_session, tenant_id: str
    ) -> AsyncIterator[BillingSubscriptionPlanTable]:
        """Create a subscription plan in the test database."""
        from decimal import Decimal

        from dotmac.platform.billing.models import BillingSubscriptionPlanTable
        from dotmac.platform.billing.subscriptions.models import BillingCycle

        plan = BillingSubscriptionPlanTable(
            plan_id="plan_test_123",
            tenant_id=tenant_id,
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
        await async_session.flush()
        await async_session.refresh(plan)

        try:
            yield plan
        finally:
            await async_session.delete(plan)
            await async_session.flush()

    @AsyncFixture
    async def client(test_app) -> AsyncIterator[AsyncClient]:
        """Async HTTP client used in billing integration tests."""
        from httpx import ASGITransport, AsyncClient

        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client

    @pytest.fixture
    def jwt_access_token(monkeypatch, billing_subject_id: str, tenant_id: str) -> str:
        """Provide a mocked JWT access token without hitting production secrets."""
        from unittest.mock import Mock

        from dotmac.platform.auth.core import jwt_service

        fake_token = f"test-token-{billing_subject_id}"
        monkeypatch.setattr(
            jwt_service,
            "create_access_token",
            Mock(return_value=fake_token),
        )
        monkeypatch.setattr(
            jwt_service,
            "decode_access_token",
            Mock(return_value={"sub": billing_subject_id, "tenant_id": tenant_id}),
        )
        return fake_token

    @pytest.fixture
    def auth_headers(jwt_access_token: str, tenant_id: str) -> dict[str, str]:
        """Standard auth headers for billing tests using mocked JWT token."""
        return {
            "Authorization": f"Bearer {jwt_access_token}",
            "X-Tenant-ID": tenant_id,
        }

    __all__ = [
        "auth_headers",
        "billing_subject_id",
        "client",
        "customer_id",
        "jwt_access_token",
        "mock_stripe_provider",
        "tenant_id",
        "test_payment_method",
        "test_subscription_plan",
    ]

else:  # pragma: no cover - SQLAlchemy unavailable
    pytest.skip("SQLAlchemy is required for billing fixtures.", allow_module_level=True)
