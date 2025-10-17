"""
Test fixtures for Sales-to-Activation Automation tests
"""

import pytest
from datetime import datetime
from decimal import Decimal
from typing import Any
from unittest.mock import Mock

from sqlalchemy.orm import Session

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
from dotmac.platform.deployment.models import DeploymentTemplate, DeploymentBackend


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    return Mock(spec=Session)


@pytest.fixture
def mock_tenant_service():
    """Mock tenant service"""
    service = Mock()
    service.create_tenant.return_value = Mock(id=1, slug="test-tenant")
    return service


@pytest.fixture
def mock_deployment_service():
    """Mock deployment service"""
    service = Mock()
    instance = Mock(id=1, state="active")
    execution = Mock(id=1, status="succeeded")
    service.provision_deployment.return_value = (instance, execution)
    return service


@pytest.fixture
def mock_notification_service():
    """Mock notification service"""
    service = Mock()
    service.send_notification.return_value = None
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
    bus.publish.return_value = None
    return bus


@pytest.fixture
def sample_deployment_template(db: Session) -> DeploymentTemplate:
    """Create a sample deployment template"""
    template = DeploymentTemplate(
        name="standard-cloud",
        description="Standard cloud deployment",
        backend=DeploymentBackend.KUBERNETES,
        helm_chart="dotmac/platform",
        chart_version="1.0.0",
        default_region="us-east-1",
        resource_cpu_default=4,
        resource_memory_default=16,
        resource_storage_default=100,
        is_active=True,
        is_default=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


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
def sample_order(db: Session, sample_deployment_template: DeploymentTemplate) -> Order:
    """Create a sample order"""
    order = Order(
        order_number="ORD-20251016-1001",
        order_type=OrderType.NEW_TENANT,
        status=OrderStatus.DRAFT,
        customer_email="admin@example.com",
        customer_name="John Smith",
        customer_phone="+1-555-0100",
        company_name="Example ISP Inc.",
        organization_slug="example-isp",
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
    return order


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
    db: Session, sample_order: Order
) -> list[ServiceActivation]:
    """Create sample service activations"""
    activations = [
        ServiceActivation(
            order_id=sample_order.id,
            tenant_id=1,
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
            tenant_id=1,
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
        auto_activate=True,
    )


# Factory functions for creating test data


def create_order(
    db: Session,
    order_number: str = "ORD-TEST-0001",
    status: OrderStatus = OrderStatus.DRAFT,
    **kwargs: Any,
) -> Order:
    """Factory function to create an order"""
    defaults = {
        "order_number": order_number,
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
    tenant_id: int,
    service_code: str = "test-service",
    **kwargs: Any,
) -> ServiceActivation:
    """Factory function to create a service activation"""
    defaults = {
        "order_id": order_id,
        "tenant_id": tenant_id,
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
