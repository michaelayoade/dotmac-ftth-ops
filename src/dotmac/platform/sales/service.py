"""
Sales Order Processing Service

Orchestrates the flow from customer order to deployed tenant with activated services.
"""

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..communications.email_service import EmailService
from ..events.bus import EventBus
from ..deployment.models import DeploymentTemplate
from ..deployment.schemas import ProvisionRequest
from ..deployment.service import DeploymentService
from ..notifications.schemas import NotificationChannel, NotificationCreateRequest
from ..notifications.service import NotificationService
from ..tenant.service import TenantService
from .models import (
    ActivationStatus,
    ActivationWorkflow,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    ServiceActivation,
)
from .schemas import OrderCreate, OrderSubmit


class TemplateMapper:
    """Maps order requirements to deployment templates"""

    def __init__(self, db: Session):
        self.db = db

    def map_to_template(
        self,
        region: str | None = None,
        deployment_type: str | None = None,
        package_code: str | None = None,
        service_codes: list[str] | None = None,
    ) -> DeploymentTemplate | None:
        """
        Map order parameters to appropriate deployment template

        Priority:
        1. Explicit template_id from order
        2. Package code mapping
        3. Region + deployment_type
        4. Default template for region
        """
        query = self.db.query(DeploymentTemplate).filter(
            DeploymentTemplate.is_active == True  # noqa: E712
        )

        # Package code mapping
        if package_code:
            package_map = {
                "starter": "standard-cloud",
                "professional": "enhanced-cloud",
                "enterprise": "premium-cloud",
                "custom": "custom-cloud",
            }
            template_name = package_map.get(package_code)
            if template_name:
                template = query.filter(
                    DeploymentTemplate.name == template_name
                ).first()
                if template:
                    return template

        # Deployment type match
        if deployment_type:
            template = query.filter(
                DeploymentTemplate.name.ilike(f"%{deployment_type}%"),
            ).first()
            if template:
                return template

        # Fallback to first active template
        return query.first()


class OrderProcessingService:
    """
    Order Processing Service

    Handles order creation, validation, submission, and orchestration
    of tenant provisioning and service activation.
    """

    def __init__(
        self,
        db: Session,
        tenant_service: TenantService,
        deployment_service: DeploymentService,
        notification_service: NotificationService,
        email_service: EmailService,
        event_bus: EventBus | None = None,
    ):
        self.db = db
        self.tenant_service = tenant_service
        self.deployment_service = deployment_service
        self.notification_service = notification_service
        self.email_service = email_service
        self.event_bus = event_bus
        self.template_mapper = TemplateMapper(db)

    def create_order(
        self, request: OrderCreate, user_id: int | None = None
    ) -> Order:
        """
        Create new order in draft state

        Args:
            request: Order creation request
            user_id: Optional user creating the order

        Returns:
            Created order
        """
        # Generate order number
        order_number = self._generate_order_number()

        # Map to deployment template
        template = None
        if request.deployment_template_id:
            template = self.db.query(DeploymentTemplate).filter(
                DeploymentTemplate.id == request.deployment_template_id
            ).first()
        else:
            service_codes = [s.service_code for s in request.selected_services]
            template = self.template_mapper.map_to_template(
                region=request.deployment_region,
                deployment_type=request.deployment_type,
                service_codes=service_codes,
            )

        # Create order
        order = Order(
            order_number=order_number,
            order_type=OrderType.NEW_TENANT,
            status=OrderStatus.DRAFT,
            customer_email=request.customer_email,
            customer_name=request.customer_name,
            customer_phone=request.customer_phone,
            company_name=request.company_name,
            organization_slug=request.organization_slug,
            organization_name=request.organization_name,
            billing_address=request.billing_address.model_dump() if request.billing_address else None,
            tax_id=request.tax_id,
            deployment_template_id=template.id if template else None,
            deployment_region=request.deployment_region,
            deployment_type=request.deployment_type,
            selected_services=[s.model_dump() for s in request.selected_services],
            service_configuration=request.service_configuration,
            features_enabled=request.features_enabled,
            currency=request.currency,
            billing_cycle=request.billing_cycle,
            source=request.source,
            utm_source=request.utm_source,
            utm_medium=request.utm_medium,
            utm_campaign=request.utm_campaign,
            notes=request.notes,
            external_order_id=request.external_order_id,
        )

        self.db.add(order)
        self.db.flush()

        # Create order items from selected services
        for service_selection in request.selected_services:
            # In production, you'd look up pricing from catalog
            unit_price = self._get_service_price(
                service_selection.service_code, request.billing_cycle
            )

            item = OrderItem(
                order_id=order.id,
                item_type="service",
                service_code=service_selection.service_code,
                name=service_selection.name,
                quantity=service_selection.quantity,
                unit_price=unit_price,
                total_amount=unit_price * service_selection.quantity,
                configuration=service_selection.configuration,
                billing_cycle=request.billing_cycle,
            )
            self.db.add(item)

        self.db.flush()

        # Calculate totals
        self._calculate_order_totals(order)
        self.db.commit()
        self.db.refresh(order)

        # Emit event
        if self.event_bus:
            self.event_bus.publish("order.created", {
                "order_id": order.id,
                "order_number": order.order_number,
                "customer_email": order.customer_email,
            })

        return order

    async def submit_order(
        self, order_id: int, submit_request: OrderSubmit, user_id: int | None = None
    ) -> Order:
        """
        Submit order for processing

        Transitions order from DRAFT to SUBMITTED and triggers processing workflow.

        Args:
            order_id: Order to submit
            submit_request: Submission parameters
            user_id: User submitting the order

        Returns:
            Updated order
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.status != OrderStatus.DRAFT:
            raise ValueError(f"Order {order.order_number} is not in draft state")

        # Update order
        order.status = OrderStatus.SUBMITTED
        order.payment_reference = submit_request.payment_reference
        order.contract_reference = submit_request.contract_reference
        self.db.commit()
        self.db.refresh(order)

        # Send confirmation email
        self._send_order_confirmation(order)

        # Emit event
        if self.event_bus:
            self.event_bus.publish("order.submitted", {
                "order_id": order.id,
                "order_number": order.order_number,
            })

        # Auto-process if requested
        if submit_request.auto_activate:
            try:
                await self.process_order(order_id, user_id=user_id)
            except Exception as e:
                # Log error but don't fail submission
                order.status_message = f"Auto-processing failed: {str(e)}"
                self.db.commit()

        return order

    async def process_order(self, order_id: int, user_id: int | None = None) -> Order:
        """
        Process order through complete workflow

        Steps:
        1. Validate order
        2. Create tenant
        3. Provision deployment
        4. Activate services
        5. Send notifications

        Args:
            order_id: Order to process
            user_id: User processing the order

        Returns:
            Updated order
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        try:
            # Update status
            order.status = OrderStatus.VALIDATING
            order.processing_started_at = datetime.utcnow()
            self.db.commit()

            # Step 1: Validate
            self._validate_order(order)

            # Step 2: Create tenant
            order.status = OrderStatus.PROVISIONING
            order.status_message = "Creating tenant..."
            self.db.commit()

            tenant = self._create_tenant_for_order(order, user_id)
            order.tenant_id = tenant.id
            self.db.commit()

            # Step 3: Provision deployment
            order.status_message = "Provisioning deployment..."
            self.db.commit()

            deployment_instance = await self._provision_deployment_for_order(
                order, tenant.id, user_id
            )
            order.deployment_instance_id = deployment_instance.id
            self.db.commit()

            # Step 4: Activate services
            order.status = OrderStatus.ACTIVATING
            order.status_message = "Activating services..."
            self.db.commit()

            self._activate_services_for_order(order, tenant.id, user_id)

            # Step 5: Complete
            order.status = OrderStatus.ACTIVE
            order.status_message = "Order completed successfully"
            order.processing_completed_at = datetime.utcnow()
            self.db.commit()

            # Send success notifications
            self._send_activation_complete(order)
            self._notify_operations_team(order)

            # Emit event
            if self.event_bus:
                self.event_bus.publish("order.completed", {
                    "order_id": order.id,
                    "tenant_id": tenant.id,
                    "deployment_instance_id": deployment_instance.id,
                })

        except Exception as e:
            # Mark as failed
            order.status = OrderStatus.FAILED
            order.status_message = str(e)
            order.processing_completed_at = datetime.utcnow()
            self.db.commit()

            # Send failure notification
            self._send_order_failed(order, str(e))

            # Emit event
            if self.event_bus:
                self.event_bus.publish("order.failed", {
                    "order_id": order.id,
                    "error": str(e),
                })

            raise

        return order

    def get_order_by_number(self, order_number: str) -> Order | None:
        """
        Get order by order number

        Args:
            order_number: Unique order number

        Returns:
            Order if found, None otherwise
        """
        return self.db.query(Order).filter(Order.order_number == order_number).first()

    def list_orders(
        self,
        status: OrderStatus | None = None,
        customer_email: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Order]:
        """
        List orders with optional filtering

        Args:
            status: Filter by order status
            customer_email: Filter by customer email
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return

        Returns:
            List of orders matching criteria
        """
        query = self.db.query(Order)

        if status:
            query = query.filter(Order.status == status)

        if customer_email:
            query = query.filter(Order.customer_email == customer_email)

        return query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    def get_order(self, order_id: int) -> Order | None:
        """
        Get order by ID

        Args:
            order_id: Order ID

        Returns:
            Order if found, None otherwise
        """
        return self.db.query(Order).filter(Order.id == order_id).first()

    def update_order_status(
        self,
        order_id: int,
        status: OrderStatus,
        status_message: str | None = None
    ) -> Order:
        """
        Update order status

        Args:
            order_id: Order ID
            status: New order status
            status_message: Optional status message

        Returns:
            Updated order

        Raises:
            ValueError: If order not found
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        order.status = status
        if status_message:
            order.status_message = status_message

        self.db.commit()
        self.db.refresh(order)

        return order

    def cancel_order(self, order_id: int) -> Order:
        """
        Cancel an order

        Args:
            order_id: Order ID

        Returns:
            Cancelled order

        Raises:
            ValueError: If order not found or cannot be cancelled
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.status not in [OrderStatus.DRAFT, OrderStatus.SUBMITTED]:
            raise ValueError(f"Cannot cancel order in {order.status} state")

        order.status = OrderStatus.CANCELLED
        self.db.commit()
        self.db.refresh(order)

        return order

    def delete_order(self, order_id: int) -> bool:
        """
        Delete an order (alias for cancel_order for compatibility)

        Args:
            order_id: Order ID

        Returns:
            True if successful
        """
        self.cancel_order(order_id)
        return True

    def get_order_statistics(self) -> dict[str, Any]:
        """
        Get aggregated order statistics

        Returns:
            Dictionary containing order statistics
        """
        from sqlalchemy import func

        # Orders by status
        status_counts = self.db.query(
            Order.status,
            func.count(Order.id).label("count")
        ).group_by(Order.status).all()

        # Revenue totals
        revenue = self.db.query(
            func.sum(Order.total_amount).label("total"),
            func.avg(Order.total_amount).label("average"),
        ).filter(Order.status == OrderStatus.ACTIVE).first()

        # Success rate
        total_processed = self.db.query(func.count(Order.id)).filter(
            Order.status.in_([OrderStatus.ACTIVE, OrderStatus.FAILED])
        ).scalar()

        successful = self.db.query(func.count(Order.id)).filter(
            Order.status == OrderStatus.ACTIVE
        ).scalar()

        success_rate = (successful / total_processed * 100) if total_processed > 0 else 0

        return {
            "orders_by_status": {
                status.value: count for status, count in status_counts
            },
            "revenue": {
                "total": float(revenue.total or 0),
                "average": float(revenue.average or 0),
            },
            "success_rate": round(success_rate, 2),
            "total_processed": total_processed,
            "successful": successful,
        }

    def _validate_order(self, order: Order) -> None:
        """Validate order can be processed"""
        if not order.deployment_template_id:
            raise ValueError("No deployment template assigned")

        if not order.selected_services:
            raise ValueError("No services selected")

        # Check template is active
        template = self.db.query(DeploymentTemplate).filter(
            DeploymentTemplate.id == order.deployment_template_id
        ).first()
        if not template or not template.is_active:
            raise ValueError("Deployment template not available")

    def _create_tenant_for_order(self, order: Order, user_id: int | None) -> Any:
        """Create tenant from order"""
        from ..tenant.schemas import TenantCreate

        tenant_data = TenantCreate(
            name=order.company_name,
            slug=order.organization_slug or self._generate_slug(order.company_name),
            is_active=True,
            settings={
                "order_id": order.id,
                "order_number": order.order_number,
            },
        )

        tenant = self.tenant_service.create_tenant(tenant_data)
        return tenant

    async def _provision_deployment_for_order(
        self, order: Order, tenant_id: int, user_id: int | None
    ) -> Any:
        """Provision deployment for order"""
        template = self.db.query(DeploymentTemplate).filter(
            DeploymentTemplate.id == order.deployment_template_id
        ).first()

        provision_request = ProvisionRequest(
            template_id=template.id,
            environment="production",
            region=order.deployment_region or template.region,
            config=order.service_configuration or {},
            allocated_cpu=template.cpu_cores,
            allocated_memory_gb=template.memory_gb,
            allocated_storage_gb=template.storage_gb,
        )

        instance, execution = await self.deployment_service.provision_deployment(
            tenant_id=tenant_id,
            request=provision_request,
            triggered_by=user_id,
        )

        return instance

    def _activate_services_for_order(
        self, order: Order, tenant_id: int, user_id: int | None
    ) -> None:
        """Activate services via orchestrator"""
        orchestrator = ActivationOrchestrator(
            db=self.db,
            notification_service=self.notification_service,
            event_bus=self.event_bus,
        )

        orchestrator.activate_order_services(order, tenant_id, user_id)

    def _calculate_order_totals(self, order: Order) -> None:
        """Calculate order totals from items"""
        items = self.db.query(OrderItem).filter(OrderItem.order_id == order.id).all()

        subtotal = sum(item.total_amount for item in items)
        tax_amount = subtotal * 0.0  # Implement tax calculation

        order.subtotal = subtotal
        order.tax_amount = tax_amount
        order.total_amount = subtotal + tax_amount

    def _get_service_price(
        self, service_code: str, billing_cycle: str | None
    ) -> float:
        """Get service price from catalog (mock implementation)"""
        # In production, query from billing catalog
        pricing = {
            "subscriber-provisioning": 99.0,
            "radius-aaa": 149.0,
            "network-monitoring": 199.0,
            "billing-invoicing": 249.0,
            "analytics-reporting": 99.0,
        }
        return pricing.get(service_code, 99.0)

    def _generate_order_number(self) -> str:
        """Generate unique order number"""
        import random
        from datetime import datetime
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        random_suffix = random.randint(1000, 9999)
        return f"ORD-{timestamp}-{random_suffix}"

    def _generate_slug(self, name: str) -> str:
        """Generate slug from company name"""
        import re
        slug = name.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = slug.strip("-")
        return slug[:50]

    def _send_order_confirmation(self, order: Order) -> None:
        """Send order confirmation email"""
        try:
            self.email_service.send_email(
                to_email=order.customer_email,
                subject=f"Order Confirmation - {order.order_number}",
                template_name="order_confirmation",
                template_data={
                    "order_number": order.order_number,
                    "customer_name": order.customer_name,
                    "company_name": order.company_name,
                    "total_amount": float(order.total_amount),
                    "currency": order.currency,
                },
            )
        except Exception as e:
            # Log but don't fail
            print(f"Failed to send confirmation email: {e}")

    def _send_activation_complete(self, order: Order) -> None:
        """Send activation complete email"""
        try:
            self.email_service.send_email(
                to_email=order.customer_email,
                subject=f"Your Platform is Ready - {order.order_number}",
                template_name="activation_complete",
                template_data={
                    "order_number": order.order_number,
                    "customer_name": order.customer_name,
                    "company_name": order.company_name,
                    "tenant_subdomain": order.organization_slug,
                },
            )
        except Exception as e:
            print(f"Failed to send activation email: {e}")

    def _send_order_failed(self, order: Order, error: str) -> None:
        """Send order failure notification"""
        try:
            self.email_service.send_email(
                to_email=order.customer_email,
                subject=f"Order Processing Issue - {order.order_number}",
                template_name="order_failed",
                template_data={
                    "order_number": order.order_number,
                    "customer_name": order.customer_name,
                    "error_message": error,
                },
            )
        except Exception as e:
            print(f"Failed to send failure email: {e}")

    def _notify_operations_team(self, order: Order) -> None:
        """Notify operations team of new deployment"""
        try:
            _ = NotificationCreateRequest(
                title=f"New Tenant Deployed: {order.company_name}",
                message=f"Order {order.order_number} completed. Tenant {order.organization_slug} is now active.",
                notification_type="info",
                channel=NotificationChannel.EMAIL,
                metadata={
                    "order_id": order.id,
                    "tenant_id": order.tenant_id,
                    "deployment_instance_id": order.deployment_instance_id,
                },
            )
            # Send to operations team (would need to query users with ops role)
            # self.notification_service.send_to_role(notification, "operations")
        except Exception as e:
            print(f"Failed to notify operations: {e}")


class ActivationOrchestrator:
    """
    Service Activation Orchestrator

    Handles activation of individual services for an order, respecting
    dependencies and executing in proper sequence.
    """

    def __init__(
        self,
        db: Session,
        notification_service: NotificationService,
        event_bus: EventBus | None = None,
    ):
        self.db = db
        self.notification_service = notification_service
        self.event_bus = event_bus

    def activate_order_services(
        self, order: Order, tenant_id: int, user_id: int | None = None
    ) -> list[ServiceActivation]:
        """
        Activate all services for an order

        Args:
            order: Order to activate services for
            tenant_id: Target tenant
            user_id: User triggering activation

        Returns:
            List of service activation records
        """
        # Get or create workflow
        workflow = self._get_workflow_for_order(order)

        # Create activation records
        activations = []
        for idx, service_info in enumerate(order.selected_services):
            activation = ServiceActivation(
                order_id=order.id,
                tenant_id=tenant_id,
                service_code=service_info["service_code"],
                service_name=service_info["name"],
                activation_status=ActivationStatus.PENDING,
                sequence_number=idx,
                configuration=service_info.get("configuration"),
                activated_by=user_id,
            )
            self.db.add(activation)
            activations.append(activation)

        self.db.commit()

        # Execute activations in sequence
        for activation in activations:
            self._execute_activation(activation, workflow)

        return activations

    def _get_workflow_for_order(self, order: Order) -> ActivationWorkflow | None:
        """Get activation workflow for order"""
        if not order.deployment_template_id:
            return None

        workflow = self.db.query(ActivationWorkflow).filter(
            ActivationWorkflow.deployment_template_id == order.deployment_template_id,
            ActivationWorkflow.is_active == True,  # noqa: E712
        ).first()

        return workflow

    def _execute_activation(
        self, activation: ServiceActivation, workflow: ActivationWorkflow | None
    ) -> None:
        """Execute individual service activation"""
        try:
            activation.activation_status = ActivationStatus.IN_PROGRESS
            activation.started_at = datetime.utcnow()
            self.db.commit()

            # Execute service-specific activation logic
            result = self._activate_service(activation)

            # Update activation record
            activation.activation_status = ActivationStatus.COMPLETED
            activation.completed_at = datetime.utcnow()
            activation.duration_seconds = int(
                (activation.completed_at - activation.started_at).total_seconds()
            )
            activation.success = True
            activation.activation_data = result

            self.db.commit()

            # Emit event
            if self.event_bus:
                self.event_bus.publish("service.activated", {
                    "activation_id": activation.id,
                    "service_code": activation.service_code,
                    "tenant_id": activation.tenant_id,
                })

        except Exception as e:
            activation.activation_status = ActivationStatus.FAILED
            activation.completed_at = datetime.utcnow()
            activation.success = False
            activation.error_message = str(e)
            activation.retry_count += 1

            self.db.commit()

            # Emit event
            if self.event_bus:
                self.event_bus.publish("service.activation_failed", {
                    "activation_id": activation.id,
                    "service_code": activation.service_code,
                    "error": str(e),
                })

            raise

    def _activate_service(self, activation: ServiceActivation) -> dict[str, Any]:
        """
        Activate specific service

        In production, this would call service-specific activation logic.
        For now, returns mock activation data.
        """
        # Service-specific activation logic would go here
        # For example:
        # - subscriber-provisioning: Setup customer database tables
        # - radius-aaa: Configure RADIUS server
        # - network-monitoring: Setup monitoring dashboards
        # - billing-invoicing: Initialize billing schedules

        return {
            "service_code": activation.service_code,
            "status": "active",
            "endpoints": {
                "api": f"/api/v1/{activation.service_code}",
            },
            "activated_at": datetime.utcnow().isoformat(),
        }

    def get_service_activations(self, order_id: int) -> list[ServiceActivation]:
        """
        Get all service activations for an order

        Args:
            order_id: Order ID

        Returns:
            List of service activation records
        """
        return self.db.query(ServiceActivation).filter(
            ServiceActivation.order_id == order_id
        ).order_by(ServiceActivation.sequence_number).all()

    def retry_failed_activations(self, order_id: int) -> dict[str, Any]:
        """
        Retry failed service activations for an order

        Args:
            order_id: Order ID

        Returns:
            Dictionary with retry results
        """
        # Get failed activations
        failed_activations = self.db.query(ServiceActivation).filter(
            ServiceActivation.order_id == order_id,
            ServiceActivation.activation_status == "failed",
        ).all()

        if not failed_activations:
            return {"success": True, "message": "No failed activations to retry", "services": []}

        # Retry each failed activation
        retried = []
        for activation in failed_activations:
            if activation.retry_count < activation.max_retries:
                activation.activation_status = ActivationStatus.PENDING
                retried.append(activation.service_code)

        self.db.commit()

        return {
            "success": True,
            "message": f"Retrying {len(retried)} failed activations",
            "services": retried,
        }

    def get_activation_progress(self, order_id: int) -> dict[str, Any]:
        """Get activation progress for order"""
        activations = self.db.query(ServiceActivation).filter(
            ServiceActivation.order_id == order_id
        ).all()

        total = len(activations)
        completed = sum(1 for a in activations if a.activation_status == ActivationStatus.COMPLETED)
        failed = sum(1 for a in activations if a.activation_status == ActivationStatus.FAILED)
        in_progress = sum(1 for a in activations if a.activation_status == ActivationStatus.IN_PROGRESS)
        pending = sum(1 for a in activations if a.activation_status == ActivationStatus.PENDING)

        progress_percent = int(completed / total * 100) if total > 0 else 0

        return {
            "total_services": total,
            "completed": completed,
            "failed": failed,
            "in_progress": in_progress,
            "pending": pending,
            "progress_percent": progress_percent,
            "overall_status": self._determine_overall_status(completed, failed, in_progress, total),
            "activations": activations,
        }

    def _determine_overall_status(
        self, completed: int, failed: int, in_progress: int, total: int
    ) -> str:
        """Determine overall activation status"""
        if failed > 0:
            return "failed"
        elif completed == total:
            return "completed"
        elif in_progress > 0:
            return "in_progress"
        else:
            return "pending"
