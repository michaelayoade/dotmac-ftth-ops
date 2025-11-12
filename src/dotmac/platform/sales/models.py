"""
Sales Order Models

Data models for order processing and service activation.
"""

import enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from ..db import Base as BaseRuntime
from ..db import TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class OrderStatus(str, enum.Enum):
    """Order processing status"""

    DRAFT = "draft"  # Order being created
    SUBMITTED = "submitted"  # Order submitted, awaiting processing
    VALIDATING = "validating"  # Validating order details
    APPROVED = "approved"  # Order approved
    PROVISIONING = "provisioning"  # Tenant provisioning in progress
    ACTIVATING = "activating"  # Services being activated
    ACTIVE = "active"  # Order complete, services active
    FAILED = "failed"  # Order processing failed
    CANCELLED = "cancelled"  # Order cancelled
    REFUNDED = "refunded"  # Order refunded


class OrderType(str, enum.Enum):
    """Type of order"""

    NEW_TENANT = "new_tenant"  # New tenant signup
    UPGRADE = "upgrade"  # Upgrade existing tenant
    ADDON = "addon"  # Add-on services
    RENEWAL = "renewal"  # Service renewal


class ActivationStatus(str, enum.Enum):
    """Service activation status"""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class Order(Base, TimestampMixin):
    """
    Service Order

    Represents a customer order for platform services, including tenant
    provisioning and service activation.
    """

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)

    # Order details
    order_type: OrderType = Column(Enum(OrderType), nullable=False)  # type: ignore[assignment]
    status: OrderStatus = Column(
        Enum(OrderStatus), default=OrderStatus.DRAFT, nullable=False, index=True
    )  # type: ignore[assignment]
    status_message = Column(Text)

    # Customer information
    customer_email = Column(String(255), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(50))
    company_name = Column(String(255), nullable=False)

    # Organization details
    organization_slug = Column(String(100))  # Requested subdomain/slug
    organization_name = Column(String(255))
    billing_address = Column(JSON)
    tax_id = Column(String(100))

    # Service configuration
    deployment_template_id = Column(Integer, ForeignKey("deployment_templates.id"))
    deployment_region = Column(String(50))  # us-east-1, eu-west-1, etc.
    deployment_type = Column(String(50))  # cloud_dedicated, on_prem, etc.

    # Selected services
    selected_services = Column(JSON)  # List of service codes
    service_configuration = Column(JSON)  # Service-specific config
    features_enabled = Column(JSON)  # Feature flags

    # Pricing
    currency = Column(String(3), default="USD")
    subtotal = Column(Numeric(10, 2), default=0)
    tax_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False)
    billing_cycle = Column(String(20))  # monthly, annual, etc.

    # Processing metadata
    tenant_id = Column(String(255), ForeignKey("tenants.id"), index=True)
    deployment_instance_id = Column(Integer, ForeignKey("deployment_instances.id"))
    processing_started_at = Column(DateTime)
    processing_completed_at = Column(DateTime)
    approved_at = Column(DateTime)
    approved_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))

    # External references
    external_order_id = Column(String(255), index=True)  # From external CRM/ecommerce
    payment_reference = Column(String(255))
    contract_reference = Column(String(255))

    # Notifications
    notification_email = Column(String(255))  # Override notification email
    send_welcome_email = Column(Boolean, default=True)
    send_activation_email = Column(Boolean, default=True)

    # Metadata
    source = Column(String(50))  # web, api, sales_team, etc.
    utm_source = Column(String(100))
    utm_medium = Column(String(100))
    utm_campaign = Column(String(100))
    notes = Column(Text)
    extra_metadata = Column(JSON)

    # Relationships
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    activations = relationship(
        "ServiceActivation", back_populates="order", cascade="all, delete-orphan"
    )
    tenant = relationship("Tenant", foreign_keys=[tenant_id])
    deployment_instance = relationship("DeploymentInstance", foreign_keys=[deployment_instance_id])

    def __repr__(self) -> str:
        return f"<Order {self.order_number} status={self.status.value}>"


class OrderItem(Base, TimestampMixin):
    """
    Order Line Item

    Individual service or product in an order.
    """

    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)

    # Item details
    item_type = Column(String(50), nullable=False)  # service, addon, setup_fee, etc.
    service_code = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Pricing
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0)
    tax_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False)

    # Configuration
    configuration = Column(JSON)  # Item-specific configuration
    billing_cycle = Column(String(20))  # monthly, annual, one_time
    trial_days = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)
    activated_at = Column(DateTime)

    # Metadata
    product_id = Column(String(100))  # External product ID
    sku = Column(String(100))
    extra_metadata = Column(JSON)

    # Relationships
    order = relationship("Order", back_populates="items")

    def __repr__(self) -> str:
        return f"<OrderItem {self.service_code} order={self.order_id}>"


class ServiceActivation(Base, TimestampMixin):
    """
    Service Activation Record

    Tracks the activation of individual services for an order.
    """

    __tablename__ = "service_activations"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    tenant_id = Column(String(255), ForeignKey("tenants.id"), nullable=False, index=True)

    # Service details
    service_code = Column(String(100), nullable=False, index=True)
    service_name = Column(String(255), nullable=False)
    activation_status: ActivationStatus = Column(
        Enum(ActivationStatus), default=ActivationStatus.PENDING, nullable=False, index=True
    )  # type: ignore[assignment]

    # Activation tracking
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Results
    success = Column(Boolean, default=False)
    error_message = Column(Text)
    error_details = Column(JSON)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Service-specific data
    activation_data = Column(JSON)  # Service endpoints, credentials, etc.
    configuration = Column(JSON)  # Service configuration used

    # Dependencies
    depends_on = Column(JSON)  # List of service codes this depends on
    blocks = Column(JSON)  # List of service codes blocked by this

    # Order in activation sequence
    sequence_number = Column(Integer, default=0)

    # Metadata
    activated_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    # Relationships
    order = relationship("Order", back_populates="activations")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    def __repr__(self) -> str:
        return f"<ServiceActivation {self.service_code} status={self.activation_status.value}>"


class ActivationWorkflow(Base, TimestampMixin):
    """
    Activation Workflow Template

    Defines the sequence and dependencies for service activation.
    """

    __tablename__ = "activation_workflows"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)

    # Workflow definition
    deployment_template_id = Column(Integer, ForeignKey("deployment_templates.id"))
    service_sequence = Column(JSON, nullable=False)  # Ordered list of activation steps
    parallel_groups = Column(JSON)  # Groups of services that can activate in parallel

    # Configuration
    auto_activate = Column(Boolean, default=True)
    require_approval = Column(Boolean, default=False)
    rollback_on_failure = Column(Boolean, default=True)
    max_duration_minutes = Column(Integer, default=60)

    # Conditions
    activation_conditions = Column(JSON)  # Conditions that must be met
    skip_conditions = Column(JSON)  # Conditions to skip certain services

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(String(20), default="1.0.0")
    tags = Column(JSON)

    def __repr__(self) -> str:
        return f"<ActivationWorkflow {self.name}>"
