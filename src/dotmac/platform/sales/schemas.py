"""
Sales Order Schemas

Pydantic schemas for order processing API.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

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
    company_name: Optional[str] = None


class ServiceSelection(BaseModel):
    """Service selection schema"""

    service_code: str = Field(..., min_length=1, max_length=100)
    name: str
    quantity: int = Field(1, ge=1)
    configuration: Optional[dict[str, Any]] = None


class OrderItemCreate(BaseModel):
    """Schema for creating order item"""

    item_type: str = Field(..., pattern=r"^(service|addon|setup_fee|discount|credit)$")
    service_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quantity: int = Field(1, ge=1)
    unit_price: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Field(0, ge=0)
    tax_amount: Decimal = Field(0, ge=0)
    configuration: Optional[dict[str, Any]] = None
    billing_cycle: Optional[str] = Field(None, pattern=r"^(monthly|quarterly|annual|one_time)$")
    trial_days: int = Field(0, ge=0, le=365)


class OrderCreate(BaseModel):
    """Schema for creating new order"""

    # Customer information
    customer_email: EmailStr
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_phone: Optional[str] = Field(None, max_length=50)
    company_name: str = Field(..., min_length=1, max_length=255)

    # Organization details
    organization_slug: Optional[str] = Field(None, pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100)
    organization_name: Optional[str] = Field(None, max_length=255)
    billing_address: Optional[BillingAddress] = None
    tax_id: Optional[str] = Field(None, max_length=100)

    # Service configuration
    deployment_template_id: Optional[int] = Field(None, gt=0)
    deployment_region: Optional[str] = Field(None, max_length=50)
    deployment_type: Optional[str] = None

    # Services
    selected_services: list[ServiceSelection] = Field(..., min_length=1)
    service_configuration: Optional[dict[str, Any]] = None
    features_enabled: Optional[dict[str, bool]] = None

    # Pricing
    currency: str = Field("USD", pattern=r"^[A-Z]{3}$")
    billing_cycle: Optional[str] = Field(None, pattern=r"^(monthly|quarterly|annual)$")

    # Metadata
    source: Optional[str] = Field(None, max_length=50)
    utm_source: Optional[str] = Field(None, max_length=100)
    utm_medium: Optional[str] = Field(None, max_length=100)
    utm_campaign: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    external_order_id: Optional[str] = Field(None, max_length=255)

    @field_validator("organization_slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
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
    status_message: Optional[str] = None

    customer_email: str
    customer_name: str
    company_name: str
    organization_slug: Optional[str] = None

    deployment_template_id: Optional[int] = None
    deployment_region: Optional[str] = None
    deployment_type: Optional[str] = None

    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    billing_cycle: Optional[str] = None

    tenant_id: Optional[int] = None
    deployment_instance_id: Optional[int] = None

    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status"""

    status: OrderStatus
    status_message: Optional[str] = None


class OrderSubmit(BaseModel):
    """Schema for submitting order for processing"""

    payment_reference: Optional[str] = None
    contract_reference: Optional[str] = None
    auto_activate: bool = True


# ============================================================================
# Activation Schemas
# ============================================================================


class ServiceActivationResponse(BaseModel):
    """Schema for service activation response"""

    id: int
    order_id: int
    tenant_id: int
    service_code: str
    service_name: str
    activation_status: ActivationStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    success: bool
    error_message: Optional[str] = None
    activation_data: Optional[dict[str, Any]] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
    current_step: Optional[str] = None
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
    phone: Optional[str] = None

    # Package selection
    package_code: str = Field(..., pattern=r"^(starter|professional|enterprise|custom)$")
    billing_cycle: str = Field("monthly", pattern=r"^(monthly|annual)$")

    # Deployment
    region: str = Field("us-east-1", pattern=r"^[a-z]{2}-[a-z]+-\d+$")
    organization_slug: Optional[str] = Field(None, pattern=r"^[a-z0-9-]+$")

    # Optional customizations
    additional_services: Optional[list[str]] = None
    user_count: int = Field(10, ge=1, le=1000)

    # Marketing
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None


class OrderStatusResponse(BaseModel):
    """Public order status response"""

    order_number: str
    status: OrderStatus
    status_message: Optional[str] = None
    progress_percent: int
    tenant_subdomain: Optional[str] = None
    activation_url: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    created_at: datetime


# ============================================================================
# Webhook Schemas
# ============================================================================


class WebhookEvent(BaseModel):
    """Webhook event payload"""

    event_type: str = Field(..., pattern=r"^order\.(created|submitted|approved|completed|failed|cancelled)$")
    order_id: int
    order_number: str
    timestamp: datetime
    data: dict[str, Any]


class WebhookConfig(BaseModel):
    """Webhook configuration"""

    url: str = Field(..., pattern=r"^https?://")
    events: list[str]
    secret: Optional[str] = None
    active: bool = True
