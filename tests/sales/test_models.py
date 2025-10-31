
"""
Unit tests for Sales order models
"""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

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

from .conftest import (
    create_order,
    create_order_item,
    create_service_activation,
)




pytestmark = pytest.mark.unit

class TestOrderModel:
    """Tests for Order model"""

    def test_create_order(self, db: Session, sample_deployment_template):
        """Test creating an order"""
        order = Order(
            order_number="ORD-TEST-0001",
            order_type=OrderType.NEW_TENANT,
            status=OrderStatus.DRAFT,
            customer_email="test@example.com",
            customer_name="Test User",
            company_name="Test Company",
            deployment_template_id=sample_deployment_template.id,
            currency="USD",
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("10.00"),
            total_amount=Decimal("110.00"),
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        assert order.id is not None
        assert order.order_number == "ORD-TEST-0001"
        assert order.status == OrderStatus.DRAFT
        assert order.customer_email == "test@example.com"
        assert order.total_amount == Decimal("110.00")
        assert order.created_at is not None
        assert order.updated_at is not None

    def test_order_relationships(self, db: Session, sample_order, sample_order_items):
        """Test order relationships"""
        # Test items relationship
        assert len(sample_order.items) == 2
        assert all(isinstance(item, OrderItem) for item in sample_order.items)

        # Test item order reference
        for item in sample_order.items:
            assert item.order_id == sample_order.id
            assert item.order == sample_order

    def test_order_status_transitions(self, db: Session):
        """Test order status transitions"""
        order = create_order(db, status=OrderStatus.DRAFT)

        # Draft -> Submitted
        order.status = OrderStatus.SUBMITTED
        db.commit()
        assert order.status == OrderStatus.SUBMITTED

        # Submitted -> Validating
        order.status = OrderStatus.VALIDATING
        db.commit()
        assert order.status == OrderStatus.VALIDATING

        # Validating -> Approved
        order.status = OrderStatus.APPROVED
        db.commit()
        assert order.status == OrderStatus.APPROVED

        # Approved -> Provisioning
        order.status = OrderStatus.PROVISIONING
        db.commit()
        assert order.status == OrderStatus.PROVISIONING

        # Provisioning -> Activating
        order.status = OrderStatus.ACTIVATING
        db.commit()
        assert order.status == OrderStatus.ACTIVATING

        # Activating -> Active
        order.status = OrderStatus.ACTIVE
        db.commit()
        assert order.status == OrderStatus.ACTIVE

    def test_order_json_fields(self, db: Session):
        """Test JSON field storage"""
        order = create_order(
            db,
            selected_services=[
                {"service_code": "service1", "name": "Service 1"},
                {"service_code": "service2", "name": "Service 2"},
            ],
            service_configuration={"region": "us-east-1", "plan": "professional"},
            features_enabled={"feature1": True, "feature2": False},
            billing_address={
                "street": "123 Main St",
                "city": "New York",
                "country": "USA",
            },
        )

        assert len(order.selected_services) == 2
        assert order.service_configuration["region"] == "us-east-1"
        assert order.features_enabled["feature1"] is True
        assert order.billing_address["city"] == "New York"

    def test_order_repr(self, db: Session, sample_order):
        """Test order string representation"""
        repr_str = repr(sample_order)
        assert "Order" in repr_str
        assert sample_order.order_number in repr_str
        assert "draft" in repr_str


class TestOrderItemModel:
    """Tests for OrderItem model"""

    def test_create_order_item(self, db: Session, sample_order):
        """Test creating an order item"""
        item = OrderItem(
            order_id=sample_order.id,
            item_type="service",
            service_code="test-service",
            name="Test Service",
            quantity=2,
            unit_price=Decimal("50.00"),
            discount_amount=Decimal("5.00"),
            tax_amount=Decimal("4.50"),
            total_amount=Decimal("99.50"),
            billing_cycle="monthly",
        )

        db.add(item)
        db.commit()
        db.refresh(item)

        assert item.id is not None
        assert item.order_id == sample_order.id
        assert item.service_code == "test-service"
        assert item.quantity == 2
        assert item.unit_price == Decimal("50.00")
        assert item.total_amount == Decimal("99.50")

    def test_order_item_configuration(self, db: Session, sample_order):
        """Test order item configuration field"""
        item = create_order_item(
            db,
            order_id=sample_order.id,
            configuration={
                "bandwidth": "100mbps",
                "ip_addresses": 5,
                "features": ["monitoring", "backup"],
            },
        )

        assert item.configuration["bandwidth"] == "100mbps"
        assert item.configuration["ip_addresses"] == 5
        assert "monitoring" in item.configuration["features"]

    def test_order_item_repr(self, db: Session, sample_order):
        """Test order item string representation"""
        item = create_order_item(db, order_id=sample_order.id)
        repr_str = repr(item)
        assert "OrderItem" in repr_str
        assert item.service_code in repr_str


class TestServiceActivationModel:
    """Tests for ServiceActivation model"""

    def test_create_service_activation(self, db: Session, sample_order):
        """Test creating a service activation"""
        tenant_id = str(uuid4())
        activation = ServiceActivation(
            order_id=sample_order.id,
            tenant_id=tenant_id,
            service_code="test-service",
            service_name="Test Service",
            activation_status=ActivationStatus.PENDING,
            sequence_number=1,
        )

        db.add(activation)
        db.commit()
        db.refresh(activation)

        assert activation.id is not None
        assert activation.order_id == sample_order.id
        assert activation.tenant_id == tenant_id
        assert activation.service_code == "test-service"
        assert activation.activation_status == ActivationStatus.PENDING
        assert activation.success is False
        assert activation.retry_count == 0

    def test_service_activation_lifecycle(self, db: Session, sample_order):
        """Test service activation status lifecycle"""
        tenant_id = str(uuid4())
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=tenant_id,
            activation_status=ActivationStatus.PENDING,
        )

        # Pending -> In Progress
        activation.activation_status = ActivationStatus.IN_PROGRESS
        activation.started_at = datetime.utcnow()
        db.commit()
        assert activation.activation_status == ActivationStatus.IN_PROGRESS
        assert activation.started_at is not None

        # In Progress -> Completed
        activation.activation_status = ActivationStatus.COMPLETED
        activation.completed_at = datetime.utcnow()
        activation.success = True
        activation.duration_seconds = 90
        db.commit()
        assert activation.activation_status == ActivationStatus.COMPLETED
        assert activation.completed_at is not None
        assert activation.success is True
        assert activation.duration_seconds == 90

    def test_service_activation_failure(self, db: Session, sample_order):
        """Test service activation failure tracking"""
        tenant_id = str(uuid4())
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=tenant_id,
            activation_status=ActivationStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
        )

        # Mark as failed
        activation.activation_status = ActivationStatus.FAILED
        activation.completed_at = datetime.utcnow()
        activation.success = False
        activation.error_message = "Connection timeout"
        activation.error_details = {"code": "TIMEOUT", "timeout_seconds": 300}
        activation.retry_count = 1
        db.commit()

        assert activation.activation_status == ActivationStatus.FAILED
        assert activation.success is False
        assert activation.error_message == "Connection timeout"
        assert activation.error_details["code"] == "TIMEOUT"
        assert activation.retry_count == 1

    def test_service_activation_dependencies(self, db: Session, sample_order):
        """Test service activation dependencies"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="dependent-service",
            depends_on=["base-service", "auth-service"],
            blocks=["addon-service"],
        )

        assert "base-service" in activation.depends_on
        assert "auth-service" in activation.depends_on
        assert "addon-service" in activation.blocks

    def test_service_activation_data(self, db: Session, sample_order):
        """Test service activation data storage"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            activation_status=ActivationStatus.COMPLETED,
            activation_data={
                "endpoints": {
                    "api": "https://api.example.com/v1",
                    "ui": "https://app.example.com",
                },
                "credentials": {
                    "api_key": "key_12345",
                },
                "status": "active",
            },
        )

        assert activation.activation_data["endpoints"]["api"] == "https://api.example.com/v1"
        assert activation.activation_data["credentials"]["api_key"] == "key_12345"
        assert activation.activation_data["status"] == "active"

    def test_service_activation_repr(self, db: Session, sample_order):
        """Test service activation string representation"""
        activation = create_service_activation(db, order_id=sample_order.id, tenant_id=1)
        repr_str = repr(activation)
        assert "ServiceActivation" in repr_str
        assert activation.service_code in repr_str


class TestActivationWorkflowModel:
    """Tests for ActivationWorkflow model"""

    def test_create_activation_workflow(self, db: Session, sample_deployment_template):
        """Test creating an activation workflow"""
        workflow = ActivationWorkflow(
            name="Test Workflow",
            description="Test workflow description",
            deployment_template_id=sample_deployment_template.id,
            service_sequence=[
                {"service": "service1", "sequence": 1, "depends_on": []},
                {"service": "service2", "sequence": 2, "depends_on": ["service1"]},
            ],
            auto_activate=True,
            is_active=True,
        )

        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        assert workflow.id is not None
        assert workflow.name == "Test Workflow"
        assert workflow.is_active is True
        assert len(workflow.service_sequence) == 2

    def test_workflow_parallel_groups(self, db: Session, sample_deployment_template):
        """Test workflow parallel groups"""
        workflow = ActivationWorkflow(
            name="Parallel Workflow",
            deployment_template_id=sample_deployment_template.id,
            service_sequence=[
                {"service": "base", "sequence": 1, "depends_on": []},
            ],
            parallel_groups=[
                ["service1", "service2", "service3"],
                ["service4", "service5"],
            ],
            is_active=True,
        )

        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        assert len(workflow.parallel_groups) == 2
        assert "service1" in workflow.parallel_groups[0]

    def test_workflow_conditions(self, db: Session, sample_deployment_template):
        """Test workflow activation and skip conditions"""
        workflow = ActivationWorkflow(
            name="Conditional Workflow",
            deployment_template_id=sample_deployment_template.id,
            service_sequence=[],
            activation_conditions={
                "min_services": 2,
                "required_features": ["feature1"],
            },
            skip_conditions={"environment": "development"},
            is_active=True,
        )

        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        assert workflow.activation_conditions["min_services"] == 2
        assert "feature1" in workflow.activation_conditions["required_features"]
        assert workflow.skip_conditions["environment"] == "development"

    def test_workflow_configuration(self, db: Session, sample_deployment_template):
        """Test workflow configuration options"""
        workflow = ActivationWorkflow(
            name="Configured Workflow",
            deployment_template_id=sample_deployment_template.id,
            service_sequence=[],
            auto_activate=False,
            require_approval=True,
            rollback_on_failure=True,
            max_duration_minutes=30,
            is_active=True,
        )

        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        assert workflow.auto_activate is False
        assert workflow.require_approval is True
        assert workflow.rollback_on_failure is True
        assert workflow.max_duration_minutes == 30

    def test_workflow_repr(self, db: Session, sample_activation_workflow):
        """Test workflow string representation"""
        repr_str = repr(sample_activation_workflow)
        assert "ActivationWorkflow" in repr_str
        assert sample_activation_workflow.name in repr_str


class TestOrderItemCalculations:
    """Tests for order item calculations"""

    def test_order_total_calculation(self, db: Session, sample_order, sample_order_items):
        """Test order total calculation from items"""
        # Calculate expected total
        expected_subtotal = sum(item.total_amount for item in sample_order_items)

        assert sample_order.subtotal == expected_subtotal
        assert sample_order.total_amount == expected_subtotal + sample_order.tax_amount

    def test_item_discount_calculation(self, db: Session, sample_order):
        """Test item discount calculation"""
        item = create_order_item(
            db,
            order_id=sample_order.id,
            unit_price=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            quantity=2,
            total_amount=Decimal("180.00"),  # (100 - 10) * 2
        )

        # Expected: (unit_price - discount) * quantity
        expected_total = (item.unit_price - item.discount_amount) * item.quantity
        assert item.total_amount == expected_total


class TestOrderQueryFiltering:
    """Tests for order query filtering"""

    def test_filter_orders_by_status(self, db: Session):
        """Test filtering orders by status"""
        # Create orders with different statuses
        draft_order = create_order(db, order_number="ORD-001", status=OrderStatus.DRAFT)
        active_order = create_order(db, order_number="ORD-002", status=OrderStatus.ACTIVE)

        # Query draft orders
        draft_orders = db.query(Order).filter(Order.status == OrderStatus.DRAFT).all()
        assert len(draft_orders) >= 1
        assert draft_order in draft_orders
        assert active_order not in draft_orders

    def test_filter_orders_by_email(self, db: Session):
        """Test filtering orders by customer email"""
        email = "customer@example.com"
        order = create_order(db, customer_email=email)

        # Query by email
        orders = db.query(Order).filter(Order.customer_email == email).all()
        assert len(orders) >= 1
        assert order in orders

    def test_order_with_activations_query(
        self, db: Session, sample_order, sample_service_activations
    ):
        """Test querying orders with activations"""
        # Query order with activations
        order = db.query(Order).filter(Order.id == sample_order.id).first()
        assert order is not None

        # Access activations through relationship
        activations = order.activations
        assert len(activations) >= 2
        assert all(isinstance(a, ServiceActivation) for a in activations)
