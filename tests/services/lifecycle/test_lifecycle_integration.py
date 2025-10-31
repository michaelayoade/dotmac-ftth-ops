"""
Integration tests for service lifecycle workflows.

Tests complete lifecycle: provision → activate → suspend → resume → terminate
"""

import inspect
from datetime import timezone, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.exceptions import (
    BusinessRuleError,
    ValidationError,
)
from dotmac.platform.customer_management.models import (
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.services.lifecycle.models import (
    LifecycleEvent,
    LifecycleEventType,
    ProvisioningStatus,
    ServiceStatus,
    ServiceType,
)
from dotmac.platform.services.lifecycle.schemas import (
    ServiceModificationRequest,
    ServiceProvisionRequest,
)
from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService


async def _provision_service_instance(
    lifecycle_service: LifecycleOrchestrationService,
    tenant_id: str,
    provision_request: ServiceProvisionRequest,
    db_session: AsyncSession,
    **kwargs: Any,
):
    """Provision a service and return the persisted instance."""
    response = await lifecycle_service.provision_service(
        tenant_id=tenant_id,
        data=provision_request,
        **kwargs,
    )
    await db_session.commit()
    service = await lifecycle_service.get_service_instance(response.service_instance_id, tenant_id)
    assert service is not None
    return service


@pytest.fixture
def test_tenant_id() -> str:
    """Provide tenant id for lifecycle tests."""
    return "tenant-lifecycle-test"


@pytest_asyncio.fixture
async def lifecycle_service(db_session: AsyncSession) -> LifecycleOrchestrationService:
    """Create LifecycleOrchestrationService instance."""
    return LifecycleOrchestrationService(db_session)


@pytest_asyncio.fixture
async def test_customer(db_session: AsyncSession, test_tenant_id: str) -> Customer:
    """Create test customer for lifecycle tests."""
    customer = Customer(
        id=uuid4(),
        tenant_id=test_tenant_id,
        customer_number=f"CUST-{uuid4().hex[:8]}",
        first_name="Lifecycle",
        last_name="Customer",
        status=CustomerStatus.ACTIVE,
        customer_type=CustomerType.INDIVIDUAL,
        tier=CustomerTier.STANDARD,
        email="lifecycle.test@example.com",
        phone="+1234567890",
        address_line1="123 Test St",
        city="Test City",
        state_province="TS",
        postal_code="12345",
        country="USA",
    )
    db_session.add(customer)
    flush_result = db_session.flush()
    if inspect.isawaitable(flush_result):
        await flush_result
    return customer


@pytest.fixture
def test_service_provision_request(test_customer: Customer) -> ServiceProvisionRequest:
    """Create test service provisioning request."""
    return ServiceProvisionRequest(
        customer_id=test_customer.id,
        service_type=ServiceType.FIBER_INTERNET,
        service_name="Test Fiber Internet 100 Mbps",
        plan_id="plan_fiber_100",
        service_config={
            "bandwidth_down_mbps": 100,
            "bandwidth_up_mbps": 50,
            "static_ip": "203.0.113.10",
            "vlan_id": 100,
        },
        installation_address="123 Test St, Test City, TS 12345",
        installation_scheduled_date=datetime.now(timezone.utc) + timedelta(days=7),
    )


@pytest.mark.integration
class TestServiceProvisioning:
    """Test service provisioning workflows."""

    @pytest.mark.asyncio
    async def test_provision_service_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service provisioning."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Verify service created
        assert service.id is not None
        assert service.tenant_id == test_tenant_id
        assert service.service_identifier.startswith("SVC-")
        assert service.customer_id == test_service_provision_request.customer_id
        assert service.service_type == ServiceType.FIBER_INTERNET
        assert service.service_name == "Test Fiber Internet 100 Mbps"
        assert service.status == ServiceStatus.ACTIVE  # Auto-activated
        assert service.provisioning_status == ProvisioningStatus.COMPLETED
        assert service.provisioned_at is not None
        assert service.activated_at is not None
        assert service.service_config["bandwidth_down_mbps"] == 100
        assert service.installation_address == "123 Test St, Test City, TS 12345"

        # Verify lifecycle events created
        stmt = select(LifecycleEvent).where(LifecycleEvent.service_instance_id == service.id)
        result = await db_session.execute(stmt)
        events = result.scalars().all()
        assert len(events) >= 2  # PROVISION_STARTED, PROVISION_COMPLETED
        event_types = [e.event_type for e in events]
        assert LifecycleEventType.PROVISION_STARTED in event_types
        assert LifecycleEventType.PROVISION_COMPLETED in event_types

    @pytest.mark.asyncio
    async def test_provision_service_validation_error(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test provisioning fails with invalid data."""
        # Create invalid request (missing required service_config)
        invalid_request = ServiceProvisionRequest.model_construct(
            customer_id=test_customer.id,
            service_type=ServiceType.FIBER_INTERNET,
            service_name="",  # Empty name should fail validation
            plan_id="plan_test",
            service_config={},
        )

        with pytest.raises(ValidationError):
            await lifecycle_service.provision_service(
                tenant_id=test_tenant_id,
                data=invalid_request,
            )

    @pytest.mark.asyncio
    async def test_provision_service_with_subscription(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test provisioning service linked to subscription."""
        # Add subscription ID to request
        test_service_provision_request.subscription_id = "sub_test123"

        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        assert service.subscription_id == "sub_test123"


@pytest.mark.integration
class TestServiceActivation:
    """Test service activation workflows."""

    @pytest.mark.asyncio
    async def test_activate_service_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service activation."""
        # Provision service without auto-activation
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
            auto_activate=False,
        )

        assert service.status == ServiceStatus.PENDING

        # Activate service
        activated = await lifecycle_service.activate_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
        )
        await db_session.commit()

        # Verify activation
        assert activated.status == ServiceStatus.ACTIVE
        assert activated.activated_at is not None

        # Verify activation event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.ACTIVATION_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None

    @pytest.mark.asyncio
    async def test_activate_already_active_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test activating already active service."""
        # Provision service (auto-activated)
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        assert service.status == ServiceStatus.ACTIVE

        # Try to activate again
        with pytest.raises(BusinessRuleError):
            await lifecycle_service.activate_service(
                service_id=service.id,
                tenant_id=test_tenant_id,
            )


@pytest.mark.integration
class TestServiceSuspension:
    """Test service suspension workflows."""

    @pytest.mark.asyncio
    async def test_suspend_service_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service suspension."""
        # Provision and activate service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        assert service.status == ServiceStatus.ACTIVE

        # Suspend service
        suspended = await lifecycle_service.suspend_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Non-payment",
            suspended_by_user_id=uuid4(),
        )
        await db_session.commit()

        # Verify suspension
        assert suspended.status == ServiceStatus.SUSPENDED
        assert suspended.suspended_at is not None

        # Verify suspension event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.SUSPENSION_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None
        assert event.event_data.get("suspension_reason") == "Non-payment"

    @pytest.mark.asyncio
    async def test_suspend_fraud_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test fraud suspension."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Suspend for fraud
        suspended = await lifecycle_service.suspend_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Suspected fraud activity",
            fraud_suspension=True,
        )
        await db_session.commit()

        assert suspended.status == ServiceStatus.SUSPENDED_FRAUD

    @pytest.mark.asyncio
    async def test_suspend_non_active_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test suspending non-active service fails."""
        # Provision without activation
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
            auto_activate=False,
        )

        assert service.status == ServiceStatus.PENDING

        # Try to suspend non-active service
        with pytest.raises(BusinessRuleError):
            await lifecycle_service.suspend_service(
                service_id=service.id,
                tenant_id=test_tenant_id,
                reason="Test",
            )


@pytest.mark.integration
class TestServiceResumption:
    """Test service resumption workflows."""

    @pytest.mark.asyncio
    async def test_resume_service_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service resumption."""
        # Provision, activate, and suspend service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )
        suspended = await lifecycle_service.suspend_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Non-payment",
        )
        await db_session.commit()

        assert suspended.status == ServiceStatus.SUSPENDED

        # Resume service
        resumed = await lifecycle_service.resume_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            resumed_by_user_id=uuid4(),
        )
        await db_session.commit()

        # Verify resumption
        assert resumed.status == ServiceStatus.ACTIVE
        assert resumed.suspended_at is None  # Cleared

        # Verify resumption event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.RESUMPTION_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None

    @pytest.mark.asyncio
    async def test_resume_non_suspended_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test resuming non-suspended service fails."""
        # Provision active service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        assert service.status == ServiceStatus.ACTIVE

        # Try to resume active service
        with pytest.raises(BusinessRuleError):
            await lifecycle_service.resume_service(
                service_id=service.id,
                tenant_id=test_tenant_id,
            )


@pytest.mark.integration
class TestServiceTermination:
    """Test service termination workflows."""

    @pytest.mark.asyncio
    async def test_terminate_service_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service termination."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Terminate service
        terminated = await lifecycle_service.terminate_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Customer cancellation",
            terminated_by_user_id=uuid4(),
        )
        await db_session.commit()

        # Verify termination
        assert terminated.status == ServiceStatus.TERMINATED
        assert terminated.terminated_at is not None

        # Verify termination event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.TERMINATION_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None
        assert event.event_data.get("termination_reason") == "Customer cancellation"

    @pytest.mark.asyncio
    async def test_terminate_suspended_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test terminating suspended service."""
        # Provision and suspend service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )
        await lifecycle_service.suspend_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Non-payment",
        )
        await db_session.commit()

        # Terminate suspended service
        terminated = await lifecycle_service.terminate_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Long-term non-payment",
        )
        await db_session.commit()

        assert terminated.status == ServiceStatus.TERMINATED

    @pytest.mark.asyncio
    async def test_terminate_already_terminated_service(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test terminating already terminated service fails."""
        # Provision and terminate service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )
        await lifecycle_service.terminate_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Test",
        )
        await db_session.commit()

        # Try to terminate again
        with pytest.raises(BusinessRuleError):
            await lifecycle_service.terminate_service(
                service_id=service.id,
                tenant_id=test_tenant_id,
                reason="Test again",
            )


@pytest.mark.integration
class TestServiceModification:
    """Test service modification workflows."""

    @pytest.mark.asyncio
    async def test_modify_service_config_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful service configuration modification."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        original_bandwidth = service.service_config["bandwidth_down_mbps"]
        assert original_bandwidth == 100

        # Modify service (upgrade bandwidth)
        modification_request = ServiceModificationRequest.model_construct(
            service_instance_id=service.id,
            modification_reason="Bandwidth upgrade",
            service_config={
                "bandwidth_down_mbps": 200,  # Upgrade to 200 Mbps
                "bandwidth_up_mbps": 100,
            },
        )
        modified_result = await lifecycle_service.modify_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            data=modification_request,
        )
        await db_session.commit()

        if hasattr(modified_result, "service_config"):
            modified = modified_result
        else:
            modified = await lifecycle_service.get_service_instance(service.id, test_tenant_id)

        # Verify modification
        assert modified.service_config["bandwidth_down_mbps"] == 200
        assert modified.service_config["bandwidth_up_mbps"] == 100

        # Verify modification event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.MODIFICATION_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None
        changes = event.event_data.get("changes", {})
        assert changes.get("bandwidth_down_mbps", {}).get("old") == 100
        assert changes.get("bandwidth_down_mbps", {}).get("new") == 200


@pytest.mark.integration
class TestServiceHealthChecks:
    """Test service health check workflows."""

    @pytest.mark.asyncio
    async def test_perform_health_check_success(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test successful health check."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Perform health check
        health_result = await lifecycle_service.perform_health_check(
            service_id=service.id,
            tenant_id=test_tenant_id,
        )
        await db_session.commit()

        # Verify health check
        assert health_result.is_healthy is True
        assert health_result.checks_performed >= 1

        # Verify health check event
        stmt = select(LifecycleEvent).where(
            LifecycleEvent.service_instance_id == service.id,
            LifecycleEvent.event_type == LifecycleEventType.HEALTH_CHECK_COMPLETED,
        )
        result = await db_session.execute(stmt)
        event = result.scalar_one()
        assert event is not None


@pytest.mark.integration
class TestBulkOperations:
    """Test bulk service operations."""

    @pytest.mark.asyncio
    async def test_bulk_suspend_services(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test bulk suspension of services."""
        # Create multiple services
        service_ids = []
        for i in range(3):
            request = ServiceProvisionRequest(
                customer_id=test_customer.id,
                service_type=ServiceType.FIBER_INTERNET,
                service_name=f"Bulk Test Service {i + 1}",
                plan_id=f"plan_bulk_{i}",
                service_config={"bandwidth_down_mbps": 100},
            )
            service_instance = await _provision_service_instance(
                lifecycle_service,
                test_tenant_id,
                request,
                db_session,
            )
            service_ids.append(service_instance.id)

        # Bulk suspend
        results = await lifecycle_service.bulk_service_operation(
            service_ids=service_ids,
            tenant_id=test_tenant_id,
            operation="suspend",
            reason="Bulk test suspension",
        )
        await db_session.commit()

        # Verify all suspended
        assert len(results) == 3
        assert all(r.status == ServiceStatus.SUSPENDED for r in results)

    @pytest.mark.asyncio
    async def test_bulk_resume_services(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test bulk resumption of services."""
        # Create and suspend multiple services
        service_ids = []
        for i in range(2):
            request = ServiceProvisionRequest(
                customer_id=test_customer.id,
                service_type=ServiceType.FIBER_INTERNET,
                service_name=f"Bulk Resume Test {i + 1}",
                plan_id=f"plan_resume_{i}",
                service_config={"bandwidth_down_mbps": 100},
            )
            service_instance = await _provision_service_instance(
                lifecycle_service,
                test_tenant_id,
                request,
                db_session,
            )
            await lifecycle_service.suspend_service(
                service_id=service_instance.id,
                tenant_id=test_tenant_id,
                reason="Test",
            )
            service_ids.append(service_instance.id)

        # Bulk resume
        results = await lifecycle_service.bulk_service_operation(
            service_ids=service_ids,
            tenant_id=test_tenant_id,
            operation="resume",
        )
        await db_session.commit()

        # Verify all resumed
        assert len(results) == 2
        assert all(r.status == ServiceStatus.ACTIVE for r in results)


@pytest.mark.integration
class TestLifecycleEvents:
    """Test lifecycle event tracking."""

    @pytest.mark.asyncio
    async def test_lifecycle_events_recorded(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test complete lifecycle event tracking."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Suspend
        await lifecycle_service.suspend_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Test",
        )

        # Resume
        await lifecycle_service.resume_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
        )

        # Terminate
        await lifecycle_service.terminate_service(
            service_id=service.id,
            tenant_id=test_tenant_id,
            reason="Test complete",
        )
        await db_session.commit()

        # Get all events
        events = await lifecycle_service.get_lifecycle_events(
            service_id=service.id,
            tenant_id=test_tenant_id,
        )

        # Verify events
        assert len(events) >= 6
        event_types = [e.event_type for e in events]
        assert LifecycleEventType.PROVISION_STARTED in event_types
        assert LifecycleEventType.PROVISION_COMPLETED in event_types
        assert LifecycleEventType.SUSPENSION_COMPLETED in event_types
        assert LifecycleEventType.RESUMPTION_COMPLETED in event_types
        assert LifecycleEventType.TERMINATION_COMPLETED in event_types

    @pytest.mark.asyncio
    async def test_get_events_by_type(
        self,
        lifecycle_service: LifecycleOrchestrationService,
        test_tenant_id: str,
        test_service_provision_request: ServiceProvisionRequest,
        db_session: AsyncSession,
    ):
        """Test filtering events by type."""
        # Provision service
        service = await _provision_service_instance(
            lifecycle_service,
            test_tenant_id,
            test_service_provision_request,
            db_session,
        )

        # Get only provisioning events
        events = await lifecycle_service.get_lifecycle_events(
            service_id=service.id,
            tenant_id=test_tenant_id,
            event_type=LifecycleEventType.PROVISION_COMPLETED,
        )

        assert len(events) >= 1
        assert all(e.event_type == LifecycleEventType.PROVISION_COMPLETED for e in events)


@pytest_asyncio.fixture
async def db_session(async_db_session: AsyncSession) -> AsyncSession:
    """Alias async session fixture expected by tests."""
    return async_db_session
