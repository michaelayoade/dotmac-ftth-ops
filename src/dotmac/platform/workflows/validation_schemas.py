"""
Workflow Service Input Validation Schemas

Pydantic schemas for validating workflow method inputs.
These schemas ensure type safety and input validation across all workflow services.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, FieldValidationInfo, field_validator

# ============================================================================
# Notification Workflow Schemas
# ============================================================================


class NotifyTeamInput(BaseModel):
    """Input schema for NotificationsService.notify_team()"""

    team: str = Field(..., min_length=1, description="Team name or identifier")
    channel: str = Field(..., min_length=1, description="Notification channel")
    subject: str = Field(..., min_length=1, max_length=255, description="Notification subject")
    message: str = Field(..., min_length=1, description="Notification message body")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")
    tenant_id: str | None = Field(None, description="Tenant ID for isolation")
    priority: str = Field("medium", description="Notification priority")
    notification_type: str = Field("custom", description="Notification type")

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        """Validate notification channel"""
        valid_channels = {"email", "in_app", "sms", "push", "webhook"}
        if v.lower() not in valid_channels:
            raise ValueError(f"Invalid channel: {v}. Valid channels: {', '.join(valid_channels)}")
        return v.lower()

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        """Validate notification priority"""
        valid_priorities = {"low", "medium", "high", "urgent"}
        if v.lower() not in valid_priorities:
            raise ValueError(
                f"Invalid priority: {v}. Valid priorities: {', '.join(valid_priorities)}"
            )
        return v.lower()


# ============================================================================
# Licensing Workflow Schemas
# ============================================================================


class IssueLicenseInput(BaseModel):
    """Input schema for LicenseService.issue_license()"""

    customer_id: str = Field(..., description="Customer ID (UUID or integer)")
    license_template_id: str = Field(..., description="License template ID (UUID)")
    tenant_id: str = Field(..., description="Tenant ID")
    issued_to: str | None = Field(None, description="Name of licensee")
    issued_via: str | None = Field("workflow", description="Source of issuance")
    reseller_id: str | None = Field(None, description="Reseller/partner ID")
    additional_metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class AllocateFromPartnerInput(BaseModel):
    """Input schema for LicenseService.allocate_from_partner()"""

    partner_id: str = Field(..., description="Partner ID (UUID)")
    customer_id: str = Field(..., description="Customer ID (UUID)")
    license_template_id: str = Field(..., description="License template ID (UUID)")
    license_count: int = Field(1, ge=1, description="Number of licenses to allocate")
    tenant_id: str | None = Field(None, description="Tenant ID")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


# ============================================================================
# Sales Workflow Schemas
# ============================================================================


class CreateQuoteInput(BaseModel):
    """Input schema for SalesService.create_quote()"""

    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    items: list[dict[str, Any]] = Field(..., min_length=1, description="Quote line items")
    valid_until: datetime | None = Field(None, description="Quote expiration date")
    discount_percent: float | None = Field(None, ge=0, le=100, description="Discount percentage")
    notes: str | None = Field(None, description="Additional notes")

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Validate quote line items"""
        for item in v:
            if "product_id" not in item:
                raise ValueError("Each item must have a product_id")
            if "quantity" not in item or item["quantity"] < 1:
                raise ValueError("Each item must have a quantity >= 1")
        return v


class ConvertQuoteToOrderInput(BaseModel):
    """Input schema for SalesService.convert_quote_to_order()"""

    quote_id: str = Field(..., description="Quote ID")
    tenant_id: str = Field(..., description="Tenant ID")
    payment_method: str | None = Field(None, description="Payment method")
    purchase_order_number: str | None = Field(None, description="PO number")


# ============================================================================
# Billing Workflow Schemas
# ============================================================================


class ProcessRenewalInput(BaseModel):
    """Input schema for BillingService.process_renewal()"""

    subscription_id: str = Field(..., description="Subscription ID")
    tenant_id: str = Field(..., description="Tenant ID")
    payment_method_id: str | None = Field(None, description="Payment method ID")
    prorate: bool = Field(False, description="Whether to prorate charges")


class GenerateInvoiceInput(BaseModel):
    """Input schema for BillingService.generate_invoice()"""

    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    line_items: list[dict[str, Any]] = Field(..., min_length=1, description="Invoice line items")
    due_date: datetime | None = Field(None, description="Invoice due date")
    notes: str | None = Field(None, description="Additional notes")

    @field_validator("line_items")
    @classmethod
    def validate_line_items(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Validate invoice line items"""
        for item in v:
            if "description" not in item:
                raise ValueError("Each line item must have a description")
            if "amount" not in item or item["amount"] <= 0:
                raise ValueError("Each line item must have an amount > 0")
        return v


# ============================================================================
# Deployment Workflow Schemas
# ============================================================================


class ProvisionDeploymentInput(BaseModel):
    """Input schema for DeploymentService.provision_deployment()"""

    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    deployment_template_id: str = Field(..., description="Deployment template ID")
    region: str | None = Field(None, description="Deployment region")
    environment: str = Field("production", description="Environment name")
    config: dict[str, Any] | None = Field(None, description="Deployment configuration")


class ScheduleMaintenanceInput(BaseModel):
    """Input schema for DeploymentService.schedule_maintenance()"""

    deployment_id: str = Field(..., description="Deployment ID")
    tenant_id: str = Field(..., description="Tenant ID")
    maintenance_type: str = Field(..., description="Maintenance type")
    scheduled_start: datetime = Field(..., description="Maintenance start time")
    scheduled_end: datetime = Field(..., description="Maintenance end time")
    description: str = Field(..., min_length=1, description="Maintenance description")
    notify_users: bool = Field(True, description="Whether to notify users")

    @field_validator("scheduled_end")
    @classmethod
    def validate_end_time(cls, v: datetime, info: FieldValidationInfo) -> datetime:
        """Validate end time is after start time"""
        if "scheduled_start" in info.data and v <= info.data["scheduled_start"]:
            raise ValueError("scheduled_end must be after scheduled_start")
        return v


# ============================================================================
# Partner Management Workflow Schemas
# ============================================================================


class CreatePartnerAccountInput(BaseModel):
    """Input schema for PartnerService.create_partner_account()"""

    partner_id: str = Field(..., description="Partner ID")
    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    engagement_type: str = Field(..., description="Engagement type")
    commission_rate: float | None = Field(
        None, ge=0, le=100, description="Commission rate percentage"
    )
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class CheckLicenseQuotaInput(BaseModel):
    """Input schema for PartnerService.check_license_quota()"""

    partner_id: str = Field(..., description="Partner ID")
    requested_licenses: int = Field(0, ge=0, description="Number of requested licenses")
    tenant_id: str | None = Field(None, description="Tenant ID")


# ============================================================================
# Customer Management Workflow Schemas
# ============================================================================


class CreateCustomerInput(BaseModel):
    """Input schema for CustomerService.create_customer()"""

    tenant_id: str = Field(..., description="Tenant ID")
    email: EmailStr = Field(..., description="Customer email address")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: str | None = Field(None, description="Phone number")
    company: str | None = Field(None, description="Company name")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class UpdateCustomerInput(BaseModel):
    """Input schema for CustomerService.update_customer()"""

    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    email: EmailStr | None = Field(None, description="Customer email address")
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, description="Phone number")
    company: str | None = Field(None, description="Company name")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


# ============================================================================
# Ticketing Workflow Schemas
# ============================================================================


class CreateTicketInput(BaseModel):
    """Input schema for TicketingService.create_ticket()"""

    customer_id: str = Field(..., description="Customer ID")
    tenant_id: str = Field(..., description="Tenant ID")
    title: str = Field(..., min_length=1, max_length=255, description="Ticket title")
    description: str = Field(..., min_length=1, description="Ticket description")
    priority: str = Field("medium", description="Ticket priority")
    category: str | None = Field(None, description="Ticket category")
    assigned_to: str | None = Field(None, description="Assigned user ID")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        """Validate ticket priority"""
        valid_priorities = {"low", "medium", "high", "urgent"}
        if v.lower() not in valid_priorities:
            raise ValueError(
                f"Invalid priority: {v}. Valid priorities: {', '.join(valid_priorities)}"
            )
        return v.lower()


class AssignTicketInput(BaseModel):
    """Input schema for TicketingService.assign_ticket()"""

    ticket_id: str = Field(..., description="Ticket ID")
    tenant_id: str = Field(..., description="Tenant ID")
    assigned_to: str = Field(..., description="User ID to assign to")
    notes: str | None = Field(None, description="Assignment notes")
