"""
Advanced tests for customer management service to reach 90% coverage.

Tests batch processing, segments, metrics, and filtering methods.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import (
    Customer,
    CustomerSegment,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.customer_management.schemas import (
    CustomerSegmentCreate,
)
from dotmac.platform.customer_management.service import CustomerService


@pytest.fixture
def mock_db_session():
    """Create mock async database session."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def service(mock_db_session):
    """Create customer service with mock session."""
    return CustomerService(mock_db_session)


@pytest.mark.unit
class TestBatchProcessing:
    """Test batch processing methods."""

    @pytest.mark.asyncio
    async def test_batch_process_customers_archive(self, service, mock_db_session):
        """Test batch archiving customers."""
        customer_ids = [str(uuid4()), str(uuid4()), str(uuid4())]

        # Mock execute and commit
        mock_db_session.execute = AsyncMock()
        mock_db_session.commit = AsyncMock()

        results = await service.batch_process_customers(
            customer_ids=customer_ids, operation="archive", batch_size=2
        )

        assert "success" in results
        assert "failed" in results
        assert len(results["success"]) == 3
        assert len(results["failed"]) == 0

    @pytest.mark.asyncio
    async def test_batch_process_customers_activate(self, service, mock_db_session):
        """Test batch activating customers."""
        customer_ids = [str(uuid4()), str(uuid4())]

        mock_db_session.execute = AsyncMock()
        mock_db_session.commit = AsyncMock()

        results = await service.batch_process_customers(
            customer_ids=customer_ids, operation="activate", batch_size=10
        )

        assert "success" in results
        assert len(results["success"]) == 2

    @pytest.mark.asyncio
    async def test_batch_process_invalid_operation(self, service, mock_db_session):
        """Test batch processing with invalid operation."""
        customer_ids = [str(uuid4())]

        mock_db_session.execute = AsyncMock()
        mock_db_session.commit = AsyncMock()

        results = await service.batch_process_customers(
            customer_ids=customer_ids, operation="invalid_op", batch_size=10
        )

        # Should fail due to invalid operation
        assert len(results["failed"]) > 0

    @pytest.mark.asyncio
    async def test_batch_process_with_errors(self, service, mock_db_session):
        """Test batch processing with errors."""
        customer_ids = [str(uuid4()), "invalid-uuid", str(uuid4())]

        mock_db_session.execute = AsyncMock()
        mock_db_session.commit = AsyncMock()

        results = await service.batch_process_customers(
            customer_ids=customer_ids, operation="archive", batch_size=10
        )

        # Some should fail due to invalid UUID
        assert len(results["failed"]) > 0


@pytest.mark.unit
class TestCustomerFiltering:
    """Test customer filtering and sorting methods."""

    def test_get_customers_by_criteria_status(self, service):
        """Test filtering customers by status."""
        customers = [
            Customer(id=uuid4(), status=CustomerStatus.ACTIVE, tier=CustomerTier.STANDARD),
            Customer(id=uuid4(), status=CustomerStatus.INACTIVE, tier=CustomerTier.STANDARD),
            Customer(id=uuid4(), status=CustomerStatus.ACTIVE, tier=CustomerTier.PREMIUM),
        ]

        filtered = service.get_customers_by_criteria(customers, status=CustomerStatus.ACTIVE)

        assert len(filtered) == 2
        assert all(c.status == CustomerStatus.ACTIVE for c in filtered)

    def test_get_customers_by_criteria_tier(self, service):
        """Test filtering customers by tier."""
        customers = [
            Customer(id=uuid4(), status=CustomerStatus.ACTIVE, tier=CustomerTier.STANDARD),
            Customer(id=uuid4(), status=CustomerStatus.ACTIVE, tier=CustomerTier.PREMIUM),
            Customer(id=uuid4(), status=CustomerStatus.ACTIVE, tier=CustomerTier.PREMIUM),
        ]

        filtered = service.get_customers_by_criteria(customers, tier=CustomerTier.PREMIUM)

        assert len(filtered) == 2
        assert all(c.tier == CustomerTier.PREMIUM for c in filtered)

    def test_get_customers_by_criteria_min_lifetime_value(self, service):
        """Test filtering customers by minimum lifetime value."""
        customers = [
            Customer(id=uuid4(), lifetime_value=Decimal("100.00")),
            Customer(id=uuid4(), lifetime_value=Decimal("500.00")),
            Customer(id=uuid4(), lifetime_value=Decimal("1000.00")),
            Customer(id=uuid4(), lifetime_value=None),
        ]

        filtered = service.get_customers_by_criteria(
            customers, min_lifetime_value=Decimal("300.00")
        )

        assert len(filtered) == 2
        assert all(c.lifetime_value >= Decimal("300.00") for c in filtered if c.lifetime_value)

    def test_get_customers_by_criteria_multiple(self, service):
        """Test filtering customers by multiple criteria."""
        customers = [
            Customer(
                id=uuid4(),
                status=CustomerStatus.ACTIVE,
                tier=CustomerTier.PREMIUM,
                lifetime_value=Decimal("1000.00"),
            ),
            Customer(
                id=uuid4(),
                status=CustomerStatus.ACTIVE,
                tier=CustomerTier.STANDARD,
                lifetime_value=Decimal("200.00"),
            ),
            Customer(
                id=uuid4(),
                status=CustomerStatus.INACTIVE,
                tier=CustomerTier.PREMIUM,
                lifetime_value=Decimal("1500.00"),
            ),
        ]

        filtered = service.get_customers_by_criteria(
            customers,
            status=CustomerStatus.ACTIVE,
            tier=CustomerTier.PREMIUM,
            min_lifetime_value=Decimal("500.00"),
        )

        assert len(filtered) == 1
        assert filtered[0].status == CustomerStatus.ACTIVE
        assert filtered[0].tier == CustomerTier.PREMIUM

    def test_sort_customers_by_created_at(self, service):
        """Test sorting customers by created_at."""
        now = datetime.now(UTC)
        customers = [
            Customer(id=uuid4(), created_at=now - timedelta(days=1)),
            Customer(id=uuid4(), created_at=now - timedelta(days=5)),
            Customer(id=uuid4(), created_at=now),
        ]

        sorted_customers = service.sort_customers(customers, sort_by="created_at", reverse=True)

        assert sorted_customers[0].created_at > sorted_customers[1].created_at
        assert sorted_customers[1].created_at > sorted_customers[2].created_at

    def test_sort_customers_by_lifetime_value(self, service):
        """Test sorting customers by lifetime value."""
        customers = [
            Customer(id=uuid4(), lifetime_value=Decimal("500.00")),
            Customer(id=uuid4(), lifetime_value=Decimal("100.00")),
            Customer(id=uuid4(), lifetime_value=Decimal("1000.00")),
        ]

        sorted_customers = service.sort_customers(customers, sort_by="lifetime_value", reverse=True)

        assert sorted_customers[0].lifetime_value == Decimal("1000.00")
        assert sorted_customers[2].lifetime_value == Decimal("100.00")

    def test_sort_customers_by_email(self, service):
        """Test sorting customers by email."""
        customers = [
            Customer(id=uuid4(), email="charlie@example.com"),
            Customer(id=uuid4(), email="alice@example.com"),
            Customer(id=uuid4(), email="bob@example.com"),
        ]

        sorted_customers = service.sort_customers(customers, sort_by="email", reverse=False)

        assert sorted_customers[0].email == "alice@example.com"
        assert sorted_customers[2].email == "charlie@example.com"

    def test_sort_customers_invalid_key(self, service):
        """Test sorting with invalid key falls back to created_at."""
        now = datetime.now(UTC)
        customers = [
            Customer(id=uuid4(), created_at=now - timedelta(days=1)),
            Customer(id=uuid4(), created_at=now),
        ]

        sorted_customers = service.sort_customers(customers, sort_by="invalid_key", reverse=True)

        # Should fallback to created_at
        assert sorted_customers[0].created_at > sorted_customers[1].created_at


@pytest.mark.unit
class TestUpdateMetrics:
    """Test update_metrics wrapper method."""

    @pytest.mark.asyncio
    async def test_update_metrics_with_purchase(self, service, mock_db_session):
        """Test update_metrics calls record_purchase."""
        customer_id = uuid4()

        with patch.object(service, "record_purchase", new=AsyncMock()) as mock_record:
            await service.update_metrics(customer_id=customer_id, purchase_amount=100.50)

            mock_record.assert_called_once()
            call_kwargs = mock_record.call_args.kwargs
            assert call_kwargs["customer_id"] == customer_id
            assert call_kwargs["amount"] == Decimal("100.50")

    @pytest.mark.asyncio
    async def test_update_metrics_without_purchase(self, service):
        """Test update_metrics without purchase amount does nothing."""
        customer_id = uuid4()

        with patch.object(service, "record_purchase", new=AsyncMock()) as mock_record:
            await service.update_metrics(customer_id=customer_id)

            mock_record.assert_not_called()


@pytest.mark.unit
class TestSegmentManagement:
    """Test customer segment management."""

    @pytest.mark.asyncio
    async def test_create_segment_static(self, service, mock_db_session):
        """Test creating a static segment."""
        segment_data = CustomerSegmentCreate(
            name="VIP Customers", description="High-value customers", criteria={}, is_dynamic=False
        )

        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        segment = await service.create_segment(segment_data)

        assert segment.name == "VIP Customers"
        assert segment.is_dynamic is False
        assert segment.member_count == 0
        mock_db_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_segment_dynamic(self, service, mock_db_session):
        """Test creating a dynamic segment."""
        segment_data = CustomerSegmentCreate(
            name="Active Premium",
            description="Active premium tier customers",
            criteria={"status": "active", "tier": "premium"},
            is_dynamic=True,
        )

        # Mock _calculate_segment_members
        with patch.object(service, "_calculate_segment_members", return_value=50):
            mock_db_session.add = MagicMock()
            mock_db_session.commit = AsyncMock()
            mock_db_session.refresh = AsyncMock()

            segment = await service.create_segment(segment_data)

            assert segment.name == "Active Premium"
            assert segment.is_dynamic is True
            assert segment.member_count == 50
            assert segment.last_calculated is not None

    @pytest.mark.asyncio
    async def test_recalculate_segment_dynamic(self, service, mock_db_session):
        """Test recalculating a dynamic segment."""
        segment_id = uuid4()
        tenant_id = service._resolve_tenant_id()

        # Create mock segment
        mock_segment = CustomerSegment(
            id=segment_id,
            tenant_id=tenant_id,
            name="Test Segment",
            criteria={"status": "active"},
            is_dynamic=True,
            member_count=10,
        )

        # Mock database query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_segment
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock()

        # Mock _calculate_segment_members
        with patch.object(service, "_calculate_segment_members", return_value=25):
            member_count = await service.recalculate_segment(segment_id)

            assert member_count == 25
            assert mock_segment.member_count == 25
            assert mock_segment.last_calculated is not None

    @pytest.mark.asyncio
    async def test_recalculate_segment_static(self, service, mock_db_session):
        """Test recalculating a static segment returns existing count."""
        segment_id = uuid4()
        tenant_id = service._resolve_tenant_id()

        # Create mock static segment
        mock_segment = CustomerSegment(
            id=segment_id,
            tenant_id=tenant_id,
            name="Static Segment",
            criteria={},
            is_dynamic=False,
            member_count=15,
        )

        # Mock database query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_segment
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        member_count = await service.recalculate_segment(segment_id)

        # Should return existing count without recalculation
        assert member_count == 15

    @pytest.mark.asyncio
    async def test_recalculate_segment_not_found(self, service, mock_db_session):
        """Test recalculating non-existent segment raises error."""
        segment_id = uuid4()

        # Mock database query returning None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="not found"):
            await service.recalculate_segment(segment_id)


@pytest.mark.unit
class TestCustomerMetrics:
    """Test customer metrics aggregation."""

    @pytest.mark.asyncio
    async def test_get_customer_metrics_basic(self, service, mock_db_session):
        """Test getting basic customer metrics."""
        # Mock total customers
        total_result = MagicMock()
        total_result.scalar.return_value = 100

        # Mock active customers
        active_result = MagicMock()
        active_result.scalar.return_value = 85

        # Mock revenue metrics
        revenue_result = MagicMock()
        revenue_result.one.return_value = (Decimal("50000.00"), Decimal("588.24"))

        # Mock status breakdown
        status_result = MagicMock()
        status_result.__iter__ = lambda self: iter(
            [
                (CustomerStatus.ACTIVE, 85),
                (CustomerStatus.INACTIVE, 10),
                (CustomerStatus.ARCHIVED, 5),
            ]
        )

        # Mock tier breakdown
        tier_result = MagicMock()
        tier_result.__iter__ = lambda self: iter(
            [(CustomerTier.STANDARD, 60), (CustomerTier.PREMIUM, 30), (CustomerTier.ENTERPRISE, 10)]
        )

        # Mock type breakdown
        type_result = MagicMock()
        type_result.__iter__ = lambda self: iter(
            [(CustomerType.INDIVIDUAL, 70), (CustomerType.BUSINESS, 30)]
        )

        # Mock new customers this month
        new_customers_result = MagicMock()
        new_customers_result.scalar.return_value = 15

        # Mock segments
        segments_result = MagicMock()
        mock_segment = CustomerSegment(
            id=uuid4(),
            tenant_id=service._resolve_tenant_id(),
            name="VIP",
            member_count=20,
            is_dynamic=True,
            criteria={},
        )
        segments_result.scalars.return_value.all.return_value = [mock_segment]

        # Setup execute to return different results based on query
        call_count = [0]

        def execute_side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return total_result
            elif call_count[0] == 2:
                return active_result
            elif call_count[0] == 3:
                return revenue_result
            elif call_count[0] == 4:
                return status_result
            elif call_count[0] == 5:
                return tier_result
            elif call_count[0] == 6:
                return type_result
            elif call_count[0] == 7:
                return new_customers_result
            else:
                return segments_result

        mock_db_session.execute = AsyncMock(side_effect=execute_side_effect)

        metrics = await service.get_customer_metrics()

        assert metrics["total_customers"] == 100
        assert metrics["active_customers"] == 85
        assert metrics["new_customers_this_month"] == 15
        assert metrics["churn_rate"] == 15.0  # (100-85)/100 * 100
        assert metrics["total_revenue"] == 50000.00
        assert metrics["average_lifetime_value"] == 588.24
        assert "customers_by_status" in metrics
        assert "customers_by_tier" in metrics
        assert "customers_by_type" in metrics
        assert "top_segments" in metrics

    @pytest.mark.asyncio
    async def test_get_customer_metrics_empty(self, service, mock_db_session):
        """Test metrics with no customers."""
        # Mock empty results
        empty_result = MagicMock()
        empty_result.scalar.return_value = 0

        revenue_result = MagicMock()
        revenue_result.one.return_value = (None, None)

        empty_iter = MagicMock()
        empty_iter.__iter__ = lambda self: iter([])

        segments_result = MagicMock()
        segments_result.scalars.return_value.all.return_value = []

        call_count = [0]

        def execute_side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] <= 2:
                return empty_result
            elif call_count[0] == 3:
                return revenue_result
            elif call_count[0] <= 7:
                return empty_iter
            else:
                return segments_result

        mock_db_session.execute = AsyncMock(side_effect=execute_side_effect)

        metrics = await service.get_customer_metrics()

        assert metrics["total_customers"] == 0
        assert metrics["active_customers"] == 0
        assert metrics["churn_rate"] == 0.0
        assert metrics["total_revenue"] == 0.0
        assert metrics["average_lifetime_value"] == 0.0


@pytest.mark.unit
class TestCalculateSegmentMembers:
    """Test segment member calculation."""

    @pytest.mark.asyncio
    async def test_calculate_segment_members_by_status(self, service, mock_db_session):
        """Test calculating segment members by status."""
        criteria = {"status": "active"}
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = 50
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 50

    @pytest.mark.asyncio
    async def test_calculate_segment_members_by_tier(self, service, mock_db_session):
        """Test calculating segment members by tier."""
        criteria = {"tier": "premium"}
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = 25
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 25

    @pytest.mark.asyncio
    async def test_calculate_segment_members_by_lifetime_value(self, service, mock_db_session):
        """Test calculating segment members by lifetime value."""
        criteria = {"min_lifetime_value": 1000, "max_lifetime_value": 5000}
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = 15
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 15

    @pytest.mark.asyncio
    async def test_calculate_segment_members_by_date_range(self, service, mock_db_session):
        """Test calculating segment members by date range."""
        criteria = {"created_after": "2024-01-01", "created_before": "2024-12-31"}
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = 40
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 40

    @pytest.mark.asyncio
    async def test_calculate_segment_members_complex(self, service, mock_db_session):
        """Test calculating segment members with complex criteria."""
        criteria = {
            "status": "active",
            "tier": "premium",
            "min_lifetime_value": 5000,
            "created_after": "2024-01-01",
        }
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = 8
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 8

    @pytest.mark.asyncio
    async def test_calculate_segment_members_empty_result(self, service, mock_db_session):
        """Test calculating segment members with no matches."""
        criteria = {"status": "archived"}
        tenant_id = service._resolve_tenant_id()

        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        count = await service._calculate_segment_members(criteria, tenant_id)

        assert count == 0
