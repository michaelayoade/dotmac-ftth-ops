"""Tests for billing payments router."""

from datetime import timezone, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.core.entities import PaymentEntity
from dotmac.platform.billing.core.models import PaymentMethodType, PaymentStatus
from dotmac.platform.billing.payments.router import router
from dotmac.platform.db import get_session_dependency


@pytest.fixture
def client(async_db_session: AsyncSession):
    """Create test client with auth override."""
    app = FastAPI()

    def override_auth():
        return UserInfo(
            user_id="test-user",
            email="test@example.com",
            username="testuser",
            tenant_id="test-tenant",
            roles=["admin"],
            permissions=["billing:read"],
        )

    app.dependency_overrides[get_current_user] = override_auth
    app.dependency_overrides[get_session_dependency] = lambda: async_db_session
    app.include_router(router, prefix="/billing")

    return TestClient(app)


@pytest_asyncio.fixture
async def sample_failed_payments(async_db_session: AsyncSession):
    """Create sample failed payments for testing."""
    payments = []
    base_time = datetime.now(timezone.utc)

    for i in range(3):
        payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id="test-tenant",
            customer_id=f"customer-{i}",
            amount=int(100 * (i + 1)),  # 100, 200, 300 cents
            currency="USD",
            status=PaymentStatus.FAILED,
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            created_at=base_time - timedelta(days=i),
        )
        async_db_session.add(payment)
        payments.append(payment)

    await async_db_session.commit()
    return payments


@pytest_asyncio.fixture
async def sample_successful_payments(async_db_session: AsyncSession):
    """Create sample successful payments (should not be counted)."""
    payment = PaymentEntity(
        payment_id=str(uuid4()),
        tenant_id="test-tenant",
        customer_id="customer-success",
        amount=50000,  # 500.00 in cents
        currency="USD",
        status=PaymentStatus.SUCCEEDED,
        payment_method_type=PaymentMethodType.CARD,
        provider="stripe",
        created_at=datetime.now(timezone.utc),
    )
    async_db_session.add(payment)
    await async_db_session.commit()
    return payment


class TestGetFailedPayments:
    """Test the GET /failed endpoint."""

    @pytest.mark.asyncio
    async def test_get_failed_payments_with_data(
        self, client, sample_failed_payments, async_db_session
    ):
        """Test getting failed payments summary with data."""
        response = client.get("/billing/payments/failed")

        assert response.status_code == 200
        data = response.json()

        assert data["count"] == 3
        assert data["total_amount"] == 6.0  # 100 + 200 + 300 cents = $6.00
        assert "oldest_failure" in data
        assert "newest_failure" in data

    @pytest.mark.asyncio
    async def test_get_failed_payments_no_data(self, client, async_db_session):
        """Test getting failed payments with no failures."""
        response = client.get("/billing/payments/failed")

        assert response.status_code == 200
        data = response.json()

        assert data["count"] == 0
        assert data["total_amount"] == 0.0
        assert data["oldest_failure"] is None
        assert data["newest_failure"] is None

    @pytest.mark.asyncio
    async def test_get_failed_payments_ignores_successful(
        self, client, sample_failed_payments, sample_successful_payments, async_db_session
    ):
        """Test that successful payments are not counted."""
        response = client.get("/billing/payments/failed")

        assert response.status_code == 200
        data = response.json()

        # Should only count the 3 failed payments, not the successful one
        assert data["count"] == 3
        assert data["total_amount"] == 6.0  # 100 + 200 + 300 cents = $6.00

    @pytest.mark.asyncio
    async def test_get_failed_payments_only_last_30_days(self, client, async_db_session):
        """Test that only payments from last 30 days are counted."""
        # Create a failed payment from 31 days ago (should not be counted)
        old_payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id="test-tenant",
            customer_id="customer-old",
            amount=100000,  # 1000.00 in cents
            currency="USD",
            status=PaymentStatus.FAILED,
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            created_at=datetime.now(timezone.utc) - timedelta(days=31),
        )
        async_db_session.add(old_payment)

        # Create a recent failed payment (should be counted)
        recent_payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id="test-tenant",
            customer_id="customer-recent",
            amount=25000,  # 250.00 in cents
            currency="USD",
            status=PaymentStatus.FAILED,
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            created_at=datetime.now(timezone.utc) - timedelta(days=5),
        )
        async_db_session.add(recent_payment)
        await async_db_session.commit()

        response = client.get("/billing/payments/failed")

        assert response.status_code == 200
        data = response.json()

        # Should only count the recent payment
        assert data["count"] == 1
        assert data["total_amount"] == 250.0  # 25000 cents = $250.00

    @pytest.mark.asyncio
    async def test_get_failed_payments_exception_handling(self, client):
        """Test exception handling returns empty summary."""
        app = FastAPI()

        def override_auth():
            return UserInfo(
                user_id="test-user",
                email="test@example.com",
                username="testuser",
                tenant_id="test-tenant",
                roles=["admin"],
                permissions=["billing:read"],
            )

        # Mock session that raises exception
        async def mock_session():
            mock = AsyncMock()
            mock.execute.side_effect = Exception("Database error")
            return mock

        app.dependency_overrides[get_current_user] = override_auth
        app.dependency_overrides[get_session_dependency] = mock_session
        app.include_router(router, prefix="/billing")

        test_client = TestClient(app)
        response = test_client.get("/billing/payments/failed")

        assert response.status_code == 200
        data = response.json()

        # Should return empty summary on error
        assert data["count"] == 0
        assert data["total_amount"] == 0.0
        assert data["oldest_failure"] is None
        assert data["newest_failure"] is None

    @pytest.mark.asyncio
    async def test_get_failed_payments_requires_auth(self):
        """Test that endpoint requires authentication."""
        app = FastAPI()

        # No auth override
        app.include_router(router, prefix="/billing")

        test_client = TestClient(app, raise_server_exceptions=False)
        response = test_client.get("/billing/payments/failed")

        # Should fail without authentication
        assert response.status_code in [401, 422]  # Unauthorized or validation error
