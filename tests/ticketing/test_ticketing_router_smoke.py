"""Smoke tests for ticketing/support workflows to mirror UI calls."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.ticketing.dependencies import get_ticket_service
from dotmac.platform.ticketing.router import router
from dotmac.platform.ticketing.schemas import (
    AgentPerformanceMetrics,
    TicketCountStats,
    TicketDetail,
    TicketMessageRead,
    TicketMessageResponse,
    TicketStats,
    TicketStatus,
)
from dotmac.platform.ticketing.schemas import TicketActorType as ActorType
from dotmac.platform.ticketing.schemas import TicketPriority, TicketSummary
from dotmac.platform.tenant import set_current_tenant_id


def _now() -> datetime:
    return datetime.now()


class FakeTicketService:
    """In-memory ticket service used for smoke testing the router."""

    def __init__(self) -> None:
        ticket_id = uuid4()
        message = TicketMessageRead(
            id=uuid4(),
            ticket_id=ticket_id,
            sender_type=ActorType.TENANT,
            sender_user_id=uuid4(),
            body="Initial message",
            attachments=[],
            created_at=_now(),
            updated_at=_now(),
        )
        self.ticket = TicketDetail(
            id=ticket_id,
            ticket_number="TCK-1001",
            subject="Sample ticket",
            status=TicketStatus.OPEN,
            priority=TicketPriority.NORMAL,
            origin_type=ActorType.TENANT,
            target_type=ActorType.PLATFORM,
            tenant_id="tenant-1",
            customer_id=None,
            partner_id=None,
            assigned_to_user_id=None,
            last_response_at=_now(),
            context={},
            ticket_type=None,
            service_address=None,
            sla_due_date=None,
            sla_breached=False,
            escalation_level=0,
            created_at=_now(),
            updated_at=_now(),
            messages=[message],
            affected_services=[],
            device_serial_numbers=[],
            first_response_at=_now(),
            resolution_time_minutes=None,
            escalated_at=None,
            escalated_to_user_id=None,
        )

    async def create_ticket(self, payload, current_user, tenant_id):
        new_id = uuid4()
        base = self.ticket.model_dump()
        base.update(
            {
                "id": new_id,
                "ticket_number": "TCK-NEW",
                "subject": payload.subject,
                "tenant_id": tenant_id,
                "messages": [
                    TicketMessageRead(
                        id=uuid4(),
                        ticket_id=new_id,
                        sender_type=ActorType.TENANT,
                        sender_user_id=UUID(current_user.user_id),
                        body=payload.message,
                        attachments=payload.attachments or [],
                        created_at=_now(),
                        updated_at=_now(),
                    )
                ],
                "last_response_at": _now(),
            }
        )
        created = TicketDetail(**base)
        self.ticket = created
        return created

    async def list_tickets(
        self,
        current_user,
        tenant_id,
        status=None,
        priority=None,
        search=None,
        include_messages=False,
    ):
        summary: TicketSummary = TicketSummary.model_validate(self.ticket)
        return [summary]

    async def get_ticket(self, ticket_id, current_user, tenant_id, include_messages=True):
        return self.ticket

    async def add_message(self, ticket_id, payload, current_user, tenant_id):
        new_msg = TicketMessageRead(
            id=uuid4(),
            ticket_id=UUID(str(ticket_id)),
            sender_type=ActorType.TENANT,
            sender_user_id=UUID(current_user.user_id),
            body=payload.message,
            attachments=payload.attachments or [],
            created_at=_now(),
            updated_at=_now(),
        )
        self.ticket.messages.append(new_msg)
        self.ticket.last_response_at = _now()
        return self.ticket

    async def update_ticket(self, ticket_id, payload, current_user, tenant_id):
        if payload.status:
            self.ticket.status = payload.status
        if payload.priority:
            self.ticket.priority = payload.priority
        return self.ticket

    async def get_ticket_counts(self, current_user, tenant_id):
        return TicketCountStats(
            total_tickets=5,
            open_tickets=2,
            in_progress_tickets=1,
            waiting_tickets=1,
            resolved_tickets=1,
            closed_tickets=0,
        )

    async def get_ticket_metrics(self, current_user, tenant_id):
        return TicketStats(
            total=5,
            open=2,
            in_progress=1,
            waiting=1,
            resolved=1,
            closed=0,
            sla_breached=0,
            by_priority={"normal": 3, "high": 2},
            by_type={"incident": 2},
        )

    async def get_agent_performance(self, tenant_id, start_date=None, end_date=None):
        return [
            AgentPerformanceMetrics(
                agent_id=uuid4(),
                agent_name="Agent One",
                total_assigned=3,
                total_resolved=2,
                total_open=1,
                total_in_progress=1,
                avg_resolution_time_minutes=45.5,
                sla_compliance_rate=95.0,
            )
        ]


@pytest.fixture(autouse=True)
def set_tenant_context():
    set_current_tenant_id("tenant-1")
    yield
    set_current_tenant_id(None)


@pytest.fixture
def ticketing_app():
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    test_user = UserInfo(
        user_id=str(uuid4()),
        username="ticket-tester",
        email="tickets@example.com",
        tenant_id="tenant-1",
    )

    async def override_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_ticket_service] = lambda: FakeTicketService()
    return app


@pytest_asyncio.fixture
async def ticketing_client(ticketing_app):
    transport = ASGITransport(app=ticketing_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_ticket_crud_and_messages(ticketing_client: AsyncClient):
    payload = {
        "subject": "Broken CPE",
        "message": "CPE offline",
        "target_type": "platform",
        "priority": "high",
    }
    create_resp = await ticketing_client.post("/api/v1/tickets/", json=payload, follow_redirects=True)
    assert create_resp.status_code == 201
    created = create_resp.json()
    ticket_id = created["id"]
    assert created["messages"]

    # Fetch detail
    detail_resp = await ticketing_client.get(f"/api/v1/tickets/{ticket_id}", follow_redirects=True)
    assert detail_resp.status_code == 200

    # Append a message
    msg_resp = await ticketing_client.post(
        f"/api/v1/tickets/{ticket_id}/messages",
        json={"message": "Adding more context"},
        follow_redirects=True,
    )
    assert msg_resp.status_code == 201
    assert len(msg_resp.json()["messages"]) >= 2

    # List messages endpoint
    list_msgs = await ticketing_client.get(
        f"/api/v1/tickets/{ticket_id}/messages", follow_redirects=True
    )
    assert list_msgs.status_code == 200
    assert isinstance(list_msgs.json(), list)


@pytest.mark.asyncio
async def test_ticket_list_and_stats(ticketing_client: AsyncClient):
    list_resp = await ticketing_client.get("/api/v1/tickets/", follow_redirects=True)
    assert list_resp.status_code == 200
    tickets = list_resp.json()
    assert isinstance(tickets, list)

    stats_resp = await ticketing_client.get("/api/v1/tickets/stats", follow_redirects=True)
    assert stats_resp.status_code == 200
    metrics_resp = await ticketing_client.get("/api/v1/tickets/metrics", follow_redirects=True)
    assert metrics_resp.status_code == 200


@pytest.mark.asyncio
async def test_agent_performance(ticketing_client: AsyncClient):
    resp = await ticketing_client.get(
        "/api/v1/tickets/agents/performance", follow_redirects=True
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert "total_assigned" in data[0]
