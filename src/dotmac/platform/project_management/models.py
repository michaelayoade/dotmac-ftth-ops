"""
Project Management Models

Models for managing multi-step projects, tasks, teams, and assignments.
Designed for field service operations like fiber installations, maintenance, etc.
"""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base

if TYPE_CHECKING:  # pragma: no cover - typing alias
    from sqlalchemy.types import TypeDecorator as ArrayCompat  # type: ignore[assignment]
    from sqlalchemy.types import TypeDecorator as JSONBCompat  # type: ignore[assignment]
else:
    from dotmac.platform.db.types import ArrayCompat, JSONBCompat
from dotmac.platform.project_management.constants import FIELD_SERVICE_TEAM_TABLE


class ProjectType(str, enum.Enum):
    """Type of project"""

    INSTALLATION = "installation"
    MAINTENANCE = "maintenance"
    UPGRADE = "upgrade"
    REPAIR = "repair"
    SITE_SURVEY = "site_survey"
    EMERGENCY = "emergency"
    CUSTOM = "custom"


class ProjectStatus(str, enum.Enum):
    """Project status"""

    PLANNED = "planned"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TaskType(str, enum.Enum):
    """Type of task within a project"""

    SITE_SURVEY = "site_survey"
    PLANNING = "planning"
    FIBER_ROUTING = "fiber_routing"
    TRENCHING = "trenching"
    CONDUIT_INSTALLATION = "conduit_installation"
    CABLE_PULLING = "cable_pulling"
    SPLICING = "splicing"
    TERMINATION = "termination"
    ONT_INSTALLATION = "ont_installation"
    CPE_INSTALLATION = "cpe_installation"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    CUSTOMER_TRAINING = "customer_training"
    CLOSEOUT = "closeout"
    INSPECTION = "inspection"
    TROUBLESHOOTING = "troubleshooting"
    CUSTOM = "custom"


class TaskStatus(str, enum.Enum):
    """Task status"""

    PENDING = "pending"
    READY = "ready"  # Dependencies met, ready to start
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class TaskPriority(str, enum.Enum):
    """Task priority"""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class TeamType(str, enum.Enum):
    """Type of team"""

    INSTALLATION = "installation"
    MAINTENANCE = "maintenance"
    EMERGENCY = "emergency"
    FIELD_SERVICE = "field_service"
    SPECIALIZED = "specialized"
    GENERAL = "general"


class TeamRole(str, enum.Enum):
    """Role within a team"""

    MEMBER = "member"
    LEAD = "lead"
    SUPERVISOR = "supervisor"
    COORDINATOR = "coordinator"


class Project(Base):
    """
    Multi-step Project Model

    Represents a complete project consisting of multiple tasks.
    Example: Fiber Installation Project with site survey, routing, splicing, etc.
    """

    __tablename__ = "projects"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    project_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_type: Mapped[ProjectType] = mapped_column(
        SQLEnum(ProjectType),
        nullable=False,
        index=True,
    )
    status: Mapped[ProjectStatus] = mapped_column(
        SQLEnum(ProjectStatus),
        nullable=False,
        default=ProjectStatus.PLANNED,
        index=True,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SQLEnum(TaskPriority),
        nullable=False,
        default=TaskPriority.NORMAL,
    )

    # Linked entities
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    subscriber_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    quote_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), nullable=True, index=True
    )  # Link to quote if applicable

    # Location
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    service_coordinates: Mapped[dict[str, Any] | None] = mapped_column(
        JSONBCompat, nullable=True
    )  # Geocoded coordinates

    # Timeline
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    # SLA
    sla_definition_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("sla_definitions.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False)

    # Progress tracking
    completion_percent: Mapped[int] = mapped_column(Integer, default=0)
    tasks_total: Mapped[int] = mapped_column(Integer, default=0)
    tasks_completed: Mapped[int] = mapped_column(Integer, default=0)

    # Assignment
    assigned_team_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(f"{FIELD_SERVICE_TEAM_TABLE}.id", ondelete="SET NULL"),
        nullable=True,
    )
    project_manager_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), nullable=True
    )  # User who manages project

    # Cost tracking
    estimated_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Additional metadata
    tags: Mapped[list[str] | None] = mapped_column(ArrayCompat(String(50)), nullable=True)
    custom_fields = Column(JSONBCompat, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    team_assignments = relationship(
        "ProjectTeam", back_populates="project", cascade="all, delete-orphan"
    )
    assigned_team = relationship(
        "dotmac.platform.project_management.models.Team",
        foreign_keys=[assigned_team_id],
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "project_number", name="uq_project_tenant_number"),
        Index("ix_projects_tenant_status", "tenant_id", "status"),
        Index("ix_projects_tenant_type", "tenant_id", "project_type"),
        Index("ix_projects_customer", "customer_id"),
        Index("ix_projects_due_date", "due_date"),
        Index("ix_projects_location", "location_lat", "location_lng"),
    )

    def __repr__(self) -> str:
        return f"<Project {self.project_number}: {self.name}>"


class Task(Base):
    """
    Task Model

    Individual task within a project. Can have dependencies and subtasks.
    Example: Fiber Splicing at Distribution Point DP-123
    """

    __tablename__ = "tasks"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    project_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[TaskType] = mapped_column(
        SQLEnum(TaskType),
        nullable=False,
        index=True,
    )
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus),
        nullable=False,
        default=TaskStatus.PENDING,
        index=True,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SQLEnum(TaskPriority),
        nullable=False,
        default=TaskPriority.NORMAL,
    )

    # Hierarchy and dependencies
    parent_task_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sequence_order: Mapped[int] = mapped_column(Integer, default=0)  # Order within project
    depends_on_tasks: Mapped[list[UUID] | None] = mapped_column(
        ArrayCompat(PostgresUUID(as_uuid=True)),
        nullable=True,
    )  # Task IDs that must complete first

    # Assignment
    assigned_technician_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_team_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(f"{FIELD_SERVICE_TEAM_TABLE}.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Location
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timeline
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # SLA
    sla_target_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False)
    sla_breach_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Skills and requirements
    required_skills = Column(JSONBCompat, nullable=True)  # {"fiber_splicing": true, "otdr": true}
    required_equipment: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # ["fusion_splicer", "otdr"]
    required_certifications: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # ["fiber_optic_cert"]

    # Progress
    completion_percent: Mapped[int] = mapped_column(Integer, default=0)
    blockers = Column(JSONBCompat, nullable=True)  # List of blocking issues
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Documentation
    photos = Column(JSONBCompat, nullable=True)  # Array of photo URLs
    documents = Column(JSONBCompat, nullable=True)  # Array of document URLs
    checklist = Column(JSONBCompat, nullable=True)  # [{item: "Check fiber loss", completed: true}]

    # Customer interaction
    requires_customer_presence: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_signature: Mapped[str | None] = mapped_column(Text, nullable=True)  # Base64 encoded
    customer_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    customer_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5 stars

    # Additional metadata
    tags: Mapped[list[str] | None] = mapped_column(ArrayCompat(String(50)), nullable=True)
    custom_fields = Column(JSONBCompat, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    parent_task = relationship("Task", remote_side=[id], backref="subtasks")
    assigned_technician = relationship("Technician", foreign_keys=[assigned_technician_id])
    assigned_team = relationship(
        "dotmac.platform.project_management.models.Team",
        foreign_keys=[assigned_team_id],
    )
    assignments = relationship(
        "TaskAssignment", back_populates="task", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("project_id", "task_number", name="uq_task_project_number"),
        Index("ix_tasks_tenant_status", "tenant_id", "status"),
        Index("ix_tasks_tenant_type", "tenant_id", "task_type"),
        Index("ix_tasks_assigned_tech", "assigned_technician_id"),
        Index("ix_tasks_scheduled", "scheduled_start", "scheduled_end"),
        Index("ix_tasks_location", "location_lat", "location_lng"),
    )

    def __repr__(self) -> str:
        return f"<Task {self.task_number}: {self.name}>"


class Team(Base):
    """
    Team Model

    Logical grouping of technicians for project/task assignment.
    Example: Installation Team Alpha, Emergency Response Team B
    """

    __tablename__ = FIELD_SERVICE_TEAM_TABLE

    # Primary identification
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    team_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    team_type: Mapped[TeamType] = mapped_column(SQLEnum(TeamType), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Capacity and coverage
    max_concurrent_projects: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_concurrent_tasks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    service_areas: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # Geographic areas covered
    coverage_radius_km: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # Coverage radius

    # Location (home base)
    home_base_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_base_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_base_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Schedule
    working_hours_start: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "08:00"
    working_hours_end: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "17:00"
    working_days: Mapped[list[int] | None] = mapped_column(
        ArrayCompat(Integer),
        nullable=True,
    )  # [0,1,2,3,4] = Mon-Fri (0=Monday)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Skills and capabilities
    team_skills = Column(JSONBCompat, nullable=True)  # Aggregate of member skills
    team_equipment = Column(JSONBCompat, nullable=True)  # Available equipment
    specializations: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # ["fiber", "wireless", "copper"]

    # Leadership
    lead_technician_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="SET NULL"),
        nullable=True,
    )
    supervisor_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), nullable=True
    )  # Manager/supervisor

    # Performance metrics
    projects_completed: Mapped[int] = mapped_column(Integer, default=0)
    tasks_completed: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # Success rate percentage
    average_response_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Additional metadata
    tags: Mapped[list[str] | None] = mapped_column(ArrayCompat(String(50)), nullable=True)
    custom_fields = Column(JSONBCompat, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    members = relationship(
        "TechnicianTeamMembership", back_populates="team", cascade="all, delete-orphan"
    )
    lead_technician = relationship("Technician", foreign_keys=[lead_technician_id])
    project_assignments = relationship(
        "ProjectTeam", back_populates="team", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "team_code", name="uq_team_tenant_code"),
        Index("ix_field_service_teams_tenant_active", "tenant_id", "is_active"),
        Index("ix_field_service_teams_tenant_type", "tenant_id", "team_type"),
        Index("ix_field_service_teams_location", "home_base_lat", "home_base_lng"),
    )

    def __repr__(self) -> str:
        return f"<Team {self.team_code}: {self.name}>"


class TechnicianTeamMembership(Base):
    """
    Technician-Team Membership Model

    Many-to-many relationship between technicians and teams.
    Technicians can belong to multiple teams.
    """

    __tablename__ = "technician_team_memberships"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Relationship
    technician_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(f"{FIELD_SERVICE_TEAM_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role in team
    role: Mapped[TeamRole] = mapped_column(
        SQLEnum(TeamRole),
        nullable=False,
        default=TeamRole.MEMBER,
    )
    is_primary_team: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # Is this their main team?

    # Membership period
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # NULL if still active
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Additional metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    technician = relationship("Technician")
    team = relationship(
        "dotmac.platform.project_management.models.Team",
        back_populates="members",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "technician_id",
            "team_id",
            name="uq_tech_team_membership",
        ),
        Index("ix_membership_tenant_tech", "tenant_id", "technician_id"),
        Index("ix_membership_tenant_team", "tenant_id", "team_id"),
        Index("ix_membership_active", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<TechnicianTeamMembership tech={self.technician_id} team={self.team_id}>"


class ProjectTeam(Base):
    """
    Project-Team Assignment Model

    Tracks which teams are assigned to which projects.
    Allows multiple teams to work on the same project.
    """

    __tablename__ = "project_teams"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Relationship
    project_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(f"{FIELD_SERVICE_TEAM_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Assignment details
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    is_primary_team: Mapped[bool] = mapped_column(Boolean, default=True)  # Primary vs support team
    role_description: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # What this team does

    # Additional metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="team_assignments")
    team = relationship(
        "dotmac.platform.project_management.models.Team",
        back_populates="project_assignments",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("project_id", "team_id", name="uq_project_team"),
        Index("ix_project_teams_tenant", "tenant_id"),
    )

    def __repr__(self) -> str:
        return f"<ProjectTeam project={self.project_id} team={self.team_id}>"
