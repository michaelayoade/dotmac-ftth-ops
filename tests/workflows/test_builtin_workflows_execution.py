"""Integration-style tests for built-in ISP workflows."""

from __future__ import annotations

from copy import deepcopy

import pytest

pytestmark = pytest.mark.integration

from dotmac.platform.workflows.builtin_workflows import (
    LEAD_TO_CUSTOMER_WORKFLOW,
    QUOTE_ACCEPTED_WORKFLOW,
)
from dotmac.platform.workflows.models import WorkflowStatus
from dotmac.platform.workflows.service import WorkflowService


class _StubPublisher:
    """Capture workflow events published by the engine."""

    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    async def publish(self, name: str, payload: dict):
        self.events.append((name, payload))


class _StubRegistry:
    """Minimal service registry implementation for tests."""

    def __init__(self, services: dict[str, object]):
        self._services = services

    def get_service(self, name: str) -> object:
        if name not in self._services:
            raise ValueError(f"Service not found: {name}")
        return self._services[name]


class _RecordingServiceBase:
    """Base class providing call recording helpers."""

    def __init__(self, service_name: str, calls: list[tuple[str, str, dict]]):
        self._service_name = service_name
        self._calls = calls

    def _record(self, method: str, payload: dict) -> None:
        self._calls.append((self._service_name, method, payload))


class _CustomerService(_RecordingServiceBase):
    async def create_from_lead(self, lead_id: str, tenant_id: str) -> dict:
        self._record(
            "create_from_lead",
            {"lead_id": lead_id, "tenant_id": tenant_id},
        )
        return {"customer_id": "cust-100", "email": "fiber@example.com", "name": "Fiber User"}


class _BillingService(_RecordingServiceBase):
    async def create_subscription(self, customer_id: str, plan_id: str, tenant_id: str) -> dict:
        self._record(
            "create_subscription",
            {"customer_id": customer_id, "plan_id": plan_id, "tenant_id": tenant_id},
        )
        return {"subscription_id": f"sub-{customer_id}", "customer_id": customer_id}

    async def process_payment(self, order_id: str, amount: float, payment_method: str) -> dict:
        self._record(
            "process_payment",
            {"order_id": order_id, "amount": amount, "payment_method": payment_method},
        )
        return {"payment_id": "pay-1", "status": "captured"}


class _LicenseService(_RecordingServiceBase):
    async def issue_license(
        self, customer_id: str, license_template_id: str, tenant_id: str
    ) -> dict:
        self._record(
            "issue_license",
            {
                "customer_id": customer_id,
                "license_template_id": license_template_id,
                "tenant_id": tenant_id,
            },
        )
        return {"license_key": "LIC-ABC-123"}


class _DeploymentService(_RecordingServiceBase):
    async def provision_tenant(
        self, customer_id: str, license_key: str, deployment_type: str
    ) -> dict:
        self._record(
            "provision_tenant",
            {
                "customer_id": customer_id,
                "license_key": license_key,
                "deployment_type": deployment_type,
            },
        )
        return {"tenant_url": f"https://{customer_id}.isp.example.com"}

    async def schedule_deployment(
        self,
        order_id: str,
        customer_id: str,
        priority: str,
        scheduled_date: str,
    ) -> dict:
        self._record(
            "schedule_deployment",
            {
                "order_id": order_id,
                "customer_id": customer_id,
                "priority": priority,
                "scheduled_date": scheduled_date,
            },
        )
        return {"deployment_id": "dep-1", "scheduled_date": scheduled_date}


class _CommunicationsService(_RecordingServiceBase):
    async def send_template_email(self, template: str, recipient: str, variables: dict) -> dict:
        self._record(
            "send_template_email",
            {"template": template, "recipient": recipient, "variables": variables},
        )
        return {"template": template, "recipient": recipient, "status": "sent"}


class _TicketingService(_RecordingServiceBase):
    async def create_ticket(
        self,
        title: str,
        description: str,
        customer_id: str,
        priority: str,
        assigned_team: str,
    ) -> dict:
        self._record(
            "create_ticket",
            {
                "title": title,
                "description": description,
                "customer_id": customer_id,
                "priority": priority,
                "assigned_team": assigned_team,
            },
        )
        return {"ticket_id": "ticket-100", "status": "open"}


class _CRMService(_RecordingServiceBase):
    async def accept_quote(self, quote_id: str, accepted_by: str) -> dict:
        self._record(
            "accept_quote",
            {"quote_id": quote_id, "accepted_by": accepted_by},
        )
        return {"quote_status": "accepted"}


class _SalesService(_RecordingServiceBase):
    async def create_order_from_quote(self, quote_id: str, tenant_id: str) -> dict:
        self._record(
            "create_order_from_quote",
            {"quote_id": quote_id, "tenant_id": tenant_id},
        )
        return {
            "order_id": "order-500",
            "customer_id": "cust-100",
            "customer_email": "fiber@example.com",
            "total_amount": 299.0,
        }


class _NotificationsService(_RecordingServiceBase):
    async def notify_team(
        self,
        team: str,
        channel: str,
        subject: str,
        message: str,
        metadata: dict,
    ) -> dict:
        self._record(
            "notify_team",
            {
                "team": team,
                "channel": channel,
                "subject": subject,
                "message": message,
                "metadata": metadata,
            },
        )
        return {"notified": True}


def _build_registry(calls: list[tuple[str, str, dict]]) -> _StubRegistry:
    """Create a registry populated with stub services."""
    services = {
        "customer_service": _CustomerService("customer_service", calls),
        "billing_service": _BillingService("billing_service", calls),
        "license_service": _LicenseService("license_service", calls),
        "deployment_service": _DeploymentService("deployment_service", calls),
        "communications_service": _CommunicationsService("communications_service", calls),
        "ticketing_service": _TicketingService("ticketing_service", calls),
        "crm_service": _CRMService("crm_service", calls),
        "sales_service": _SalesService("sales_service", calls),
        "notifications_service": _NotificationsService("notifications_service", calls),
    }
    return _StubRegistry(services)


@pytest.mark.asyncio
async def test_lead_to_customer_workflow_executes_all_services(async_db_session):
    calls: list[tuple[str, str, dict]] = []
    registry = _build_registry(calls)
    publisher = _StubPublisher()
    workflow_service = WorkflowService(
        async_db_session,
        event_publisher=publisher,
        service_registry=registry,
    )

    workflow_data = deepcopy(LEAD_TO_CUSTOMER_WORKFLOW)
    await workflow_service.create_workflow(
        name=workflow_data["name"],
        definition=workflow_data["definition"],
        description=workflow_data["description"],
        version=workflow_data["version"],
        tags=workflow_data["tags"],
    )

    execution = await workflow_service.execute_workflow(
        workflow_name=workflow_data["name"],
        context={
            "lead_id": "lead-123",
            "tenant_id": "tenant-alpha",
            "plan_id": "fiber-premium",
            "license_template_id": "license-standard",
            "deployment_type": "fiber",
        },
        tenant_id=None,
    )

    assert execution.status == WorkflowStatus.COMPLETED
    assert [call[:2] for call in calls] == [
        ("customer_service", "create_from_lead"),
        ("billing_service", "create_subscription"),
        ("license_service", "issue_license"),
        ("deployment_service", "provision_tenant"),
        ("communications_service", "send_template_email"),
        ("ticketing_service", "create_ticket"),
    ]
    assert execution.result["steps"]["create_customer"]["customer_id"] == "cust-100"
    assert execution.result["steps"]["provision_tenant"]["tenant_url"].startswith(
        "https://cust-100"
    )
    assert publisher.events and publisher.events[0][0] == "workflow.execution.completed"

    reloaded = await workflow_service.get_execution(execution.id, include_steps=True)
    assert reloaded is not None
    assert len(reloaded.steps) == len(workflow_data["definition"]["steps"])


@pytest.mark.asyncio
async def test_quote_workflow_prepaid_runs_full_path(async_db_session):
    calls: list[tuple[str, str, dict]] = []
    registry = _build_registry(calls)
    workflow_service = WorkflowService(
        async_db_session,
        event_publisher=_StubPublisher(),
        service_registry=registry,
    )

    workflow_data = deepcopy(QUOTE_ACCEPTED_WORKFLOW)
    await workflow_service.create_workflow(
        name=workflow_data["name"],
        definition=workflow_data["definition"],
        description=workflow_data["description"],
        version=workflow_data["version"],
        tags=workflow_data["tags"],
    )

    execution = await workflow_service.execute_workflow(
        workflow_name=workflow_data["name"],
        context={
            "quote_id": "quote-200",
            "tenant_id": "tenant-alpha",
            "accepted_by": "sales-user",
            "payment_method": "card",
            "payment_type": "prepaid",
            "priority": "high",
            "deployment_date": "2025-01-10",
        },
        tenant_id=None,
    )

    assert execution.status == WorkflowStatus.COMPLETED
    # Ensure all services triggered, including payment path
    assert [call[:2] for call in calls] == [
        ("crm_service", "accept_quote"),
        ("sales_service", "create_order_from_quote"),
        ("billing_service", "process_payment"),
        ("deployment_service", "schedule_deployment"),
        ("notifications_service", "notify_team"),
        ("communications_service", "send_template_email"),
    ]
    assert execution.result["steps"]["create_order"]["order_id"] == "order-500"
    assert execution.result["steps"]["schedule_deployment"]["deployment_id"] == "dep-1"


@pytest.mark.asyncio
async def test_quote_workflow_postpaid_skips_followup_steps(async_db_session):
    calls: list[tuple[str, str, dict]] = []
    registry = _build_registry(calls)
    workflow_service = WorkflowService(
        async_db_session,
        event_publisher=_StubPublisher(),
        service_registry=registry,
    )

    workflow_data = deepcopy(QUOTE_ACCEPTED_WORKFLOW)
    await workflow_service.create_workflow(
        name=workflow_data["name"],
        definition=workflow_data["definition"],
        description=workflow_data["description"],
        version=workflow_data["version"],
        tags=workflow_data["tags"],
    )

    execution = await workflow_service.execute_workflow(
        workflow_name=workflow_data["name"],
        context={
            "quote_id": "quote-201",
            "tenant_id": "tenant-alpha",
            "accepted_by": "sales-user",
            "payment_method": "card",
            "payment_type": "postpaid",
            "priority": "medium",
            "deployment_date": "2025-02-01",
        },
        tenant_id=None,
    )

    assert execution.status == WorkflowStatus.COMPLETED
    # Workflow engine should stop after payment condition evaluates false
    assert [call[:2] for call in calls] == [
        ("crm_service", "accept_quote"),
        ("sales_service", "create_order_from_quote"),
        ("billing_service", "process_payment"),
    ]
    assert set(execution.result["steps"].keys()) == {
        "mark_quote_accepted",
        "create_order",
        "process_payment_if_prepaid",
    }
