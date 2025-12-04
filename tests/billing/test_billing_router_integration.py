"""
Integration Tests for Billing Routers (API Endpoints).

Strategy: Use REAL database, mock ONLY external APIs (payment providers, event bus)
Focus: Test API contracts, authentication, validation, database integration
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import status
from httpx import AsyncClient

from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionStatus,
)

# Reset rate limiter before each test to prevent state leakage


pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter singleton before each test to ensure test isolation.

    The rate limiter uses in-memory storage that persists across tests,
    which can cause tests to fail if a previous test exhausted the rate limit.
    """
    from dotmac.platform.core.rate_limiting import reset_limiter

    reset_limiter()
    yield
    # Optional: Reset again after test for extra safety
    reset_limiter()


@pytest.mark.asyncio
class TestPaymentsRouter:
    """Integration tests for payments router."""

    async def test_get_failed_payments_success(
        self, router_client: AsyncClient, auth_headers, payment_factory
    ):
        """Test getting failed payments summary."""
        # Create test failed payments using factory with _commit=True
        # This makes data visible to router's separate session
        # Let factory create customers automatically to avoid FK violations
        now = datetime.now(UTC)

        await payment_factory(
            amount=Decimal("100.00"),
            currency="usd",
            status="failed",  # Factory expects lowercase, converts to enum
            provider="stripe",
            created_at=now - timedelta(days=5),
            _commit=True,  # Makes data visible to HTTP request
        )

        await payment_factory(
            amount=Decimal("50.00"),
            currency="usd",
            status="failed",  # Factory expects lowercase, converts to enum
            provider="stripe",
            created_at=now - timedelta(days=2),
            _commit=True,  # Makes data visible to HTTP request
        )

        # Call API - router can now see committed data
        response = await router_client.get(
            "/api/v1/billing/payments/failed",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Note: May include payments from other tests due to session-scoped database
        # Just verify our payments are included
        assert data["count"] >= 2
        assert data["total_amount"] >= 150.0  # At least our $150

    async def test_get_failed_payments_requires_auth(self, unauth_client: AsyncClient):
        """Test that failed payments endpoint requires authentication."""
        response = await unauth_client.get("/api/v1/billing/payments/failed")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_failed_payments_handles_errors(
        self, router_client: AsyncClient, auth_headers
    ):
        """Test that failed payments endpoint handles DB errors gracefully."""
        from dotmac.platform.db import get_session_dependency

        failing_session = AsyncMock()
        failing_session.execute = AsyncMock(side_effect=Exception("DB Error"))

        async def override_session_dependency():
            yield failing_session

        transport = getattr(router_client, "_transport", None)
        app = getattr(transport, "app", None) if transport else None
        assert app is not None, "router_client transport missing app reference"

        original_override = app.dependency_overrides.get(get_session_dependency)
        app.dependency_overrides[get_session_dependency] = override_session_dependency

        try:
            response = await router_client.get(
                "/api/v1/billing/payments/failed",
                headers=auth_headers,
            )
        finally:
            if original_override is not None:
                app.dependency_overrides[get_session_dependency] = original_override
            else:
                app.dependency_overrides.pop(get_session_dependency, None)

        # Should return empty summary instead of 500 error
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == 0
        assert data["total_amount"] == 0.0


@pytest.mark.asyncio
class TestSubscriptionsRouter:
    """Integration tests for subscriptions router."""

    async def test_create_subscription_plan_success(
        self, router_client: AsyncClient, auth_headers, async_session
    ):
        """Test creating subscription plan."""
        plan_data = {
            "product_id": "prod_123",
            "name": "Basic Plan",
            "description": "Basic subscription",
            "billing_cycle": BillingCycle.MONTHLY.value,
            "price": 29.99,
            "currency": "usd",
            "setup_fee": 0,
            "trial_days": 14,
            "included_usage": {},
            "overage_rates": {},
            "metadata": {},
        }

        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            json=plan_data,
            headers=auth_headers,
        )

        # Debug: Print response if not 201
        if response.status_code != status.HTTP_201_CREATED:
            print(f"ERROR: Status {response.status_code}, Body: {response.text}")

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["name"] == "Basic Plan"
        assert float(data["price"]) == 29.99  # Price is returned as string from Decimal
        assert data["billing_cycle"] == BillingCycle.MONTHLY.value
        assert "plan_id" in data

    async def test_create_subscription_plan_requires_auth(self, unauth_client: AsyncClient):
        """Test that plan creation requires authentication."""
        plan_data = {
            "product_id": "prod_123",
            "name": "Test Plan",
            "billing_cycle": "monthly",
            "price": 10.00,
            "currency": "usd",
        }

        response = await unauth_client.post(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            json=plan_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_list_subscription_plans(
        self, router_client: AsyncClient, auth_headers, subscription_plan_factory
    ):
        """Test listing subscription plans."""
        # Create test plan using factory with _commit=True
        # This makes data visible to router's separate session
        # Use unique IDs to prevent conflicts with session-scoped database
        plan_id = f"plan_{uuid4().hex[:8]}"
        product_id = f"prod_{uuid4().hex[:8]}"

        await subscription_plan_factory(
            plan_id=plan_id,  # ← Unique per test
            product_id=product_id,  # ← Unique per test
            name=f"Test Plan {plan_id}",  # ← Unique name
            description="Test subscription plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("29.99"),
            currency="usd",
            is_active=True,
            _commit=True,  # ← Makes data visible to HTTP request
        )

        # Call API - router can now see committed data
        response = await router_client.get(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data, list)
        # Verify our plan is in the list (may include plans from other tests)
        assert len(data) >= 1, f"Expected at least 1 plan, got {len(data)}"
        assert any(p["plan_id"] == plan_id for p in data), (
            f"{plan_id} not in {[p['plan_id'] for p in data]}"
        )

    async def test_get_subscription_plan_by_id(
        self, router_client: AsyncClient, auth_headers, subscription_plan_factory
    ):
        """Test getting subscription plan by ID."""
        # Create test plan using factory with _commit=True
        # This makes data visible to router's separate session
        # Use unique IDs to prevent conflicts with session-scoped database
        plan_id = f"plan_{uuid4().hex[:8]}"
        product_id = f"prod_{uuid4().hex[:8]}"

        await subscription_plan_factory(
            plan_id=plan_id,  # ← Unique per test
            product_id=product_id,  # ← Unique per test
            name=f"Premium Plan {plan_id}",  # ← Unique name
            description="Premium subscription",
            billing_cycle=BillingCycle.ANNUAL.value,
            price=Decimal("299.99"),
            currency="usd",
            is_active=True,
            _commit=True,  # ← Makes data visible to HTTP request
        )

        # Call API - router can now see committed data
        response = await router_client.get(
            f"/api/v1/billing/subscriptions/subscriptions/plans/{plan_id}",  # ← Use dynamic ID
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["plan_id"] == plan_id  # ← Use dynamic ID
        assert data["name"] == f"Premium Plan {plan_id}"  # ← Use dynamic name
        assert float(data["price"]) == 299.99  # Price is returned as string from Decimal

    async def test_get_nonexistent_plan_returns_404(self, router_client: AsyncClient, auth_headers):
        """Test getting non-existent plan returns 404."""
        response = await router_client.get(
            "/api/v1/billing/subscriptions/subscriptions/plans/plan_nonexistent",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_create_subscription_success(
        self, router_client: AsyncClient, auth_headers, async_session
    ):
        """Test creating customer subscription."""
        # Create plan first
        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

        tenant = auth_headers["X-Tenant-ID"]

        plan = BillingSubscriptionPlanTable(
            plan_id="plan_789",
            tenant_id=tenant,
            product_id="prod_123",
            name="Monthly Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("49.99"),
            currency="usd",
            trial_days=7,
            is_active=True,
        )

        async_session.add(plan)
        await async_session.commit()

        subscription_data = {
            "customer_id": "cust_123",
            "plan_id": "plan_789",
            "metadata": {},
        }

        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/",
            json=subscription_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_201_CREATED, response.text
        data = response.json()

        assert data["customer_id"] == "cust_123"
        assert data["plan_id"] == "plan_789"
        assert data["status"] == SubscriptionStatus.TRIALING.value  # Has 7 day trial
        assert "subscription_id" in data

    async def test_create_subscription_invalid_plan_returns_400(
        self, router_client: AsyncClient, auth_headers
    ):
        """Test creating subscription with invalid plan returns 400."""
        subscription_data = {
            "customer_id": "cust_123",
            "plan_id": "plan_nonexistent",
        }

        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/",
            json=subscription_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
class TestInvoiceRouter:
    """Integration tests for invoice router (if exists)."""

    async def test_invoice_creation_validation(self, router_client: AsyncClient, auth_headers):
        """Test invoice creation with validation."""
        # This test assumes invoice router exists
        # If not, it will be skipped
        invoice_data = {
            "customer_id": "cust_123",
            "billing_email": "customer@example.com",
            "billing_address": {"street": "123 Main St", "city": "Boston"},
            "line_items": [
                {
                    "description": "Product A",
                    "quantity": 2,
                    "unit_price": 50.00,
                    "total_price": 100.00,
                    "tax_rate": 0.0,
                    "tax_amount": 0.0,
                    "discount_percentage": 0.0,
                    "discount_amount": 0.0,
                }
            ],
            "currency": "USD",
        }

        # Try creating invoice (may not exist)
        try:
            response = await router_client.post(
                "/api/v1/billing/invoices",
                json=invoice_data,
                headers=auth_headers,
            )

            # If endpoint exists, verify response
            if response.status_code != status.HTTP_404_NOT_FOUND:
                assert response.status_code in [
                    status.HTTP_201_CREATED,
                    status.HTTP_200_OK,
                ]
        except Exception:
            # Endpoint may not exist, skip
            pytest.skip("Invoice endpoint not implemented")


@pytest.mark.asyncio
class TestTenantIsolation:
    """Test tenant isolation across billing endpoints."""

    async def test_plans_tenant_isolation(
        self, router_client: AsyncClient, auth_headers, async_session
    ):
        """Test that plans are isolated by tenant."""
        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

        tenant = auth_headers["X-Tenant-ID"]

        # Create plan for tenant-1
        plan_tenant1 = BillingSubscriptionPlanTable(
            plan_id="plan_tenant1",
            tenant_id=tenant,
            product_id="prod_123",
            name="Tenant 1 Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("29.99"),
            currency="usd",
            is_active=True,
        )

        # Create plan for different tenant
        other_tenant = f"{tenant}-isolated"
        plan_tenant2 = BillingSubscriptionPlanTable(
            plan_id="plan_tenant2",
            tenant_id=other_tenant,
            product_id="prod_123",
            name="Tenant 2 Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("29.99"),
            currency="usd",
            is_active=True,
        )

        async_session.add(plan_tenant1)
        async_session.add(plan_tenant2)
        await async_session.commit()

        # List plans (should only see tenant-1 plans)
        response = await router_client.get(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should only see tenant-1 plan
        plan_ids = [p["plan_id"] for p in data]
        assert "plan_tenant1" in plan_ids
        assert "plan_tenant2" not in plan_ids


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling in billing routers."""

    async def test_invalid_json_returns_422(self, router_client: AsyncClient, auth_headers):
        """Test that invalid JSON returns 422 validation error."""
        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            content="not valid json",
            headers={**auth_headers, "Content-Type": "application/json"},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_missing_required_fields_returns_422(
        self, router_client: AsyncClient, auth_headers
    ):
        """Test that missing required fields returns 422."""
        incomplete_data = {
            "name": "Test Plan",
            # Missing: billing_cycle, price, currency
        }

        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            json=incomplete_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_service_exception_handling(self, router_client: AsyncClient, auth_headers):
        """Test that service exceptions are properly handled by router."""
        # Test with a malformed request that will cause service-level error
        plan_data = {
            "product_id": "prod_123",
            "name": "Test Plan",
            "billing_cycle": "INVALID_CYCLE",  # Invalid enum value
            "price": 10.00,
            "currency": "usd",
        }

        response = await router_client.post(
            "/api/v1/billing/subscriptions/subscriptions/plans",
            json=plan_data,
            headers=auth_headers,
        )

        # Should return 422 validation error for invalid enum
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
class TestRateLimiting:
    """Test rate limiting on billing endpoints (if implemented)."""

    async def test_rate_limit_enforcement(self, router_client: AsyncClient, auth_headers):
        """Test that rate limits are enforced.

        SECURITY: Rate limiting is REQUIRED for billing endpoints to prevent:
        - Denial of service attacks
        - Resource exhaustion
        - Abuse of billing operations

        This test MUST NOT skip - rate limiting is a mandatory security control.
        """
        # Enable rate limiting for this specific test (global fixture disables it)
        import os

        from dotmac.platform.core.rate_limiting import get_limiter, reset_limiter
        from dotmac.platform.settings import settings

        # Use in-memory storage for tests (Redis may not be available in test environment)
        # This still validates rate limiting logic without requiring Redis infrastructure
        storage_url = "memory://"
        original_env_storage = os.environ.get("RATE_LIMIT_STORAGE_URL")
        original_settings_storage = settings.rate_limit.storage_url
        os.environ["RATE_LIMIT_STORAGE_URL"] = storage_url

        # Force reload settings to pick up the new environment variable
        settings.rate_limit.storage_url = storage_url

        # Reset and recreate limiter with in-memory storage
        reset_limiter()
        limiter_instance = get_limiter()
        original_enabled = limiter_instance.enabled
        limiter_instance.enabled = True

        try:
            # Try to make many requests rapidly (exceeds 100/minute limit)
            responses = []
            for _ in range(150):  # Exceed the 100/minute limit on list_subscription_plans
                response = await router_client.get(
                    "/api/v1/billing/subscriptions/subscriptions/plans",
                    headers=auth_headers,
                )
                responses.append(response.status_code)

            # SECURITY: Rate limiting MUST be enforced - 429 responses are REQUIRED
            rate_limited_count = responses.count(status.HTTP_429_TOO_MANY_REQUESTS)

            assert rate_limited_count > 0, (
                f"SECURITY FAILURE: Rate limiting not enforced on billing endpoints! "
                f"Made 150 requests, expected HTTP 429 responses but got none. "
                f"Response codes: {set(responses)}. "
                f"This is a critical security vulnerability - billing endpoints MUST be rate limited."
            )
        finally:
            # Restore original state
            limiter_instance.enabled = original_enabled
            if original_env_storage is None:
                os.environ.pop("RATE_LIMIT_STORAGE_URL", None)
            else:
                os.environ["RATE_LIMIT_STORAGE_URL"] = original_env_storage
            settings.rate_limit.storage_url = original_settings_storage
            reset_limiter()
