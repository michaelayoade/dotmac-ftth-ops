"""Unit tests for PartnerTenantLink model."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.partner_management.models import (
    CommissionModel,
    Partner,
    PartnerStatus,
    PartnerTenantAccessRole,
    PartnerTenantLink,
    PartnerTier,
)
from dotmac.platform.tenant.models import Tenant, TenantStatus

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def test_partner(db_session: AsyncSession, test_tenant_id: str) -> Partner:
    """Create a test partner."""
    partner = Partner(
        id=uuid4(),
        tenant_id=test_tenant_id,
        partner_number="PTR-001",
        company_name="Test MSP Partner",
        primary_email="contact@testmsp.com",
        status=PartnerStatus.ACTIVE,
        tier=PartnerTier.PLATINUM,
        commission_model=CommissionModel.REVENUE_SHARE,
        default_commission_rate=Decimal("0.15"),
    )
    db_session.add(partner)
    await db_session.commit()
    await db_session.refresh(partner)
    return partner


@pytest_asyncio.fixture
async def partner_tenant(db_session: AsyncSession) -> Tenant:
    """Create a tenant for the partner."""
    tenant = Tenant(
        id="partner-tenant-001",
        name="Partner MSP Tenant",
        slug="partner-msp",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def managed_tenant(db_session: AsyncSession) -> Tenant:
    """Create a managed tenant."""
    tenant = Tenant(
        id="managed-tenant-001",
        name="Managed ISP Tenant",
        slug="managed-isp",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def partner_tenant_link(
    db_session: AsyncSession,
    test_partner: Partner,
    partner_tenant: Tenant,
    managed_tenant: Tenant,
) -> PartnerTenantLink:
    """Create a test partner-tenant link."""
    link = PartnerTenantLink(
        id=uuid4(),
        partner_id=test_partner.id,
        managed_tenant_id=managed_tenant.id,
        partner_tenant_id=partner_tenant.id,
        access_role=PartnerTenantAccessRole.MSP_FULL,
        relationship_type="msp_managed",
        start_date=datetime.now(UTC),
        is_active=True,
    )
    db_session.add(link)
    await db_session.commit()
    await db_session.refresh(link)
    return link


class TestPartnerTenantLinkBasics:
    """Test basic PartnerTenantLink model functionality."""

    async def test_create_partner_tenant_link(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test creating a PartnerTenantLink."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.id is not None
        assert link.partner_id == test_partner.id
        assert link.managed_tenant_id == managed_tenant.id
        assert link.partner_tenant_id == partner_tenant.id
        assert link.access_role == PartnerTenantAccessRole.MSP_FULL
        assert link.relationship_type == "msp_managed"
        assert link.is_active is True

    async def test_link_with_custom_permissions(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test creating a link with custom permissions."""
        custom_perms = {
            "partner.billing.invoices.delete": True,
            "partner.provisioning.subscribers.delete": False,
        }

        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.DELEGATE,
            custom_permissions=custom_perms,
            relationship_type="custom_delegate",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.custom_permissions == custom_perms
        assert link.custom_permissions["partner.billing.invoices.delete"] is True
        assert link.custom_permissions["partner.provisioning.subscribers.delete"] is False

    async def test_link_with_notification_config(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test creating a link with notification configuration."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_BILLING,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
            notify_on_sla_breach=True,
            notify_on_billing_threshold=True,
            billing_alert_threshold=Decimal("5000.00"),
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.notify_on_sla_breach is True
        assert link.notify_on_billing_threshold is True
        assert link.billing_alert_threshold == Decimal("5000.00")

    async def test_link_with_sla_commitments(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test creating a link with SLA commitments."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_SUPPORT,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
            sla_response_hours=4,
            sla_uptime_target=Decimal("99.95"),
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.sla_response_hours == 4
        assert link.sla_uptime_target == Decimal("99.95")


class TestPartnerTenantLinkAccessRoles:
    """Test access role functionality."""

    @pytest.mark.parametrize(
        "access_role",
        [
            PartnerTenantAccessRole.MSP_FULL,
            PartnerTenantAccessRole.MSP_BILLING,
            PartnerTenantAccessRole.MSP_SUPPORT,
            PartnerTenantAccessRole.ENTERPRISE_HQ,
            PartnerTenantAccessRole.AUDITOR,
            PartnerTenantAccessRole.RESELLER,
            PartnerTenantAccessRole.DELEGATE,
        ],
    )
    async def test_all_access_roles(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
        access_role: PartnerTenantAccessRole,
    ):
        """Test that all access roles can be assigned."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=access_role,
            relationship_type="test_relationship",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.access_role == access_role


class TestPartnerTenantLinkExpiry:
    """Test link expiry and validity logic."""

    async def test_link_not_expired_when_no_end_date(self, partner_tenant_link: PartnerTenantLink):
        """Test that link is not expired when end_date is None."""
        assert partner_tenant_link.end_date is None
        assert partner_tenant_link.is_expired is False

    async def test_link_not_expired_when_end_date_future(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that link is not expired when end_date is in the future."""
        future_date = datetime.now(UTC) + timedelta(days=30)
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            end_date=future_date,
            is_active=True,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.is_expired is False

    async def test_link_expired_when_end_date_past(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that link is expired when end_date is in the past."""
        past_date = datetime.now(UTC) - timedelta(days=30)
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC) - timedelta(days=60),
            end_date=past_date,
            is_active=True,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.is_expired is True

    async def test_link_valid_when_active_and_not_expired(
        self, partner_tenant_link: PartnerTenantLink
    ):
        """Test that link is valid when active and not expired."""
        assert partner_tenant_link.is_active is True
        assert partner_tenant_link.is_expired is False
        assert partner_tenant_link.is_valid is True

    async def test_link_invalid_when_not_active(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that link is invalid when not active."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=False,  # Not active
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.is_active is False
        assert link.is_valid is False

    async def test_link_invalid_when_expired(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that link is invalid when expired."""
        past_date = datetime.now(UTC) - timedelta(days=30)
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC) - timedelta(days=60),
            end_date=past_date,
            is_active=True,  # Active but expired
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.is_active is True
        assert link.is_expired is True
        assert link.is_valid is False


class TestPartnerTenantLinkConstraints:
    """Test database constraints."""

    async def test_unique_partner_managed_tenant_constraint(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that duplicate partner-tenant links are prevented."""
        # Create first link
        link1 = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link1)
        await db_session.commit()

        # Try to create duplicate link
        link2 = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,  # Same partner
            managed_tenant_id=managed_tenant.id,  # Same managed tenant
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_BILLING,  # Different role
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link2)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.skip(reason="SQLite does not enforce foreign key constraints by default")
    async def test_foreign_key_partner_id(
        self,
        db_session: AsyncSession,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that invalid partner_id is rejected."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=uuid4(),  # Non-existent partner
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.skip(reason="SQLite does not enforce foreign key constraints by default")
    async def test_foreign_key_managed_tenant_id(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
    ):
        """Test that invalid managed_tenant_id is rejected."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id="non-existent-tenant",  # Non-existent tenant
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(link)

        with pytest.raises(IntegrityError):
            await db_session.commit()


class TestPartnerTenantLinkRelationships:
    """Test model relationships."""

    async def test_partner_relationship(
        self,
        db_session: AsyncSession,
        partner_tenant_link: PartnerTenantLink,
        test_partner: Partner,
    ):
        """Test that partner relationship loads correctly."""
        await db_session.refresh(partner_tenant_link, ["partner"])
        assert partner_tenant_link.partner is not None
        assert partner_tenant_link.partner.id == test_partner.id
        assert partner_tenant_link.partner.company_name == "Test MSP Partner"

    async def test_partner_backref_managed_tenant_links(
        self,
        db_session: AsyncSession,
        partner_tenant_link: PartnerTenantLink,
        test_partner: Partner,
    ):
        """Test that partner backref to managed_tenant_links works."""
        await db_session.refresh(test_partner, ["managed_tenant_links"])
        assert len(test_partner.managed_tenant_links) == 1
        assert test_partner.managed_tenant_links[0].id == partner_tenant_link.id


class TestPartnerTenantLinkAuditFields:
    """Test audit trail fields."""

    async def test_timestamps_auto_populated(self, partner_tenant_link: PartnerTenantLink):
        """Test that created_at and updated_at are auto-populated."""
        assert partner_tenant_link.created_at is not None
        assert partner_tenant_link.updated_at is not None
        assert partner_tenant_link.created_at <= partner_tenant_link.updated_at

    async def test_created_by_and_updated_by(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that created_by and updated_by can be set."""
        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
            created_by="admin@test.com",
            updated_by="admin@test.com",
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.created_by == "admin@test.com"
        assert link.updated_by == "admin@test.com"


class TestPartnerTenantLinkMetadata:
    """Test metadata field."""

    async def test_metadata_storage(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test that metadata can store arbitrary JSON data."""
        metadata = {
            "contract_number": "MSP-2025-001",
            "sales_rep": "Jane Smith",
            "custom_tags": ["premium", "managed"],
            "integration_config": {
                "webhook_url": "https://msp.example.com/webhooks",
                "api_key": "secret-key-123",
            },
        }

        link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
            metadata_=metadata,
        )
        db_session.add(link)
        await db_session.commit()
        await db_session.refresh(link)

        assert link.metadata_ == metadata
        assert link.metadata_["contract_number"] == "MSP-2025-001"
        assert link.metadata_["sales_rep"] == "Jane Smith"
        assert "premium" in link.metadata_["custom_tags"]
        assert (
            link.metadata_["integration_config"]["webhook_url"]
            == "https://msp.example.com/webhooks"
        )


class TestPartnerTenantLinkQueries:
    """Test common query patterns."""

    async def test_query_active_links_for_partner(
        self,
        db_session: AsyncSession,
        test_partner: Partner,
        partner_tenant: Tenant,
        managed_tenant: Tenant,
    ):
        """Test querying active links for a partner."""
        # Create active link
        active_link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id=managed_tenant.id,
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=True,
        )
        db_session.add(active_link)

        # Create inactive link
        inactive_link = PartnerTenantLink(
            id=uuid4(),
            partner_id=test_partner.id,
            managed_tenant_id="another-tenant-001",
            partner_tenant_id=partner_tenant.id,
            access_role=PartnerTenantAccessRole.MSP_FULL,
            relationship_type="msp_managed",
            start_date=datetime.now(UTC),
            is_active=False,
        )
        # Create another tenant
        another_tenant = Tenant(
            id="another-tenant-001",
            name="Another Tenant",
            slug="another-tenant",
            status=TenantStatus.ACTIVE,
        )
        db_session.add(another_tenant)
        db_session.add(inactive_link)
        await db_session.commit()

        # Query active links
        result = await db_session.execute(
            select(PartnerTenantLink).where(
                PartnerTenantLink.partner_id == test_partner.id,
                PartnerTenantLink.is_active == True,  # noqa: E712
            )
        )
        links = result.scalars().all()

        assert len(links) == 1
        assert links[0].id == active_link.id
