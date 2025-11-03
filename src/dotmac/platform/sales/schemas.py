"""
Sales Order Schemas

Pydantic schemas for order processing API.
"""
# mypy: disable-error-code="attr-defined,call-arg,misc,unused-ignore"

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, constr, field_validator

from .models import ActivationStatus, OrderStatus, OrderType

# ============================================================================
# Order Schemas
# ============================================================================


class BillingAddress(BaseModel):
    """Billing address schema"""

    street_address: str
    city: str
    state_province: str
    postal_code: str
    country: str
    company_name: str | None = None


class ServiceSelection(BaseModel):
    """Service selection schema"""

    service_code: str = Field(..., min_length=1, max_length=100)
    name: str
    quantity: int = Field(1, ge=1)
    configuration: dict[str, Any] | None = None


class OrderItemCreate(BaseModel):
    """Schema for creating order item"""

    item_type: constr(pattern=r"^(service|addon|setup_fee|discount|credit)$")  # type: ignore[valid-type]
    service_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    quantity: int = Field(1, ge=1)
    unit_price: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    configuration: dict[str, Any] | None = None
    billing_cycle: constr(pattern=r"^(monthly|quarterly|annual|one_time)$") | None = None  # type: ignore[valid-type]
    trial_days: int = Field(0, ge=0, le=365)


class OrderCreate(BaseModel):
    """Schema for creating new order"""

    # Customer information
    customer_email: EmailStr
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_phone: str | None = Field(None, max_length=50)
    company_name: str = Field(..., min_length=1, max_length=255)

    # Organization details
    organization_slug: constr(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100) | None = None  # type: ignore[valid-type]
    organization_name: str | None = Field(None, max_length=255)
    billing_address: BillingAddress | None = None
    tax_id: str | None = Field(None, max_length=100)

    # Service configuration
    deployment_template_id: int | None = Field(None, gt=0)
    deployment_region: str | None = Field(None, max_length=50)
    deployment_type: str | None = None

    # Services
    selected_services: list[ServiceSelection] = Field(..., min_length=1)
    service_configuration: dict[str, Any] | None = None
    features_enabled: dict[str, bool] | None = None

    # Pricing
    currency: constr(pattern=r"^[A-Z]{3}$") = "USD"  # type: ignore[valid-type,assignment]
    billing_cycle: constr(pattern=r"^(monthly|quarterly|annual)$") | None = None  # type: ignore[valid-type]

    # Metadata
    source: str | None = Field(None, max_length=50)
    utm_source: str | None = Field(None, max_length=100)
    utm_medium: str | None = Field(None, max_length=100)
    utm_campaign: str | None = Field(None, max_length=100)
    notes: str | None = None
    external_order_id: str | None = Field(None, max_length=255)

    @field_validator("organization_slug")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        """Validate organization slug"""
        if v:
            # Check for reserved slugs
            reserved = {"admin", "api", "www", "mail", "ftp", "smtp", "support", "help", "docs"}
            if v in reserved:
                raise ValueError(f"Slug '{v}' is reserved")
        return v


class OrderResponse(BaseModel):
    """Schema for order response"""

    id: int
    order_number: str
    order_type: OrderType
    status: OrderStatus
    status_message: str | None = None

    customer_email: str
    customer_name: str
    company_name: str
    organization_slug: str | None = None

    deployment_template_id: int | None = None
    deployment_region: str | None = None
    deployment_type: str | None = None

    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    billing_cycle: str | None = None

    tenant_id: str | None = None
    deployment_instance_id: int | None = None

    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: float})


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status"""

    status: OrderStatus
    status_message: str | None = None


class OrderSubmit(BaseModel):
    """Schema for submitting order for processing"""

    payment_reference: str | None = None
    contract_reference: str | None = None
    auto_activate: bool = True


# ============================================================================
# Activation Schemas
# ============================================================================


class ServiceActivationResponse(BaseModel):
    """Schema for service activation response"""

    id: int
    order_id: int
    tenant_id: str
    service_code: str
    service_name: str
    activation_status: ActivationStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: int | None = None
    success: bool
    error_message: str | None = None
    activation_data: dict[str, Any] | None = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: float})


class ActivationProgress(BaseModel):
    """Schema for activation progress"""

    order_id: int
    order_number: str
    total_services: int
    completed: int
    failed: int
    in_progress: int
    pending: int
    overall_status: str
    current_step: str | None = None
    progress_percent: int
    activations: list[ServiceActivationResponse]


# ============================================================================
# Public API Schemas
# ============================================================================


class ServicePackage(BaseModel):
    """Pre-configured service package"""

    code: str
    name: str
    description: str
    services: list[str]  # Service codes included
    price_monthly: Decimal
    price_annual: Decimal
    features: list[str]
    deployment_template: str
    recommended: bool = False


class QuickOrderRequest(BaseModel):
    """Simplified order request for common packages"""

    # Customer info
    email: EmailStr
    name: str = Field(..., min_length=1)
    company: str = Field(..., min_length=1)
    phone: str | None = None

    # Package selection
    package_code: constr(pattern=r"^(starter|professional|enterprise|custom)$")  # type: ignore[valid-type]
    billing_cycle: constr(pattern=r"^(monthly|annual)$") = "monthly"  # type: ignore[valid-type,assignment]

    # Deployment
    region: constr(pattern=r"^[a-z]{2}-[a-z]+-\d+$") = "us-east-1"  # type: ignore[valid-type,assignment]
    organization_slug: constr(pattern=r"^[a-z0-9-]+$") | None = None  # type: ignore[valid-type]

    # Optional customizations
    additional_services: list[str] | None = None
    user_count: int = Field(10, ge=1, le=1000)

    # Marketing
    utm_source: str | None = None
    utm_campaign: str | None = None


class OrderStatusResponse(BaseModel):
    """Public order status response"""

    order_number: str
    status: OrderStatus
    status_message: str | None = None
    progress_percent: int
    tenant_subdomain: str | None = None
    activation_url: str | None = None
    estimated_completion: datetime | None = None
    created_at: datetime


# ============================================================================
# Webhook Schemas
# ============================================================================


class WebhookEvent(BaseModel):
    """Webhook event payload"""

    event_type: constr(pattern=r"^order\.(created|submitted|approved|completed|failed|cancelled)$")  # type: ignore[valid-type]
    order_id: int
    order_number: str
    timestamp: datetime
    data: dict[str, Any]


class WebhookConfig(BaseModel):
    """Webhook configuration"""

    url: constr(pattern=r"^https?://")  # type: ignore[valid-type]
    events: list[str]
    secret: str | None = None
    active: bool = True
