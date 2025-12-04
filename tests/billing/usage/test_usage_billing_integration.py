"""
Integration tests for usage billing workflows.

Tests complete lifecycle: RADIUS accounting → usage aggregation → invoice generation
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.usage.models import BilledStatus, UsageType
from dotmac.platform.billing.usage.schemas import UsageRecordCreate, UsageReportRequest
from dotmac.platform.billing.usage.service import UsageBillingService
from dotmac.platform.core.exceptions import EntityNotFoundError, ValidationError
from dotmac.platform.customer_management.models import (
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)


@pytest.fixture
def test_tenant_id() -> str:
    """Generate a unique tenant identifier for the test."""
    return f"tenant-{uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def db_session(async_db_session: AsyncSession):
    """Provide a writable async session for the usage billing tests."""
    yield async_db_session


@pytest_asyncio.fixture
async def usage_service(db_session: AsyncSession) -> UsageBillingService:
    """Create UsageBillingService instance backed by the shared session."""
    return UsageBillingService(db_session)


@pytest_asyncio.fixture
async def test_customer(db_session: AsyncSession, test_tenant_id: str) -> Customer:
    """Create test customer for usage billing tests."""
    customer = Customer(
        tenant_id=test_tenant_id,
        customer_number=f"CUST-{uuid4().hex[:8]}",
        first_name="Test",
        last_name="Customer",
        email=f"test.customer.{uuid4().hex[:6]}@example.com",
        status=CustomerStatus.ACTIVE,
        customer_type=CustomerType.INDIVIDUAL,
        tier=CustomerTier.BASIC,
    )
    db_session.add(customer)
    await db_session.flush()  # Flush instead of commit to stay in same transaction
    await db_session.refresh(customer)
    return customer


@pytest.fixture
def test_usage_record_data(test_customer: Customer):
    """Create reusable usage record payload for tests."""
    now = datetime.now(UTC)
    return UsageRecordCreate(
        subscription_id="sub_test_usage_001",
        customer_id=test_customer.id,
        usage_type=UsageType.DATA_TRANSFER,
        quantity=Decimal("15.5"),
        unit="GB",
        unit_price=Decimal("0.10"),
        period_start=now - timedelta(hours=1),
        period_end=now,
        source_system="radius",
        description="Test usage record",
    )


@pytest.mark.integration
class TestUsageRecordManagement:
    """Test usage record CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_usage_record_success(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_usage_record_data: UsageRecordCreate,
        db_session: AsyncSession,
    ):
        """Test successful usage record creation."""
        # Create usage record
        record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=test_usage_record_data,
        )
        await db_session.commit()

        # Verify record created
        assert record.id is not None
        assert record.tenant_id == test_tenant_id
        assert record.subscription_id == "sub_test_usage_001"
        assert record.usage_type == UsageType.DATA_TRANSFER
        assert record.quantity == Decimal("15.5")
        assert record.unit == "GB"
        assert record.unit_price == Decimal("0.10")
        assert record.total_amount == 155  # 15.5 * 0.10 * 100 cents = 155 cents ($1.55)
        assert record.currency == "USD"
        assert record.billed_status == BilledStatus.PENDING
        assert record.source_system == "radius"
        assert record.invoice_id is None

    @pytest.mark.asyncio
    async def test_create_usage_record_validation(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
    ):
        """Test usage record validation."""
        # Create invalid record (negative quantity)
        invalid_data = UsageRecordCreate(
            subscription_id="sub_test",
            customer_id=test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("-10.0"),  # Negative quantity should fail
            unit="GB",
            unit_price=Decimal("0.10"),
            period_start=datetime.now(UTC) - timedelta(hours=1),
            period_end=datetime.now(UTC),
            source_system="test",
        )

        with pytest.raises(ValidationError, match="quantity must be positive"):
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=invalid_data,
            )

    @pytest.mark.asyncio
    async def test_get_usage_record_success(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_usage_record_data: UsageRecordCreate,
        db_session: AsyncSession,
    ):
        """Test retrieving usage record by ID."""
        # Create record
        created = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=test_usage_record_data,
        )
        await db_session.commit()

        # Retrieve record
        retrieved = await usage_service.get_usage_record(
            record_id=created.id,
            tenant_id=test_tenant_id,
        )

        assert retrieved.id == created.id
        assert retrieved.quantity == created.quantity
        assert retrieved.total_amount == created.total_amount

    @pytest.mark.asyncio
    async def test_get_usage_record_not_found(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
    ):
        """Test retrieving non-existent usage record."""
        fake_id = uuid4()

        with pytest.raises(EntityNotFoundError):
            await usage_service.get_usage_record(
                record_id=fake_id,
                tenant_id=test_tenant_id,
            )

    @pytest.mark.asyncio
    async def test_list_usage_records_by_subscription(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test listing usage records filtered by subscription."""
        subscription_id = "sub_filter_test"

        # Create multiple usage records
        for i in range(3):
            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=UsageType.DATA_TRANSFER,
                quantity=Decimal(f"{i + 1}.0"),
                unit="GB",
                unit_price=Decimal("0.10"),
                period_start=datetime.now(UTC) - timedelta(hours=i + 1),
                period_end=datetime.now(UTC) - timedelta(hours=i),
                source_system="test",
            )
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
        await db_session.commit()

        # List records for subscription
        records = await usage_service.list_usage_records(
            tenant_id=test_tenant_id,
            subscription_id=subscription_id,
        )

        assert len(records) >= 3
        assert all(r.subscription_id == subscription_id for r in records)


@pytest.mark.integration
class TestUsageBillingWorkflow:
    """Test complete usage billing workflow."""

    @pytest.mark.asyncio
    async def test_radius_to_usage_record(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test converting RADIUS accounting to usage record."""
        # Simulate RADIUS accounting data
        radius_session = {
            "acctsessionid": "TEST-SESSION-001",
            "username": "test.user@alpha.com",
            "acctstarttime": datetime.now(UTC) - timedelta(hours=2),
            "acctstoptime": datetime.now(UTC),
            "acctinputoctets": 5368709120,  # 5 GB download
            "acctoutputoctets": 1073741824,  # 1 GB upload
            "acctsessiontime": 7200,  # 2 hours
        }

        # Convert to usage record
        usage_data = UsageRecordCreate(
            subscription_id="sub_radius_test",
            customer_id=test_customer.id,
            usage_type=UsageType.BANDWIDTH_GB,
            quantity=Decimal("6.0"),  # 5 GB + 1 GB = 6 GB total
            unit="GB",
            unit_price=Decimal("0.05"),  # $0.05 per GB
            period_start=radius_session["acctstarttime"],
            period_end=radius_session["acctstoptime"],
            source_system="radius",
            source_record_id=radius_session["acctsessionid"],
            description=f"Session usage for {radius_session['username']}",
        )

        record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=usage_data,
        )
        await db_session.commit()

        # Verify conversion
        assert record.usage_type == UsageType.BANDWIDTH_GB
        assert record.quantity == Decimal("6.0")
        assert record.total_amount == 30  # 6 * 0.05 * 100 = 30 cents
        assert record.source_system == "radius"
        assert record.source_record_id == "TEST-SESSION-001"

    @pytest.mark.asyncio
    async def test_mark_usage_as_billed(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_usage_record_data: UsageRecordCreate,
        db_session: AsyncSession,
    ):
        """Test marking usage record as billed."""
        # Create pending usage record
        record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=test_usage_record_data,
        )
        await db_session.commit()

        assert record.billed_status == BilledStatus.PENDING
        assert record.invoice_id is None

        # Mark as billed
        invoice_id = "in_test_12345"
        billed = await usage_service.mark_usage_as_billed(
            record_id=record.id,
            tenant_id=test_tenant_id,
            invoice_id=invoice_id,
        )
        await db_session.commit()

        # Verify billing status
        assert billed.billed_status == BilledStatus.BILLED
        assert billed.invoice_id == invoice_id
        assert billed.billed_at is not None

    @pytest.mark.asyncio
    async def test_bulk_mark_usage_as_billed(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test bulk marking multiple usage records as billed."""
        subscription_id = "sub_bulk_billing"

        # Create multiple pending usage records
        record_ids = []
        for i in range(5):
            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=UsageType.DATA_TRANSFER,
                quantity=Decimal(f"{i + 1}.0"),
                unit="GB",
                unit_price=Decimal("0.10"),
                period_start=datetime.now(UTC) - timedelta(days=i + 1),
                period_end=datetime.now(UTC) - timedelta(days=i),
                source_system="test",
            )
            record = await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
            record_ids.append(record.id)
        await db_session.commit()

        # Bulk mark as billed
        invoice_id = "in_bulk_test"
        results = await usage_service.bulk_mark_as_billed(
            record_ids=record_ids,
            tenant_id=test_tenant_id,
            invoice_id=invoice_id,
        )
        await db_session.commit()

        # Verify all marked as billed
        assert len(results) == 5
        assert all(r.billed_status == BilledStatus.BILLED for r in results)
        assert all(r.invoice_id == invoice_id for r in results)

    @pytest.mark.asyncio
    async def test_get_pending_usage_for_billing(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test retrieving pending usage records for billing cycle."""
        subscription_id = "sub_pending_test"

        # Create mix of pending and billed records
        for i in range(3):
            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=UsageType.DATA_TRANSFER,
                quantity=Decimal("10.0"),
                unit="GB",
                unit_price=Decimal("0.10"),
                period_start=datetime.now(UTC) - timedelta(days=i + 1),
                period_end=datetime.now(UTC) - timedelta(days=i),
                source_system="test",
            )
            record = await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )

            # Mark first record as already billed
            if i == 0:
                await usage_service.mark_usage_as_billed(
                    record_id=record.id,
                    tenant_id=test_tenant_id,
                    invoice_id="in_previous",
                )
        await db_session.commit()

        # Get pending usage
        pending = await usage_service.get_pending_usage(
            tenant_id=test_tenant_id,
            subscription_id=subscription_id,
        )

        # Should return only the 2 pending records
        assert len(pending) == 2
        assert all(r.billed_status == BilledStatus.PENDING for r in pending)


@pytest.mark.integration
class TestUsageAggregation:
    """Test usage aggregation for reporting."""

    @pytest.mark.asyncio
    async def test_aggregate_daily_usage(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test daily usage aggregation."""
        subscription_id = "sub_aggregate_test"
        target_date = datetime.now(UTC).date()

        # Create multiple hourly usage records for the same day
        total_expected = Decimal("0")
        for hour in range(5):
            quantity = Decimal(f"{hour + 1}.0")  # 1, 2, 3, 4, 5 GB
            total_expected += quantity

            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=UsageType.DATA_TRANSFER,
                quantity=quantity,
                unit="GB",
                unit_price=Decimal("0.10"),
                period_start=datetime.combine(target_date, datetime.min.time())
                + timedelta(hours=hour),
                period_end=datetime.combine(target_date, datetime.min.time())
                + timedelta(hours=hour + 1),
                source_system="test",
            )
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
        await db_session.commit()

        # Aggregate daily usage
        aggregate = await usage_service.aggregate_usage(
            tenant_id=test_tenant_id,
            subscription_id=subscription_id,
            period_type="daily",
            period_start=datetime.combine(target_date, datetime.min.time()),
            period_end=datetime.combine(target_date, datetime.max.time()),
        )
        await db_session.commit()

        # Verify aggregation
        assert aggregate is not None
        assert aggregate.usage_type == UsageType.DATA_TRANSFER
        assert aggregate.period_type == "daily"
        assert aggregate.total_quantity == total_expected  # 1+2+3+4+5 = 15 GB
        assert aggregate.record_count == 5
        assert aggregate.total_amount == 150  # 15 * 0.10 * 100 = 150 cents

    @pytest.mark.asyncio
    async def test_aggregate_monthly_usage(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test monthly usage aggregation."""
        subscription_id = "sub_monthly_test"
        now = datetime.now(UTC)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Create daily usage records for the month
        for day in range(5):
            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=UsageType.BANDWIDTH_GB,
                quantity=Decimal("100.0"),  # 100 GB per day
                unit="GB",
                unit_price=Decimal("0.02"),
                period_start=month_start + timedelta(days=day),
                period_end=month_start + timedelta(days=day + 1),
                source_system="test",
            )
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
        await db_session.commit()

        # Aggregate monthly usage
        aggregate = await usage_service.aggregate_usage(
            tenant_id=test_tenant_id,
            subscription_id=subscription_id,
            period_type="monthly",
            period_start=month_start,
            period_end=month_start + timedelta(days=30),
        )
        await db_session.commit()

        # Verify aggregation
        assert aggregate.total_quantity == Decimal("500.0")  # 100 * 5 days
        assert aggregate.total_amount == 1000  # 500 * 0.02 * 100 = 1000 cents ($10.00)
        assert aggregate.record_count == 5


@pytest.mark.integration
class TestUsageReporting:
    """Test usage reporting and analytics."""

    @pytest.mark.asyncio
    async def test_generate_usage_report(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test generating usage report for period."""
        subscription_id = "sub_report_test"

        # Create usage records across different types
        usage_types = [
            (UsageType.DATA_TRANSFER, Decimal("50.0"), "GB"),
            (UsageType.VOICE_MINUTES, Decimal("120.0"), "minutes"),
            (UsageType.SMS_COUNT, Decimal("25.0"), "count"),
        ]

        for usage_type, quantity, unit in usage_types:
            data = UsageRecordCreate(
                subscription_id=subscription_id,
                customer_id=test_customer.id,
                usage_type=usage_type,
                quantity=quantity,
                unit=unit,
                unit_price=Decimal("0.10"),
                period_start=datetime.now(UTC) - timedelta(days=1),
                period_end=datetime.now(UTC),
                source_system="test",
            )
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
        await db_session.commit()

        # Generate report
        report_request = UsageReportRequest(
            subscription_id=subscription_id,
            period_start=datetime.now(UTC) - timedelta(days=7),
            period_end=datetime.now(UTC),
        )

        report = await usage_service.generate_usage_report(
            tenant_id=test_tenant_id,
            request=report_request,
        )

        # Verify report
        assert report is not None
        assert report.subscription_id == subscription_id
        assert len(report.usage_by_type) == 3
        assert UsageType.DATA_TRANSFER in report.usage_by_type
        assert UsageType.VOICE_MINUTES in report.usage_by_type
        assert UsageType.SMS_COUNT in report.usage_by_type
        assert report.total_amount > 0

    @pytest.mark.asyncio
    async def test_get_usage_summary(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test getting usage summary for customer."""
        # Create usage records
        for i in range(3):
            data = UsageRecordCreate(
                subscription_id=f"sub_{i}",
                customer_id=test_customer.id,
                usage_type=UsageType.DATA_TRANSFER,
                quantity=Decimal("10.0"),
                unit="GB",
                unit_price=Decimal("0.10"),
                period_start=datetime.now(UTC) - timedelta(days=1),
                period_end=datetime.now(UTC),
                source_system="test",
            )
            await usage_service.create_usage_record(
                tenant_id=test_tenant_id,
                data=data,
            )
        await db_session.commit()

        # Get summary
        summary = await usage_service.get_usage_summary(
            tenant_id=test_tenant_id,
            customer_id=test_customer.id,
        )

        # Verify summary
        assert summary.total_records >= 3
        assert summary.total_amount >= 300  # 3 * 10 * 0.10 * 100 = 300 cents
        assert summary.pending_amount > 0  # Should have pending records


@pytest.mark.integration
class TestOverageCharges:
    """Test overage charge calculations."""

    @pytest.mark.asyncio
    async def test_calculate_overage_charges(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test calculating overage charges beyond plan limits."""
        subscription_id = "sub_overage_test"
        plan_limit = Decimal("100.0")  # 100 GB included

        # Create usage record exceeding limit
        total_usage = Decimal("125.0")  # 25 GB overage
        data = UsageRecordCreate(
            subscription_id=subscription_id,
            customer_id=test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=total_usage,
            unit="GB",
            unit_price=Decimal("0.05"),  # Base rate
            period_start=datetime.now(UTC) - timedelta(days=1),
            period_end=datetime.now(UTC),
            source_system="test",
        )
        await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=data,
        )
        await db_session.commit()

        # Calculate overage
        overage_quantity = total_usage - plan_limit  # 25 GB overage
        overage_rate = Decimal("0.15")  # Higher rate for overage

        overage_data = UsageRecordCreate(
            subscription_id=subscription_id,
            customer_id=test_customer.id,
            usage_type=UsageType.OVERAGE_GB,
            quantity=overage_quantity,
            unit="GB",
            unit_price=overage_rate,
            period_start=data.period_start,
            period_end=data.period_end,
            source_system="overage_calculator",
            description=f"Overage charges ({overage_quantity} GB @ ${overage_rate}/GB)",
        )
        overage_record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=overage_data,
        )
        await db_session.commit()

        # Verify overage record
        assert overage_record.usage_type == UsageType.OVERAGE_GB
        assert overage_record.quantity == Decimal("25.0")
        assert overage_record.unit_price == Decimal("0.15")
        assert overage_record.total_amount == 375  # 25 * 0.15 * 100 = 375 cents ($3.75)


@pytest.mark.integration
class TestUsageEdgeCases:
    """Test edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_zero_quantity_usage(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test handling zero quantity usage (e.g., no usage during period)."""
        data = UsageRecordCreate(
            subscription_id="sub_zero_test",
            customer_id=test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("0.0"),  # Zero usage
            unit="GB",
            unit_price=Decimal("0.10"),
            period_start=datetime.now(UTC) - timedelta(hours=1),
            period_end=datetime.now(UTC),
            source_system="test",
        )

        record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=data,
        )
        await db_session.commit()

        # Verify zero usage recorded
        assert record.quantity == Decimal("0.0")
        assert record.total_amount == 0

    @pytest.mark.asyncio
    async def test_high_precision_usage(
        self,
        usage_service: UsageBillingService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test handling high-precision decimal usage."""
        data = UsageRecordCreate(
            subscription_id="sub_precision_test",
            customer_id=test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("10.123456"),  # 6 decimal places
            unit="GB",
            unit_price=Decimal("0.123456"),
            period_start=datetime.now(UTC) - timedelta(hours=1),
            period_end=datetime.now(UTC),
            source_system="test",
        )

        record = await usage_service.create_usage_record(
            tenant_id=test_tenant_id,
            data=data,
        )
        await db_session.commit()

        # Verify precision maintained
        assert record.quantity == Decimal("10.123456")
        assert record.unit_price == Decimal("0.123456")
        # total_amount = 10.123456 * 0.123456 * 100 = 124.99... ≈ 125 cents
        assert record.total_amount == 125
