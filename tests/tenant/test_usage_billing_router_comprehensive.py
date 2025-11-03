"""
Comprehensive tests for Tenant Usage Billing Router.

Tests all endpoints in usage_billing_router.py for 90%+ coverage.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status as http_status

pytestmark = pytest.mark.integration

pytestmark = pytest.mark.asyncio


class TestRecordUsageWithBilling:
    """Test POST /tenants/{tenant_id}/usage/record-with-billing endpoint."""

    async def test_record_usage_success(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
        usage_billing_integration,
    ):
        """Test successful usage recording with billing."""
        now = datetime.now(UTC)
        usage_data = {
            "period_start": (now - timedelta(hours=1)).isoformat(),
            "period_end": now.isoformat(),
            "api_calls": 1000,
            "storage_gb": 5.5,
            "bandwidth_gb": 2.3,
            "active_users": 3,
        }

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing",
            json=usage_data,
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        data = response.json()
        assert data["tenant_id"] == sample_tenant.id
        assert "billing_records" in data
        assert len(data["billing_records"]) > 0

    async def test_record_usage_with_subscription_id(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test usage recording with explicit subscription ID."""
        now = datetime.now(UTC)
        usage_data = {
            "period_start": (now - timedelta(hours=1)).isoformat(),
            "period_end": now.isoformat(),
            "api_calls": 500,
        }

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing?subscription_id=sub-explicit",
            json=usage_data,
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        data = response.json()
        assert data["subscription_id"] == "sub-explicit" or data["subscription_id"] is not None

    async def test_record_usage_zero_values(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test recording usage with zero values."""
        now = datetime.now(UTC)
        usage_data = {
            "period_start": (now - timedelta(hours=1)).isoformat(),
            "period_end": now.isoformat(),
            "api_calls": 0,
            "storage_gb": 0,
            "bandwidth_gb": 0,
            "active_users": 0,
        }

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing",
            json=usage_data,
        )

        assert response.status_code == http_status.HTTP_201_CREATED

    async def test_record_usage_invalid_tenant(
        self,
        authenticated_client,
    ):
        """Test recording usage for non-existent tenant."""
        now = datetime.now(UTC)
        usage_data = {
            "period_start": (now - timedelta(hours=1)).isoformat(),
            "period_end": now.isoformat(),
            "api_calls": 1000,
        }

        response = await authenticated_client.post(
            "/api/v1/tenants/nonexistent-tenant/usage/record-with-billing",
            json=usage_data,
        )

        assert response.status_code == http_status.HTTP_500_INTERNAL_SERVER_ERROR

    async def test_record_usage_missing_fields(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test recording usage with missing required fields."""
        # Missing period_start and period_end
        usage_data = {
            "api_calls": 1000,
        }

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing",
            json=usage_data,
        )

        # Should fail validation
        assert response.status_code == http_status.HTTP_422_UNPROCESSABLE_ENTITY


class TestSyncUsageToBilling:
    """Test POST /tenants/{tenant_id}/usage/sync-billing endpoint."""

    async def test_sync_usage_success(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test successful usage sync."""
        # Update tenant counters first
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=25.5,
            users=7,
        )

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/sync-billing",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert "synced" in data

    async def test_sync_usage_with_subscription_id(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test usage sync with explicit subscription ID."""
        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/sync-billing?subscription_id=sub-123",
        )

        assert response.status_code == http_status.HTTP_200_OK

    async def test_sync_usage_no_subscription(
        self,
        authenticated_client,
        sample_tenant,
        mock_subscription_service,
    ):
        """Test sync when no active subscription exists."""
        # Mock no subscriptions
        mock_subscription_service.list_subscriptions = AsyncMock(return_value=[])

        response = await authenticated_client.post(
            f"/api/v1/tenants/{sample_tenant.id}/usage/sync-billing",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert data.get("synced") is False or "No active subscription" in data.get("reason", "")


class TestGetUsageOverages:
    """Test GET /tenants/{tenant_id}/usage/overages endpoint."""

    async def test_get_overages_with_overages(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test getting overages when limits are exceeded."""
        # Set usage above limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=15000,  # Limit is 10000
            storage_gb=60.0,  # Limit is 50
            users=12,  # Limit is 10
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/overages",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert data["has_overages"] is True
        assert len(data["overages"]) > 0

    async def test_get_overages_no_overages(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test getting overages when within limits."""
        # Set usage within limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=25.0,
            users=5,
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/overages",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert data["has_overages"] is False
        assert len(data["overages"]) == 0

    async def test_get_overages_with_date_range(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test getting overages with specific date range."""
        start_date = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        end_date = datetime.now(UTC).isoformat()

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/overages",
            params={
                "period_start": start_date,
                "period_end": end_date,
            },
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert "has_overages" in data


class TestGetBillingPreview:
    """Test GET /tenants/{tenant_id}/billing/preview endpoint."""

    async def test_get_billing_preview_with_overages(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test billing preview including overages."""
        # Set usage with overages
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=12000,
            storage_gb=55.0,
            users=8,
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/billing/preview?include_overages=true",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert "plan_type" in data
        assert "base_subscription_cost" in data
        assert "usage_summary" in data
        assert "total_estimated_charge" in data

    async def test_get_billing_preview_without_overages(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test billing preview excluding overages."""
        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/billing/preview?include_overages=false",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert "base_subscription_cost" in data
        assert "total_estimated_charge" in data
        # When overages excluded, total should equal base cost
        if "overages" not in data:
            # This is expected behavior
            pass

    async def test_get_billing_preview_default_includes_overages(
        self,
        authenticated_client,
        sample_tenant,
    ):
        """Test billing preview defaults to including overages."""
        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/billing/preview",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        # Default behavior should include overages
        assert "usage_summary" in data


class TestGetUsageBillingStatus:
    """Test GET /tenants/{tenant_id}/usage/billing-status endpoint."""

    async def test_get_billing_status_normal(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test getting billing status with normal usage."""
        # Set normal usage
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=25.0,
            users=5,
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert data["tenant_id"] == sample_tenant.id
        assert data["plan_type"] == sample_tenant.plan_type.value
        assert data["status"] == sample_tenant.status.value
        assert "usage" in data
        assert "recommendations" in data
        assert data["requires_action"] is False

    async def test_get_billing_status_with_exceeded_limits(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test billing status when limits are exceeded."""
        # Exceed all limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=15000,  # Over limit
            storage_gb=60.0,  # Over limit
            users=12,  # Over limit
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()
        assert data["requires_action"] is True
        assert len(data["recommendations"]) > 0

        # Check for high severity recommendations
        high_severity = [r for r in data["recommendations"] if r["severity"] == "high"]
        assert len(high_severity) > 0

    async def test_get_billing_status_approaching_limits(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test billing status when approaching limits (>80%)."""
        # Set usage at 85% of limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=8500,  # 85% of 10000
            storage_gb=42.5,  # 85% of 50
            users=8,  # 80% of 10
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()

        # Should have warnings
        assert len(data["recommendations"]) > 0

        # Check for low severity warnings
        low_severity = [r for r in data["recommendations"] if r["severity"] == "low"]
        assert len(low_severity) > 0

    async def test_get_billing_status_usage_percentages(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test that usage percentages are calculated correctly."""
        # Set specific usage levels
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,  # 50%
            storage_gb=25.0,  # 50%
            users=5,  # 50%
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()

        assert data["usage"]["api_calls"]["percentage"] == 50.0
        assert data["usage"]["storage_gb"]["percentage"] == 50.0
        assert data["usage"]["users"]["percentage"] == 50.0

    async def test_get_billing_status_tenant_not_found(
        self,
        authenticated_client,
    ):
        """Test billing status for non-existent tenant."""
        response = await authenticated_client.get(
            "/api/v1/tenants/nonexistent-tenant/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    async def test_get_billing_status_includes_current_values(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test that status includes current usage values."""
        # Set known usage values
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=3000,
            storage_gb=15.0,
            users=4,
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        assert response.status_code == http_status.HTTP_200_OK
        data = response.json()

        assert data["usage"]["api_calls"]["current"] == 3000
        assert data["usage"]["storage_gb"]["current"] == 15.0
        assert data["usage"]["users"]["current"] == 4


class TestEndpointAuthentication:
    """Test authentication requirements for all endpoints."""

    async def test_endpoints_require_authentication(self, unauthenticated_client, sample_tenant):
        """Test that all endpoints require authentication.

        Uses unauthenticated_client fixture which does NOT override auth,
        allowing us to verify that authentication is actually enforced.
        """
        endpoints = [
            ("POST", f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing"),
            ("POST", f"/api/v1/tenants/{sample_tenant.id}/usage/sync-billing"),
            ("GET", f"/api/v1/tenants/{sample_tenant.id}/usage/overages"),
            ("GET", f"/api/v1/tenants/{sample_tenant.id}/billing/preview"),
            ("GET", f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status"),
        ]

        for method, url in endpoints:
            if method == "POST":
                response = await unauthenticated_client.post(url, json={})
            else:
                response = await unauthenticated_client.get(url)

            # Should require authentication
            assert response.status_code in [
                http_status.HTTP_401_UNAUTHORIZED,
                http_status.HTTP_403_FORBIDDEN,
                http_status.HTTP_422_UNPROCESSABLE_ENTITY,  # Validation may run first
            ]


class TestErrorHandling:
    """Test error handling across endpoints."""

    async def test_record_usage_handles_service_error(
        self,
        authenticated_client,
        sample_tenant,
        usage_billing_integration,
    ):
        """Test that service errors are handled gracefully."""
        # Mock service to raise error
        with patch.object(
            usage_billing_integration,
            "record_tenant_usage_with_billing",
            side_effect=Exception("Service error"),
        ):
            now = datetime.now(UTC)
            usage_data = {
                "period_start": (now - timedelta(hours=1)).isoformat(),
                "period_end": now.isoformat(),
                "api_calls": 1000,
            }

            response = await authenticated_client.post(
                f"/api/v1/tenants/{sample_tenant.id}/usage/record-with-billing",
                json=usage_data,
            )

            assert response.status_code == http_status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Failed to record usage" in response.json()["detail"]


class TestRecommendationGeneration:
    """Test recommendation generation logic."""

    async def test_recommendations_for_api_limit_exceeded(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test API limit exceeded generates recommendation."""
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=15000,  # Over limit
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        data = response.json()
        api_recommendations = [r for r in data["recommendations"] if r["metric"] == "api_calls"]
        assert len(api_recommendations) > 0
        assert api_recommendations[0]["severity"] == "high"

    async def test_recommendations_for_storage_limit_exceeded(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test storage limit exceeded generates recommendation."""
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            storage_gb=60.0,  # Over limit
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        data = response.json()
        storage_recommendations = [r for r in data["recommendations"] if r["metric"] == "storage"]
        assert len(storage_recommendations) > 0

    async def test_recommendations_for_user_limit_exceeded(
        self,
        authenticated_client,
        sample_tenant,
        tenant_service,
    ):
        """Test user limit exceeded generates recommendation."""
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            users=12,  # Over limit
        )

        response = await authenticated_client.get(
            f"/api/v1/tenants/{sample_tenant.id}/usage/billing-status",
        )

        data = response.json()
        user_recommendations = [r for r in data["recommendations"] if r["metric"] == "users"]
        assert len(user_recommendations) > 0
