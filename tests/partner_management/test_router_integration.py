"""
Integration tests for partner management router with database.

Tests router endpoints with actual database to cover response model mappings.
"""

from decimal import Decimal
from uuid import uuid4

import pytest

from dotmac.platform.partner_management.schemas import (
    PartnerAccountCreate,
    PartnerCommissionEventCreate,
    PartnerCreate,
    ReferralLeadCreate,
)
from dotmac.platform.partner_management.service import PartnerService

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.mark.asyncio
class TestPartnerRouterIntegration:
    """Integration tests for partner router with database."""

    async def test_list_partner_accounts_with_metadata(self, db_session, tenant_context):
        """Test list partner accounts returns accounts with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import list_partner_accounts

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Create partner account
        account_data = PartnerAccountCreate(
            partner_id=partner.id,
            customer_id=uuid4(),
            engagement_type="referral",
        )
        account = await service.create_partner_account(data=account_data)

        # Call router function to execute response mapping (lines 315-323)
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        accounts = await list_partner_accounts(partner.id, service, mock_user, active_only=True)

        assert len(accounts) == 1
        assert accounts[0].id == account.id

    async def test_list_commission_events_with_metadata(self, db_session, tenant_context):
        """Test list commission events returns events with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import list_commission_events

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Create commission event
        event_data = PartnerCommissionEventCreate(
            partner_id=partner.id,
            commission_amount=Decimal("100.00"),
            event_type="sale",
        )
        event = await service.create_commission_event(data=event_data)

        # Call router function to execute response mapping (lines 383-389)
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        result = await list_commission_events(partner.id, service, mock_user, page=1, page_size=50)

        assert result.total == 1
        assert result.events[0].id == event.id

    async def test_create_commission_event_with_metadata(self, db_session, tenant_context):
        """Test create commission event returns event with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import create_commission_event

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Call router function to execute response mapping (lines 352-355)
        event_data = PartnerCommissionEventCreate(
            partner_id=partner.id,
            commission_amount=Decimal("150.00"),
            base_amount=Decimal("1000.00"),
            commission_rate=Decimal("0.15"),
            event_type="sale",
        )
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        event = await create_commission_event(event_data, service, mock_user)

        assert event.commission_amount == Decimal("150.00")
        assert event.partner_id == partner.id

    async def test_list_referrals_with_metadata(self, db_session, tenant_context):
        """Test list referrals returns referrals with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import list_referrals

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Create referral
        referral_data = ReferralLeadCreate(
            partner_id=partner.id,
            contact_name="John Doe",
            contact_email=f"john-{uuid4().hex[:8]}@example.com",
        )
        referral = await service.create_referral(data=referral_data)

        # Call router function to execute response mapping (lines 450-458)
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        result = await list_referrals(partner.id, service, mock_user, page=1, page_size=50)

        assert result.total == 1
        assert result.referrals[0].id == referral.id

    async def test_create_referral_with_metadata(self, db_session, tenant_context):
        """Test create referral returns referral with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import create_referral

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Call router function to execute response mapping (lines 419-422)
        referral_data = ReferralLeadCreate(
            partner_id=partner.id,
            contact_name="Jane Smith",
            contact_email=f"jane-{uuid4().hex[:8]}@example.com",
            source="website",
        )
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        referral = await create_referral(referral_data, service, mock_user)

        assert referral.contact_name == "Jane Smith"
        assert referral.partner_id == partner.id

    async def test_create_partner_account_with_metadata(self, db_session, tenant_context):
        """Test create partner account returns account with metadata mapping."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.partner_management.router import create_partner_account

        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Call router function to execute response mapping (lines 291-294)
        account_data = PartnerAccountCreate(
            partner_id=partner.id,
            customer_id=uuid4(),
            engagement_type="reseller",
        )
        mock_user = UserInfo(
            user_id="u1",
            username="test",
            email="test@test.com",
            roles=["admin"],
            tenant_id="default",
        )
        account = await create_partner_account(account_data, service, mock_user)

        assert account.partner_id == partner.id
        assert account.engagement_type == "reseller"

    async def test_get_partner_by_number_service_call(self, db_session, tenant_context):
        """Test get partner by number service method."""
        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Get by number
        found = await service.get_partner_by_number(partner.partner_number)

        assert found is not None
        assert found.id == partner.id
        assert found.partner_number == partner.partner_number

    async def test_delete_partner_service_call(self, db_session, tenant_context):
        """Test delete partner service method."""
        service = PartnerService(db_session)

        # Create partner
        partner_data = PartnerCreate(
            company_name=f"Test Partner {uuid4().hex[:8]}",
            primary_email=f"test-{uuid4().hex[:8]}@example.com",
            billing_email=f"billing-{uuid4().hex[:8]}@example.com",
        )
        partner = await service.create_partner(data=partner_data)

        # Delete partner
        result = await service.delete_partner(partner_id=partner.id, deleted_by="test_user")

        assert result is True

        # Verify deleted
        found = await service.get_partner(partner_id=partner.id)
        assert found is None  # Soft deleted, so not returned by default

    async def test_service_uuid_validation_errors(self, db_session, tenant_context):
        """Test service methods with invalid UUID inputs."""
        service = PartnerService(db_session)

        # Test get_partner with invalid UUID string
        with pytest.raises(ValueError, match="Invalid UUID"):
            await service.get_partner(partner_id="not-a-uuid")

        # Test update_partner with invalid UUID
        from dotmac.platform.partner_management.schemas import PartnerUpdate

        with pytest.raises(ValueError, match="Invalid UUID"):
            await service.update_partner(
                partner_id="invalid-uuid", data=PartnerUpdate(company_name="Test")
            )
