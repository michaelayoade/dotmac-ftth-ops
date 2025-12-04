"""Integration tests for partner multi-tenant API endpoints."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, Role, role_permissions, user_roles
from dotmac.platform.partner_management.models import (
    CommissionModel,
    Partner,
    PartnerStatus,
    PartnerTenantAccessRole,
    PartnerTenantLink,
    PartnerTier,
    PartnerUser,
)
from dotmac.platform.tenant.models import Tenant, TenantStatus
from dotmac.platform.user_management.models import User

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def test_tenant(db_session: AsyncSession) -> Tenant:
    """Create a test tenant (partner's home tenant)."""
    tenant = Tenant(
        id="partner-home-001",
        name="Partner MSP Home",
        slug="partner-msp-home",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def managed_tenant_1(db_session: AsyncSession) -> Tenant:
    """Create first managed tenant."""
    tenant = Tenant(
        id="managed-001",
        name="Managed ISP Alpha",
        slug="managed-alpha",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def managed_tenant_2(db_session: AsyncSession) -> Tenant:
    """Create second managed tenant."""
    tenant = Tenant(
        id="managed-002",
        name="Managed ISP Beta",
        slug="managed-beta",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def partner(db_session: AsyncSession, test_tenant: Tenant) -> Partner:
    """Create a test partner organization."""
    partner = Partner(
        id=uuid4(),
        tenant_id=test_tenant.id,
        partner_number="PTR-MSP-001",
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
async def partner_user(db_session: AsyncSession, partner: Partner, test_tenant: Tenant) -> User:
    """Create a partner user."""
    user = User(
        id=uuid4(),
        username="partner_admin",
        email="admin@testmsp.com",
        hashed_password="hashed",
        is_active=True,
        tenant_id=test_tenant.id,
    )
    db_session.add(user)
    await db_session.flush()

    # Link user to partner
    partner_user_link = PartnerUser(
        id=uuid4(),
        partner_id=partner.id,
        user_id=user.id,
        tenant_id=test_tenant.id,
        role="admin",
        is_primary=True,
    )
    db_session.add(partner_user_link)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def partner_permissions(db_session: AsyncSession) -> list[Permission]:
    """Create partner permissions."""
    from dotmac.platform.auth.models import PermissionCategory

    permissions_data = [
        ("partner.tenants.list", "List managed tenants", PermissionCategory.PARTNER),
        ("partner.billing.summary.read", "View billing summary", PermissionCategory.PARTNER),
        ("partner.billing.invoices.read", "View invoices", PermissionCategory.PARTNER),
        (
            "partner.billing.invoices.export",
            "Export invoices",
            PermissionCategory.PARTNER,
        ),
        ("partner.support.tickets.list", "List tickets", PermissionCategory.PARTNER),
        ("partner.support.tickets.create", "Create tickets", PermissionCategory.PARTNER),
        ("partner.support.tickets.update", "Update tickets", PermissionCategory.PARTNER),
        ("partner.reports.usage.read", "View usage reports", PermissionCategory.PARTNER),
        ("partner.reports.sla.read", "View SLA reports", PermissionCategory.PARTNER),
        ("partner.alerts.sla.read", "View SLA alerts", PermissionCategory.PARTNER),
        ("partner.alerts.billing.read", "View billing alerts", PermissionCategory.PARTNER),
    ]

    permissions = []
    for name, desc, category in permissions_data:
        perm = Permission(
            id=uuid4(),
            name=name,
            display_name=name.replace(".", " ").title(),
            description=desc,
            category=category,
            is_active=True,
            is_system=True,
        )
        db_session.add(perm)
        permissions.append(perm)

    await db_session.flush()
    return permissions


@pytest_asyncio.fixture
async def partner_role(db_session: AsyncSession, partner_permissions: list[Permission]) -> Role:
    """Create partner MSP full access role."""
    role = Role(
        id=uuid4(),
        name="partner_msp_full",
        display_name="Partner MSP Full Access",
        description="Full access for MSP partners",
        is_active=True,
        is_system=True,
    )
    db_session.add(role)
    await db_session.flush()

    # Grant all partner permissions to role
    for perm in partner_permissions:
        stmt = role_permissions.insert().values(role_id=role.id, permission_id=perm.id)
        await db_session.execute(stmt)

    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest_asyncio.fixture
async def partner_user_with_role(
    db_session: AsyncSession, partner_user: User, partner_role: Role
) -> User:
    """Assign partner role to partner user."""
    stmt = user_roles.insert().values(user_id=partner_user.id, role_id=partner_role.id)
    await db_session.execute(stmt)
    await db_session.commit()
    return partner_user


@pytest_asyncio.fixture
async def partner_tenant_links(
    db_session: AsyncSession,
    partner: Partner,
    test_tenant: Tenant,
    managed_tenant_1: Tenant,
    managed_tenant_2: Tenant,
) -> list[PartnerTenantLink]:
    """Create partner-tenant links."""
    link1 = PartnerTenantLink(
        id=uuid4(),
        partner_id=partner.id,
        managed_tenant_id=managed_tenant_1.id,
        partner_tenant_id=test_tenant.id,
        access_role=PartnerTenantAccessRole.MSP_FULL,
        relationship_type="msp_managed",
        start_date=datetime.now(UTC),
        is_active=True,
    )
    link2 = PartnerTenantLink(
        id=uuid4(),
        partner_id=partner.id,
        managed_tenant_id=managed_tenant_2.id,
        partner_tenant_id=test_tenant.id,
        access_role=PartnerTenantAccessRole.MSP_BILLING,
        relationship_type="msp_managed",
        start_date=datetime.now(UTC),
        is_active=True,
    )
    db_session.add(link1)
    db_session.add(link2)
    await db_session.commit()
    await db_session.refresh(link1)
    await db_session.refresh(link2)
    return [link1, link2]


@pytest_asyncio.fixture
async def authenticated_client(
    async_client: AsyncClient,
    partner_user_with_role: User,
    partner: Partner,
    managed_tenant_1: Tenant,
    managed_tenant_2: Tenant,
    partner_tenant_links: list[PartnerTenantLink],
) -> AsyncClient:
    """Create authenticated client with partner context."""
    from dotmac.platform.auth.core import jwt_service

    # Create token with partner metadata
    token = jwt_service.create_access_token(
        str(partner_user_with_role.id),
        additional_claims={
            "email": partner_user_with_role.email,
            "username": partner_user_with_role.username,
            "tenant_id": str(partner_user_with_role.tenant_id),
            "partner_id": str(partner.id),
            "managed_tenant_ids": [managed_tenant_1.id, managed_tenant_2.id],
            "permissions": [
                "partner.tenants.list",
                "partner.billing.summary.read",
                "partner.billing.invoices.read",
                "partner.billing.invoices.export",
                "partner.support.tickets.list",
                "partner.support.tickets.create",
                "partner.support.tickets.update",
                "partner.reports.usage.read",
                "partner.reports.sla.read",
                "partner.alerts.sla.read",
                "partner.alerts.billing.read",
            ],
            "roles": ["partner_msp_full"],
        },
    )

    async_client.headers["Authorization"] = f"Bearer {token}"
    return async_client


class TestTenantManagementEndpoints:
    """Test tenant management endpoints."""

    async def test_list_managed_tenants(
        self, authenticated_client: AsyncClient, partner_tenant_links: list[PartnerTenantLink]
    ):
        """Test listing managed tenants."""
        response = await authenticated_client.get("/api/v1/partner/customers")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "tenants" in data
        assert data["total"] == 2
        assert len(data["tenants"]) == 2

        # Verify tenant data
        tenant_ids = {t["tenant_id"] for t in data["tenants"]}
        assert "managed-001" in tenant_ids
        assert "managed-002" in tenant_ids

    async def test_list_managed_tenants_with_filters(self, authenticated_client: AsyncClient):
        """Test listing managed tenants with status filter."""
        response = await authenticated_client.get("/api/v1/partner/customers?status=active")

        assert response.status_code == status.HTTP_200_OK

    async def test_get_managed_tenant_detail(
        self, authenticated_client: AsyncClient, managed_tenant_1: Tenant
    ):
        """Test getting detailed tenant information."""
        response = await authenticated_client.get(
            f"/api/v1/partner/customers/{managed_tenant_1.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["tenant_id"] == managed_tenant_1.id
        assert data["tenant_name"] == "Managed ISP Alpha"
        assert data["access_role"] == "msp_full"

    async def test_get_unauthorized_tenant_detail(self, authenticated_client: AsyncClient):
        """Test accessing unauthorized tenant."""
        response = await authenticated_client.get(
            "/api/v1/partner/customers/unauthorized-tenant-id"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestBillingEndpoints:
    """Test billing endpoints."""

    async def test_get_consolidated_billing_summary(self, authenticated_client: AsyncClient):
        """Test getting consolidated billing summary."""
        response = await authenticated_client.get("/api/v1/partner/billing/summary")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_revenue" in data
        assert "total_ar" in data
        assert "tenants_count" in data

    async def test_list_invoices(self, authenticated_client: AsyncClient):
        """Test listing invoices across tenants."""
        response = await authenticated_client.get("/api/v1/partner/billing/invoices")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "invoices" in data
        assert "total" in data

    async def test_export_invoices(self, authenticated_client: AsyncClient):
        """Test requesting invoice export."""
        export_request = {"format": "csv", "status": "overdue"}

        response = await authenticated_client.post(
            "/api/v1/partner/billing/invoices/export", json=export_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "export_id" in data
        assert data["status"] == "pending"


class TestSupportEndpoints:
    """Test support/ticketing endpoints."""

    async def test_list_tickets(self, authenticated_client: AsyncClient):
        """Test listing tickets across tenants."""
        response = await authenticated_client.get("/api/v1/partner/support/tickets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "tickets" in data

    async def test_create_ticket_requires_tenant_header(self, authenticated_client: AsyncClient):
        """Test creating ticket requires X-Active-Tenant-Id header."""
        ticket_data = {
            "subject": "Test ticket",
            "description": "Test description",
            "priority": "normal",
        }

        # Without header should fail
        response = await authenticated_client.post(
            "/api/v1/partner/support/tickets", json=ticket_data
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_create_ticket_with_tenant_header(
        self, authenticated_client: AsyncClient, managed_tenant_1: Tenant
    ):
        """Test creating ticket with X-Active-Tenant-Id header."""
        ticket_data = {
            "subject": "Test ticket",
            "description": "Test description",
            "priority": "normal",
        }

        # Add cross-tenant header
        authenticated_client.headers["X-Active-Tenant-Id"] = managed_tenant_1.id

        response = await authenticated_client.post(
            "/api/v1/partner/support/tickets", json=ticket_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "ticket_id" in data
        assert data["tenant_id"] == managed_tenant_1.id


class TestReportingEndpoints:
    """Test reporting endpoints."""

    async def test_get_usage_report(self, authenticated_client: AsyncClient):
        """Test getting usage report."""
        from_date = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        to_date = datetime.now(UTC).isoformat()

        response = await authenticated_client.get(
            f"/api/v1/partner/reports/usage?from_date={from_date}&to_date={to_date}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "period_start" in data
        assert "period_end" in data
        assert "tenants" in data

    async def test_get_sla_report(self, authenticated_client: AsyncClient):
        """Test getting SLA report."""
        from_date = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        to_date = datetime.now(UTC).isoformat()

        response = await authenticated_client.get(
            f"/api/v1/partner/reports/sla?from_date={from_date}&to_date={to_date}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "overall_compliance_pct" in data


class TestAlertEndpoints:
    """Test alert endpoints."""

    async def test_get_sla_alerts(self, authenticated_client: AsyncClient):
        """Test getting SLA alerts."""
        response = await authenticated_client.get("/api/v1/partner/alerts/sla")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "alerts" in data
        assert "unacknowledged_count" in data

    async def test_get_billing_alerts(self, authenticated_client: AsyncClient):
        """Test getting billing alerts."""
        response = await authenticated_client.get("/api/v1/partner/alerts/billing")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "alerts" in data
        assert "unacknowledged_count" in data
