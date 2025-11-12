"""
Project Template Models

Database models for storing custom project templates that can be used
to auto-generate projects from orders.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..db import Base as BaseRuntime

if TYPE_CHECKING:  # pragma: no cover - typing-only alias
    from sqlalchemy.types import TypeDecorator as ArrayCompat  # type: ignore[assignment]
    from sqlalchemy.types import TypeDecorator as JSONBCompat  # type: ignore[assignment]
else:
    from ..db.types import ArrayCompat, JSONBCompat

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class ProjectTemplate(Base):
    """
    Project Template Model

    Defines reusable templates for creating projects. Each template contains
    metadata and a list of task templates that should be created when a project
    is instantiated from this template.
    """

    __tablename__ = "project_templates"

    # Primary key
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Multi-tenant
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Template identification
    template_code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g., "FIBER_INSTALL_V1"
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # e.g., "Fiber Installation Template"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # Template versioning

    # Template settings
    project_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # installation, maintenance, etc.
    estimated_duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    default_priority: Mapped[str] = mapped_column(
        String(20), default="normal"
    )  # low, normal, high, critical, emergency

    # Auto-assignment settings
    required_team_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # Team type required for this template
    required_team_skills = Column(JSONBCompat, nullable=True)  # Skills the team must have

    # Template activation
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # Default template for a project type

    # Name/description patterns with placeholders
    # e.g., "Fiber Installation - {customer_name}"
    project_name_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)
    project_description_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Mapping to order types - which order types should use this template
    applies_to_order_types: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(50)),
        nullable=True,
    )  # ["new_tenant", "addon"]
    applies_to_service_types: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(50)),
        nullable=True,
    )  # ["fiber", "wireless"]

    # Metadata
    tags: Mapped[list[str] | None] = mapped_column(ArrayCompat(String(50)), nullable=True)
    custom_fields = Column(JSONBCompat, nullable=True)
    notes = Column(Text, nullable=True)

    # Audit fields
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tasks = relationship(
        "TaskTemplate",
        back_populates="project_template",
        foreign_keys="TaskTemplate.template_id",
        cascade="all, delete-orphan",
        order_by="TaskTemplate.sequence_order",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "template_code", "version", name="uq_template_tenant_code_version"
        ),
        {"comment": "Project templates for auto-generating projects from orders"},
    )


class TaskTemplate(Base):
    """
    Task Template Model

    Defines a task that should be created as part of a project template.
    Contains all the settings needed to instantiate a real task.
    """

    __tablename__ = "task_templates"

    # Primary key
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Multi-tenant
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Parent template
    template_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("project_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Task definition
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # site_survey, splicing, testing, etc.

    # Sequencing and dependencies
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    depends_on_sequence_orders: Mapped[list[int] | None] = mapped_column(
        ArrayCompat(Integer),
        nullable=True,
    )  # [1, 2] = depends on tasks 1 and 2

    # Task settings
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sla_target_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Requirements
    required_skills = Column(JSONBCompat, nullable=True)  # {"fiber_splicing": true, "otdr": true}
    required_equipment: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # ["fusion_splicer", "otdr"]
    required_certifications: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # ["fiber_optic_technician"]
    requires_customer_presence: Mapped[bool] = mapped_column(Boolean, default=False)

    # Auto-assignment
    auto_assign_to_role: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "lead", "member", "specialist"
    auto_assign_to_skill: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # Assign to tech with this skill

    # Metadata
    tags: Mapped[list[str] | None] = mapped_column(ArrayCompat(String(50)), nullable=True)
    custom_fields = Column(JSONBCompat, nullable=True)
    notes = Column(Text, nullable=True)

    # Audit fields
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project_template = relationship("ProjectTemplate", back_populates="tasks")

    # Constraints
    __table_args__ = (
        UniqueConstraint("template_id", "sequence_order", name="uq_task_template_sequence"),
        {"comment": "Task templates within project templates"},
    )
