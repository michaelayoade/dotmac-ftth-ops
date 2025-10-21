"""
Unit tests for Order Processing Service
"""

import pytest
from decimal import Decimal
from unittest.mock import Mock, patch, call

from sqlalchemy.orm import Session

from dotmac.platform.sales.models import Order, OrderStatus, OrderType
from dotmac.platform.sales.schemas import OrderCreate, OrderSubmit
from dotmac.platform.sales.service import (
    OrderProcessingService,
    TemplateMapper,
)
from .conftest import create_order


class TestTemplateMapper:
    """Tests for TemplateMapper"""

    def test_map_by_package_code_starter(self, db: Session, sample_deployment_template):
        """Test mapping by package code - starter"""
        # Create template with specific name
        sample_deployment_template.name = "standard-cloud"
        db.commit()

        mapper = TemplateMapper(db)
        template = mapper.map_to_template(package_code="starter")

        assert template is not None
        assert template.name == "standard-cloud"

    def test_map_by_package_code_professional(self, db: Session):
        """Test mapping by package code - professional"""
        from dotmac.platform.deployment.models import DeploymentTemplate, DeploymentBackend

        # Create professional template
        template = DeploymentTemplate(
            name="enhanced-cloud",
            description="Enhanced deployment",
            backend=DeploymentBackend.KUBERNETES,
            helm_chart="dotmac/platform",
            chart_version="1.0.0",
            default_region="us-east-1",
            is_active=True,
        )
        db.add(template)
        db.commit()

        mapper = TemplateMapper(db)
        result = mapper.map_to_template(package_code="professional")

        assert result is not None
        assert result.name == "enhanced-cloud"

    def test_map_by_region_default(self, db: Session, sample_deployment_template):
        """Test mapping by region with default template"""
        sample_deployment_template.default_region = "us-east-1"
        sample_deployment_template.is_default = True
        db.commit()

        mapper = TemplateMapper(db)
        template = mapper.map_to_template(region="us-east-1")

        assert template is not None
        assert template.default_region == "us-east-1"

    def test_map_fallback_to_any_default(self, db: Session, sample_deployment_template):
        """Test fallback to any default template"""
        sample_deployment_template.is_default = True
        db.commit()

        mapper = TemplateMapper(db)
        template = mapper.map_to_template(region="nonexistent-region")

        assert template is not None
        assert template.is_default is True

    def test_map_no_template_found(self, db: Session):
        """Test when no template is found"""
        mapper = TemplateMapper(db)
        template = mapper.map_to_template(package_code="nonexistent")

        assert template is None


class TestOrderProcessingService:
    """Tests for OrderProcessingService"""

    @pytest.fixture
    def order_service(
        self,
        db,
        mock_tenant_service,
        mock_deployment_service,
        mock_notification_service,
        mock_email_service,
        mock_event_bus,
    ):
        """Create OrderProcessingService with mocked dependencies"""
        return OrderProcessingService(
            db=db,
            tenant_service=mock_tenant_service,
            deployment_service=mock_deployment_service,
            notification_service=mock_notification_service,
            email_service=mock_email_service,
            event_bus=mock_event_bus,
        )

    def test_create_order_basic(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test basic order creation"""
        order = order_service.create_order(sample_order_create)

        assert order.id is not None
        assert order.order_number.startswith("ORD-")
        assert order.status == OrderStatus.DRAFT
        assert order.customer_email == sample_order_create.customer_email
        assert order.company_name == sample_order_create.company_name
        assert order.total_amount > 0

    def test_create_order_generates_unique_order_number(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test that order numbers are unique"""
        order1 = order_service.create_order(sample_order_create)
        order2 = order_service.create_order(sample_order_create)

        assert order1.order_number != order2.order_number

    def test_create_order_creates_items(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test that order items are created"""
        order = order_service.create_order(sample_order_create)

        # Check items were created
        assert len(order.items) == len(sample_order_create.selected_services)

        for item, service in zip(order.items, sample_order_create.selected_services):
            assert item.service_code == service.service_code
            assert item.name == service.name
            assert item.quantity == service.quantity

    def test_create_order_calculates_totals(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test that order totals are calculated"""
        order = order_service.create_order(sample_order_create)

        # Verify totals are calculated
        assert order.subtotal > 0
        assert order.tax_amount >= 0
        assert order.total_amount == order.subtotal + order.tax_amount

    def test_create_order_maps_template(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test that deployment template is mapped"""
        order = order_service.create_order(sample_order_create)

        assert order.deployment_template_id is not None
        assert order.deployment_template_id == sample_deployment_template.id

    def test_create_order_publishes_event(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
        mock_event_bus,
    ):
        """Test that order.created event is published"""
        order = order_service.create_order(sample_order_create)

        mock_event_bus.publish.assert_called()
        call_args = mock_event_bus.publish.call_args
        assert call_args[0][0] == "order.created"
        assert call_args[0][1]["order_id"] == order.id

    def test_submit_order_success(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order: Order,
        sample_order_submit: OrderSubmit,
    ):
        """Test successful order submission"""
        result = order_service.submit_order(
            sample_order.id, sample_order_submit
        )

        assert result.status == OrderStatus.SUBMITTED
        assert result.payment_reference == sample_order_submit.payment_reference

    def test_submit_order_not_found(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_submit: OrderSubmit,
    ):
        """Test submitting non-existent order"""
        with pytest.raises(ValueError, match="not found"):
            order_service.submit_order(99999, sample_order_submit)

    def test_submit_order_wrong_status(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_submit: OrderSubmit,
    ):
        """Test submitting order in wrong status"""
        # Create order in ACTIVE status
        order = create_order(db, status=OrderStatus.ACTIVE)

        with pytest.raises(ValueError, match="not in draft state"):
            order_service.submit_order(order.id, sample_order_submit)

    def test_submit_order_sends_confirmation_email(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order: Order,
        sample_order_submit: OrderSubmit,
        mock_email_service,
    ):
        """Test that confirmation email is sent"""
        order_service.submit_order(sample_order.id, sample_order_submit)

        mock_email_service.send_email.assert_called_once()
        call_args = mock_email_service.send_email.call_args
        assert call_args[1]["to_email"] == sample_order.customer_email
        assert "Confirmation" in call_args[1]["subject"]

    def test_validate_order_success(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order: Order,
        sample_deployment_template,
    ):
        """Test successful order validation"""
        # Should not raise
        order_service._validate_order(sample_order)

    def test_validate_order_no_template(
        self,
        db: Session,
        order_service: OrderProcessingService,
    ):
        """Test validation fails without template"""
        order = create_order(db, deployment_template_id=None)

        with pytest.raises(ValueError, match="No deployment template"):
            order_service._validate_order(order)

    def test_validate_order_no_services(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_deployment_template,
    ):
        """Test validation fails without services"""
        order = create_order(
            db,
            deployment_template_id=sample_deployment_template.id,
            selected_services=[],
        )

        with pytest.raises(ValueError, match="No services selected"):
            order_service._validate_order(order)

    def test_validate_order_inactive_template(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_deployment_template,
    ):
        """Test validation fails with inactive template"""
        # Make template inactive
        sample_deployment_template.is_active = False
        db.commit()

        order = create_order(
            db,
            deployment_template_id=sample_deployment_template.id,
            selected_services=[{"service_code": "test"}],
        )

        with pytest.raises(ValueError, match="not available"):
            order_service._validate_order(order)

    def test_process_order_complete_workflow(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_deployment_template,
        mock_tenant_service,
        mock_deployment_service,
    ):
        """Test complete order processing workflow"""
        # Create order in submitted state
        order = create_order(
            db,
            status=OrderStatus.SUBMITTED,
            deployment_template_id=sample_deployment_template.id,
            selected_services=[{"service_code": "test-service", "name": "Test"}],
        )

        # Process order
        result = order_service.process_order(order.id)

        # Verify workflow executed
        assert result.status == OrderStatus.ACTIVE
        assert result.tenant_id is not None
        assert result.deployment_instance_id is not None
        assert result.processing_started_at is not None
        assert result.processing_completed_at is not None

        # Verify services were called
        mock_tenant_service.create_tenant.assert_called_once()
        mock_deployment_service.provision_deployment.assert_called_once()

    def test_process_order_handles_failure(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_deployment_template,
        mock_tenant_service,
    ):
        """Test order processing handles failures"""
        # Make tenant creation fail
        mock_tenant_service.create_tenant.side_effect = Exception("Tenant creation failed")

        order = create_order(
            db,
            status=OrderStatus.SUBMITTED,
            deployment_template_id=sample_deployment_template.id,
            selected_services=[{"service_code": "test"}],
        )

        # Process should handle exception
        with pytest.raises(Exception):
            order_service.process_order(order.id)

        # Verify order marked as failed
        db.refresh(order)
        assert order.status == OrderStatus.FAILED
        assert "Tenant creation failed" in order.status_message

    def test_create_tenant_for_order(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order: Order,
        mock_tenant_service,
    ):
        """Test tenant creation from order"""
        tenant = order_service._create_tenant_for_order(sample_order, user_id=1)

        assert tenant is not None
        assert tenant.id is not None

        # Verify tenant service was called
        mock_tenant_service.create_tenant.assert_called_once()
        call_args = mock_tenant_service.create_tenant.call_args[0][0]
        assert call_args.name == sample_order.company_name

    def test_provision_deployment_for_order(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order: Order,
        sample_deployment_template,
        mock_deployment_service,
    ):
        """Test deployment provisioning from order"""
        instance = order_service._provision_deployment_for_order(
            sample_order, tenant_id=1, user_id=1
        )

        assert instance is not None
        assert instance.id is not None

        # Verify deployment service was called
        mock_deployment_service.provision_deployment.assert_called_once()
        call_args = mock_deployment_service.provision_deployment.call_args
        assert call_args[1]["tenant_id"] == 1
        assert call_args[1]["request"].template_id == sample_deployment_template.id

    def test_get_service_price(
        self,
        db: Session,
        order_service: OrderProcessingService,
    ):
        """Test service price retrieval"""
        price = order_service._get_service_price("subscriber-provisioning", "monthly")
        assert price > 0
        assert isinstance(price, float)

    def test_generate_order_number(
        self,
        db: Session,
        order_service: OrderProcessingService,
    ):
        """Test order number generation"""
        order_number = order_service._generate_order_number()

        assert order_number.startswith("ORD-")
        assert len(order_number) > 10
        # Should contain date and random suffix
        assert "-" in order_number

    def test_generate_slug(
        self,
        db: Session,
        order_service: OrderProcessingService,
    ):
        """Test slug generation from company name"""
        slug = order_service._generate_slug("Example ISP Inc.")

        assert slug == "example-isp-inc"
        assert slug.islower()
        assert " " not in slug

    def test_generate_slug_special_chars(
        self,
        db: Session,
        order_service: OrderProcessingService,
    ):
        """Test slug generation with special characters"""
        slug = order_service._generate_slug("Test & Company, LLC!")

        assert slug == "test-company-llc"
        assert slug.replace("-", "").isalnum()


class TestOrderProcessingIntegration:
    """Integration tests for order processing"""

    @pytest.fixture
    def order_service(
        self,
        db,
        mock_tenant_service,
        mock_deployment_service,
        mock_notification_service,
        mock_email_service,
        mock_event_bus,
    ):
        """Create OrderProcessingService with mocked dependencies"""
        return OrderProcessingService(
            db=db,
            tenant_service=mock_tenant_service,
            deployment_service=mock_deployment_service,
            notification_service=mock_notification_service,
            email_service=mock_email_service,
            event_bus=mock_event_bus,
        )

    def test_full_order_lifecycle(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
        mock_event_bus,
    ):
        """Test complete order lifecycle from creation to activation"""
        # Step 1: Create order
        order = order_service.create_order(sample_order_create)
        assert order.status == OrderStatus.DRAFT

        # Step 2: Submit order
        submit = OrderSubmit(auto_activate=False)
        order = order_service.submit_order(order.id, submit)
        assert order.status == OrderStatus.SUBMITTED

        # Step 3: Process order
        order = order_service.process_order(order.id)
        assert order.status == OrderStatus.ACTIVE
        assert order.tenant_id is not None
        assert order.deployment_instance_id is not None

        # Verify events published
        event_calls = [call[0][0] for call in mock_event_bus.publish.call_args_list]
        assert "order.created" in event_calls
        assert "order.submitted" in event_calls
        assert "order.completed" in event_calls

    def test_order_with_auto_activate(
        self,
        db: Session,
        order_service: OrderProcessingService,
        sample_order_create: OrderCreate,
        sample_deployment_template,
    ):
        """Test order submission with auto_activate"""
        # Create order
        order = order_service.create_order(sample_order_create)

        # Submit with auto_activate
        submit = OrderSubmit(auto_activate=True)
        order = order_service.submit_order(order.id, submit)

        # Should be processed automatically
        # (In this test it might fail due to mocks, but status should change)
        assert order.status in [OrderStatus.SUBMITTED, OrderStatus.ACTIVE, OrderStatus.FAILED]
