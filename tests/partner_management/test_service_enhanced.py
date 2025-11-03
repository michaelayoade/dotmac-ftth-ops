"""
Enhanced tests for partner management service to reach 90% coverage.

Tests partner users, accounts, commissions, and referrals.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.partner_management.models import (
    Partner,
    PartnerCommissionEvent,
    PartnerUser,
    ReferralLead,
    ReferralStatus,
)
from dotmac.platform.partner_management.schemas import (
    PartnerAccountCreate,
    PartnerCommissionEventCreate,
    PartnerUserCreate,
    ReferralLeadCreate,
    ReferralLeadUpdate,
)
from dotmac.platform.partner_management.service import PartnerService

pytestmark = pytest.mark.asyncio


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
    """Create partner service with mock session."""
    return PartnerService(mock_db_session)


@pytest.mark.integration
class TestPartnerUsers:
    """Test partner user operations."""

    @pytest.mark.asyncio
    async def test_create_partner_user(self, service, mock_db_session):
        """Test creating a partner user."""
        partner_id = uuid4()
        user_data = PartnerUserCreate(
            partner_id=partner_id,
            email="user@partner.com",
            first_name="John",
            last_name="Doe",
            role="manager",
        )

        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_partner_user(user_data)

        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_partner_users_active_only(self, service, mock_db_session):
        """Test listing active partner users only."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        # Mock _validate_and_get_tenant
        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            # Mock users
            mock_user1 = PartnerUser(
                id=uuid4(), partner_id=partner_id, email="user1@partner.com", is_active=True
            )
            mock_user2 = PartnerUser(
                id=uuid4(), partner_id=partner_id, email="user2@partner.com", is_active=True
            )

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [mock_user1, mock_user2]
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            users = await service.list_partner_users(partner_id, active_only=True)

            assert len(users) == 2
            assert all(isinstance(u, PartnerUser) for u in users)

    @pytest.mark.asyncio
    async def test_list_partner_users_all(self, service, mock_db_session):
        """Test listing all partner users including inactive."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            users = await service.list_partner_users(partner_id, active_only=False)

            assert isinstance(users, list)


@pytest.mark.integration
class TestPartnerAccounts:
    """Test partner account operations."""

    @pytest.mark.asyncio
    async def test_create_partner_account(self, service, mock_db_session):
        """Test creating partner-customer account assignment."""
        partner_id = uuid4()
        customer_id = uuid4()

        account_data = PartnerAccountCreate(
            partner_id=partner_id,
            customer_id=customer_id,
            engagement_type="referral",
            metadata={"source": "referral"},
        )

        # Mock partner lookup
        mock_partner = Partner(
            id=partner_id, partner_number="P-001", company_name="Test Partner", total_customers=5
        )
        mock_partner_result = MagicMock()
        mock_partner_result.scalar_one_or_none.return_value = mock_partner

        mock_db_session.execute = AsyncMock(return_value=mock_partner_result)
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_partner_account(account_data)

        # Should increment partner's total_customers
        assert mock_partner.total_customers == 6
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_partner_account_no_partner(self, service, mock_db_session):
        """Test creating account when partner doesn't exist."""
        account_data = PartnerAccountCreate(
            partner_id=uuid4(), customer_id=uuid4(), engagement_type="direct"
        )

        # Mock partner not found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_partner_account(account_data)

        # Should still create account even if partner not found
        mock_db_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_partner_accounts_active_only(self, service, mock_db_session):
        """Test listing active partner accounts."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            accounts = await service.list_partner_accounts(partner_id, active_only=True)

            assert isinstance(accounts, list)

    @pytest.mark.asyncio
    async def test_list_partner_accounts_all(self, service, mock_db_session):
        """Test listing all partner accounts."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            accounts = await service.list_partner_accounts(partner_id, active_only=False)

            assert isinstance(accounts, list)


@pytest.mark.integration
class TestCommissionEvents:
    """Test commission event operations."""

    @pytest.mark.asyncio
    async def test_create_commission_event(self, service, mock_db_session):
        """Test creating commission event."""
        partner_id = uuid4()

        event_data = PartnerCommissionEventCreate(
            partner_id=partner_id,
            commission_amount=Decimal("150.00"),
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.15"),
            event_type="sale",
            metadata={"order_number": "123", "reference_id": "ORDER-123"},
        )

        # Mock partner lookup
        mock_partner = Partner(
            id=partner_id,
            partner_number="P-001",
            company_name="Test Partner",
            total_commissions_earned=Decimal("500.00"),
            total_revenue_generated=Decimal("5000.00"),
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_partner

        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_commission_event(event_data)

        # Should update partner totals
        assert mock_partner.total_commissions_earned == Decimal("650.00")
        assert mock_partner.total_revenue_generated == Decimal("6000.00")

    @pytest.mark.asyncio
    async def test_create_commission_event_no_base_amount(self, service, mock_db_session):
        """Test creating commission event without base amount."""
        partner_id = uuid4()

        event_data = PartnerCommissionEventCreate(
            partner_id=partner_id,
            commission_amount=Decimal("100.00"),
            commission_rate=Decimal("0.10"),
            event_type="referral",
        )

        # Mock partner
        mock_partner = Partner(
            id=partner_id,
            partner_number="P-001",
            company_name="Test Partner",
            total_commissions_earned=Decimal("500.00"),
            total_revenue_generated=Decimal("5000.00"),
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_partner

        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_commission_event(event_data)

        # Should only update commissions, not revenue
        assert mock_partner.total_commissions_earned == Decimal("600.00")
        assert mock_partner.total_revenue_generated == Decimal("5000.00")

    @pytest.mark.asyncio
    async def test_list_commission_events(self, service, mock_db_session):
        """Test listing commission events."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_event = PartnerCommissionEvent(
                id=uuid4(),
                partner_id=partner_id,
                commission_amount=Decimal("100.00"),
                event_date=datetime.now(UTC),
            )

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [mock_event]
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            events = await service.list_commission_events(partner_id, offset=0, limit=50)

            assert len(events) == 1
            assert events[0].commission_amount == Decimal("100.00")

    @pytest.mark.asyncio
    async def test_list_commission_events_pagination(self, service, mock_db_session):
        """Test listing commission events with pagination."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            events = await service.list_commission_events(partner_id, offset=10, limit=20)

            assert isinstance(events, list)


@pytest.mark.integration
class TestReferralLeads:
    """Test referral lead operations."""

    @pytest.mark.asyncio
    async def test_create_referral(self, service, mock_db_session):
        """Test creating a referral lead."""
        partner_id = uuid4()

        referral_data = ReferralLeadCreate(
            partner_id=partner_id,
            contact_name="Jane Smith",
            contact_email="jane@example.com",
            company_name="Acme Corp",
            source="website",
            metadata={"campaign": "spring_2024"},
        )

        # Mock partner lookup
        mock_partner = Partner(
            id=partner_id, partner_number="P-001", company_name="Test Partner", total_referrals=10
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_partner

        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        await service.create_referral(referral_data)

        # Should increment partner's total_referrals
        assert mock_partner.total_referrals == 11

    @pytest.mark.asyncio
    async def test_list_referrals(self, service, mock_db_session):
        """Test listing referrals."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_referral = ReferralLead(
                id=uuid4(),
                partner_id=partner_id,
                contact_email="test@example.com",
                submitted_date=datetime.now(UTC),
            )

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [mock_referral]
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            referrals = await service.list_referrals(partner_id, offset=0, limit=100)

            assert len(referrals) == 1
            assert referrals[0].contact_email == "test@example.com"

    @pytest.mark.asyncio
    async def test_list_referrals_pagination(self, service, mock_db_session):
        """Test listing referrals with pagination."""
        partner_id = uuid4()
        tenant_id = str(uuid4())

        with patch.object(
            service, "_validate_and_get_tenant", return_value=(partner_id, tenant_id)
        ):
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db_session.execute = AsyncMock(return_value=mock_result)

            referrals = await service.list_referrals(partner_id, offset=20, limit=50)

            assert isinstance(referrals, list)

    @pytest.mark.asyncio
    async def test_update_referral_status_to_converted(self, service, mock_db_session):
        """Test updating referral status to converted."""
        referral_id = uuid4()
        partner_id = uuid4()

        # Mock existing referral
        mock_referral = ReferralLead(
            id=referral_id,
            partner_id=partner_id,
            contact_email="test@example.com",
            status=ReferralStatus.QUALIFIED,
            submitted_date=datetime.now(UTC),
        )

        # Mock partner
        mock_partner = Partner(
            id=partner_id,
            partner_number="P-001",
            company_name="Test Partner",
            converted_referrals=5,
        )

        # Setup execute to return different results
        call_count = [0]

        def execute_side_effect(*args, **kwargs):
            call_count[0] += 1
            result = MagicMock()
            if call_count[0] == 1:
                # First call: get referral
                result.scalar_one_or_none.return_value = mock_referral
            else:
                # Second call: get partner
                result.scalar_one_or_none.return_value = mock_partner
            return result

        mock_db_session.execute = AsyncMock(side_effect=execute_side_effect)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        update_data = ReferralLeadUpdate(status=ReferralStatus.CONVERTED)

        await service.update_referral(referral_id, update_data)

        # Should set converted_at and increment partner count
        assert mock_referral.status == ReferralStatus.CONVERTED
        assert mock_referral.converted_at is not None
        assert mock_partner.converted_referrals == 6

    @pytest.mark.asyncio
    async def test_update_referral_with_dict(self, service, mock_db_session):
        """Test updating referral with dict data."""
        referral_id = uuid4()

        mock_referral = ReferralLead(
            id=referral_id,
            partner_id=uuid4(),
            contact_email="test@example.com",
            status=ReferralStatus.NEW,
            submitted_date=datetime.now(UTC),
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_referral
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        update_dict = {
            "status": ReferralStatus.CONTACTED,
            "notes": "Called customer",
            "metadata": {"call_date": "2024-01-15"},
        }

        await service.update_referral(referral_id, update_dict)

        assert mock_referral.status == ReferralStatus.CONTACTED
        assert mock_referral.notes == "Called customer"
        assert mock_referral.metadata_ == {"call_date": "2024-01-15"}

    @pytest.mark.asyncio
    async def test_update_referral_not_found(self, service, mock_db_session):
        """Test updating non-existent referral."""
        referral_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        update_data = ReferralLeadUpdate(status=ReferralStatus.CONTACTED)

        referral = await service.update_referral(referral_id, update_data)

        assert referral is None

    @pytest.mark.asyncio
    async def test_update_referral_status_without_conversion(self, service, mock_db_session):
        """Test updating referral status without triggering conversion."""
        referral_id = uuid4()

        mock_referral = ReferralLead(
            id=referral_id,
            partner_id=uuid4(),
            contact_email="test@example.com",
            status=ReferralStatus.NEW,
            submitted_date=datetime.now(UTC),
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_referral
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        update_data = ReferralLeadUpdate(status=ReferralStatus.QUALIFIED)

        await service.update_referral(referral_id, update_data)

        # Should not set converted_at
        assert mock_referral.converted_at is None
