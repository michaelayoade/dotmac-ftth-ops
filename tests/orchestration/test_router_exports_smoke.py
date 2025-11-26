"""Smoke tests for orchestration export endpoints (CSV/JSON) to match UI expectations."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.orchestration.router import router as orchestration_router, get_orchestration_service
from dotmac.platform.orchestration.schemas import (
    WorkflowResponse,
    WorkflowStatsResponse,
    WorkflowStepResponse,
)
from dotmac.platform.orchestration.models import WorkflowStatus, WorkflowStepStatus, WorkflowType


def _now() -> datetime:
    return datetime.now()


class FakeOrchestrationService:
    """Stub service returning deterministic workflow data for export tests."""

    def __init__(self) -> None:
        finished = _now()
        started = finished - timedelta(minutes=5)
        step = WorkflowStepResponse(
            step_id="step-1",
            step_name="Provision subscriber",
            step_order=1,
            target_system="netbox",
            status=WorkflowStepStatus.COMPLETED,
            sequence_number=1,
            started_at=started,
            completed_at=finished,
            retry_count=0,
            error_message=None,
        )
        self.workflow = WorkflowResponse(
            workflow_id="wf-1",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.COMPLETED,
            started_at=started,
            completed_at=finished,
            retry_count=0,
            error_message=None,
            steps=[step],
        )

    async def list_workflows(self, **_kwargs):
        return {"workflows": [self.workflow], "total": 1, "limit": _kwargs.get("limit", 1000), "offset": 0}

    async def get_workflow_statistics(self) -> WorkflowStatsResponse:
        return WorkflowStatsResponse(
            total_workflows=1,
            pending_workflows=0,
            running_workflows=0,
            completed_workflows=1,
            failed_workflows=0,
            rolled_back_workflows=0,
            success_rate=100.0,
            average_duration_seconds=300.0,
            total_compensations=0,
            active_workflows=0,
            recent_failures=0,
            by_type={"provision_subscriber": 1},
            by_status={"completed": 1},
        )


@pytest.fixture
def orchestration_app():
    app = FastAPI()
    app.include_router(orchestration_router, prefix="/api/v1")

    test_user = UserInfo(
        user_id="user-orchestration",
        username="orchestration-tester",
        email="orch@example.com",
        tenant_id="tenant-1",
        permissions=["admin", "orchestration.read"],
    )

    async def override_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_orchestration_service] = lambda request=None, db=None, current_user=None: FakeOrchestrationService()  # type: ignore[arg-type]
    return app


@pytest_asyncio.fixture
async def orchestration_client(orchestration_app):
    transport = ASGITransport(app=orchestration_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_export_workflows_csv(orchestration_client: AsyncClient):
    resp = await orchestration_client.get("/api/v1/orchestration/export/csv", follow_redirects=True)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    assert "wf-1" in resp.text


@pytest.mark.asyncio
async def test_export_workflows_json(orchestration_client: AsyncClient):
    resp = await orchestration_client.get("/api/v1/orchestration/export/json", follow_redirects=True)
    assert resp.status_code == 200
    assert "application/json" in resp.headers.get("content-type", "")
    data = resp.json()
    assert data["summary"]["exported_workflows"] == 1
    assert data["workflows"]
