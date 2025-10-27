"""
Test fixtures for Sales-to-Activation Automation tests
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from dotmac.platform.auth.rbac_service import RBACService, get_rbac_service
from dotmac.platform.db import Base
from dotmac.platform.dependencies import get_deployment_service
from dotmac.platform.deployment.models import DeploymentBackend, DeploymentTemplate
from dotmac.platform.sales.models import (
    ActivationStatus,
    ActivationWorkflow,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    ServiceActivation,
)
from dotmac.platform.sales.schemas import (
    OrderCreate,
    OrderSubmit,
    QuickOrderRequest,
    ServiceSelection,
)


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    return Mock(spec=Session)


@pytest.fixture
def mock_tenant_service():
    """Mock tenant service"""
    service = Mock()
    service.create_tenant = AsyncMock(return_value=Mock(id=str(uuid4()), slug="test-tenant"))
    return service


@pytest.fixture
def mock_deployment_service():
    """Mock deployment service"""
    service = Mock()
    instance = Mock(id=1, state="active")
    execution = Mock(id=1, status="succeeded")
    service.provision_deployment = AsyncMock(return_value=(instance, execution))
    return service


@pytest.fixture
def mock_notification_service():
    """Mock notification service"""
    service = Mock()
    service.send_notification = AsyncMock(return_value=None)
    return service


@pytest.fixture
def mock_email_service():
    """Mock email service"""
    service = Mock()
    service.send_email.return_value = None
    return service


@pytest.fixture
def mock_event_bus():
    """Mock event bus"""
    bus = Mock()
    bus.publish = AsyncMock(return_value=None)
    return bus


@pytest.fixture
def client(test_client):
    """Provide sync test client for API tests"""
    return test_client


# Use the global db_engine and db_session fixtures from tests/conftest.py
# They already create tables for all models including sales and deployment


@pytest.fixture
def db(db_session):
    """Alias for db_session to match test expectations"""
    # Clean up service_activations table before each test to prevent pollution
    from sqlalchemy.exc import DatabaseError

    from dotmac.platform.sales.models import ServiceActivation

    try:
        db_session.query(ServiceActivation).filter(
            ServiceActivation.order_id.isnot(None)  # Delete all test-created activations
        ).delete(synchronize_session=False)
        db_session.commit()
    except DatabaseError:
        # Table doesn't exist yet or other DB error, skip cleanup
        db_session.rollback()

    yield db_session

    # Clean up after test
    try:
        db_session.query(ServiceActivation).filter(ServiceActivation.order_id.isnot(None)).delete(
            synchronize_session=False
        )
        db_session.commit()
    except DatabaseError:
        # Table doesn't exist or other DB error, skip cleanup
        db_session.rollback()


@pytest.fixture
def sample_tenant(db: Session):
    """Create a sample tenant for testing."""
    from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

    Base.metadata.create_all(db.get_bind(), checkfirst=True)

    tenant = Tenant(
        id=f"tenant-{uuid4().hex}",
        name="Test ISP Company",
        slug=f"tenant-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.ENTERPRISE,
        billing_cycle=BillingCycle.MONTHLY,
        email="admin@test-isp.com",
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    try:
        yield tenant
    finally:
        db.delete(tenant)
        db.commit()


@pytest.fixture
def sample_deployment_template(db: Session) -> DeploymentTemplate:
    """Create a sample deployment template."""
    from dotmac.platform.deployment.models import DeploymentType

    Base.metadata.create_all(db.get_bind(), checkfirst=True)

    template = DeploymentTemplate(
        name=f"standard-cloud-{uuid4().hex[:6]}",
        display_name="Standard Cloud Deployment",
        description="Standard cloud deployment",
        backend=DeploymentBackend.KUBERNETES,
        deployment_type=DeploymentType.CLOUD_DEDICATED,
        version="1.0.0",
        helm_chart_url="https://charts.dotmac.io/platform",
        helm_chart_version="1.0.0",
        cpu_cores=4,
        memory_gb=16,
        storage_gb=100,
        is_active=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    try:
        yield template
    finally:
        db.delete(template)
        db.commit()


@pytest.fixture
def sample_order_create() -> OrderCreate:
    """Sample order creation request"""
    return OrderCreate(
        customer_email="admin@example.com",
        customer_name="John Smith",
        customer_phone="+1-555-0100",
        company_name="Example ISP Inc.",
        organization_slug="example-isp",
        organization_name="Example ISP Inc.",
        deployment_region="us-east-1",
        selected_services=[
            ServiceSelection(
                service_code="subscriber-provisioning",
                name="Subscriber Management",
                quantity=1,
            ),
            ServiceSelection(
                service_code="billing-invoicing",
                name="Billing & Invoicing",
                quantity=1,
            ),
        ],
        currency="USD",
        billing_cycle="monthly",
        source="public_api",
    )


@pytest.fixture
def sample_quick_order() -> QuickOrderRequest:
    """Sample quick order request"""
    return QuickOrderRequest(
        email="admin@example.com",
        name="John Smith",
        company="Example ISP Inc.",
        package_code="professional",
        billing_cycle="monthly",
        region="us-east-1",
        organization_slug="example-isp",
    )


@pytest.fixture
def sample_order(
    db: Session, sample_deployment_template: DeploymentTemplate, sample_tenant
) -> Order:
    """Create a sample order for testing."""

    Base.metadata.create_all(db.get_bind(), checkfirst=True)

    order = Order(
        order_number=f"ORD-{uuid4().hex[:12].upper()}",
        order_type=OrderType.NEW_TENANT,
        status=OrderStatus.DRAFT,
        customer_email="admin@example.com",
        customer_name="John Smith",
        customer_phone="+1-555-0100",
        company_name="Example ISP Inc.",
        organization_slug=f"example-{uuid4().hex[:8]}",
        deployment_template_id=sample_deployment_template.id,
        deployment_region="us-east-1",
        selected_services=[
            {
                "service_code": "subscriber-provisioning",
                "name": "Subscriber Management",
                "quantity": 1,
            },
            {
                "service_code": "billing-invoicing",
                "name": "Billing & Invoicing",
                "quantity": 1,
            },
        ],
        currency="USD",
        subtotal=Decimal("248.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("248.00"),
        billing_cycle="monthly",
        source="public_api",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    try:
        yield order
    finally:
        db.delete(order)
        db.commit()


@pytest.fixture
def sample_order_items(db: Session, sample_order: Order) -> list[OrderItem]:
    """Create sample order items"""
    items = [
        OrderItem(
            order_id=sample_order.id,
            item_type="service",
            service_code="subscriber-provisioning",
            name="Subscriber Management",
            quantity=1,
            unit_price=Decimal("99.00"),
            total_amount=Decimal("99.00"),
            billing_cycle="monthly",
        ),
        OrderItem(
            order_id=sample_order.id,
            item_type="service",
            service_code="billing-invoicing",
            name="Billing & Invoicing",
            quantity=1,
            unit_price=Decimal("149.00"),
            total_amount=Decimal("149.00"),
            billing_cycle="monthly",
        ),
    ]
    for item in items:
        db.add(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


@pytest.fixture
def sample_service_activations(
    db: Session, sample_order: Order, sample_tenant
) -> list[ServiceActivation]:
    """Create sample service activations"""
    activations = [
        ServiceActivation(
            order_id=sample_order.id,
            tenant_id=sample_tenant.id,
            service_code="subscriber-provisioning",
            service_name="Subscriber Management",
            activation_status=ActivationStatus.COMPLETED,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_seconds=90,
            success=True,
            sequence_number=1,
        ),
        ServiceActivation(
            order_id=sample_order.id,
            tenant_id=sample_tenant.id,
            service_code="billing-invoicing",
            service_name="Billing & Invoicing",
            activation_status=ActivationStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
            sequence_number=2,
        ),
    ]
    for activation in activations:
        db.add(activation)
    db.commit()
    for activation in activations:
        db.refresh(activation)
    return activations


@pytest.fixture
def sample_activation_workflow(
    db: Session, sample_deployment_template: DeploymentTemplate
) -> ActivationWorkflow:
    """Create sample activation workflow"""
    workflow = ActivationWorkflow(
        name="Standard ISP Activation",
        description="Standard activation workflow",
        deployment_template_id=sample_deployment_template.id,
        service_sequence=[
            {
                "service": "subscriber-provisioning",
                "sequence": 1,
                "depends_on": [],
            },
            {
                "service": "billing-invoicing",
                "sequence": 2,
                "depends_on": ["subscriber-provisioning"],
            },
        ],
        auto_activate=True,
        is_active=True,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@pytest.fixture
def sample_order_submit() -> OrderSubmit:
    """Sample order submission request"""
    return OrderSubmit(
        payment_reference="PAY-123456",
        contract_reference="CONTRACT-789",
        auto_activate=False,
    )


@pytest.fixture
def auth_client(client, auth_headers):
    """Authenticated TestClient with default headers for internal API tests."""
    original_all_permissions = RBACService.user_has_all_permissions
    original_any_permission = (
        RBACService.user_has_any_permission
        if hasattr(RBACService, "user_has_any_permission")
        else None
    )
    original_get_permissions = RBACService.get_user_permissions

    async def _allow_all_permissions(self, user_id, permissions):  # noqa: D401
        return True

    async def _allow_any_permission(self, user_id, permissions):  # noqa: D401
        return True

    async def _return_permissions(self, user_id):  # noqa: D401
        return {"order.read", "order.submit", "order.process", "order.update", "order.delete"}

    RBACService.user_has_all_permissions = _allow_all_permissions  # type: ignore[assignment]
    if original_any_permission is not None:
        RBACService.user_has_any_permission = _allow_any_permission  # type: ignore[assignment]
    RBACService.get_user_permissions = _return_permissions  # type: ignore[assignment]

    class _AllowAllRBACService:
        async def user_has_all_permissions(self, *args, **kwargs):
            return True

        async def user_has_permission(self, *args, **kwargs):
            return True

        async def get_user_permissions(self, *args, **kwargs):
            return {"order.read", "order.submit", "order.process", "order.update", "order.delete"}

        async def get_user_roles(self, *args, **kwargs):
            return {"admin"}

    class _MockDeploymentService:
        async def provision_deployment(self, *args, **kwargs):  # noqa: D401
            return Mock(id=1, state="active"), Mock(id=1, status="succeeded")

    client.app.dependency_overrides[get_rbac_service] = lambda: _AllowAllRBACService()
    client.app.dependency_overrides[get_deployment_service] = lambda: _MockDeploymentService()
    original_headers = dict(client.headers)
    client.headers.update(auth_headers)
    try:
        yield client
    finally:
        client.headers.clear()
        client.headers.update(original_headers)
        client.app.dependency_overrides.pop(get_rbac_service, None)
        client.app.dependency_overrides.pop(get_deployment_service, None)
        RBACService.user_has_all_permissions = original_all_permissions  # type: ignore[assignment]
        if original_any_permission is not None:
            RBACService.user_has_any_permission = original_any_permission  # type: ignore[assignment]
        RBACService.get_user_permissions = original_get_permissions  # type: ignore[assignment]


# Factory functions for creating test data


def create_order(
    db: Session,
    order_number: str | None = None,
    status: OrderStatus = OrderStatus.DRAFT,
    **kwargs: Any,
) -> Order:
    """Factory function to create an order"""
    order_number_value = order_number or f"ORD-{uuid4().hex[:8].upper()}"

    defaults = {
        "order_number": order_number_value,
        "order_type": OrderType.NEW_TENANT,
        "status": status,
        "customer_email": "test@example.com",
        "customer_name": "Test User",
        "company_name": "Test Company",
        "currency": "USD",
        "subtotal": Decimal("100.00"),
        "tax_amount": Decimal("0.00"),
        "total_amount": Decimal("100.00"),
        "selected_services": [],
    }
    defaults.update(kwargs)

    order = Order(**defaults)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def create_order_item(
    db: Session,
    order_id: int,
    service_code: str = "test-service",
    **kwargs: Any,
) -> OrderItem:
    """Factory function to create an order item"""
    defaults = {
        "order_id": order_id,
        "item_type": "service",
        "service_code": service_code,
        "name": f"{service_code.replace('-', ' ').title()}",
        "quantity": 1,
        "unit_price": Decimal("99.00"),
        "total_amount": Decimal("99.00"),
    }
    defaults.update(kwargs)

    item = OrderItem(**defaults)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_service_activation(
    db: Session,
    order_id: int,
    tenant_id: str | None = None,
    service_code: str = "test-service",
    **kwargs: Any,
) -> ServiceActivation:
    """Factory function to create a service activation"""
    tenant_value = tenant_id or str(uuid4())
    if isinstance(tenant_value, int):
        tenant_value = str(tenant_value)

    defaults = {
        "order_id": order_id,
        "tenant_id": tenant_value,
        "service_code": service_code,
        "service_name": f"{service_code.replace('-', ' ').title()}",
        "activation_status": ActivationStatus.PENDING,
        "success": False,
        "retry_count": 0,
    }
    defaults.update(kwargs)

    activation = ServiceActivation(**defaults)
    db.add(activation)
    db.commit()
    db.refresh(activation)
    return activation
