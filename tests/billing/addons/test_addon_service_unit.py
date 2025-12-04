"""
Unit tests for billing add-ons service layer.

Tests all business logic for add-on management including:
- Fetching available add-ons
- Purchasing add-ons
- Updating quantity
- Cancellation and reactivation
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.addons.models import (
    Addon,
    AddonBillingType,
    AddonResponse,
    AddonStatus,
    AddonType,
    TenantAddonResponse,
)
from dotmac.platform.billing.addons.service import AddonService
from dotmac.platform.billing.exceptions import AddonNotFoundError


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def addon_service(mock_db_session):
    """Create AddonService with mocked database."""
    return AddonService(mock_db_session)


@pytest.fixture
def sample_addon_data():
    """Sample add-on data for testing."""
    return {
        "addon_id": "addon_test_123",
        "tenant_id": "test_tenant",
        "name": "Test Add-on",
        "description": "Test add-on description",
        "addon_type": AddonType.FEATURE,
        "billing_type": AddonBillingType.RECURRING,
        "price": Decimal("25.00"),
        "currency": "USD",
        "setup_fee": None,
        "is_quantity_based": True,
        "min_quantity": 1,
        "max_quantity": 10,
        "metered_unit": None,
        "included_quantity": None,
        "is_active": True,
        "is_featured": True,
        "compatible_with_all_plans": True,
        "compatible_plan_ids": [],
        "metadata": {},
        "icon": "test-icon",
        "features": ["Feature 1", "Feature 2"],
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }


@pytest.fixture
def sample_addon(sample_addon_data):
    """Create sample Addon model."""
    return Addon(**sample_addon_data)


@pytest.mark.unit
class TestGetAvailableAddons:
    """Test suite for get_available_addons method."""

    @pytest.mark.asyncio
    async def test_get_available_addons_success(self, addon_service, mock_db_session):
        """Test successful retrieval of available add-ons."""
        # Mock database response
        mock_row = MagicMock()
        mock_row.addon_id = "addon_123"
        mock_row.name = "Test Add-on"
        mock_row.description = "Test description"
        mock_row.addon_type = "feature"
        mock_row.billing_type = "recurring"
        mock_row.price = Decimal("25.00")
        mock_row.currency = "USD"
        mock_row.setup_fee = None
        mock_row.is_quantity_based = True
        mock_row.min_quantity = 1
        mock_row.max_quantity = 10
        mock_row.metered_unit = None
        mock_row.included_quantity = None
        mock_row.is_active = True
        mock_row.is_featured = True
        mock_row.compatible_with_all_plans = True
        mock_row.icon = "icon"
        mock_row.features = ["Feature 1"]

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [mock_row]
        mock_db_session.execute.return_value = mock_result

        # Execute
        addons = await addon_service.get_available_addons("test_tenant")

        # Assert
        assert len(addons) == 1
        assert isinstance(addons[0], AddonResponse)
        assert addons[0].addon_id == "addon_123"
        assert addons[0].name == "Test Add-on"

    @pytest.mark.asyncio
    async def test_get_available_addons_with_plan_filter(self, addon_service, mock_db_session):
        """Test filtering add-ons by plan compatibility."""
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute
        addons = await addon_service.get_available_addons("test_tenant", "plan_123")

        # Assert
        assert len(addons) == 0
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_available_addons_empty_result(self, addon_service, mock_db_session):
        """Test when no add-ons are available."""
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute
        addons = await addon_service.get_available_addons("test_tenant")

        # Assert
        assert len(addons) == 0


@pytest.mark.unit
class TestGetAddon:
    """Test suite for get_addon method."""

    @pytest.mark.asyncio
    async def test_get_addon_success(self, addon_service, mock_db_session):
        """Test successful retrieval of a single add-on."""
        # Mock database response
        mock_row = MagicMock()
        mock_row.addon_id = "addon_123"
        mock_row.tenant_id = "test_tenant"
        mock_row.name = "Test Add-on"
        mock_row.description = "Test description"
        mock_row.addon_type = "feature"
        mock_row.billing_type = "recurring"
        mock_row.price = Decimal("25.00")
        mock_row.currency = "USD"
        mock_row.setup_fee = None
        mock_row.is_quantity_based = True
        mock_row.min_quantity = 1
        mock_row.max_quantity = 10
        mock_row.metered_unit = None
        mock_row.included_quantity = None
        mock_row.is_active = True
        mock_row.is_featured = True
        mock_row.compatible_with_all_plans = True
        mock_row.compatible_plan_ids = []
        mock_row.metadata_json = {}
        mock_row.icon = "icon"
        mock_row.features = ["Feature 1"]
        mock_row.created_at = datetime.now(UTC)
        mock_row.updated_at = datetime.now(UTC)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute
        addon = await addon_service.get_addon("addon_123")

        # Assert
        assert addon is not None
        assert isinstance(addon, Addon)
        assert addon.addon_id == "addon_123"

    @pytest.mark.asyncio
    async def test_get_addon_not_found(self, addon_service, mock_db_session):
        """Test when add-on doesn't exist."""
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute
        addon = await addon_service.get_addon("nonexistent")

        # Assert
        assert addon is None


@pytest.mark.unit
class TestPurchaseAddon:
    """Test suite for purchase_addon method."""

    @pytest.mark.asyncio
    async def test_purchase_addon_success(self, addon_service, mock_db_session, sample_addon):
        """Test successful add-on purchase."""
        # Mock get_addon to return sample addon
        with patch.object(addon_service, "get_addon", return_value=sample_addon):
            # Mock database insert and commit
            mock_row = MagicMock()
            mock_row.tenant_addon_id = "taddon_123"
            mock_row.tenant_id = "test_tenant"
            mock_row.addon_id = "addon_test_123"
            mock_row.subscription_id = None
            mock_row.status = "active"
            mock_row.quantity = 1
            mock_row.started_at = datetime.now(UTC)
            mock_row.current_period_start = None
            mock_row.current_period_end = None
            mock_row.canceled_at = None
            mock_row.ended_at = None
            mock_row.current_usage = 0
            mock_row.metadata_json = {}

            # Mock the addon fetch after purchase
            addon_details_row = MagicMock()
            addon_details_row.addon_id = "addon_test_123"
            addon_details_row.name = "Test Add-on"
            addon_details_row.description = "Test description"
            addon_details_row.addon_type = "feature"
            addon_details_row.billing_type = "recurring"
            addon_details_row.price = Decimal("25.00")
            addon_details_row.currency = "USD"
            addon_details_row.setup_fee = None
            addon_details_row.is_quantity_based = True
            addon_details_row.min_quantity = 1
            addon_details_row.max_quantity = 10
            addon_details_row.metered_unit = None
            addon_details_row.included_quantity = None
            addon_details_row.is_active = True
            addon_details_row.is_featured = True
            addon_details_row.compatible_with_all_plans = True
            addon_details_row.icon = "icon"
            addon_details_row.features = ["Feature 1"]

            mock_result = AsyncMock()
            mock_result.scalar_one.return_value = addon_details_row
            mock_db_session.execute.return_value = mock_result

            # Execute
            result = await addon_service.purchase_addon(
                tenant_id="test_tenant",
                addon_id="addon_test_123",
                quantity=2,
                subscription_id=None,
                purchased_by_user_id="user_123",
            )

            # Assert
            assert isinstance(result, TenantAddonResponse)
            assert result.addon_id == "addon_test_123"
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_purchase_addon_not_found(self, addon_service):
        """Test purchasing non-existent add-on."""
        with patch.object(addon_service, "get_addon", return_value=None):
            with pytest.raises(AddonNotFoundError):
                await addon_service.purchase_addon(
                    tenant_id="test_tenant",
                    addon_id="nonexistent",
                    quantity=1,
                    subscription_id=None,
                    purchased_by_user_id="user_123",
                )

    @pytest.mark.asyncio
    async def test_purchase_addon_inactive(self, addon_service, sample_addon):
        """Test purchasing inactive add-on raises error."""
        sample_addon.is_active = False

        with patch.object(addon_service, "get_addon", return_value=sample_addon):
            with pytest.raises(ValueError, match="not available for purchase"):
                await addon_service.purchase_addon(
                    tenant_id="test_tenant",
                    addon_id="addon_test_123",
                    quantity=1,
                    subscription_id=None,
                    purchased_by_user_id="user_123",
                )

    @pytest.mark.asyncio
    async def test_purchase_addon_quantity_below_minimum(self, addon_service, sample_addon):
        """Test purchasing with quantity below minimum."""
        with patch.object(addon_service, "get_addon", return_value=sample_addon):
            with pytest.raises(ValueError, match="must be at least"):
                await addon_service.purchase_addon(
                    tenant_id="test_tenant",
                    addon_id="addon_test_123",
                    quantity=0,
                    subscription_id=None,
                    purchased_by_user_id="user_123",
                )

    @pytest.mark.asyncio
    async def test_purchase_addon_quantity_above_maximum(self, addon_service, sample_addon):
        """Test purchasing with quantity above maximum."""
        with patch.object(addon_service, "get_addon", return_value=sample_addon):
            with pytest.raises(ValueError, match="cannot exceed"):
                await addon_service.purchase_addon(
                    tenant_id="test_tenant",
                    addon_id="addon_test_123",
                    quantity=20,
                    subscription_id=None,
                    purchased_by_user_id="user_123",
                )


@pytest.mark.unit
class TestUpdateAddonQuantity:
    """Test suite for update_addon_quantity method."""

    @pytest.mark.asyncio
    async def test_update_quantity_success(self, addon_service, mock_db_session, sample_addon):
        """Test successful quantity update."""
        # Mock get_tenant_addon
        tenant_addon = TenantAddonResponse(
            tenant_addon_id="taddon_123",
            tenant_id="test_tenant",
            addon_id="addon_test_123",
            subscription_id=None,
            status=AddonStatus.ACTIVE,
            quantity=2,
            started_at=datetime.now(UTC),
            current_period_start=datetime.now(UTC),
            current_period_end=datetime.now(UTC) + timedelta(days=30),
            canceled_at=None,
            ended_at=None,
            current_usage=0,
            addon=AddonResponse(
                addon_id="addon_test_123",
                name="Test",
                description="Test",
                addon_type=AddonType.FEATURE,
                billing_type=AddonBillingType.RECURRING,
                price=Decimal("25.00"),
                currency="USD",
                setup_fee=None,
                is_quantity_based=True,
                min_quantity=1,
                max_quantity=10,
                metered_unit=None,
                included_quantity=None,
                is_active=True,
                is_featured=True,
                compatible_with_all_plans=True,
                icon="icon",
                features=[],
            ),
        )

        with patch.object(addon_service, "get_tenant_addon", return_value=tenant_addon):
            with patch.object(addon_service, "get_addon", return_value=sample_addon):
                # Mock database query for fetching metadata
                mock_tenant_addon_row = MagicMock()
                mock_tenant_addon_row.metadata_json = {}

                mock_result = AsyncMock()
                mock_result.scalar_one_or_none.return_value = mock_tenant_addon_row
                mock_db_session.execute.return_value = mock_result

                # Execute
                await addon_service.update_addon_quantity(
                    tenant_addon_id="taddon_123",
                    tenant_id="test_tenant",
                    new_quantity=5,
                    updated_by_user_id="user_123",
                )

                # Assert
                mock_db_session.execute.assert_called()
                mock_db_session.commit.assert_called()


@pytest.mark.unit
class TestCancelAddon:
    """Test suite for cancel_addon method."""

    @pytest.mark.asyncio
    async def test_cancel_addon_immediate(self, addon_service, mock_db_session, sample_addon):
        """Test immediate add-on cancellation."""
        # Mock get_tenant_addon
        tenant_addon = TenantAddonResponse(
            tenant_addon_id="taddon_123",
            tenant_id="test_tenant",
            addon_id="addon_test_123",
            subscription_id=None,
            status=AddonStatus.ACTIVE,
            quantity=1,
            started_at=datetime.now(UTC),
            current_period_start=datetime.now(UTC),
            current_period_end=datetime.now(UTC) + timedelta(days=30),
            canceled_at=None,
            ended_at=None,
            current_usage=0,
            addon=AddonResponse(
                addon_id="addon_test_123",
                name="Test",
                description="Test",
                addon_type=AddonType.FEATURE,
                billing_type=AddonBillingType.RECURRING,
                price=Decimal("25.00"),
                currency="USD",
                setup_fee=None,
                is_quantity_based=False,
                min_quantity=1,
                max_quantity=None,
                metered_unit=None,
                included_quantity=None,
                is_active=True,
                is_featured=True,
                compatible_with_all_plans=True,
                icon="icon",
                features=[],
            ),
        )

        with patch.object(addon_service, "get_tenant_addon", return_value=tenant_addon):
            with patch.object(addon_service, "get_addon", return_value=sample_addon):
                # Mock database query for fetching metadata
                mock_tenant_addon_row = MagicMock()
                mock_tenant_addon_row.metadata_json = {}

                mock_result = AsyncMock()
                mock_result.scalar_one_or_none.return_value = mock_tenant_addon_row
                mock_db_session.execute.return_value = mock_result

                # Execute
                await addon_service.cancel_addon(
                    tenant_addon_id="taddon_123",
                    tenant_id="test_tenant",
                    cancel_immediately=True,
                    reason="Testing",
                    canceled_by_user_id="user_123",
                )

                # Assert
                mock_db_session.execute.assert_called()
                mock_db_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_cancel_addon_already_canceled(self, addon_service):
        """Test canceling already canceled add-on."""
        tenant_addon = TenantAddonResponse(
            tenant_addon_id="taddon_123",
            tenant_id="test_tenant",
            addon_id="addon_test_123",
            subscription_id=None,
            status=AddonStatus.CANCELED,
            quantity=1,
            started_at=datetime.now(UTC),
            current_period_start=None,
            current_period_end=None,
            canceled_at=datetime.now(UTC),
            ended_at=None,
            current_usage=0,
            addon=AddonResponse(
                addon_id="addon_test_123",
                name="Test",
                description="Test",
                addon_type=AddonType.FEATURE,
                billing_type=AddonBillingType.RECURRING,
                price=Decimal("25.00"),
                currency="USD",
                setup_fee=None,
                is_quantity_based=False,
                min_quantity=1,
                max_quantity=None,
                metered_unit=None,
                included_quantity=None,
                is_active=True,
                is_featured=True,
                compatible_with_all_plans=True,
                icon="icon",
                features=[],
            ),
        )

        with patch.object(addon_service, "get_tenant_addon", return_value=tenant_addon):
            with pytest.raises(ValueError, match="already canceled or ended"):
                await addon_service.cancel_addon(
                    tenant_addon_id="taddon_123",
                    tenant_id="test_tenant",
                    cancel_immediately=False,
                    reason="Testing",
                    canceled_by_user_id="user_123",
                )


@pytest.mark.unit
class TestReactivateAddon:
    """Test suite for reactivate_addon method."""

    @pytest.mark.asyncio
    async def test_reactivate_addon_success(self, addon_service, mock_db_session):
        """Test successful add-on reactivation."""
        # Mock get_tenant_addon
        tenant_addon = TenantAddonResponse(
            tenant_addon_id="taddon_123",
            tenant_id="test_tenant",
            addon_id="addon_test_123",
            subscription_id=None,
            status=AddonStatus.CANCELED,
            quantity=1,
            started_at=datetime.now(UTC),
            current_period_start=None,
            current_period_end=datetime.now(UTC) + timedelta(days=30),
            canceled_at=datetime.now(UTC),
            ended_at=datetime.now(UTC) + timedelta(days=30),
            current_usage=0,
            addon=AddonResponse(
                addon_id="addon_test_123",
                name="Test",
                description="Test",
                addon_type=AddonType.FEATURE,
                billing_type=AddonBillingType.RECURRING,
                price=Decimal("25.00"),
                currency="USD",
                setup_fee=None,
                is_quantity_based=False,
                min_quantity=1,
                max_quantity=None,
                metered_unit=None,
                included_quantity=None,
                is_active=True,
                is_featured=True,
                compatible_with_all_plans=True,
                icon="icon",
                features=[],
            ),
        )

        with patch.object(addon_service, "get_tenant_addon", return_value=tenant_addon):
            # Mock database query for fetching metadata
            mock_tenant_addon_row = MagicMock()
            mock_tenant_addon_row.metadata_json = {}

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_tenant_addon_row
            mock_db_session.execute.return_value = mock_result

            # Execute
            await addon_service.reactivate_addon(
                tenant_addon_id="taddon_123",
                tenant_id="test_tenant",
                reactivated_by_user_id="user_123",
            )

            # Assert
            mock_db_session.execute.assert_called()
            mock_db_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_reactivate_addon_not_canceled(self, addon_service):
        """Test reactivating non-canceled add-on."""
        tenant_addon = TenantAddonResponse(
            tenant_addon_id="taddon_123",
            tenant_id="test_tenant",
            addon_id="addon_test_123",
            subscription_id=None,
            status=AddonStatus.ACTIVE,
            quantity=1,
            started_at=datetime.now(UTC),
            current_period_start=None,
            current_period_end=None,
            canceled_at=None,
            ended_at=None,
            current_usage=0,
            addon=AddonResponse(
                addon_id="addon_test_123",
                name="Test",
                description="Test",
                addon_type=AddonType.FEATURE,
                billing_type=AddonBillingType.RECURRING,
                price=Decimal("25.00"),
                currency="USD",
                setup_fee=None,
                is_quantity_based=False,
                min_quantity=1,
                max_quantity=None,
                metered_unit=None,
                included_quantity=None,
                is_active=True,
                is_featured=True,
                compatible_with_all_plans=True,
                icon="icon",
                features=[],
            ),
        )

        with patch.object(addon_service, "get_tenant_addon", return_value=tenant_addon):
            with pytest.raises(ValueError, match="Only canceled add-ons can be reactivated"):
                await addon_service.reactivate_addon(
                    tenant_addon_id="taddon_123",
                    tenant_id="test_tenant",
                    reactivated_by_user_id="user_123",
                )
