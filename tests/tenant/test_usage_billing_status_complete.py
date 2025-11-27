"""
Complete tests for usage billing status endpoint to achieve 90%+ router coverage.

Focuses on recommendation generation logic (lines 185-240 in usage_billing_router.py).
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo
from src.dotmac.platform.tenant.models import Tenant, TenantPlanType, TenantStatus
from src.dotmac.platform.tenant.service import TenantService

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


@asynccontextmanager
async def create_test_client_with_mock_tenant_service(
    test_app, async_db_session, mock_tenant_service
):
    """Helper to create a test client with mocked tenant service."""
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.db import get_async_db
    from dotmac.platform.tenant.usage_billing_router import get_tenant_service

    async def mock_get_current_user():
        return UserInfo(
            user_id="test-user-123",
            username="testuser",
            email="test@example.com",
            permissions=[
                "tenants:read",
                "tenants:write",
                "tenants:admin",
                "platform:tenants:read",
                "platform:tenants:write",
            ],
            tenant_id=None,
            is_platform_admin=True,
        )

    async def override_get_async_db():
        yield async_db_session

    def override_get_tenant_service():
        return mock_tenant_service

    test_app.dependency_overrides[get_current_user] = mock_get_current_user
    test_app.dependency_overrides[get_async_db] = override_get_async_db
    test_app.dependency_overrides[get_tenant_service] = override_get_tenant_service

    transport = ASGITransport(app=test_app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver", headers={"X-Tenant-ID": "test-tenant"}
    ) as client:
        yield client

    test_app.dependency_overrides.clear()


async def create_tenant_with_usage(
    tenant_service: TenantService,
    tenant_id: str,
    current_api_calls: int = 0,
    current_storage_gb: float = 0.0,
    current_users: int = 0,
    max_api_calls: int = 10000,
    max_storage_gb: int = 50,
    max_users: int = 10,
) -> Tenant:
    """Helper to create a tenant with specific usage values."""
    tenant = Tenant(
        id=tenant_id,
        name=f"Test Tenant {tenant_id}",
        slug=f"test-{tenant_id}",
        plan_type=TenantPlanType.PROFESSIONAL,
        status=TenantStatus.ACTIVE,
        max_api_calls_per_month=max_api_calls,
        max_storage_gb=max_storage_gb,
        max_users=max_users,
        current_api_calls=current_api_calls,
        current_storage_gb=Decimal(str(current_storage_gb)),
        current_users=current_users,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    return tenant


@pytest.mark.integration
class TestBillingStatusRecommendations:
    """Test recommendation generation in billing status endpoint."""

    async def test_api_limit_exceeded_generates_high_severity_recommendation(
        self, test_app, async_db_session
    ):
        """Test that exceeding API limit generates high severity recommendation."""
        # Create tenant exceeding API limit
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="api-exceeded-123",
            current_api_calls=15000,  # Exceeds limit of 10000
            max_api_calls=10000,
        )

        # Mock tenant service to return our tenant
        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=150.0,
                storage_usage_percent=0.0,
                user_usage_percent=0.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Check for high severity API recommendation
            api_recommendations = [r for r in data["recommendations"] if r["metric"] == "api_calls"]
            assert len(api_recommendations) > 0
            assert api_recommendations[0]["severity"] == "high"
            assert "exceeded" in api_recommendations[0]["message"].lower()
            assert data["requires_action"] is True

    async def test_storage_limit_exceeded_generates_high_severity_recommendation(
        self, test_app, async_db_session
    ):
        """Test that exceeding storage limit generates high severity recommendation."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="storage-exceeded-123",
            current_storage_gb=60.0,  # Exceeds limit of 50
            max_storage_gb=50,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=0.0,
                storage_usage_percent=120.0,
                user_usage_percent=0.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            storage_recommendations = [
                r for r in data["recommendations"] if r["metric"] == "storage"
            ]
            assert len(storage_recommendations) > 0
            assert storage_recommendations[0]["severity"] == "high"
            assert data["requires_action"] is True

    async def test_user_limit_exceeded_generates_medium_severity_recommendation(
        self, test_app, async_db_session
    ):
        """Test that exceeding user limit generates medium severity recommendation."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="users-exceeded-123",
            current_users=15,  # Exceeds limit of 10
            max_users=10,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=0.0,
                storage_usage_percent=0.0,
                user_usage_percent=150.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            user_recommendations = [r for r in data["recommendations"] if r["metric"] == "users"]
            assert len(user_recommendations) > 0
            assert user_recommendations[0]["severity"] == "medium"

    async def test_api_approaching_limit_generates_low_severity_warning(
        self, test_app, async_db_session
    ):
        """Test that approaching API limit (>80%) generates low severity warning."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="api-warning-123",
            current_api_calls=8500,  # 85% of 10000
            max_api_calls=10000,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=85.0,
                storage_usage_percent=0.0,
                user_usage_percent=0.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Should have low severity warning
            api_recommendations = [r for r in data["recommendations"] if r["metric"] == "api_calls"]
            assert len(api_recommendations) > 0
            assert api_recommendations[0]["severity"] == "low"
            assert "85" in api_recommendations[0]["message"]
            # Should NOT require action for warnings
            assert data["requires_action"] is False

    async def test_storage_approaching_limit_generates_low_severity_warning(
        self, test_app, async_db_session
    ):
        """Test that approaching storage limit (>80%) generates low severity warning."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="storage-warning-123",
            current_storage_gb=45.0,  # 90% of 50
            max_storage_gb=50,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=0.0,
                storage_usage_percent=90.0,
                user_usage_percent=0.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            storage_recommendations = [
                r for r in data["recommendations"] if r["metric"] == "storage"
            ]
            assert len(storage_recommendations) > 0
            assert storage_recommendations[0]["severity"] == "low"
            assert "90" in storage_recommendations[0]["message"]

    async def test_multiple_limits_exceeded_requires_action(self, test_app, async_db_session):
        """Test that multiple exceeded limits sets requires_action=True."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="multi-exceeded-123",
            current_api_calls=12000,  # Exceeds 10000
            current_storage_gb=60.0,  # Exceeds 50
            max_api_calls=10000,
            max_storage_gb=50,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=120.0,
                storage_usage_percent=120.0,
                user_usage_percent=0.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Should have multiple high severity recommendations
            high_severity = [r for r in data["recommendations"] if r["severity"] == "high"]
            assert len(high_severity) >= 2
            assert data["requires_action"] is True

    async def test_no_recommendations_when_within_limits(self, test_app, async_db_session):
        """Test that no recommendations are generated when well within limits."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="within-limits-123",
            current_api_calls=5000,  # 50% of 10000
            current_storage_gb=25.0,  # 50% of 50
            current_users=5,  # 50% of 10
            max_api_calls=10000,
            max_storage_gb=50,
            max_users=10,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=50.0,
                storage_usage_percent=50.0,
                user_usage_percent=50.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Should have no recommendations
            assert len(data["recommendations"]) == 0
            assert data["requires_action"] is False

    async def test_tenant_not_found_returns_404(self, test_app, async_db_session):
        """Test that non-existent tenant returns 404."""
        from dotmac.platform.tenant.service import TenantNotFoundError

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(
            side_effect=TenantNotFoundError("Tenant not found")
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get("/api/v1/tenants/nonexistent-123/usage/billing-status")

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "not found" in response.json()["detail"].lower()


@pytest.mark.integration
class TestBillingStatusResponseStructure:
    """Test the response structure of billing status endpoint."""

    async def test_response_includes_all_required_fields(self, test_app, async_db_session):
        """Test that response includes all required fields."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="structure-test-123",
            current_api_calls=1000,
            current_storage_gb=10.0,
            current_users=3,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=10.0,
                storage_usage_percent=20.0,
                user_usage_percent=30.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Check top-level fields
            assert "tenant_id" in data
            assert "plan_type" in data
            assert "status" in data
            assert "usage" in data
            assert "recommendations" in data
            assert "requires_action" in data

            # Check usage structure
            assert "api_calls" in data["usage"]
            assert "storage_gb" in data["usage"]
            assert "users" in data["usage"]

            # Check usage detail fields
            for metric in ["api_calls", "storage_gb", "users"]:
                assert "current" in data["usage"][metric]
                assert "limit" in data["usage"][metric]
                assert "percentage" in data["usage"][metric]
                assert "exceeded" in data["usage"][metric]

    async def test_usage_percentages_calculated_correctly(self, test_app, async_db_session):
        """Test that usage percentages are calculated correctly."""
        tenant = await create_tenant_with_usage(
            tenant_service=None,
            tenant_id="percentage-test-123",
            current_api_calls=7500,  # 75% of 10000
            current_storage_gb=37.5,  # 75% of 50
            current_users=8,  # 80% of 10
            max_api_calls=10000,
            max_storage_gb=50,
            max_users=10,
        )

        mock_tenant_service = AsyncMock()
        mock_tenant_service.get_tenant = AsyncMock(return_value=tenant)
        mock_tenant_service.get_tenant_stats = AsyncMock(
            return_value=MagicMock(
                api_usage_percent=75.0,
                storage_usage_percent=75.0,
                user_usage_percent=80.0,
            )
        )

        async with create_test_client_with_mock_tenant_service(
            test_app, async_db_session, mock_tenant_service
        ) as client:
            response = await client.get(f"/api/v1/tenants/{tenant.id}/usage/billing-status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["usage"]["api_calls"]["percentage"] == 75.0
            assert data["usage"]["storage_gb"]["percentage"] == 75.0
            assert data["usage"]["users"]["percentage"] == 80.0
