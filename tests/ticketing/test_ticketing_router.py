"""
Integration tests for the ticketing router.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.dependencies import get_current_user_optional
from dotmac.platform.customer_management.models import (
    CommunicationChannel,
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management.models import (
    CommissionModel,
    Partner,
    PartnerStatus,
    PartnerTier,
    PartnerUser,
)
from dotmac.platform.tenant import get_current_tenant_id
from dotmac.platform.ticketing.models import Ticket, TicketActorType, TicketPriority, TicketStatus, TicketType
from dotmac.platform.ticketing.router import router as ticketing_router
from dotmac.platform.user_management.models import User
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

pytestmark = pytest.mark.integration


@pytest.fixture
def ticketing_app(async_db_session):
    """
    Build a dedicated FastAPI app for ticketing tests with dependency overrides.
    """

    app = FastAPI()
    app.include_router(ticketing_router, prefix="/api/v1")

    current_user_holder: dict[str, UserInfo | None] = {"value": None}

    async def override_get_current_user():
        user = current_user_holder["value"]
        if user is None:
            raise AssertionError("Test must set current_user before making requests.")
        return user

    async def override_session():
        yield async_db_session

    def override_get_current_tenant_id():
        return "test-tenant"

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_optional] = override_get_current_user
    app.dependency_overrides[get_session_dependency] = override_session
    app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id

    return app, current_user_holder


@pytest.mark.asyncio
@patch("dotmac.platform.ticketing.events.get_event_bus")
@patch("dotmac.platform.ticketing.router.get_current_tenant_id")
async def test_customer_creates_ticket_for_tenant(
    mock_get_tenant_id, mock_event_bus, async_db_session, ticketing_app
):
    """Customers should be able to open tickets targeting their tenant support team."""
    tenant_id = f"test-tenant-{uuid.uuid4()}"
    mock_get_tenant_id.return_value = tenant_id
    # Mock event bus to avoid event publishing errors in tests
    from unittest.mock import AsyncMock

    from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

    mock_bus_instance = AsyncMock()
    mock_event_bus.return_value = mock_bus_instance

    app, current_user_holder = ticketing_app

    # Create tenant first
    tenant = Tenant(
        id=tenant_id,
        name="Test Tenant",
        slug=tenant_id,
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.ENTERPRISE,
        billing_cycle=BillingCycle.MONTHLY,
        email="admin@test-tenant.com",
    )
    async_db_session.add(tenant)
    await async_db_session.commit()

    # Set current user as customer-role (role-based fallback)
    current_user_id = uuid.uuid4()

    current_user_holder["value"] = UserInfo(
        user_id=str(current_user_id),
        email="customer@example.com",
        username="customer-user",
        roles=["customer"],
        permissions=["tickets:create"],
        tenant_id=tenant_id,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/tickets/",
            json={
                "subject": "Need assistance",
                "message": "Our onboarding is blocked.",
                "target_type": "tenant",
                "priority": "high",
            },
        )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["origin_type"] == TicketActorType.CUSTOMER.value
    assert payload["target_type"] == TicketActorType.TENANT.value
    assert payload["customer_id"] is None
    assert payload["priority"] == "high"
    assert len(payload["messages"]) >= 1, "Should have at least one message"
    assert payload["messages"][0]["body"] == "Our onboarding is blocked."

    # Ensure ticket persisted with correct tenant association
    stored_ticket = await async_db_session.get(Ticket, uuid.UUID(payload["id"]))
    assert stored_ticket is not None
    assert stored_ticket.tenant_id == tenant_id


@pytest.mark.asyncio
@patch("dotmac.platform.ticketing.events.get_event_bus")
@patch("dotmac.platform.ticketing.router.get_current_tenant_id")
async def test_tenant_escalates_ticket_to_partner(
    mock_get_tenant_id, mock_event_bus, async_db_session, ticketing_app
):
    """Tenant administrators should be able to escalate tickets to an active partner."""
    mock_get_tenant_id.return_value = "test-tenant"
    from unittest.mock import AsyncMock

    mock_bus_instance = AsyncMock()
    mock_event_bus.return_value = mock_bus_instance

    app, current_user_holder = ticketing_app

    partner = Partner(
        id=uuid.uuid4(),
        partner_number="PARTNER-001",
        company_name="Partner Co",
        primary_email="support@partner.co",
        status=PartnerStatus.ACTIVE,
        tier=PartnerTier.BRONZE,
        commission_model=CommissionModel.REVENUE_SHARE,
        tenant_id="test-tenant",
    )
    async_db_session.add(partner)
    await async_db_session.commit()
    await async_db_session.refresh(partner)

    current_user_holder["value"] = UserInfo(
        user_id=str(uuid.uuid4()),
        email="admin@tenant.com",
        username="tenant-admin",
        roles=["admin"],
        permissions=["tickets:create", "tickets:update"],
        tenant_id="test-tenant",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/tickets/",
            json={
                "subject": "Partner escalation",
                "message": "We need partner assistance on deployment.",
                "target_type": "partner",
                "partner_id": str(partner.id),
            },
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["partner_id"] == str(partner.id)
    assert data["origin_type"] == TicketActorType.TENANT.value
    assert data["target_type"] == TicketActorType.PARTNER.value


@pytest.mark.asyncio
@patch("dotmac.platform.ticketing.events.get_event_bus")
@patch("dotmac.platform.ticketing.router.get_current_tenant_id")
async def test_partner_appends_message_with_status_transition(
    mock_get_tenant_id, mock_event_bus, async_db_session, ticketing_app
):
    """Partners should respond to tickets and transition status."""
    mock_get_tenant_id.return_value = "test-tenant"
    from unittest.mock import AsyncMock

    mock_bus_instance = AsyncMock()
    mock_event_bus.return_value = mock_bus_instance

    app, current_user_holder = ticketing_app

    # Prepare partner and associated user
    partner_id = uuid.uuid4()
    partner_user_account_id = uuid.uuid4()
    tenant_admin_id = uuid.uuid4()

    partner = Partner(
        id=partner_id,
        partner_number="PARTNER-9000",
        company_name="Reseller Partners",
        primary_email="ops@reseller.io",
        status=PartnerStatus.ACTIVE,
        tier=PartnerTier.SILVER,
        commission_model=CommissionModel.REVENUE_SHARE,
        tenant_id="test-tenant",
    )
    tenant_user = User(
        id=tenant_admin_id,
        username="tenant-user",
        email="tenant@example.com",
        password_hash="hashed",
        tenant_id="test-tenant",
        roles=["admin"],
    )
    partner_portal_user = User(
        id=partner_user_account_id,
        username="partner-portal",
        email="partner.user@example.com",
        password_hash="hashed",
        tenant_id="test-tenant",
    )
    partner_user = PartnerUser(
        id=uuid.uuid4(),
        partner_id=partner_id,
        first_name="Pat",
        last_name="Ner",
        email="partner.user@example.com",
        role="account_manager",
        is_primary_contact=True,
        user_id=partner_user_account_id,
        tenant_id="test-tenant",
    )

    async_db_session.add_all([partner, tenant_user, partner_portal_user, partner_user])
    await async_db_session.commit()
    await async_db_session.refresh(partner)
    await async_db_session.refresh(partner_user)

    # Tenant opens ticket to partner
    current_user_holder["value"] = UserInfo(
        user_id=str(tenant_admin_id),
        email="tenant@example.com",
        username="tenant-user",
        roles=["admin"],
        permissions=["tickets:create"],
        tenant_id="test-tenant",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        create_resp = await client.post(
            "/api/v1/tickets/",
            json={
                "subject": "Partner help needed",
                "message": "Please review our integration plan.",
                "target_type": "partner",
                "partner_id": str(partner_id),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        ticket_payload = create_resp.json()
        ticket_id = ticket_payload["id"]

        # Partner responds and moves ticket in progress
        current_user_holder["value"] = UserInfo(
            user_id=str(partner_user_account_id),
            email="partner.user@example.com",
            username="partner-portal",
            roles=["partner"],
            permissions=["tickets:respond"],
            tenant_id="test-tenant",
        )

        message_resp = await client.post(
            f"/api/v1/tickets/{ticket_id}/messages",
            json={
                "message": "Review complete, proceeding with implementation.",
                "new_status": "in_progress",
            },
        )

    assert message_resp.status_code == 201, message_resp.text
    updated_ticket = message_resp.json()
    assert updated_ticket["status"] == "in_progress"
    assert len(updated_ticket["messages"]) >= 2, "Should have at least 2 messages"
    assert updated_ticket["messages"][-1]["sender_type"] == TicketActorType.PARTNER.value
    assert (
        updated_ticket["messages"][-1]["body"] == "Review complete, proceeding with implementation."
    )
    assert updated_ticket["partner_id"] == str(partner_id)
    assert updated_ticket["last_response_at"] is not None

    # Reload from database to verify persistence
    stored_ticket = await async_db_session.get(Ticket, uuid.UUID(ticket_id))
    assert stored_ticket.status == "in_progress"
    assert stored_ticket.partner_id == partner_id
    assert stored_ticket.last_response_at is not None
    assert stored_ticket.last_response_at <= datetime.now(UTC)


@pytest.mark.asyncio
async def test_ticket_metrics_endpoint(async_db_session, ticketing_app):
    """Ticket metrics should aggregate status, priority, type, and SLA counts."""
    app, current_user_holder = ticketing_app

    tenant_id = f"test-tenant-{uuid.uuid4()}"

    # Create tenant and platform admin user
    tenant = Tenant(
        id=tenant_id,
        name="Test Tenant",
        slug=tenant_id,
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.ENTERPRISE,
        billing_cycle=BillingCycle.MONTHLY,
        email="admin@test-tenant.com",
    )
    user = User(
        id=uuid.uuid4(),
        username="platform-admin",
        email="admin@example.com",
        password_hash="hashed",
        tenant_id=tenant_id,
        roles=["platform_admin"],
        permissions=["tickets:create", "tickets:update"],
    )
    async_db_session.add_all([tenant, user])
    await async_db_session.commit()

    # Seed tickets with varied status, priority, and types
    def make_ticket(
        number: str,
        status: TicketStatus,
        priority: TicketPriority,
        ticket_type: TicketType,
        sla_breached: bool = False,
    ) -> Ticket:
        return Ticket(
            id=uuid.uuid4(),
            ticket_number=number,
            subject=f"Ticket {number}",
            status=status,
            priority=priority,
            origin_type=TicketActorType.TENANT,
            target_type=TicketActorType.PLATFORM,
            tenant_id="test-tenant",
            ticket_type=ticket_type,
            sla_breached=sla_breached,
            context={},
        )

    tickets = [
        make_ticket("TCK-1", TicketStatus.OPEN, TicketPriority.NORMAL, TicketType.OUTAGE),
        make_ticket("TCK-2", TicketStatus.IN_PROGRESS, TicketPriority.HIGH, TicketType.TECHNICAL_SUPPORT),
        make_ticket("TCK-3", TicketStatus.RESOLVED, TicketPriority.URGENT, TicketType.OUTAGE, sla_breached=True),
    ]
    async_db_session.add_all(tickets)
    await async_db_session.commit()

    current_user_holder["value"] = UserInfo(
        user_id=str(user.id),
        email=user.email,
        username=user.username,
        roles=user.roles,
        permissions=user.permissions,
        tenant_id=user.tenant_id,
        is_platform_admin=True,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/tickets/metrics")
        if resp.status_code != 200:
            print("metrics response", resp.json())
            pytest.fail(f"metrics request failed: {resp.status_code}")
        data = resp.json()

    assert data["total"] == 3
    assert data["open"] == 1
    assert data["in_progress"] == 1
    assert data["resolved"] == 1
    assert data["sla_breached"] == 1
    assert data["by_priority"]["normal"] == 1
    assert data["by_priority"]["high"] == 1
    assert data["by_priority"]["urgent"] == 1
    assert data["by_type"]["outage"] == 2
    assert data["by_type"]["technical_support"] == 1
