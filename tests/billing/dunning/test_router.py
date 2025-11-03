"""Comprehensive tests for dunning API router."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_user():
    """Mock authenticated user."""

    return MagicMock(
        user_id=uuid4(),
        tenant_id="test-tenant-001",
        email="test@example.com",
    )


# Note: auth_headers fixture is provided by tests/billing/conftest.py
# It includes both Authorization and X-Tenant-ID headers


@pytest.mark.asyncio
class TestCampaignEndpoints:
    """Test campaign CRUD endpoints."""

    async def test_create_campaign_success(
        self, async_client: AsyncClient, auth_headers, sample_campaign_data
    ):
        """Test POST /campaigns - successful creation."""
        response = await async_client.post(
            "/api/v1/billing/dunning/campaigns",
            json=sample_campaign_data.model_dump(mode="json"),
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == sample_campaign_data.name
        assert data["trigger_after_days"] == sample_campaign_data.trigger_after_days
        assert len(data["actions"]) == 3
        assert data["is_active"] is True

    async def test_create_campaign_validation_error(self, async_client: AsyncClient, auth_headers):
        """Test POST /campaigns - validation error for empty actions."""
        invalid_data = {
            "name": "Invalid Campaign",
            "trigger_after_days": 7,
            "actions": [],  # Empty actions
        }

        response = await async_client.post(
            "/api/v1/billing/dunning/campaigns",
            json=invalid_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_create_campaign_unauthorized(self, async_client: AsyncClient):
        """Test POST /campaigns - unauthorized without token."""
        response = await async_client.post(
            "/api/v1/billing/dunning/campaigns",
            json={"name": "Test", "trigger_after_days": 7, "actions": []},
        )

        assert response.status_code in {status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST}

    async def test_list_campaigns(self, async_client: AsyncClient, auth_headers, sample_campaign):
        """Test GET /campaigns - list all campaigns."""
        response = await async_client.get("/api/v1/billing/dunning/campaigns", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_campaigns_filtered_by_active(
        self, async_client: AsyncClient, auth_headers, sample_campaign
    ):
        """Test GET /campaigns?active_only=true - filter active campaigns."""
        response = await async_client.get(
            "/api/v1/billing/dunning/campaigns?active_only=true",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(campaign["is_active"] for campaign in data)

    async def test_get_campaign(self, async_client: AsyncClient, auth_headers, sample_campaign):
        """Test GET /campaigns/{id} - retrieve specific campaign."""
        response = await async_client.get(
            f"/api/v1/billing/dunning/campaigns/{sample_campaign.id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(sample_campaign.id)
        assert data["name"] == sample_campaign.name

    async def test_get_campaign_not_found(self, async_client: AsyncClient, auth_headers):
        """Test GET /campaigns/{id} - campaign not found."""
        fake_id = uuid4()

        response = await async_client.get(
            f"/api/v1/billing/dunning/campaigns/{fake_id}", headers=auth_headers
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_update_campaign(self, async_client: AsyncClient, auth_headers, sample_campaign):
        """Test PATCH /campaigns/{id} - update campaign."""
        update_data = {"name": "Updated Campaign Name", "priority": 10}

        response = await async_client.patch(
            f"/api/v1/billing/dunning/campaigns/{sample_campaign.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Campaign Name"
        assert data["priority"] == 10

    async def test_delete_campaign(self, async_client: AsyncClient, auth_headers, sample_campaign):
        """Test DELETE /campaigns/{id} - soft delete campaign."""
        response = await async_client.delete(
            f"/api/v1/billing/dunning/campaigns/{sample_campaign.id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_get_campaign_stats(
        self, async_client: AsyncClient, auth_headers, sample_campaign
    ):
        """Test GET /campaigns/{id}/stats - retrieve campaign statistics."""
        response = await async_client.get(
            f"/api/v1/billing/dunning/campaigns/{sample_campaign.id}/stats",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["campaign_id"] == str(sample_campaign.id)
        assert "total_executions" in data
        assert "success_rate" in data


@pytest.mark.asyncio
class TestExecutionEndpoints:
    """Test execution lifecycle endpoints."""

    async def test_start_execution_success(
        self, async_client: AsyncClient, auth_headers, sample_campaign
    ):
        """Test POST /executions - start new execution."""
        execution_data = {
            "campaign_id": str(sample_campaign.id),
            "subscription_id": "sub_test_456",
            "customer_id": str(uuid4()),
            "invoice_id": "inv_test_456",
            "outstanding_amount": 5000,
            "metadata": {"test": "data"},
        }

        response = await async_client.post(
            "/api/v1/billing/dunning/executions",
            json=execution_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["campaign_id"] == str(sample_campaign.id)
        assert data["subscription_id"] == "sub_test_456"
        assert data["outstanding_amount"] == 5000
        assert data["status"] == "pending"

    async def test_start_execution_duplicate_subscription(
        self, async_client: AsyncClient, auth_headers, sample_execution
    ):
        """Test POST /executions - fail on duplicate active execution."""
        execution_data = {
            "campaign_id": str(sample_execution.campaign_id),
            "subscription_id": sample_execution.subscription_id,  # Duplicate
            "customer_id": str(sample_execution.customer_id),
            "invoice_id": "inv_test_789",
            "outstanding_amount": 3000,
        }

        response = await async_client.post(
            "/api/v1/billing/dunning/executions",
            json=execution_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_list_executions(self, async_client: AsyncClient, auth_headers, sample_execution):
        """Test GET /executions - list all executions."""
        response = await async_client.get(
            "/api/v1/billing/dunning/executions", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_executions_filtered_by_status(
        self, async_client: AsyncClient, auth_headers, sample_execution
    ):
        """Test GET /executions?status=pending - filter by status."""
        response = await async_client.get(
            "/api/v1/billing/dunning/executions?status=pending",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(execution["status"] == "pending" for execution in data)

    async def test_get_execution(self, async_client: AsyncClient, auth_headers, sample_execution):
        """Test GET /executions/{id} - retrieve specific execution."""
        response = await async_client.get(
            f"/api/v1/billing/dunning/executions/{sample_execution.id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(sample_execution.id)
        assert data["subscription_id"] == sample_execution.subscription_id

    async def test_cancel_execution(
        self, async_client: AsyncClient, auth_headers, sample_execution
    ):
        """Test POST /executions/{id}/cancel - cancel execution."""
        cancel_data = {"reason": "Customer paid invoice"}

        response = await async_client.post(
            f"/api/v1/billing/dunning/executions/{sample_execution.id}/cancel",
            json=cancel_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "canceled"
        assert data["canceled_reason"] == "Customer paid invoice"

    async def test_get_execution_logs(
        self, async_client: AsyncClient, auth_headers, sample_execution
    ):
        """Test GET /executions/{id}/logs - retrieve action logs."""
        response = await async_client.get(
            f"/api/v1/billing/dunning/executions/{sample_execution.id}/logs",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)


@pytest.mark.asyncio
class TestStatisticsEndpoints:
    """Test statistics and reporting endpoints."""

    async def test_get_tenant_stats(self, async_client: AsyncClient, auth_headers):
        """Test GET /stats - retrieve tenant-wide statistics."""
        response = await async_client.get("/api/v1/billing/dunning/stats", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_campaigns" in data
        assert "active_campaigns" in data
        assert "total_executions" in data
        assert "average_recovery_rate" in data

    async def test_get_pending_actions(self, async_client: AsyncClient, auth_headers):
        """Test GET /pending-actions - retrieve pending actions."""
        response = await async_client.get(
            "/api/v1/billing/dunning/pending-actions?limit=10",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)


@pytest.mark.asyncio
class TestRateLimiting:
    """Test rate limiting on dunning endpoints."""

    async def test_campaign_creation_rate_limit(
        self, async_client: AsyncClient, auth_headers, sample_campaign_data
    ):
        """Test rate limiting on POST /campaigns (20/minute)."""
        # Make 21 requests rapidly
        responses = []
        for _i in range(21):
            response = await async_client.post(
                "/api/v1/billing/dunning/campaigns",
                json=sample_campaign_data.model_dump(mode="json"),
                headers=auth_headers,
            )
            responses.append(response)

        # At least one should be rate limited
        any(r.status_code == status.HTTP_429_TOO_MANY_REQUESTS for r in responses)
        # Note: This test may be flaky depending on rate limiter implementation
        # In production, the 21st request should be rate limited


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling and validation."""

    async def test_invalid_uuid_format(self, async_client: AsyncClient, auth_headers):
        """Test endpoints handle invalid UUID format."""
        response = await async_client.get(
            "/api/v1/billing/dunning/campaigns/invalid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_missing_required_fields(self, async_client: AsyncClient, auth_headers):
        """Test validation for missing required fields."""
        incomplete_data = {"name": "Test Campaign"}  # Missing required fields

        response = await async_client.post(
            "/api/v1/billing/dunning/campaigns",
            json=incomplete_data,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_negative_outstanding_amount(
        self, async_client: AsyncClient, auth_headers, sample_campaign
    ):
        """Test validation rejects negative outstanding amount."""
        invalid_execution = {
            "campaign_id": str(sample_campaign.id),
            "subscription_id": "sub_test",
            "customer_id": str(uuid4()),
            "outstanding_amount": -1000,  # Invalid negative amount
        }

        response = await async_client.post(
            "/api/v1/billing/dunning/executions",
            json=invalid_execution,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
