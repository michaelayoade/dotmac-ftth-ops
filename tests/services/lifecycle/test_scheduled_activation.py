"""
Tests for scheduled service activation workflows.

Tests the ability to schedule service activations for future dates
and automatically execute them via cron/scheduler.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

from dotmac.platform.customer_management.models import (
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.services.lifecycle.models import (
    ServiceInstance,
    ServiceStatus,
    ServiceType,
)
from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

pytestmark = pytest.mark.integration


def _unique_code(prefix: str) -> str:
    """Generate a short unique identifier for test entities."""
    return f"{prefix}-{uuid4().hex[:6].upper()}"


async def _create_customer(
    async_session, tenant_id: str, *, customer_id: UUID | None = None
) -> Customer:
    """Create a simple customer to satisfy FK constraints."""
    cid = customer_id or uuid4()
    customer = Customer(
        id=cid,
        tenant_id=tenant_id,
        customer_number=f"CUST-{uuid4().hex[:8]}",
        first_name="Scheduled",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        customer_type=CustomerType.INDIVIDUAL,
        tier=CustomerTier.STANDARD,
        email=f"scheduled-{cid.hex[:6]}@example.com",
    )
    async_session.add(customer)
    await async_session.flush()
    return customer
@pytest.fixture
def scheduled_tenant_id() -> str:
    """Provide a unique tenant identifier for scheduled activation tests."""
    return f"tenant-scheduled-{uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def scheduled_customer(async_session, scheduled_tenant_id: str) -> Customer:
    """Create test customer for scheduled activation tests."""
    customer = Customer(
        id=uuid4(),
        tenant_id=scheduled_tenant_id,
        customer_number=f"CUST-{uuid4().hex[:8]}",
        first_name="Scheduled",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        customer_type=CustomerType.INDIVIDUAL,
        tier=CustomerTier.STANDARD,
        email="scheduled.test@example.com",
        phone="+1234567890",
        address_line1="123 Test St",
        city="Test City",
        state_province="TS",
        postal_code="12345",
        country="US",
    )
    async_session.add(customer)
    await async_session.flush()
    return customer


@pytest_asyncio.fixture
async def provisioned_service(
    async_session, scheduled_tenant_id: str, scheduled_customer: Customer
) -> ServiceInstance:
    """Create a provisioned service ready for activation."""
    service = ServiceInstance(
        id=uuid4(),
        tenant_id=scheduled_tenant_id,
        service_identifier=_unique_code("SVC-TEST"),
        service_name="Test Fiber Internet",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=scheduled_customer.id,
        status=ServiceStatus.PROVISIONING,
        service_config={
            "download_speed_mbps": 1000,
            "upload_speed_mbps": 500,
        },
        service_metadata={},
    )

    async_session.add(service)
    await async_session.flush()
    await async_session.refresh(service)

    return service


@pytest.mark.asyncio
async def test_schedule_service_activation(async_session, provisioned_service: ServiceInstance):
    """Test scheduling a service for future activation."""
    service = LifecycleOrchestrationService(async_session)

    # Schedule activation for 1 hour from now
    activation_time = datetime.now(UTC) + timedelta(hours=1)

    result = await service.schedule_service_activation(
        service_instance_id=provisioned_service.id,
        tenant_id=provisioned_service.tenant_id,
        activation_datetime=activation_time,
        user_id=uuid4(),
    )

    assert result["success"] is True
    assert result["service_instance_id"] == str(provisioned_service.id)
    assert "scheduled_activation_datetime" in result

    # Verify metadata was updated
    await async_session.refresh(provisioned_service)
    assert "scheduled_activation_datetime" in provisioned_service.service_metadata
    assert (
        provisioned_service.service_metadata["scheduled_activation_datetime"]
        == activation_time.isoformat()
    )


@pytest.mark.asyncio
async def test_schedule_activation_invalid_status(
    async_session, provisioned_service: ServiceInstance
):
    """Test that scheduling fails for invalid service status."""
    service = LifecycleOrchestrationService(async_session)

    # Mark service as already active
    provisioned_service.status = ServiceStatus.ACTIVE
    await async_session.flush()

    activation_time = datetime.now(UTC) + timedelta(hours=1)

    result = await service.schedule_service_activation(
        service_instance_id=provisioned_service.id,
        tenant_id=provisioned_service.tenant_id,
        activation_datetime=activation_time,
    )

    assert result["success"] is False
    assert "Cannot schedule activation" in result["error"]


@pytest.mark.asyncio
async def test_get_services_due_for_activation_past(
    async_session, provisioned_service: ServiceInstance
):
    """Test retrieving services due for activation (past scheduled time)."""
    service = LifecycleOrchestrationService(async_session)

    # Schedule activation for 1 hour ago (already due)
    past_time = datetime.now(UTC) - timedelta(hours=1)
    provisioned_service.service_metadata["scheduled_activation_datetime"] = past_time.isoformat()
    await async_session.flush()

    # Get due services
    due_services = await service.get_services_due_for_activation(
        tenant_id=provisioned_service.tenant_id
    )

    assert len(due_services) == 1
    assert due_services[0].id == provisioned_service.id


@pytest.mark.asyncio
async def test_get_services_due_for_activation_future(
    async_session, provisioned_service: ServiceInstance
):
    """Test that future scheduled activations are not returned as due."""
    service = LifecycleOrchestrationService(async_session)

    # Schedule activation for 1 hour from now (not yet due)
    future_time = datetime.now(UTC) + timedelta(hours=1)
    provisioned_service.service_metadata["scheduled_activation_datetime"] = future_time.isoformat()
    await async_session.flush()

    # Get due services
    due_services = await service.get_services_due_for_activation(
        tenant_id=provisioned_service.tenant_id
    )

    assert len(due_services) == 0


@pytest.mark.asyncio
async def test_get_services_due_for_activation_no_schedule(
    async_session, provisioned_service: ServiceInstance
):
    """Test that services without scheduled activation are not returned."""
    service = LifecycleOrchestrationService(async_session)

    # Don't set scheduled activation
    await async_session.flush()

    # Get due services
    due_services = await service.get_services_due_for_activation(
        tenant_id=provisioned_service.tenant_id
    )

    assert len(due_services) == 0


@pytest.mark.asyncio
async def test_scheduled_activation_workflow_end_to_end(
    async_session, provisioned_service: ServiceInstance
):
    """Test complete scheduled activation workflow."""
    service = LifecycleOrchestrationService(async_session)

    # Step 1: Schedule activation for now (immediately due)
    activation_time = datetime.now(UTC)
    await service.schedule_service_activation(
        service_instance_id=provisioned_service.id,
        tenant_id=provisioned_service.tenant_id,
        activation_datetime=activation_time,
    )

    # Step 2: Get due services
    due_services = await service.get_services_due_for_activation(
        tenant_id=provisioned_service.tenant_id
    )
    assert len(due_services) == 1

    # Step 3: Manually activate (simulating what the task would do)
    service_instance = due_services[0]
    service_instance.status = ServiceStatus.ACTIVE
    service_instance.activated_at = datetime.now(UTC)

    if "scheduled_activation_datetime" in service_instance.service_metadata:
        del service_instance.service_metadata["scheduled_activation_datetime"]
        from sqlalchemy.orm import attributes

        attributes.flag_modified(service_instance, "service_metadata")

    await async_session.flush()

    # Step 4: Verify activation
    await async_session.refresh(provisioned_service)
    assert provisioned_service.status == ServiceStatus.ACTIVE
    assert provisioned_service.activated_at is not None
    assert "scheduled_activation_datetime" not in provisioned_service.service_metadata


@pytest.mark.asyncio
async def test_multiple_scheduled_activations(async_session, scheduled_tenant_id: str):
    """Test scheduling multiple services for activation."""
    service = LifecycleOrchestrationService(async_session)

    # Create 3 services with different activation times
    services = []
    activation_times = [
        datetime.now(UTC) - timedelta(hours=2),  # Past - should be due
        datetime.now(UTC) - timedelta(minutes=30),  # Past - should be due
        datetime.now(UTC) + timedelta(hours=1),  # Future - not due
    ]

    for i, activation_time in enumerate(activation_times):
        customer = await _create_customer(async_session, scheduled_tenant_id)

        svc = ServiceInstance(
            id=uuid4(),
            tenant_id=scheduled_tenant_id,
            service_identifier=_unique_code("SVC-TEST"),
            service_name=f"Test Service {i}",
            service_type=ServiceType.FIBER_INTERNET,
            customer_id=customer.id,
            status=ServiceStatus.PROVISIONING,
            service_config={},
            service_metadata={"scheduled_activation_datetime": activation_time.isoformat()},
        )
        async_session.add(svc)
        services.append(svc)

    await async_session.flush()

    # Get due services
    due_services = await service.get_services_due_for_activation(tenant_id=scheduled_tenant_id)

    # Should only get the 2 past-scheduled services
    assert len(due_services) == 2
    due_ids = {svc.id for svc in due_services}
    assert services[0].id in due_ids
    assert services[1].id in due_ids
    assert services[2].id not in due_ids


@pytest.mark.asyncio
async def test_scheduled_activation_tenant_isolation(async_session):
    """Test that scheduled activations respect tenant boundaries."""
    service = LifecycleOrchestrationService(async_session)

    past_time = datetime.now(UTC) - timedelta(hours=1)

    # Create services for different tenants
    tenant1_id = f"tenant-{uuid4().hex[:6]}"
    tenant2_id = f"tenant-{uuid4().hex[:6]}"

    tenant1_customer = await _create_customer(async_session, tenant1_id)
    tenant2_customer = await _create_customer(async_session, tenant2_id)

    service1 = ServiceInstance(
        id=uuid4(),
        tenant_id=tenant1_id,
        service_identifier=_unique_code("SVC-T1"),
        service_name="Tenant 1 Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=tenant1_customer.id,
        status=ServiceStatus.PROVISIONING,
        service_config={},
        service_metadata={"scheduled_activation_datetime": past_time.isoformat()},
    )

    service2 = ServiceInstance(
        id=uuid4(),
        tenant_id=tenant2_id,
        service_identifier=_unique_code("SVC-T2"),
        service_name="Tenant 2 Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=tenant2_customer.id,
        status=ServiceStatus.PROVISIONING,
        service_config={},
        service_metadata={"scheduled_activation_datetime": past_time.isoformat()},
    )

    async_session.add_all([service1, service2])
    await async_session.flush()

    # Get due services for tenant-1 only
    due_services = await service.get_services_due_for_activation(tenant_id=tenant1_id)

    assert len(due_services) == 1
    assert due_services[0].id == service1.id
    assert due_services[0].tenant_id == tenant1_id
