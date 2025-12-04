"""
Contact System Database Models

Comprehensive contact management with configurable labels and custom fields.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base
from dotmac.platform.db.types import JSONBCompat

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModel
else:
    BaseModel = Base

# Association table for many-to-many contact labels
contact_to_labels = Table(
    "contact_to_labels",
    Base.metadata,
    Column(
        "contact_id",
        PGUUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "label_definition_id",
        PGUUID(as_uuid=True),
        ForeignKey("contact_label_definitions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("assigned_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("assigned_by", PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True),
    UniqueConstraint("contact_id", "label_definition_id", name="uq_contact_label"),
    Index("ix_contact_labels_contact_id", "contact_id"),
    Index("ix_contact_labels_label_definition_id", "label_definition_id"),
)


class ContactStatus(str, Enum):
    """Contact lifecycle status"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    BLOCKED = "blocked"
    PENDING = "pending"


class ContactStage(str, Enum):
    """Contact relationship stage"""

    PROSPECT = "prospect"
    LEAD = "lead"
    OPPORTUNITY = "opportunity"
    CUSTOMER = "customer"
    PARTNER = "partner"
    VENDOR = "vendor"
    OTHER = "other"


class ContactMethodType(str, Enum):
    """Types of contact methods"""

    EMAIL = "email"
    PHONE = "phone"
    MOBILE = "mobile"
    FAX = "fax"
    WEBSITE = "website"
    SOCIAL_LINKEDIN = "social_linkedin"
    SOCIAL_TWITTER = "social_twitter"
    SOCIAL_FACEBOOK = "social_facebook"
    SOCIAL_INSTAGRAM = "social_instagram"
    ADDRESS = "address"
    OTHER = "other"


class ContactFieldType(str, Enum):
    """Custom field data types"""

    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    SELECT = "select"
    MULTISELECT = "multiselect"
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    JSON = "json"


class Contact(BaseModel):  # type: ignore[misc]
    """
    Core contact entity representing a person or organization
    """

    __tablename__ = "contacts"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Legacy customer_id FK - use customer_links for new code
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
        comment="Legacy FK - use customer_links join table for new relationships",
    )

    # Name fields
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Computed or custom
    prefix: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Mr, Ms, Dr, etc.
    suffix: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Jr, Sr, III, etc.

    # Organization
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status and lifecycle
    status: Mapped[ContactStatus] = mapped_column(
        String(50), default=ContactStatus.ACTIVE, nullable=False
    )
    stage: Mapped[ContactStage] = mapped_column(
        String(50), default=ContactStage.PROSPECT, nullable=False
    )

    # Ownership and assignment
    owner_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    assigned_team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Notes and metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True, default=list)

    # Custom fields (JSONB for flexible schema)
    custom_fields: Mapped[dict[str, Any] | None] = mapped_column(
        JSONBCompat, nullable=True, default=dict
    )

    # Additional metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSONBCompat, nullable=True, default=dict
    )

    # Important dates
    birthday: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anniversary: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Flags
    is_primary: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Primary contact for customer
    is_decision_maker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_billing_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_technical_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Preferences
    preferred_contact_method: Mapped[ContactMethodType | None] = mapped_column(
        String(50), nullable=True
    )
    preferred_language: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # ISO 639-1 code
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)  # IANA timezone

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    contact_methods = relationship(
        "ContactMethod", back_populates="contact", cascade="all, delete-orphan"
    )
    labels = relationship(
        "ContactLabelDefinition", secondary=contact_to_labels, back_populates="contacts"
    )
    # New normalized many-to-many relationship via join table
    # Note: Commented to avoid circular import with customer_management module
    # customer_links = relationship("CustomerContactLink", back_populates="contact", lazy="dynamic")
    # Legacy direct relationship - kept for backward compatibility
    customer = relationship("Customer", foreign_keys=[customer_id], viewonly=True)
    owner = relationship("User", foreign_keys=[owner_id])

    __table_args__ = (
        # Note: tenant_id index created automatically via index=True in column definition
        Index("ix_contacts_customer_id", "customer_id"),
        Index("ix_contacts_display_name", "display_name"),
        Index("ix_contacts_company", "company"),
        Index("ix_contacts_status", "status"),
        Index("ix_contacts_stage", "stage"),
        Index("ix_contacts_owner_id", "owner_id"),
        Index("ix_contacts_deleted_at", "deleted_at"),
        CheckConstraint(
            "display_name IS NOT NULL AND display_name != ''", name="check_display_name_not_empty"
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Contact(id={self.id}, display_name='{self.display_name}', company='{self.company}')>"
        )


class ContactMethod(BaseModel):  # type: ignore[misc]
    """
    Individual contact method (email, phone, address, etc.)
    """

    __tablename__ = "contact_methods"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contact_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )

    # Contact method details
    type: Mapped[ContactMethodType] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(
        String(500), nullable=False
    )  # Email, phone number, URL, etc.
    label: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Work, Home, Mobile, etc.

    # For addresses, store structured data
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # ISO 3166-1 alpha-2

    # Flags
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )  # Visible to all or internal only

    # Verification
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Display order
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    contact = relationship("Contact", back_populates="contact_methods")

    __table_args__ = (
        Index("ix_contact_methods_contact_id", "contact_id"),
        Index("ix_contact_methods_type", "type"),
        Index("ix_contact_methods_value", "value"),
        Index("ix_contact_methods_is_primary", "is_primary"),
        UniqueConstraint("contact_id", "type", "value", name="uq_contact_method"),
    )

    def __repr__(self) -> str:
        return f"<ContactMethod(type='{self.type}', value='{self.value}', label='{self.label}')>"


class ContactLabelDefinition(Base):  # type: ignore[misc]
    """
    Tenant-specific label definitions
    """

    __tablename__ = "contact_label_definitions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Label details
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)  # URL-safe identifier
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Visual
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color code
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Icon name/class

    # Category/grouping
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Display
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # System flags
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Cannot be deleted
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Auto-applied

    # Metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    contacts = relationship("Contact", secondary=contact_to_labels, back_populates="labels")

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_tenant_label_slug"),
        # Note: tenant_id index created automatically via index=True in column definition
        Index("ix_contact_label_definitions_slug", "slug"),
        Index("ix_contact_label_definitions_category", "category"),
    )

    def __repr__(self) -> str:
        return f"<ContactLabelDefinition(name='{self.name}', slug='{self.slug}')>"


class ContactFieldDefinition(Base):  # type: ignore[misc]
    """
    Custom field definitions for contacts
    """

    __tablename__ = "contact_field_definitions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Field details
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)  # JSON key in custom_fields
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Field type and validation
    field_type: Mapped[ContactFieldType] = mapped_column(String(50), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_unique: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_searchable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Default value (stored as JSON for flexibility)
    default_value: Mapped[Any | None] = mapped_column(JSON, nullable=True)

    # Validation rules (JSON schema or custom rules)
    validation_rules: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # For select/multiselect fields
    options: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)

    # Display configuration
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    placeholder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Grouping
    field_group: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Visibility and permissions
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_editable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    required_permission: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # System flags
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_encrypted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Encrypt in custom_fields

    # Metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "field_key", name="uq_tenant_field_key"),
        # Note: tenant_id index created automatically via index=True in column definition
        Index("ix_contact_field_definitions_field_key", "field_key"),
        Index("ix_contact_field_definitions_field_group", "field_group"),
    )

    def __repr__(self) -> str:
        return f"<ContactFieldDefinition(name='{self.name}', field_key='{self.field_key}', type='{self.field_type}')>"


class ContactActivity(Base):  # type: ignore[misc]
    """
    Activity log for contacts (calls, emails, meetings, etc.)
    """

    __tablename__ = "contact_activities"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contact_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )

    # Activity details
    activity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # call, email, meeting, note, etc.
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timing
    activity_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # scheduled, completed, cancelled
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # User tracking
    performed_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_contact_activities_contact_id", "contact_id"),
        Index("ix_contact_activities_activity_type", "activity_type"),
        Index("ix_contact_activities_activity_date", "activity_date"),
        Index("ix_contact_activities_performed_by", "performed_by"),
    )

    def __repr__(self) -> str:
        return f"<ContactActivity(type='{self.activity_type}', subject='{self.subject}')>"
