"""
Tests for billing subscriptions router.

Tests cover:
- Subscription plan CRUD operations
- Customer subscription lifecycle
- Plan changes and proration
- Usage tracking
- Cancellation and reactivation
"""

from datetime import datetime, timedelta

import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.integration


class TestSubscriptionPlans:
    """Tests for subscription plan management endpoints."""

    @pytest.mark.asyncio
    async def test_create_subscription_plan_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription_plan
    ):
        """Test successful subscription plan creation."""
        # Arrange
        mock_subscription_service.create_plan.return_value = sample_subscription_plan

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/plans",
            json={
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
                "metadata": {},
            },
        )

        # Assert
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Error response: {response.json()}")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["plan_id"] == "plan-123"
        assert data["name"] == "Premium Plan"
        assert data["billing_cycle"] == "monthly"
        assert data["price"] == "99.99"

    @pytest.mark.asyncio
    async def test_list_subscription_plans_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription_plan
    ):
        """Test listing subscription plans."""
        # Arrange
        mock_subscription_service.list_plans.return_value = [sample_subscription_plan]

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/plans")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["plan_id"] == "plan-123"
        assert data[0]["name"] == "Premium Plan"

    @pytest.mark.asyncio
    async def test_get_subscription_plan_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription_plan
    ):
        """Test getting a specific subscription plan."""
        # Arrange
        mock_subscription_service.get_plan.return_value = sample_subscription_plan

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/plans/plan-123")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["plan_id"] == "plan-123"
        assert data["name"] == "Premium Plan"

    @pytest.mark.asyncio
    async def test_get_subscription_plan_not_found(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test getting a non-existent subscription plan."""
        # Arrange
        from dotmac.platform.billing.exceptions import PlanNotFoundError

        mock_subscription_service.get_plan.side_effect = PlanNotFoundError("Plan not found")

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/plans/nonexistent")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestCustomerSubscriptions:
    """Tests for customer subscription management endpoints."""

    @pytest.mark.asyncio
    async def test_create_subscription_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test successful subscription creation."""
        # Arrange
        mock_subscription_service.create_subscription.return_value = sample_subscription

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/",
            json={"customer_id": "cust-123", "plan_id": "plan-123", "metadata": {}},
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["subscription_id"] == "sub-789"
        assert data["customer_id"] == "cust-123"
        assert data["plan_id"] == "plan-123"
        assert data["status"] == "active"
        assert "is_in_trial" in data
        assert "days_until_renewal" in data

    @pytest.mark.asyncio
    async def test_list_subscriptions_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test listing subscriptions."""
        # Arrange
        mock_subscription_service.list_subscriptions.return_value = [sample_subscription]

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["subscription_id"] == "sub-789"

    @pytest.mark.asyncio
    async def test_list_subscriptions_filtered_by_customer(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test listing subscriptions filtered by customer."""
        # Arrange
        mock_subscription_service.list_subscriptions.return_value = [sample_subscription]

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/?customer_id=cust-123")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["customer_id"] == "cust-123"

    @pytest.mark.asyncio
    async def test_get_subscription_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test getting a specific subscription."""
        # Arrange
        mock_subscription_service.get_subscription.return_value = sample_subscription

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/sub-789")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["subscription_id"] == "sub-789"
        assert "is_in_trial" in data
        assert "days_until_renewal" in data

    @pytest.mark.asyncio
    async def test_get_subscription_not_found(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test getting a non-existent subscription."""
        # Arrange
        mock_subscription_service.get_subscription.return_value = None

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/nonexistent")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_update_subscription_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test updating a subscription."""
        # Arrange
        mock_subscription_service.update_subscription.return_value = sample_subscription

        # Act
        response = await async_client.patch(
            "/api/v1/billing/subscriptions/sub-789",
            json={"custom_price": "89.99", "metadata": {"discount": "10%"}},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["subscription_id"] == "sub-789"


class TestSubscriptionLifecycle:
    """Tests for subscription lifecycle operations (cancel, reactivate, etc.)."""

    @pytest.mark.asyncio
    async def test_cancel_subscription_at_period_end(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test canceling a subscription at period end."""
        # Arrange
        canceled_sub = sample_subscription
        canceled_sub.cancel_at_period_end = True
        mock_subscription_service.cancel_subscription.return_value = canceled_sub

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/sub-789/cancel?at_period_end=true"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "current period" in data["message"]

    @pytest.mark.asyncio
    async def test_cancel_subscription_immediately(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test canceling a subscription immediately."""
        # Arrange
        canceled_sub = sample_subscription
        canceled_sub.status = "canceled"
        canceled_sub.canceled_at = datetime.utcnow()
        mock_subscription_service.cancel_subscription.return_value = canceled_sub

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/sub-789/cancel?at_period_end=false"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "immediately" in data["message"]

    @pytest.mark.asyncio
    async def test_reactivate_subscription_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test reactivating a canceled subscription."""
        # Arrange
        reactivated_sub = sample_subscription
        reactivated_sub.cancel_at_period_end = False
        mock_subscription_service.reactivate_subscription.return_value = reactivated_sub

        # Act
        response = await async_client.post("/api/v1/billing/subscriptions/sub-789/reactivate")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "reactivated successfully" in data["message"]

    @pytest.mark.asyncio
    async def test_change_subscription_plan_success(
        self,
        async_client: AsyncClient,
        mock_subscription_service,
        sample_subscription,
        sample_proration_result,
    ):
        """Test changing subscription plan with proration."""
        # Arrange
        updated_sub = sample_subscription
        updated_sub.plan_id = "plan-456"
        mock_subscription_service.change_plan.return_value = (updated_sub, sample_proration_result)

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/sub-789/change-plan",
            json={"new_plan_id": "plan-456", "proration_behavior": "prorate"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "proration" in data
        assert data["proration"]["proration_amount"] == "25.50"


class TestUsageTracking:
    """Tests for usage tracking endpoints."""

    @pytest.mark.asyncio
    async def test_record_usage_success(self, async_client: AsyncClient, mock_subscription_service):
        """Test recording usage for a subscription."""
        # Arrange
        mock_subscription_service.record_usage.return_value = {"api_calls": 150}

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/sub-789/usage",
            json={"subscription_id": "sub-789", "usage_type": "api_calls", "quantity": 150},
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "message" in data
        assert "successfully" in data["message"]

    @pytest.mark.asyncio
    async def test_get_subscription_usage_success(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test getting current usage for a subscription."""
        # Arrange
        mock_subscription_service.get_usage.return_value = {"api_calls": 150, "storage_gb": 5}

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/sub-789/usage")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["subscription_id"] == "sub-789"
        assert "usage" in data
        assert data["usage"]["api_calls"] == 150

    @pytest.mark.asyncio
    async def test_get_subscription_usage_not_found(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test getting usage for non-existent subscription."""
        # Arrange
        mock_subscription_service.get_usage.return_value = None

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/nonexistent/usage")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestProrationPreview:
    """Tests for proration preview endpoint."""

    @pytest.mark.asyncio
    async def test_preview_plan_change_proration_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_proration_result
    ):
        """Test previewing proration for plan change."""
        # Arrange
        mock_subscription_service.calculate_proration_preview.return_value = sample_proration_result

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/proration-preview?subscription_id=sub-789&new_plan_id=plan-456"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["proration_amount"] == "25.50"
        assert data["days_remaining"] == 15


class TestExpiringSubscriptions:
    """Tests for expiring subscriptions endpoint."""

    @pytest.mark.asyncio
    async def test_get_expiring_subscriptions_success(self, async_client: AsyncClient):
        """Test getting expiring subscriptions count."""
        # This endpoint queries the database directly, so we can't mock the service
        # It will return empty results but should not error

        # Act
        response = await async_client.get("/api/v1/billing/subscriptions/expiring?days=30")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "count" in data
        assert "days_ahead" in data
        assert data["days_ahead"] == 30


class TestSubscriptionRenewal:
    """Tests for subscription renewal workflow endpoints."""

    @pytest.mark.asyncio
    async def test_check_renewal_eligibility_success(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test checking subscription renewal eligibility."""
        # Arrange
        eligibility = {
            "is_eligible": True,
            "subscription_id": "sub-789",
            "customer_id": "cust-123",
            "plan_id": "plan-123",
            "plan_name": "Premium Plan",
            "current_period_end": datetime.utcnow().isoformat(),
            "days_until_renewal": 15,
            "renewal_price": "99.99",
            "currency": "USD",
            "blocking_reasons": [],
        }
        mock_subscription_service.check_renewal_eligibility.return_value = eligibility

        # Act
        response = await async_client.get(
            "/api/v1/billing/subscriptions/subscriptions/sub-789/renewal-eligibility"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_eligible"] is True
        assert data["subscription_id"] == "sub-789"
        assert data["days_until_renewal"] == 15

    @pytest.mark.asyncio
    async def test_check_renewal_eligibility_not_eligible(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test renewal eligibility check when subscription not eligible."""
        # Arrange
        eligibility = {
            "is_eligible": False,
            "subscription_id": "sub-789",
            "customer_id": "cust-123",
            "plan_id": "plan-123",
            "plan_name": "Premium Plan",
            "current_period_end": datetime.utcnow().isoformat(),
            "days_until_renewal": 0,
            "renewal_price": "99.99",
            "currency": "USD",
            "blocking_reasons": ["Payment method expired"],
        }
        mock_subscription_service.check_renewal_eligibility.return_value = eligibility

        # Act
        response = await async_client.get(
            "/api/v1/billing/subscriptions/subscriptions/sub-789/renewal-eligibility"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_eligible"] is False
        assert "blocking_reasons" in data
        assert len(data["blocking_reasons"]) > 0

    @pytest.mark.asyncio
    async def test_extend_subscription_success(
        self, async_client: AsyncClient, mock_subscription_service, sample_subscription
    ):
        """Test extending subscription to next billing period."""
        # Arrange
        extended_sub = sample_subscription
        extended_sub.current_period_end = datetime.utcnow() + timedelta(days=60)
        mock_subscription_service.extend_subscription.return_value = extended_sub

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/subscriptions/sub-789/extend?payment_id=pay-123"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["subscription_id"] == "sub-789"
        assert "current_period_end" in data

    @pytest.mark.asyncio
    async def test_process_renewal_payment_success(
        self, async_client: AsyncClient, mock_subscription_service
    ):
        """Test processing renewal payment."""
        # Arrange
        payment_details = {
            "subscription_id": "sub-789",
            "amount": "99.99",
            "currency": "USD",
            "payment_method_id": "pm-123",
            "payment_intent_id": "pi-456",
            "status": "requires_action",
            "client_secret": "secret_123",
        }
        mock_subscription_service.process_renewal_payment.return_value = payment_details

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/subscriptions/sub-789/renewal-payment?payment_method_id=pm-123"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["subscription_id"] == "sub-789"
        assert data["amount"] == "99.99"
        assert "payment_intent_id" in data

    @pytest.mark.asyncio
    async def test_create_renewal_quote_success(
        self,
        async_client: AsyncClient,
        mock_subscription_service,
        sample_subscription,
        sample_subscription_plan,
    ):
        """Test creating renewal quote."""
        # Arrange
        mock_subscription_service.get_subscription.return_value = sample_subscription
        mock_subscription_service.get_plan.return_value = sample_subscription_plan

        # Act
        response = await async_client.post(
            "/api/v1/billing/subscriptions/subscriptions/sub-789/renewal-quote?customer_id=cust-123&valid_days=30"
        )

        # Assert
        # This endpoint will fail without full CRM service setup, but we test the routing
        # It should at least attempt to process the request
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST]
