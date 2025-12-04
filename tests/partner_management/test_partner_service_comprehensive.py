"""Comprehensive tests for Partner Management Service."""

from decimal import Decimal
from uuid import uuid4

import pytest

from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.partner_management.models import (
    CommissionModel,
    CommissionStatus,
    PartnerStatus,
    PartnerTier,
    ReferralStatus,
)
from dotmac.platform.partner_management.schemas import (
    PartnerAccountCreate,
    PartnerCommissionEventCreate,
    PartnerCreate,
    PartnerUpdate,
    ReferralLeadCreate,
)
from dotmac.platform.partner_management.service import PartnerService

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.mark.asyncio
class TestPartnerServiceCRUD:
    """Test basic CRUD operations."""

    async def test_create_partner_success(self, async_db_session, test_tenant_id):
        """Test creating a new partner."""
        service = PartnerService(async_db_session)

        data = PartnerCreate(
            company_name="Test Partner Inc",
            primary_email="test@partner.com",
            tier=PartnerTier.SILVER,
            commission_model=CommissionModel.REVENUE_SHARE,
            default_commission_rate=Decimal("0.15"),
        )

        partner = await service.create_partner(data)

        assert partner.id is not None
        assert partner.partner_number is not None
        assert partner.company_name == "Test Partner Inc"
        assert partner.tier == PartnerTier.SILVER
        assert partner.status == PartnerStatus.PENDING
        assert partner.default_commission_rate == Decimal("0.15")

    async def test_get_partner_by_id(self, async_db_session, test_tenant_id):
        """Test retrieving partner by ID."""
        service = PartnerService(async_db_session)

        # Create partner
        data = PartnerCreate(
            company_name="Test Partner",
            primary_email="test@partner.com",
        )
        partner = await service.create_partner(data)

        # Retrieve partner
        retrieved = await service.get_partner(partner.id)

        assert retrieved.id == partner.id
        assert retrieved.company_name == partner.company_name

    async def test_update_partner(self, async_db_session, test_tenant_id):
        """Test updating partner information."""
        service = PartnerService(async_db_session)

        # Create partner
        data = PartnerCreate(
            company_name="Old Name",
            primary_email="test@partner.com",
        )
        partner = await service.create_partner(data)

        # Update partner
        update_data = PartnerUpdate(
            company_name="New Name",
            status=PartnerStatus.ACTIVE,
            tier=PartnerTier.GOLD,
        )
        updated = await service.update_partner(partner.id, update_data)

        assert updated.company_name == "New Name"
        assert updated.status == PartnerStatus.ACTIVE
        assert updated.tier == PartnerTier.GOLD

    async def test_list_partners_with_filters(self, async_db_session, test_tenant_id):
        """Test listing partners with status filter."""
        service = PartnerService(async_db_session)

        # Create multiple partners
        await service.create_partner(
            PartnerCreate(company_name="Active Partner", primary_email="active@test.com"),
        )

        await service.create_partner(
            PartnerCreate(company_name="Pending Partner", primary_email="pending@test.com"),
        )

        # List all partners
        all_partners, total_count = await service.list_partners()
        assert len(all_partners) >= 2
        assert total_count >= 2

        # List only pending partners
        pending_partners, pending_count = await service.list_partners(status=PartnerStatus.PENDING)
        assert all(p.status == PartnerStatus.PENDING for p in pending_partners)
        assert pending_count >= 1


@pytest.mark.asyncio
class TestPartnerAccounts:
    """Test partner account assignment."""

    async def test_create_partner_account(self, async_db_session, test_tenant_id):
        """Test assigning customer to partner."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        # Create a real customer first
        customer = Customer(
            id=uuid4(),
            customer_number=f"CUST-{uuid4().hex[:8].upper()}",
            first_name="Test",
            last_name="Customer",
            email="customer@example.com",
            status=CustomerStatus.ACTIVE,
            tenant_id=test_tenant_id,
        )
        async_db_session.add(customer)
        await async_db_session.commit()  # Commit so FK constraint can be satisfied

        # Create account assignment
        account_data = PartnerAccountCreate(
            partner_id=partner.id,
            customer_id=customer.id,
            engagement_type="direct",
            custom_commission_rate=Decimal("0.20"),
        )

        account = await service.create_partner_account(account_data)

        assert account.partner_id == partner.id
        assert account.customer_id == customer.id
        assert account.custom_commission_rate == Decimal("0.20")
        assert account.is_active is True

        # Verify partner customer count updated
        await async_db_session.refresh(partner)
        assert partner.total_customers == 1

    async def test_list_partner_accounts(self, async_db_session, test_tenant_id):
        """Test listing accounts for a partner."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        # Create multiple customers and accounts
        for i in range(3):
            customer = Customer(
                id=uuid4(),
                customer_number=f"CUST-{uuid4().hex[:8].upper()}",
                first_name=f"Test{i}",
                last_name="Customer",
                email=f"customer{i}@example.com",
                status=CustomerStatus.ACTIVE,
                tenant_id=test_tenant_id,
            )
            async_db_session.add(customer)
            await async_db_session.commit()  # Commit so FK constraint can be satisfied

            await service.create_partner_account(
                PartnerAccountCreate(
                    partner_id=partner.id,
                    customer_id=customer.id,
                    engagement_type="direct",
                ),
            )

        # List accounts
        accounts = await service.list_partner_accounts(partner_id=partner.id)

        assert len(accounts) == 3
        assert all(a.partner_id == partner.id for a in accounts)


@pytest.mark.asyncio
class TestCommissionTracking:
    """Test commission calculation and tracking."""

    async def test_create_commission_event(self, async_db_session, test_tenant_id):
        """Test creating commission event."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(
                company_name="Test Partner",
                primary_email="test@partner.com",
                default_commission_rate=Decimal("0.15"),
            ),
        )

        # Create a real customer first
        customer = Customer(
            id=uuid4(),
            customer_number=f"CUST-{uuid4().hex[:8].upper()}",
            first_name="Test",
            last_name="Customer",
            email="customer@example.com",
            status=CustomerStatus.ACTIVE,
            tenant_id=test_tenant_id,
        )
        async_db_session.add(customer)
        await async_db_session.commit()  # Commit so FK constraint can be satisfied

        # Create commission event
        base_amount = Decimal("1000.00")
        commission_rate = Decimal("0.15")
        commission_data = PartnerCommissionEventCreate(
            partner_id=partner.id,
            customer_id=customer.id,
            event_type="revenue_share",
            commission_amount=base_amount * commission_rate,
            base_amount=base_amount,
            commission_rate=commission_rate,
        )

        event = await service.create_commission_event(commission_data)

        assert event.partner_id == partner.id
        assert event.base_amount == Decimal("1000.00")
        assert event.commission_rate == Decimal("0.15")
        assert event.commission_amount == Decimal("150.00")
        assert event.status == CommissionStatus.PENDING

        # Verify partner totals updated
        await async_db_session.refresh(partner)
        assert partner.total_commissions_earned == Decimal("150.00")

    async def test_commission_with_custom_rate(self, async_db_session, test_tenant_id):
        """Test commission calculation with custom account rate."""
        service = PartnerService(async_db_session)

        # Create partner with default rate
        partner = await service.create_partner(
            PartnerCreate(
                company_name="Test Partner",
                primary_email="test@partner.com",
                default_commission_rate=Decimal("0.10"),
            ),
        )

        # Create customers for commission events
        customer1 = Customer(
            id=uuid4(),
            customer_number=f"CUST-{uuid4().hex[:8].upper()}",
            first_name="Customer1",
            last_name="Test",
            email="customer1@example.com",
            status=CustomerStatus.ACTIVE,
            tenant_id=test_tenant_id,
        )
        customer2 = Customer(
            id=uuid4(),
            customer_number=f"CUST-{uuid4().hex[:8].upper()}",
            first_name="Customer2",
            last_name="Test",
            email="customer2@example.com",
            status=CustomerStatus.ACTIVE,
            tenant_id=test_tenant_id,
        )
        async_db_session.add(customer1)
        async_db_session.add(customer2)
        await async_db_session.commit()  # Commit so FK constraint can be satisfied

        # Commission with default rate
        base1 = Decimal("1000.00")
        rate1 = Decimal("0.10")
        event1 = await service.create_commission_event(
            PartnerCommissionEventCreate(
                partner_id=partner.id,
                customer_id=customer1.id,
                event_type="revenue_share",
                commission_amount=base1 * rate1,
                base_amount=base1,
                commission_rate=rate1,
            ),
        )

        # Commission with custom rate
        base2 = Decimal("1000.00")
        rate2 = Decimal("0.20")
        event2 = await service.create_commission_event(
            PartnerCommissionEventCreate(
                partner_id=partner.id,
                customer_id=customer2.id,
                event_type="revenue_share",
                commission_amount=base2 * rate2,
                base_amount=base2,
                commission_rate=rate2,  # Custom rate
            ),
        )

        assert event1.commission_amount == Decimal("100.00")
        assert event2.commission_amount == Decimal("200.00")


@pytest.mark.asyncio
class TestReferralManagement:
    """Test referral submission and tracking."""

    async def test_create_referral(self, async_db_session, test_tenant_id):
        """Test submitting a referral."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        # Create referral
        referral_data = ReferralLeadCreate(
            partner_id=partner.id,
            contact_name="John Doe",
            contact_email="john@example.com",
            estimated_value=Decimal("5000.00"),
        )

        referral = await service.create_referral(referral_data)

        assert referral.partner_id == partner.id
        assert referral.contact_name == "John Doe"
        assert referral.status == ReferralStatus.NEW
        assert referral.estimated_value == Decimal("5000.00")

        # Verify partner referral count updated
        await async_db_session.refresh(partner)
        assert partner.total_referrals == 1

    async def test_convert_referral(self, async_db_session, test_tenant_id):
        """Test converting a referral."""
        service = PartnerService(async_db_session)

        # Create partner and referral
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        referral = await service.create_referral(
            ReferralLeadCreate(
                partner_id=partner.id,
                contact_name="John Doe",
                contact_email="john@example.com",
            ),
        )

        # Convert referral
        converted = await service.update_referral(
            referral.id,
            {"status": ReferralStatus.CONVERTED, "actual_value": Decimal("6000.00")},
        )

        assert converted.status == ReferralStatus.CONVERTED
        assert converted.actual_value == Decimal("6000.00")
        assert converted.converted_at is not None

        # Verify partner converted count updated
        await async_db_session.refresh(partner)
        assert partner.converted_referrals == 1


@pytest.mark.asyncio
class TestPartnerMetrics:
    """Test partner metrics and aggregations."""

    async def test_revenue_aggregation(self, async_db_session, test_tenant_id):
        """Test revenue tracking from customer accounts."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        # Create customers for commission events
        customers = []
        for i, amount in enumerate([Decimal("1000"), Decimal("2000"), Decimal("3000")]):
            customer = Customer(
                id=uuid4(),
                customer_number=f"CUST-{uuid4().hex[:8].upper()}",
                first_name=f"Customer{i}",
                last_name="Test",
                email=f"customer{i}@example.com",
                status=CustomerStatus.ACTIVE,
                tenant_id=test_tenant_id,
            )
            async_db_session.add(customer)
            customers.append((customer, amount))

        await async_db_session.commit()  # Commit so FK constraint can be satisfied

        # Create commission events
        for customer, amount in customers:
            rate = Decimal("0.10")
            await service.create_commission_event(
                PartnerCommissionEventCreate(
                    partner_id=partner.id,
                    customer_id=customer.id,
                    event_type="revenue_share",
                    commission_amount=amount * rate,
                    base_amount=amount,
                    commission_rate=rate,
                ),
            )

        # Refresh and verify totals
        await async_db_session.refresh(partner)

        assert partner.total_revenue_generated == Decimal("6000.00")
        assert partner.total_commissions_earned == Decimal("600.00")

    async def test_conversion_rate_calculation(self, async_db_session, test_tenant_id):
        """Test referral conversion rate calculation."""
        service = PartnerService(async_db_session)

        # Create partner
        partner = await service.create_partner(
            PartnerCreate(company_name="Test Partner", primary_email="test@partner.com"),
        )

        # Create 10 referrals, convert 3
        for i in range(10):
            referral = await service.create_referral(
                ReferralLeadCreate(
                    partner_id=partner.id,
                    contact_name=f"Lead {i}",
                    contact_email=f"lead{i}@example.com",
                ),
            )

            if i < 3:
                await service.update_referral(
                    referral.id,
                    {"status": ReferralStatus.CONVERTED},
                )

        # Refresh and calculate conversion rate
        await async_db_session.refresh(partner)

        assert partner.total_referrals == 10
        assert partner.converted_referrals == 3

        conversion_rate = (partner.converted_referrals / partner.total_referrals) * 100
        assert conversion_rate == 30.0
