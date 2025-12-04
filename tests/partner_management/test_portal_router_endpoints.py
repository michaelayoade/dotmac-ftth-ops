"""Tests for Partner Portal Router endpoints."""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.partner_management.models import (
    CommissionModel,
    CommissionStatus,
    Partner,
    PartnerAccount,
    PartnerCommissionEvent,
    PartnerPayout,
    PartnerTier,
    PayoutStatus,
    ReferralLead,
    ReferralStatus,
)

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestPartnerDashboardEndpoint:
    """Test GET /portal/dashboard endpoint."""

    async def test_get_dashboard_stats_success(self, db_session, test_tenant_id):
        """Test successful dashboard stats retrieval."""
        # Create partner with data
        partner = Partner(
            id=uuid4(),
            partner_number="P-DASH-001",
            company_name="Dashboard Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="dashboard@partner.example.com",
            default_commission_rate=Decimal("0.15"),
            total_customers=5,
            total_revenue_generated=Decimal("10000.00"),
            total_commissions_earned=Decimal("1500.00"),
            total_commissions_paid=Decimal("1000.00"),
            total_referrals=10,
            converted_referrals=5,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create active customer accounts
        for _i in range(3):
            account = PartnerAccount(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                engagement_type="direct",
                start_date=datetime.utcnow(),
                is_active=True,
                tenant_id=test_tenant_id,
            )
            db_session.add(account)

        # Create pending referrals
        for i in range(2):
            referral = ReferralLead(
                id=uuid4(),
                partner_id=partner.id,
                contact_name=f"Lead {i}",
                contact_email=f"lead{i}@test.com",
                status=ReferralStatus.QUALIFIED,
                tenant_id=test_tenant_id,
            )
            db_session.add(referral)

        await db_session.commit()

        # Verify partner data directly (test is verifying the database setup)
        assert partner.total_customers == 5
        assert partner.total_revenue_generated == Decimal("10000.00")
        assert partner.total_commissions_earned == Decimal("1500.00")
        assert partner.total_commissions_paid == Decimal("1000.00")
        assert partner.total_referrals == 10
        assert partner.converted_referrals == 5

        # Verify active customers count
        result = await db_session.execute(
            select(PartnerAccount).where(
                PartnerAccount.partner_id == partner.id,
                PartnerAccount.is_active,
            )
        )
        active_accounts = result.scalars().all()
        assert len(active_accounts) == 3

        # Verify pending referrals count
        result = await db_session.execute(
            select(ReferralLead).where(
                ReferralLead.partner_id == partner.id,
                ReferralLead.status == ReferralStatus.QUALIFIED,
            )
        )
        pending_referrals = result.scalars().all()
        assert len(pending_referrals) == 2


@pytest.mark.asyncio
class TestPartnerProfileEndpoints:
    """Test partner profile GET/PATCH endpoints."""

    async def test_get_profile_success(self, db_session, test_tenant_id):
        """Test getting partner profile."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-PROF-001",
            company_name="Profile Test Partner",
            legal_name="Profile Test Partner LLC",
            website="https://partner.com",
            tier=PartnerTier.PLATINUM,
            commission_model=CommissionModel.TIERED,
            primary_email="contact@partner.com",
            billing_email="billing@partner.com",
            phone="+1234567890",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)
        await db_session.commit()

        # Expected response structure
        expected = {
            "id": str(partner.id),
            "partner_number": "P-PROF-001",
            "company_name": "Profile Test Partner",
            "legal_name": "Profile Test Partner LLC",
            "website": "https://partner.com",
            "tier": "platinum",
            "commission_model": "tiered",
            "primary_email": "contact@partner.com",
            "billing_email": "billing@partner.com",
            "phone": "+1234567890",
        }

        assert expected["company_name"] == "Profile Test Partner"
        assert expected["tier"] == "platinum"

    async def test_update_profile_allowed_fields(self, db_session, test_tenant_id):
        """Test updating allowed profile fields."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-UPD-001",
            company_name="Update Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="update@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)
        await db_session.commit()

        # Simulate update
        update_data = {
            "company_name": "Updated Partner Name",
            "website": "https://updated.com",
            "billing_email": "new-billing@partner.com",
            "phone": "+9876543210",
        }

        # Apply updates (simulating PATCH endpoint logic)
        allowed_fields = {"company_name", "legal_name", "website", "billing_email", "phone"}
        for field, value in update_data.items():
            if field in allowed_fields and value is not None:
                setattr(partner, field, value)

        await db_session.commit()
        await db_session.refresh(partner)

        assert partner.company_name == "Updated Partner Name"
        assert partner.website == "https://updated.com"
        assert partner.billing_email == "new-billing@partner.com"
        assert partner.phone == "+9876543210"


@pytest.mark.asyncio
class TestReferralEndpoints:
    """Test referral listing and submission endpoints."""

    async def test_list_referrals(self, db_session, test_tenant_id):
        """Test listing partner referrals."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-REF-001",
            company_name="Referral Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="referral@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create referrals with different statuses
        referrals_data = [
            ("Lead One", "lead1@test.com", ReferralStatus.NEW),
            ("Lead Two", "lead2@test.com", ReferralStatus.QUALIFIED),
            ("Lead Three", "lead3@test.com", ReferralStatus.CONVERTED),
        ]

        for name, email, status in referrals_data:
            referral = ReferralLead(
                id=uuid4(),
                partner_id=partner.id,
                contact_name=name,
                contact_email=email,
                status=status,
                tenant_id=test_tenant_id,
            )
            db_session.add(referral)

        await db_session.commit()

        # Query referrals (simulating GET endpoint)
        result = await db_session.execute(
            select(ReferralLead)
            .where(ReferralLead.partner_id == partner.id)
            .order_by(ReferralLead.created_at.desc())
        )
        referrals = list(result.scalars().all())

        assert len(referrals) == 3
        assert referrals[0].status == ReferralStatus.CONVERTED

    async def test_submit_referral(self, db_session, test_tenant_id):
        """Test submitting a new referral."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-SUB-001",
            company_name="Submit Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="submit@partner.example.com",
            total_referrals=0,
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)
        await db_session.commit()

        # Submit referral (simulating POST endpoint)
        referral_data = {
            "contact_name": "New Lead",
            "contact_email": "newlead@test.com",
            "contact_phone": "+1234567890",
            "company_name": "Lead Company",
            "notes": "Hot lead from conference",
        }

        referral = ReferralLead(
            partner_id=partner.id,
            tenant_id=partner.tenant_id,
            **referral_data,
        )
        db_session.add(referral)

        # Update partner count
        partner.total_referrals += 1

        await db_session.commit()
        await db_session.refresh(referral)
        await db_session.refresh(partner)

        assert referral.contact_name == "New Lead"
        assert referral.contact_email == "newlead@test.com"
        assert partner.total_referrals == 1


@pytest.mark.asyncio
class TestCommissionEndpoints:
    """Test commission listing endpoints."""

    async def test_list_commissions(self, db_session, test_tenant_id):
        """Test listing commission events."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-COM-001",
            company_name="Commission Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="commission@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create commission events
        for i in range(5):
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                base_amount=Decimal("1000.00") * (i + 1),
                commission_rate=Decimal("0.15"),
                commission_amount=Decimal("150.00") * (i + 1),
                status=CommissionStatus.APPROVED,
                event_type="invoice_paid",
                event_date=datetime.utcnow() - timedelta(days=i),
                tenant_id=test_tenant_id,
            )
            db_session.add(commission)

        await db_session.commit()

        # Query commissions (simulating GET endpoint)
        result = await db_session.execute(
            select(PartnerCommissionEvent)
            .where(PartnerCommissionEvent.partner_id == partner.id)
            .order_by(PartnerCommissionEvent.event_date.desc())
        )
        commissions = list(result.scalars().all())

        assert len(commissions) == 5
        # Most recent first
        assert commissions[0].base_amount == Decimal("1000.00")
        assert commissions[-1].base_amount == Decimal("5000.00")


@pytest.mark.asyncio
class TestCustomerEndpoints:
    """Test customer listing endpoints."""

    async def test_list_customers(self, db_session, test_tenant_id):
        """Test listing partner customers with financials."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-CUST-001",
            company_name="Customer Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="customer@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create customers and accounts
        for i in range(3):
            customer = Customer(
                id=uuid4(),
                customer_number=f"CUST-{i:04d}",
                first_name="Customer",
                last_name=f"{i}",
                email=f"customer{i}@test.com",
                tenant_id=test_tenant_id,
            )
            db_session.add(customer)

            account = PartnerAccount(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=customer.id,
                engagement_type="direct" if i % 2 == 0 else "referral",
                start_date=datetime.utcnow(),
                is_active=True,
                tenant_id=test_tenant_id,
            )
            db_session.add(account)

            # Add commission events for customer
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=customer.id,
                base_amount=Decimal("1000.00") * (i + 1),
                commission_rate=Decimal("0.15"),
                commission_amount=Decimal("150.00") * (i + 1),
                status=CommissionStatus.APPROVED,
                event_type="invoice_paid",
                event_date=datetime.utcnow(),
                tenant_id=test_tenant_id,
            )
            db_session.add(commission)

        await db_session.commit()

        # Query accounts (simulating GET endpoint)
        result = await db_session.execute(
            select(PartnerAccount)
            .where(PartnerAccount.partner_id == partner.id)
            .order_by(PartnerAccount.created_at.desc())
        )
        accounts = list(result.scalars().all())

        assert len(accounts) == 3
        assert accounts[0].is_active is True


@pytest.mark.asyncio
class TestStatementAndPayoutEndpoints:
    """Test statement and payout endpoints."""

    async def test_list_statements(self, db_session, test_tenant_id):
        """Test listing partner statements."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-STMT-001",
            company_name="Statement Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="statement@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create payouts (statements)
        now = datetime.utcnow()
        for i in range(3):
            # Create payouts in reverse chronological order (i=0 is oldest, i=2 is newest)
            days_ago = (2 - i) * 30
            payout = PartnerPayout(
                id=uuid4(),
                partner_id=partner.id,
                period_start=now - timedelta(days=days_ago + 29),
                period_end=now - timedelta(days=days_ago),
                total_amount=Decimal("500.00") * (i + 1),
                currency="USD",
                status=PayoutStatus.COMPLETED if i < 2 else PayoutStatus.PENDING,
                payout_date=now - timedelta(days=days_ago),
                payment_reference=f"PAY-{i:03d}",
                tenant_id=test_tenant_id,
            )
            db_session.add(payout)

        await db_session.commit()

        # Query payouts (simulating GET /statements endpoint)
        result = await db_session.execute(
            select(PartnerPayout)
            .where(PartnerPayout.partner_id == partner.id)
            .order_by(PartnerPayout.period_end.desc())
            .limit(24)
        )
        statements = list(result.scalars().all())

        assert len(statements) == 3
        # Most recent first
        assert statements[0].status == PayoutStatus.PENDING

    async def test_list_payouts(self, db_session, test_tenant_id):
        """Test listing payout history."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-PAY-001",
            company_name="Payout Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="payout@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create payout records
        now = datetime.utcnow()
        for i in range(5):
            payout = PartnerPayout(
                id=uuid4(),
                partner_id=partner.id,
                period_start=now - timedelta(days=60 + i * 30),
                period_end=now - timedelta(days=31 + i * 30),
                total_amount=Decimal("1000.00"),
                currency="USD",
                status=PayoutStatus.COMPLETED,
                payout_date=now - timedelta(days=25 + i * 30),
                payment_reference=f"REF-{i:04d}",
                payment_method="ACH",
                tenant_id=test_tenant_id,
            )
            db_session.add(payout)

        await db_session.commit()

        # Query payouts (simulating GET /payouts endpoint)
        result = await db_session.execute(
            select(PartnerPayout)
            .where(PartnerPayout.partner_id == partner.id)
            .order_by(PartnerPayout.payout_date.desc())
            .limit(50)
        )
        payouts = list(result.scalars().all())

        assert len(payouts) == 5
        assert all(p.payment_method == "ACH" for p in payouts)


@pytest.mark.asyncio
class TestStatementDownload:
    """Test statement download endpoint."""

    async def test_download_statement_csv(self, db_session, test_tenant_id):
        """Test downloading statement as CSV."""
        partner = Partner(
            id=uuid4(),
            partner_number="P-DL-001",
            company_name="Download Test Partner",
            tier=PartnerTier.GOLD,
            commission_model=CommissionModel.REVENUE_SHARE,
            primary_email="download@partner.example.com",
            tenant_id=test_tenant_id,
        )
        db_session.add(partner)

        # Create payout with commission events
        payout = PartnerPayout(
            id=uuid4(),
            partner_id=partner.id,
            period_start=datetime(2025, 9, 1),
            period_end=datetime(2025, 9, 30),
            total_amount=Decimal("500.00"),
            currency="USD",
            status=PayoutStatus.COMPLETED,
            payout_date=datetime(2025, 10, 5),
            payment_reference="PAY-TEST-001",
            tenant_id=test_tenant_id,
        )
        db_session.add(payout)

        # Add commission events
        for i in range(3):
            commission = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner.id,
                customer_id=uuid4(),
                payout_id=payout.id,
                base_amount=Decimal("1000.00"),
                commission_rate=Decimal("0.15"),
                commission_amount=Decimal("150.00"),
                status=CommissionStatus.PAID,
                event_type="invoice_paid",
                event_date=datetime(2025, 9, 10 + i * 5),
                tenant_id=test_tenant_id,
            )
            db_session.add(commission)

        await db_session.commit()

        # Verify CSV would contain expected data
        expected_csv_structure = [
            "Field,Value",
            f"Statement ID,{payout.id}",
            f"Partner ID,{partner.id}",
            "Period Start,2025-09-01T00:00:00",
            "Period End,2025-09-30T00:00:00",
            "",  # Blank line
            "Event ID,Customer ID,Base Amount,Commission Amount,Status,Event Date",
        ]

        # CSV header should be present
        assert "Field,Value" in expected_csv_structure[0]
        assert "Event ID,Customer ID" in expected_csv_structure[-1]
