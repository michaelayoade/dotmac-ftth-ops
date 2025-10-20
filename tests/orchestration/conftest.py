"""
Pytest fixtures for orchestration router tests.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow,
    OrchestrationWorkflowStep,
    WorkflowStatus,
    WorkflowStepStatus,
    WorkflowType,
)
from dotmac.platform.tenant.models import Tenant, TenantStatus, TenantPlanType


@pytest.fixture
def mock_orchestration_service():
    """Mock OrchestrationService for testing."""
    service = MagicMock()

    # Make all methods async where applicable
    service.provision_subscriber = AsyncMock()
    service.deprovision_subscriber = AsyncMock()
    service.activate_service = AsyncMock()
    service.suspend_service = AsyncMock()
    service.get_workflow = AsyncMock()
    service.list_workflows = AsyncMock()
    service.retry_workflow = AsyncMock()
    service.cancel_workflow = AsyncMock()
    service.get_statistics = AsyncMock()
    service.get_workflow_statistics = AsyncMock()  # Add this method
    service.export_workflows_csv = AsyncMock()
    service.export_workflows_json = AsyncMock()

    return service


@pytest.fixture
def mock_current_user():
    """Mock current user for authentication."""
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    user.tenant_id = "test_tenant"
    user.is_superuser = False
    return user


@pytest.fixture
def sample_provision_request():
    """Sample provision subscriber request for testing."""
    return {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "service_address": "123 Main St",
        "service_city": "Springfield",
        "service_state": "CA",
        "service_postal_code": "12345",
        "service_country": "USA",
        "service_plan_id": "plan-premium-100",
        "bandwidth_mbps": 100,
        "connection_type": "ftth",
        "vlan_id": 100,
        "onu_serial": "ONT123456789",
        "installation_date": "2025-01-20T00:00:00Z",
        "installation_notes": "Standard installation",
        "auto_activate": True,
        "send_welcome_email": True,
        "create_radius_account": True,
        "allocate_ip_from_netbox": True,
        "configure_voltha": True,
        "configure_genieacs": True,
        "notes": "Test subscriber provisioning",
        "tags": {"source": "web_portal", "campaign": "Q1_2025"}
    }


@pytest.fixture
def sample_deprovision_request():
    """Sample deprovision subscriber request for testing."""
    return {
        "subscriber_id": "sub-12345",
        "reason": "customer_request",
        "terminate_immediately": False,
        "termination_date": "2025-02-01",
        "refund_amount": 0.00,
        "remove_from_radius": True,
        "release_ip_addresses": True,
        "delete_customer_data": False,
        "final_invoice": True,
        "notes": "Customer relocating to different area"
    }


@pytest.fixture
def sample_activate_request():
    """Sample activate service request for testing."""
    return {
        "subscriber_id": "sub-12345",
        "effective_date": "2025-01-20",
        "send_welcome_email": True,
        "provision_ont": True,
        "activate_radius": True,
        "notes": "Activation after successful installation"
    }


@pytest.fixture
def sample_suspend_request():
    """Sample suspend service request for testing."""
    return {
        "subscriber_id": "sub-12345",
        "reason": "non_payment",
        "suspend_immediately": True,
        "suspension_date": None,
        "disable_radius": True,
        "send_notification": True,
        "notes": "Suspended due to overdue invoice"
    }


@pytest.fixture
def sample_workflow():
    """Sample orchestration workflow for testing."""
    return OrchestrationWorkflow(
        id=1,
        workflow_id="wf-123456",
        workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
        status=WorkflowStatus.COMPLETED,
        initiator_id="user-1",
        initiator_type="user",
        input_data={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "service_plan_id": "plan-premium-100"
        },
        output_data={
            "subscriber_id": "sub-12345",
            "radius_username": "john.doe@isp.com",
            "ipv4_address": "10.0.1.100",
            "ipv6_address": "2001:db8::100"
        },
        started_at=datetime(2025, 1, 18, 10, 0, 0),
        completed_at=datetime(2025, 1, 18, 10, 5, 0),
        failed_at=None,
        error_message=None,
        error_details=None,
        retry_count=0,
        max_retries=3,
        context={"step_results": {}},
        tenant_id="test_tenant",
        created_at=datetime(2025, 1, 18, 10, 0, 0),
        updated_at=datetime(2025, 1, 18, 10, 5, 0)
    )


@pytest.fixture
def sample_workflow_with_steps(sample_workflow):
    """Sample workflow with steps for testing."""
    steps = [
        OrchestrationWorkflowStep(
            id=1,
            workflow_id=sample_workflow.id,
            step_id="step-1",
            step_order=1,
            step_name="create_customer",
            step_type="database",
            target_system="dotmac_db",
            status=WorkflowStepStatus.COMPLETED,
            input_data={"first_name": "John", "last_name": "Doe"},
            output_data={"customer_id": 123},
            started_at=datetime(2025, 1, 18, 10, 0, 0),
            completed_at=datetime(2025, 1, 18, 10, 1, 0),
            retry_count=0,
            max_retries=3
        ),
        OrchestrationWorkflowStep(
            id=2,
            workflow_id=sample_workflow.id,
            step_id="step-2",
            step_order=2,
            step_name="allocate_ip",
            step_type="api",
            target_system="netbox",
            status=WorkflowStepStatus.COMPLETED,
            input_data={"ipv4_prefix_id": 1, "ipv6_prefix_id": 2},
            output_data={"ipv4": "10.0.1.100", "ipv6": "2001:db8::100"},
            started_at=datetime(2025, 1, 18, 10, 1, 0),
            completed_at=datetime(2025, 1, 18, 10, 2, 0),
            retry_count=0,
            max_retries=3
        ),
        OrchestrationWorkflowStep(
            id=3,
            workflow_id=sample_workflow.id,
            step_id="step-3",
            step_order=3,
            step_name="create_radius_account",
            step_type="api",
            target_system="radius",
            status=WorkflowStepStatus.COMPLETED,
            input_data={"username": "john.doe@isp.com"},
            output_data={"radius_id": "rad-456"},
            started_at=datetime(2025, 1, 18, 10, 2, 0),
            completed_at=datetime(2025, 1, 18, 10, 3, 0),
            retry_count=0,
            max_retries=3
        )
    ]

    sample_workflow.steps = steps
    return sample_workflow


@pytest.fixture
def sample_failed_workflow():
    """Sample failed workflow for testing rollback scenarios."""
    return OrchestrationWorkflow(
        id=2,
        workflow_id="wf-789012",
        workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
        status=WorkflowStatus.FAILED,
        initiator_id="user-1",
        initiator_type="user",
        input_data={
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane.smith@example.com"
        },
        output_data=None,
        started_at=datetime(2025, 1, 18, 11, 0, 0),
        completed_at=None,
        failed_at=datetime(2025, 1, 18, 11, 2, 0),
        error_message="Failed to allocate IP address",
        error_details={"step": "allocate_ip", "error_code": "NETBOX_ERROR"},
        retry_count=3,
        max_retries=3,
        context={},
        tenant_id="test_tenant",
        created_at=datetime(2025, 1, 18, 11, 0, 0),
        updated_at=datetime(2025, 1, 18, 11, 2, 0)
    )


@pytest.fixture
def sample_workflow_stats():
    """Sample workflow statistics for testing."""
    return {
        "total_workflows": 150,
        "pending_workflows": 5,
        "running_workflows": 10,
        "completed_workflows": 120,
        "failed_workflows": 10,
        "rolled_back_workflows": 3,
        "success_rate": 0.88,
        "average_duration_seconds": 45.5,
        "total_compensations": 15,
        "by_status": {
            "pending": 5,
            "running": 10,
            "completed": 120,
            "failed": 10,
            "rolling_back": 2,
            "rolled_back": 3
        },
        "by_type": {
            "provision_subscriber": 80,
            "deprovision_subscriber": 20,
            "activate_service": 30,
            "suspend_service": 15,
            "terminate_service": 5
        }
    }


@pytest.fixture
async def test_tenant(async_db_session):
    """Create a test tenant for orchestration tests."""
    tenant = Tenant(
        id="tenant-orchestration-test",
        name="Test ISP Orchestration",
        slug="test-orch",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
    )
    async_db_session.add(tenant)
    await async_db_session.flush()
    return tenant


@pytest.fixture
async def test_tenant_2(async_db_session):
    """Create a second test tenant for isolation tests."""
    tenant = Tenant(
        id="tenant-orchestration-test-2",
        name="Test ISP Orchestration 2",
        slug="test-orch-2",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
    )
    async_db_session.add(tenant)
    await async_db_session.flush()
    return tenant


@pytest.fixture
async def authenticated_client(mock_current_user, mock_orchestration_service):
    """Async HTTP client with orchestration router registered and dependencies mocked."""
    from dotmac.platform.orchestration.router import (
        router as orchestration_router,
        get_orchestration_service,
    )
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.db import get_db

    app = FastAPI()

    # Override dependencies
    def override_get_current_user():
        return mock_current_user

    def override_get_db():
        return MagicMock()  # Mock database session

    def override_get_orchestration_service():
        return mock_orchestration_service

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_orchestration_service] = override_get_orchestration_service

    app.include_router(orchestration_router)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
