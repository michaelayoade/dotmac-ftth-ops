"""
Comprehensive tests for tenant usage-based billing integration.

Tests integration between tenant usage tracking and billing system.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.dotmac.platform.billing.catalog.models import UsageType
from src.dotmac.platform.tenant.models import TenantPlanType
from src.dotmac.platform.tenant.schemas import TenantCreate, TenantUsageCreate

# Fixtures are in conftest.py


@pytest.mark.integration
class TestUsageBillingIntegration:
    """Test usage billing integration service."""

    async def test_record_usage_with_billing_success(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test successful usage recording to both systems."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=1000,
            storage_gb=5.5,
            bandwidth_gb=2.3,
            active_users=3,
        )

        result = await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id="sub-123",
        )

        # Verify result structure
        assert result["tenant_id"] == sample_tenant.id
        assert result["subscription_id"] == "sub-123"
        assert "tenant_usage_id" in result
        assert len(result["billing_records"]) == 4  # API, storage, bandwidth, users

        # Verify billing records
        billing_types = [r["type"] for r in result["billing_records"]]
        assert "api_calls" in billing_types
        assert "storage_gb" in billing_types
        assert "bandwidth_gb" in billing_types
        assert "users" in billing_types

        # Verify subscription service was called
        assert mock_subscription_service.record_usage.call_count == 4

    async def test_record_usage_with_auto_subscription_detection(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test usage recording with automatic subscription detection."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=500,
            storage_gb=2.0,
            active_users=2,
        )

        # Don't provide subscription_id - should auto-detect
        result = await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id=None,
        )

        # Verify subscription was detected
        assert result["subscription_id"] == "sub-123"
        assert mock_subscription_service.list_subscriptions.called

    async def test_record_usage_no_active_subscription(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test usage recording when no active subscription exists."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=100,
            storage_gb=1.0,
            active_users=1,
        )

        # Mock no active subscriptions
        mock_subscription_service.list_subscriptions = AsyncMock(return_value=[])

        result = await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id=None,
        )

        # Should still record to tenant usage
        assert "tenant_usage_id" in result
        # But no billing records
        assert len(result["billing_records"]) == 0
        assert result["subscription_id"] is None

    async def test_record_usage_zero_quantities(self, usage_billing_integration, sample_tenant):
        """Test usage recording with zero quantities (should skip billing)."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=0,
            storage_gb=0,
            bandwidth_gb=0,
            active_users=0,
        )

        result = await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id="sub-123",
        )

        # No billing records for zero usage
        assert len(result["billing_records"]) == 0


@pytest.mark.integration
class TestUsageCounterSync:
    """Test syncing tenant counters to billing."""

    async def test_sync_counters_success(
        self, usage_billing_integration, sample_tenant, tenant_service, mock_subscription_service
    ):
        """Test successful counter sync."""
        # Update tenant counters
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=25.5,
            users=7,
        )

        result = await usage_billing_integration.sync_tenant_counters_with_billing(
            tenant_id=sample_tenant.id,
            subscription_id="sub-123",
        )

        assert result["synced"] is True
        assert result["subscription_id"] == "sub-123"
        assert len(result["metrics_synced"]) > 0

    async def test_sync_counters_no_subscription(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test sync when no subscription exists."""
        mock_subscription_service.list_subscriptions = AsyncMock(return_value=[])

        result = await usage_billing_integration.sync_tenant_counters_with_billing(
            tenant_id=sample_tenant.id,
            subscription_id=None,
        )

        assert result["synced"] is False
        assert "No active subscription" in result["reason"]


@pytest.mark.integration
class TestOverageCalculations:
    """Test overage charge calculations."""

    async def test_calculate_overages_api_calls(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test API call overage calculation."""
        # Set usage above limit
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=15000,  # Limit is 10000
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is True
        assert len(result["overages"]) == 1

        overage = result["overages"][0]
        assert overage["metric"] == "api_calls"
        assert overage["limit"] == 10000
        assert overage["usage"] == 15000
        assert overage["overage"] == 5000
        assert Decimal(overage["charge"]) == Decimal("5.00")  # 5000 * 0.001

    async def test_calculate_overages_storage(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test storage overage calculation."""
        # Set storage above limit
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            storage_gb=60.0,  # Limit is 50
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is True

        storage_overage = next(o for o in result["overages"] if o["metric"] == "storage_gb")
        assert storage_overage["overage"] == 10.0
        assert Decimal(storage_overage["charge"]) == Decimal("1.00")  # 10 * 0.10

    async def test_calculate_overages_users(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test user overage calculation."""
        # Set users above limit
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            users=15,  # Limit is 10
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is True

        user_overage = next(o for o in result["overages"] if o["metric"] == "users")
        assert user_overage["overage"] == 5
        assert Decimal(user_overage["charge"]) == Decimal("25.00")  # 5 * 5.00

    async def test_calculate_overages_multiple_metrics(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test multiple overages."""
        # Exceed multiple limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=12000,  # +2000 over
            storage_gb=55.0,  # +5 over
            users=12,  # +2 over
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is True
        assert len(result["overages"]) == 3

        # Total should be: (2000 * 0.001) + (5 * 0.10) + (2 * 5.00) = 2.00 + 0.50 + 10.00 = 12.50
        assert Decimal(result["total_overage_charge"]) == Decimal("12.50")

    async def test_calculate_overages_no_overages(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test when within limits."""
        # Set usage within limits
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=25.0,
            users=5,
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is False
        assert len(result["overages"]) == 0
        assert result["total_overage_charge"] == "0"


@pytest.mark.integration
class TestBillingPreview:
    """Test billing preview functionality."""

    async def test_billing_preview_with_overages(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test billing preview including overages."""
        # Set usage with overages
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=12000,
            storage_gb=55.0,
            users=8,
        )

        result = await usage_billing_integration.get_billing_preview(
            tenant_id=sample_tenant.id,
            include_overages=True,
        )

        assert result["plan_type"] == TenantPlanType.PROFESSIONAL
        assert result["base_subscription_cost"] == "99.00"

        # Check usage summary
        assert result["usage_summary"]["api_calls"]["current"] == 12000
        assert result["usage_summary"]["api_calls"]["percentage"] == 120.0

        # Check overages included
        assert "overages" in result
        assert result["overages"]["has_overages"] is True

        # Total should include base + overages
        total = Decimal(result["total_estimated_charge"])
        base = Decimal(result["base_subscription_cost"])
        assert total > base

    async def test_billing_preview_without_overages(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test billing preview excluding overages."""
        # Set usage with overages
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=12000,
            storage_gb=55.0,
        )

        result = await usage_billing_integration.get_billing_preview(
            tenant_id=sample_tenant.id,
            include_overages=False,
        )

        # Should only show base cost
        assert result["total_estimated_charge"] == result["base_subscription_cost"]
        assert "overages" not in result

    async def test_billing_preview_usage_percentages(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test usage percentage calculations in preview."""
        # Set specific usage levels
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,  # 50%
            storage_gb=25.0,  # 50%
            users=5,  # 50%
        )

        result = await usage_billing_integration.get_billing_preview(tenant_id=sample_tenant.id)

        # All should be at 50%
        assert result["usage_summary"]["api_calls"]["percentage"] == 50.0
        assert result["usage_summary"]["storage_gb"]["percentage"] == 50.0
        assert result["usage_summary"]["users"]["percentage"] == 50.0


@pytest.mark.integration
class TestPlanCosts:
    """Test plan cost calculations."""

    async def test_plan_costs_free(self, usage_billing_integration, tenant_service):
        """Test free plan cost."""
        tenant_data = TenantCreate(
            name="Free Org",
            slug="free-org",
            plan_type=TenantPlanType.FREE,
        )
        tenant = await tenant_service.create_tenant(tenant_data)

        result = await usage_billing_integration.get_billing_preview(tenant.id)
        assert result["base_subscription_cost"] == "0.00"

    async def test_plan_costs_starter(self, usage_billing_integration, tenant_service):
        """Test starter plan cost."""
        tenant_data = TenantCreate(
            name="Starter Org",
            slug="starter-org",
            plan_type=TenantPlanType.STARTER,
        )
        tenant = await tenant_service.create_tenant(tenant_data)

        result = await usage_billing_integration.get_billing_preview(tenant.id)
        assert result["base_subscription_cost"] == "29.00"

    async def test_plan_costs_enterprise(self, usage_billing_integration, tenant_service):
        """Test enterprise plan cost."""
        tenant_data = TenantCreate(
            name="Enterprise Org",
            slug="enterprise-org",
            plan_type=TenantPlanType.ENTERPRISE,
        )
        tenant = await tenant_service.create_tenant(tenant_data)

        result = await usage_billing_integration.get_billing_preview(tenant.id)
        assert result["base_subscription_cost"] == "499.00"


@pytest.mark.integration
class TestSubscriptionLookup:
    """Test subscription lookup functionality."""

    async def test_get_active_subscription_found(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test finding active subscription."""
        subscription_id = await usage_billing_integration._get_active_subscription_id(
            sample_tenant.id
        )

        assert subscription_id == "sub-123"
        mock_subscription_service.list_subscriptions.assert_called_once_with(
            tenant_id=sample_tenant.id,
            status="active",
        )

    async def test_get_active_subscription_not_found(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test when no active subscription exists."""
        mock_subscription_service.list_subscriptions = AsyncMock(return_value=[])

        subscription_id = await usage_billing_integration._get_active_subscription_id(
            sample_tenant.id
        )

        assert subscription_id is None

    async def test_get_active_subscription_multiple_found(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test when multiple subscriptions exist (returns first)."""
        mock_subscription_service.list_subscriptions = AsyncMock(
            return_value=[
                MagicMock(subscription_id="sub-123"),
                MagicMock(subscription_id="sub-456"),
            ]
        )

        subscription_id = await usage_billing_integration._get_active_subscription_id(
            sample_tenant.id
        )

        # Should return first one
        assert subscription_id == "sub-123"


@pytest.mark.integration
class TestUsageTypeMapping:
    """Test usage type mapping to billing."""

    async def test_api_calls_mapping(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test API calls map to correct billing type."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=1000,
        )

        await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id="sub-123",
        )

        # Verify correct usage type was used
        call_args = mock_subscription_service.record_usage.call_args_list[0]
        usage_request = call_args[0][0]
        assert usage_request.usage_type == UsageType.API_CALLS.value

    async def test_storage_mapping(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test storage maps to correct billing type."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            storage_gb=10.5,
        )

        await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id="sub-123",
        )

        call_args = mock_subscription_service.record_usage.call_args_list[0]
        usage_request = call_args[0][0]
        assert usage_request.usage_type == UsageType.STORAGE_GB.value
        assert usage_request.quantity == 10  # Converted to int

    async def test_users_mapping(
        self, usage_billing_integration, sample_tenant, mock_subscription_service
    ):
        """Test users map to correct billing type."""
        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            active_users=5,
        )

        await usage_billing_integration.record_tenant_usage_with_billing(
            tenant_id=sample_tenant.id,
            usage_data=usage_data,
            subscription_id="sub-123",
        )

        call_args = mock_subscription_service.record_usage.call_args_list[0]
        usage_request = call_args[0][0]
        assert usage_request.usage_type == UsageType.USERS.value


@pytest.mark.integration
class TestErrorHandling:
    """Test error handling in integration."""

    async def test_record_usage_invalid_tenant(self, usage_billing_integration):
        """Test usage recording with invalid tenant."""
        from dotmac.platform.tenant.service import TenantNotFoundError

        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=now - timedelta(hours=1),
            period_end=now,
            api_calls=1000,
        )

        with pytest.raises(TenantNotFoundError):
            await usage_billing_integration.record_tenant_usage_with_billing(
                tenant_id="nonexistent",
                usage_data=usage_data,
            )

    async def test_overage_calculation_invalid_tenant(self, usage_billing_integration):
        """Test overage calculation with invalid tenant."""
        from dotmac.platform.tenant.service import TenantNotFoundError

        with pytest.raises(TenantNotFoundError):
            await usage_billing_integration.calculate_overage_charges(tenant_id="nonexistent")

    async def test_billing_preview_invalid_tenant(self, usage_billing_integration):
        """Test billing preview with invalid tenant."""
        from dotmac.platform.tenant.service import TenantNotFoundError

        with pytest.raises(TenantNotFoundError):
            await usage_billing_integration.get_billing_preview(tenant_id="nonexistent")


@pytest.mark.integration
class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    async def test_exact_limit_no_overage(
        self, usage_billing_integration, sample_tenant, tenant_service
    ):
        """Test usage exactly at limit (no overage)."""
        # Set usage exactly at limit
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=10000,  # Exactly at limit
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is False

    async def test_one_over_limit(self, usage_billing_integration, sample_tenant, tenant_service):
        """Test usage one unit over limit."""
        # Set usage 1 over limit
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=10001,
        )

        result = await usage_billing_integration.calculate_overage_charges(
            tenant_id=sample_tenant.id
        )

        assert result["has_overages"] is True
        overage = result["overages"][0]
        assert overage["overage"] == 1
        assert Decimal(overage["charge"]) == Decimal("0.001")

    async def test_zero_limit_handling(self, usage_billing_integration, tenant_service):
        """Test tenant with minimal limits (edge case)."""
        tenant_data = TenantCreate(
            name="Minimal Limit Org",
            slug="minimal-limit",
            max_users=1,  # Minimum allowed
            max_api_calls_per_month=0,  # API calls can be 0
            max_storage_gb=1,  # Minimum allowed
        )
        tenant = await tenant_service.create_tenant(tenant_data)

        # Usage exceeding minimal limits
        await tenant_service.update_tenant_usage_counters(
            tenant.id,
            api_calls=1,  # Over 0 limit
            users=2,  # Over 1 limit
            storage_gb=2,  # Over 1 GB limit
        )

        result = await usage_billing_integration.calculate_overage_charges(tenant.id)

        # Should have overages for api_calls, users, and storage
        assert result["has_overages"] is True
        assert len(result["overages"]) >= 2  # At least users and storage (api_calls if 1 > 0)
