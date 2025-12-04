"""
GraphQL types for Customer Management.

Provides types for customers, activities, and notes with efficient
batched loading via DataLoaders to prevent N+1 query problems.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

import strawberry


@strawberry.enum
class CustomerStatusEnum(str, Enum):
    """Customer account status."""

    PROSPECT = "prospect"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    CHURNED = "churned"
    ARCHIVED = "archived"


@strawberry.enum
class CustomerTypeEnum(str, Enum):
    """Type of customer account."""

    INDIVIDUAL = "individual"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"
    PARTNER = "partner"
    VENDOR = "vendor"


@strawberry.enum
class CustomerTierEnum(str, Enum):
    """Customer tier/level for service differentiation."""

    FREE = "free"
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


@strawberry.enum
class ActivityTypeEnum(str, Enum):
    """Types of customer activities."""

    CREATED = "created"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    NOTE_ADDED = "note_added"
    TAG_ADDED = "tag_added"
    TAG_REMOVED = "tag_removed"
    CONTACT_MADE = "contact_made"
    PURCHASE = "purchase"
    SUPPORT_TICKET = "support_ticket"
    LOGIN = "login"
    EXPORT = "export"
    IMPORT = "import"


@strawberry.type
class CustomerActivity:
    """Customer activity/interaction record."""

    id: strawberry.ID
    customer_id: strawberry.ID
    activity_type: ActivityTypeEnum
    title: str
    description: str | None
    performed_by: strawberry.ID | None
    created_at: datetime

    @classmethod
    def from_model(cls, activity: Any) -> "CustomerActivity":
        """Convert SQLAlchemy model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(activity.id)),
            customer_id=strawberry.ID(str(activity.customer_id)),
            activity_type=ActivityTypeEnum(activity.activity_type.value),
            title=activity.title,
            description=activity.description,
            performed_by=(
                strawberry.ID(str(activity.performed_by)) if activity.performed_by else None
            ),
            created_at=activity.created_at,
        )


@strawberry.type
class CustomerNote:
    """Note/comment about a customer."""

    id: strawberry.ID
    customer_id: strawberry.ID
    subject: str
    content: str
    is_internal: bool
    created_by_id: strawberry.ID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, note: Any) -> "CustomerNote":
        """Convert SQLAlchemy model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(note.id)),
            customer_id=strawberry.ID(str(note.customer_id)),
            subject=note.subject,
            content=note.content,
            is_internal=note.is_internal,
            created_by_id=strawberry.ID(str(note.created_by_id)) if note.created_by_id else None,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )


@strawberry.type
class CustomerMetrics:
    """Aggregated customer metrics."""

    lifetime_value: Decimal
    total_purchases: int
    average_order_value: Decimal
    last_purchase_date: datetime | None
    first_purchase_date: datetime | None
    satisfaction_score: int | None
    net_promoter_score: int | None


@strawberry.type
class Customer:
    """
    Customer with comprehensive profile and related data.

    Activities and notes are batched via DataLoaders to prevent N+1 queries.
    """

    # Core identifiers
    id: strawberry.ID
    customer_number: str

    # Basic information
    first_name: str
    last_name: str
    middle_name: str | None
    display_name: str | None
    company_name: str | None

    # Account information
    status: CustomerStatusEnum
    customer_type: CustomerTypeEnum
    tier: CustomerTierEnum

    # Contact information
    email: str
    email_verified: bool
    phone: str | None
    phone_verified: bool
    mobile: str | None

    # Address
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state_province: str | None
    postal_code: str | None
    country: str | None

    # Business info (for business customers)
    tax_id: str | None
    industry: str | None
    employee_count: int | None

    # Metrics
    lifetime_value: Decimal
    total_purchases: int
    average_order_value: Decimal
    last_purchase_date: datetime | None

    # Dates
    created_at: datetime
    updated_at: datetime
    acquisition_date: datetime
    last_contact_date: datetime | None

    # Relationships - batched via DataLoaders
    activities: list[CustomerActivity] = strawberry.field(default_factory=list)
    notes: list[CustomerNote] = strawberry.field(default_factory=list)

    @classmethod
    def from_model(cls, customer: Any) -> "Customer":
        """Convert SQLAlchemy Customer model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(customer.id)),
            customer_number=customer.customer_number,
            first_name=customer.first_name,
            last_name=customer.last_name,
            middle_name=customer.middle_name,
            display_name=customer.display_name,
            company_name=customer.company_name,
            status=CustomerStatusEnum(customer.status.value),
            customer_type=CustomerTypeEnum(customer.customer_type.value),
            tier=CustomerTierEnum(customer.tier.value),
            email=customer.email,
            email_verified=customer.email_verified,
            phone=customer.phone,
            phone_verified=customer.phone_verified,
            mobile=customer.mobile,
            address_line1=customer.address_line1,
            address_line2=customer.address_line2,
            city=customer.city,
            state_province=customer.state_province,
            postal_code=customer.postal_code,
            country=customer.country,
            tax_id=customer.tax_id,
            industry=customer.industry,
            employee_count=customer.employee_count,
            lifetime_value=customer.lifetime_value,
            total_purchases=customer.total_purchases,
            average_order_value=customer.average_order_value,
            last_purchase_date=customer.last_purchase_date,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
            acquisition_date=customer.acquisition_date,
            last_contact_date=customer.last_contact_date,
            # activities and notes populated by resolvers via DataLoaders
            activities=[],
            notes=[],
        )


@strawberry.type
class CustomerConnection:
    """Paginated customer results."""

    customers: list[Customer]
    total_count: int
    has_next_page: bool


@strawberry.type
class CustomerOverviewMetrics:
    """High-level customer metrics."""

    total_customers: int
    active_customers: int
    prospect_customers: int
    churned_customers: int
    total_lifetime_value: Decimal
    average_lifetime_value: Decimal
