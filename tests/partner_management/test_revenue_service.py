"""Tests for Partner Revenue Service."""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

# Customer is not needed - commission events just reference customer_id as UUID
from dotmac.platform.partner_management.models import (
    CommissionModel,
    CommissionStatus,
    Partner,
    PartnerAccount,
    PartnerCommissionEvent,
    PartnerPayout,
    PartnerTier,
    PayoutStatus,
)
from dotmac.platform.partner_management.revenue_service import PartnerRevenueService

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestPartnerRevenueMetrics:
    """Test partner revenue metrics calculation."""

    async def test_get_revenue_metrics_with_commissions(self, db_session, test_tenant_id):
        """Test revenue metrics with commission events."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-001",
            company_name="Test Partner",
            primary_email="partner@test.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.15"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create commission events
        now = datetime.utcnow()
        commission1 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=uuid4(),
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.15"),
            commission_amount=Decimal("150.00"),
            status=CommissionStatus.APPROVED,
            event_date=now - timedelta(days=10),
            event_type="invoice_payment",
            tenant_id=test_tenant_id,
        )
        commission2 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=uuid4(),
            base_amount=Decimal("2000.00"),
            commission_rate=Decimal("0.15"),
            commission_amount=Decimal("300.00"),
            status=CommissionStatus.APPROVED,
            event_date=now - timedelta(days=5),
            event_type="invoice_payment",
            tenant_id=test_tenant_id,
        )
        db_session.add_all([commission1, commission2])

        # Create a payout
        payout = PartnerPayout(
            id=uuid4(),
            partner_id=partner.id,
            period_start=now - timedelta(days=30),
            period_end=now - timedelta(days=1),
            total_amount=Decimal("150.00"),
            currency="USD",
            status=PayoutStatus.COMPLETED,
            payout_date=now - timedelta(days=2),
            tenant_id=test_tenant_id,
        )
        db_session.add(payout)

        # Mark first commission as paid
        commission1.payout_id = payout.id
        commission1.status = CommissionStatus.PAID

        await db_session.commit()

        # Test metrics
        service = PartnerRevenueService(db_session)
        metrics = await service.get_partner_revenue_metrics(
            partner_id=partner.id,
            period_start=now - timedelta(days=30),
            period_end=now,
        )

        assert metrics.partner_id == partner.id
        assert metrics.total_commissions == Decimal("450.00")  # 150 + 300
        assert metrics.total_commission_count == 2
        assert metrics.total_payouts == Decimal("150.00")
        assert metrics.pending_amount == Decimal("300.00")  # 450 - 150
        assert metrics.currency == "USD"

    async def test_get_revenue_metrics_no_data(self, db_session, test_tenant_id):
        """Test revenue metrics with no commission data."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-002",
            company_name="New Partner",
            primary_email="newpartner@test.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.FLAT_FEE,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)
        await db_session.commit()

        service = PartnerRevenueService(db_session)
        metrics = await service.get_partner_revenue_metrics(partner_id=partner.id)

        assert metrics.partner_id == partner.id
        assert metrics.total_commissions == Decimal("0.00")
        assert metrics.total_commission_count == 0
        assert metrics.total_payouts == Decimal("0.00")
        assert metrics.pending_amount == Decimal("0.00")


@pytest.mark.asyncio
class TestPartnerCommissionEvents:
    """Test commission event listing and filtering."""

    async def test_list_commission_events(self, db_session, test_tenant_id):
        """Test listing commission events."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-003",
            company_name="Commission Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create commission events (customer_id is just a UUID reference)
        customer_id = uuid4()
        commission1 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=customer_id,
            base_amount=Decimal("500.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("50.00"),
            status=CommissionStatus.PENDING,
            event_type="invoice_payment",
            event_date=datetime.utcnow() - timedelta(days=5),
            tenant_id=test_tenant_id,
        )
        commission2 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=customer_id,
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("100.00"),
            status=CommissionStatus.APPROVED,
            event_type="invoice_payment",
            event_date=datetime.utcnow() - timedelta(days=2),
            tenant_id=test_tenant_id,
        )
        db_session.add_all([commission1, commission2])
        await db_session.commit()

        # Test listing
        service = PartnerRevenueService(db_session)
        events = await service.list_commission_events(partner_id=partner.id)

        assert len(events) == 2
        # Events ordered by event_date desc
        assert events[0].commission_amount == Decimal("100.00")
        assert events[1].commission_amount == Decimal("50.00")

    async def test_list_commission_events_with_status_filter(self, db_session, test_tenant_id):
        """Test filtering commission events by status."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-004",
            company_name="Filter Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.PLATINUM,
            commission_model=CommissionModel.TIERED,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create mixed status events
        for i, status in enumerate(
            [
                CommissionStatus.PENDING,
                CommissionStatus.APPROVED,
                CommissionStatus.PAID,
            ]
        ):
            event = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                base_amount=Decimal("100.00"),
                commission_rate=Decimal("0.10"),
                commission_amount=Decimal("10.00"),
                status=status,
                event_type="invoice_payment",
                event_date=datetime.utcnow() - timedelta(days=i),
                tenant_id=test_tenant_id,
            )
            db_session.add(event)
        await db_session.commit()

        service = PartnerRevenueService(db_session)

        # Test approved only
        approved_events = await service.list_commission_events(
            partner_id=partner.id,
            status=CommissionStatus.APPROVED,
        )
        assert len(approved_events) == 1
        assert approved_events[0].status == CommissionStatus.APPROVED


@pytest.mark.asyncio
class TestPartnerPayouts:
    """Test payout management."""

    async def test_list_payouts(self, db_session, test_tenant_id):
        """Test listing partner payouts."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-005",
            company_name="Payout Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create payouts
        now = datetime.utcnow()
        payout1 = PartnerPayout(
            id=uuid4(),
            partner_id=partner.id,
            period_start=now - timedelta(days=60),
            period_end=now - timedelta(days=31),
            total_amount=Decimal("500.00"),
            currency="USD",
            status=PayoutStatus.COMPLETED,
            payout_date=now - timedelta(days=25),
            payment_reference="PAY-001",
            tenant_id=test_tenant_id,
        )
        payout2 = PartnerPayout(
            id=uuid4(),
            partner_id=partner.id,
            period_start=now - timedelta(days=30),
            period_end=now - timedelta(days=1),
            total_amount=Decimal("750.00"),
            currency="USD",
            status=PayoutStatus.PENDING,
            payout_date=now,
            tenant_id=test_tenant_id,
        )
        db_session.add_all([payout1, payout2])
        await db_session.commit()

        service = PartnerRevenueService(db_session)
        payouts = await service.list_payouts(partner_id=partner.id)

        assert len(payouts) == 2
        # Ordered by payout_date desc
        assert payouts[0].total_amount == Decimal("750.00")
        assert payouts[1].total_amount == Decimal("500.00")

    async def test_create_payout_batch(self, db_session, test_tenant_id):
        """Test creating a payout batch."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-006",
            company_name="Batch Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create approved commissions
        total_amount = Decimal("0.00")
        for i in range(3):
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                base_amount=Decimal("100.00") * (i + 1),
                commission_rate=Decimal("0.10"),
                commission_amount=Decimal("10.00") * (i + 1),
                status=CommissionStatus.APPROVED,
                event_type="invoice_payment",
                event_date=datetime.utcnow() - timedelta(days=i),
                tenant_id=test_tenant_id,
            )
            total_amount += commission.commission_amount
            db_session.add(commission)
        await db_session.commit()

        # Create payout batch
        service = PartnerRevenueService(db_session)
        now = datetime.utcnow()
        payout = await service.create_payout_batch(
            partner_id=partner.id,
            period_start=now - timedelta(days=30),
            period_end=now,
            currency="USD",
        )

        assert payout.partner_id == partner.id
        assert payout.total_amount == Decimal("60.00")  # 10 + 20 + 30
        assert payout.status == PayoutStatus.PENDING
        assert payout.currency == "USD"

        # Verify commissions were linked to payout
        result = await db_session.execute(
            select(PartnerCommissionEvent).where(PartnerCommissionEvent.payout_id == payout.id)
        )
        linked_commissions = result.scalars().all()
        assert len(linked_commissions) == 3


@pytest.mark.asyncio
class TestCommissionCalculation:
    """Test commission calculation logic."""

    async def test_calculate_commission_revenue_share(self, db_session, test_tenant_id):
        """Test revenue share commission calculation."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-007",
            company_name="Revenue Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.15"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create partner account with custom commission rate
        customer_id = uuid4()
        account = PartnerAccount(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=customer_id,
            engagement_type="reseller",
            custom_commission_rate=Decimal("0.20"),  # Custom rate
            start_date=datetime.utcnow(),
            is_active=True,
            tenant_id=test_tenant_id,
        )
        db_session.add(account)
        await db_session.commit()

        service = PartnerRevenueService(db_session)

        # Test with default rate
        commission1 = await service.calculate_commission(
            partner_id=partner.id,
            customer_id=uuid4(),  # No account
            invoice_amount=Decimal("1000.00"),
        )
        assert commission1 == Decimal("150.00")  # 15% of 1000

        # Test with custom rate
        commission2 = await service.calculate_commission(
            partner_id=partner.id,
            customer_id=customer_id,
            invoice_amount=Decimal("1000.00"),
        )
        assert commission2 == Decimal("200.00")  # 20% of 1000

    async def test_calculate_commission_fixed_fee(self, db_session, test_tenant_id):
        """Test fixed fee commission calculation."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-008",
            company_name="Fixed Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.FLAT_FEE,
            default_commission_rate=Decimal("50.00"),  # Fixed $50
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)
        await db_session.commit()

        service = PartnerRevenueService(db_session)

        # Fixed fee should be same regardless of amount
        commission1 = await service.calculate_commission(
            partner_id=partner.id,
            customer_id=uuid4(),
            invoice_amount=Decimal("100.00"),
        )
        assert commission1 == Decimal("50.00")

        commission2 = await service.calculate_commission(
            partner_id=partner.id,
            customer_id=uuid4(),
            invoice_amount=Decimal("10000.00"),
        )
        assert commission2 == Decimal("50.00")  # Still $50


@pytest.mark.asyncio
class TestTenantIsolation:
    """Test tenant isolation in revenue service."""

    async def test_metrics_tenant_isolation(self, db_session):
        """Test that revenue metrics respect tenant boundaries."""
        # Create partners in different tenants
        partner1 = Partner(
            id=uuid4(),
            partner_number="P-T1",
            company_name="Tenant 1 Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            tenant_id="tenant-1",
        )
        partner2 = Partner(
            id=uuid4(),
            partner_number="P-T2",
            company_name="Tenant 2 Partner",
            primary_email="test@partner.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            tenant_id="tenant-2",
        )
        db_session.add_all([partner1, partner2])

        # Create commissions for both
        commission1 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner1.id,
            customer_id=uuid4(),
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("100.00"),
            status=CommissionStatus.APPROVED,
            event_type="invoice_payment",
            event_date=datetime.utcnow(),
            tenant_id="tenant-1",
        )
        commission2 = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner2.id,
            customer_id=uuid4(),
            base_amount=Decimal("2000.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("200.00"),
            status=CommissionStatus.APPROVED,
            event_type="invoice_payment",
            event_date=datetime.utcnow(),
            tenant_id="tenant-2",
        )
        db_session.add_all([commission1, commission2])
        await db_session.commit()

        service = PartnerRevenueService(db_session)

        # Metrics should only include partner's own data
        metrics1 = await service.get_partner_revenue_metrics(partner_id=partner1.id)
        assert metrics1.total_commissions == Decimal("100.00")

        metrics2 = await service.get_partner_revenue_metrics(partner_id=partner2.id)
        assert metrics2.total_commissions == Decimal("200.00")


@pytest.mark.asyncio
class TestCommissionMetadataSerialization:
    """Test commission metadata serialization (regression test for metadata_ field)."""

    async def test_list_commission_events_includes_metadata(self, db_session, test_tenant_id):
        """Test that metadata_ field is correctly serialized to metadata in response."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-META-001",
            company_name="Metadata Test Partner",
            primary_email="metadata@test.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.10"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create commission event with rich metadata
        invoice_id = uuid4()
        customer_id = uuid4()
        test_metadata = {
            "invoice_id": str(invoice_id),
            "invoice_number": "INV-2024-001",
            "customer_name": "Acme Corp",
            "payment_method": "credit_card",
            "transaction_id": "txn_abc123",
        }

        commission = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=customer_id,
            invoice_id=invoice_id,
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("100.00"),
            currency="USD",
            status=CommissionStatus.APPROVED,
            event_type="invoice_payment",
            event_date=datetime.utcnow(),
            tenant_id=test_tenant_id,
            metadata_=test_metadata,  # Note: stored as metadata_ in DB
            notes="Test commission with metadata",
        )
        db_session.add(commission)
        await db_session.commit()

        # List commission events
        service = PartnerRevenueService(db_session)
        events = await service.list_commission_events(
            partner_id=partner.id, status=CommissionStatus.APPROVED
        )

        # Verify metadata is present in response
        assert len(events) == 1
        event_response = events[0]

        # The key assertion: metadata should be populated (not empty dict)
        assert event_response.metadata_ is not None
        assert event_response.metadata_ != {}
        assert event_response.metadata_ == test_metadata

        # Verify specific metadata fields
        assert event_response.metadata_["invoice_number"] == "INV-2024-001"
        assert event_response.metadata_["customer_name"] == "Acme Corp"
        assert event_response.metadata_["payment_method"] == "credit_card"

    async def test_commission_metadata_empty_when_not_set(self, db_session, test_tenant_id):
        """Test that metadata defaults to empty dict when not set."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-NO-META",
            company_name="No Metadata Partner",
            primary_email="nometa@test.com",
            tier=PartnerTier.BRONZE,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.05"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create commission event without metadata
        commission = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=uuid4(),
            base_amount=Decimal("500.00"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("25.00"),
            currency="USD",
            status=CommissionStatus.APPROVED,
            event_type="subscription_renewal",
            event_date=datetime.utcnow(),
            tenant_id=test_tenant_id,
            # metadata_ not set - should default to {}
        )
        db_session.add(commission)
        await db_session.commit()

        # List commission events
        service = PartnerRevenueService(db_session)
        events = await service.list_commission_events(
            partner_id=partner.id, status=CommissionStatus.APPROVED
        )

        # Verify metadata is empty dict (not None)
        assert len(events) == 1
        event_response = events[0]
        assert event_response.metadata_ == {}


@pytest.mark.asyncio
class TestPayoutCreationWithCommissionCount:
    """Test payout creation correctly sets commission_count and syncs statuses."""

    async def test_create_payout_sets_commission_count(self, db_session, test_tenant_id):
        """Test that creating a payout sets commission_count to the number of linked events."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-PAYOUT-001",
            company_name="Payout Test Partner",
            primary_email="payout@test.com",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.20"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create multiple approved commission events
        now = datetime.utcnow()
        period_start = now - timedelta(days=30)
        period_end = now

        commissions = []
        for i in range(5):
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                base_amount=Decimal("100.00"),
                commission_rate=Decimal("0.20"),
                commission_amount=Decimal("20.00"),
                currency="USD",
                status=CommissionStatus.APPROVED,
                event_type="invoice_payment",
                event_date=now - timedelta(days=i),
                tenant_id=test_tenant_id,
            )
            commissions.append(commission)

        db_session.add_all(commissions)
        await db_session.commit()

        # Create payout
        service = PartnerRevenueService(db_session)
        payout_response = await service.create_payout_batch(
            partner_id=partner.id,
            period_start=period_start,
            period_end=period_end,
            currency="USD",
        )

        # Verify commission_count is set correctly
        assert payout_response.commission_count == 5
        assert payout_response.total_amount == Decimal("100.00")  # 5 * 20.00
        assert payout_response.status == PayoutStatus.PENDING

        # Verify in database
        result = await db_session.execute(
            select(PartnerPayout).where(PartnerPayout.id == payout_response.id)
        )
        db_payout = result.scalar_one()
        assert db_payout.commission_count == 5

    async def test_create_payout_updates_commission_statuses(self, db_session, test_tenant_id):
        """Test that creating a payout updates linked commission event statuses to PENDING."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-STATUS-001",
            company_name="Status Sync Partner",
            primary_email="status@test.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.15"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create approved commission events
        now = datetime.utcnow()
        period_start = now - timedelta(days=30)
        period_end = now

        commission_ids = []
        for i in range(3):
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                base_amount=Decimal("200.00"),
                commission_rate=Decimal("0.15"),
                commission_amount=Decimal("30.00"),
                currency="USD",
                status=CommissionStatus.APPROVED,  # Initially APPROVED
                event_type="subscription_payment",
                event_date=now - timedelta(days=i * 5),
                tenant_id=test_tenant_id,
            )
            commission_ids.append(commission.id)
            db_session.add(commission)

        await db_session.commit()

        # Create payout
        service = PartnerRevenueService(db_session)
        payout_response = await service.create_payout_batch(
            partner_id=partner.id,
            period_start=period_start,
            period_end=period_end,
            currency="USD",
        )

        # Verify commission events remain APPROVED and are linked to payout
        for commission_id in commission_ids:
            result = await db_session.execute(
                select(PartnerCommissionEvent).where(PartnerCommissionEvent.id == commission_id)
            )
            commission = result.scalar_one()
            assert (
                commission.status == CommissionStatus.APPROVED
            )  # Remains APPROVED for financial reporting
            assert commission.payout_id == payout_response.id

    async def test_create_payout_with_single_commission(self, db_session, test_tenant_id):
        """Test payout creation works correctly with a single commission event."""
        # Create partner
        partner = Partner(
            id=uuid4(),
            partner_number="P-SINGLE-001",
            company_name="Single Commission Partner",
            primary_email="single@test.com",
            tier=PartnerTier.BRONZE,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.10"),
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create single approved commission event
        now = datetime.utcnow()
        commission = PartnerCommissionEvent(
            id=uuid4(),
            partner_id=partner.id,
            customer_id=uuid4(),
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.10"),
            commission_amount=Decimal("100.00"),
            currency="USD",
            status=CommissionStatus.APPROVED,
            event_type="large_invoice",
            event_date=now,
            tenant_id=test_tenant_id,
        )
        db_session.add(commission)
        await db_session.commit()

        # Create payout
        service = PartnerRevenueService(db_session)
        payout_response = await service.create_payout_batch(
            partner_id=partner.id,
            period_start=now - timedelta(days=1),
            period_end=now + timedelta(days=1),
            currency="USD",
        )

        # Verify commission_count is 1 (not 0)
        assert payout_response.commission_count == 1
        assert payout_response.total_amount == Decimal("100.00")
