"""
Deployment Orchestration Models

Data models for multi-tenant deployment management.
"""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base as BaseRuntime
from ..db import TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class DeploymentBackend(str, enum.Enum):
    """Deployment execution backend types"""

    KUBERNETES = "kubernetes"  # K8s namespace + Helm
    AWX_ANSIBLE = "awx_ansible"  # AWX Tower + Ansible
    DOCKER_COMPOSE = "docker_compose"  # Standalone docker-compose
    TERRAFORM = "terraform"  # Terraform for IaC
    MANUAL = "manual"  # Manual deployment tracking


class DeploymentType(str, enum.Enum):
    """Deployment environment types"""

    CLOUD_SHARED = "cloud_shared"  # Shared cloud multi-tenant
    CLOUD_DEDICATED = "cloud_dedicated"  # Dedicated cloud single-tenant
    ON_PREM = "on_prem"  # Customer-hosted on-premises
    HYBRID = "hybrid"  # Mix of cloud and on-prem
    EDGE = "edge"  # Edge deployment for low-latency


class DeploymentState(str, enum.Enum):
    """Deployment lifecycle states"""

    PENDING = "pending"  # Awaiting provisioning
    PROVISIONING = "provisioning"  # In progress
    ACTIVE = "active"  # Running and healthy
    DEGRADED = "degraded"  # Running with issues
    SUSPENDED = "suspended"  # Temporarily suspended
    FAILED = "failed"  # Provisioning/operation failed
    DESTROYING = "destroying"  # Being torn down
    DESTROYED = "destroyed"  # Fully removed
    UPGRADING = "upgrading"  # Upgrade in progress
    ROLLING_BACK = "rolling_back"  # Rollback in progress


class DeploymentTemplate(Base, TimestampMixin):
    """
    Deployment Template

    Defines reusable deployment configurations for different scenarios.
    Templates specify the infrastructure, services, and configuration
    needed for a deployment type.
    """

    __tablename__ = "deployment_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)

    # Template configuration
    backend: Mapped[DeploymentBackend] = mapped_column(Enum(DeploymentBackend))
    deployment_type: Mapped[DeploymentType] = mapped_column(Enum(DeploymentType))
    version: Mapped[str] = mapped_column(String(50))

    # Resource specifications
    cpu_cores: Mapped[int | None] = mapped_column(Integer)  # Min CPU cores
    memory_gb: Mapped[int | None] = mapped_column(Integer)  # Min memory in GB
    storage_gb: Mapped[int | None] = mapped_column(Integer)  # Min storage in GB
    max_users: Mapped[int | None] = mapped_column(Integer)  # Max concurrent users

    # Configuration
    config_schema: Mapped[dict[str, Any] | None] = mapped_column(
        JSON
    )  # JSON schema for template variables
    default_config: Mapped[dict[str, Any] | None] = mapped_column(
        JSON
    )  # Default configuration values
    required_secrets: Mapped[list[str] | None] = mapped_column(JSON)  # List of required secrets
    feature_flags: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # Default feature flags

    # Execution artifacts
    helm_chart_url: Mapped[str | None] = mapped_column(String(500))  # Helm chart repository
    helm_chart_version: Mapped[str | None] = mapped_column(String(50))  # Helm chart version
    ansible_playbook_path: Mapped[str | None] = mapped_column(String(500))  # Ansible playbook path
    terraform_module_path: Mapped[str | None] = mapped_column(String(500))  # Terraform module path
    docker_compose_path: Mapped[str | None] = mapped_column(String(500))  # Docker compose file path

    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # Manual approval needed
    estimated_provision_time_minutes: Mapped[int | None] = mapped_column(
        Integer
    )  # Expected provision time
    tags: Mapped[dict[str, str] | None] = mapped_column(JSON)  # Tags for categorization

    # Relationships
    instances: Mapped[list["DeploymentInstance"]] = relationship(
        "DeploymentInstance",
        back_populates="template",
    )

    def __repr__(self) -> str:
        return f"<DeploymentTemplate {self.name} ({self.deployment_type.value})>"


class DeploymentInstance(Base, TenantMixin, TimestampMixin):
    """
    Deployment Instance

    Represents a deployed tenant environment. Tracks the current state,
    configuration, and metadata for a specific tenant deployment.
    """

    __tablename__ = "deployment_instances"
    __table_args__ = (UniqueConstraint("tenant_id", "environment", name="uq_tenant_environment"),)

    id: Mapped[int] = mapped_column(primary_key=True)

    # Template reference
    template_id: Mapped[int] = mapped_column(ForeignKey("deployment_templates.id"))
    template: Mapped["DeploymentTemplate"] = relationship(
        "DeploymentTemplate",
        back_populates="instances",
    )

    # Environment identification
    environment: Mapped[str] = mapped_column(String(50), index=True)  # prod, staging, dev
    region: Mapped[str | None] = mapped_column(
        String(50)
    )  # Geographic region (us-east-1, eu-west-1)
    availability_zone: Mapped[str | None] = mapped_column(String(50))  # Availability zone

    # Deployment state
    state: Mapped[DeploymentState] = mapped_column(
        Enum(DeploymentState), default=DeploymentState.PENDING, index=True
    )
    state_reason: Mapped[str | None] = mapped_column(Text)  # Reason for current state
    last_state_change: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON)  # Instance-specific configuration
    secrets_path: Mapped[str | None] = mapped_column(String(500))  # Vault/SOPS secrets path
    version: Mapped[str] = mapped_column(String(50))  # Deployed version

    # Topology metadata
    endpoints: Mapped[dict[str, str] | None] = mapped_column(
        JSON
    )  # Service endpoints (API, UI, DB, etc.)
    namespace: Mapped[str | None] = mapped_column(String(255))  # K8s namespace or resource group
    cluster_name: Mapped[str | None] = mapped_column(String(255))  # K8s cluster or datacenter name
    backend_job_id: Mapped[str | None] = mapped_column(
        String(255)
    )  # AWX job ID, Helm release name, etc.

    # Resource allocation
    allocated_cpu: Mapped[int | None] = mapped_column(Integer)  # Allocated CPU cores
    allocated_memory_gb: Mapped[int | None] = mapped_column(Integer)  # Allocated memory
    allocated_storage_gb: Mapped[int | None] = mapped_column(Integer)  # Allocated storage

    # Health and monitoring
    health_check_url: Mapped[str | None] = mapped_column(String(500))  # Health check endpoint
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime)  # Last health check time
    health_status: Mapped[str | None] = mapped_column(String(50))  # healthy, degraded, unhealthy
    health_details: Mapped[dict[str, Any] | None] = mapped_column(
        JSON
    )  # Detailed health information

    # Metadata
    tags: Mapped[dict[str, str] | None] = mapped_column(JSON)  # Instance tags
    notes: Mapped[str | None] = mapped_column(Text)  # Operator notes
    deployed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )  # User who deployed
    approved_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )  # User who approved

    # Relationships
    executions: Mapped[list["DeploymentExecution"]] = relationship(
        "DeploymentExecution",
        back_populates="instance",
        cascade="all, delete-orphan",
    )
    health_records: Mapped[list["DeploymentHealth"]] = relationship(
        "DeploymentHealth",
        back_populates="instance",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<DeploymentInstance tenant={self.tenant_id} env={self.environment} state={self.state.value}>"


class DeploymentExecution(Base, TimestampMixin):
    """
    Deployment Execution

    Tracks individual deployment operations (provision, upgrade, suspend, etc.)
    with logs and execution metadata.
    """

    __tablename__ = "deployment_executions"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Instance reference
    instance_id: Mapped[int] = mapped_column(ForeignKey("deployment_instances.id"))
    instance: Mapped["DeploymentInstance"] = relationship(
        "DeploymentInstance",
        back_populates="executions",
    )

    # Execution details
    operation: Mapped[str] = mapped_column(
        String(50), index=True
    )  # provision, upgrade, suspend, destroy
    state: Mapped[str] = mapped_column(
        String(50), default="running", index=True
    )  # running, succeeded, failed
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)

    # Backend execution
    backend_job_id: Mapped[str | None] = mapped_column(
        String(255), index=True
    )  # AWX job ID, Helm release, etc.
    backend_job_url: Mapped[str | None] = mapped_column(String(500))  # Link to backend job
    backend_logs: Mapped[str | None] = mapped_column(Text)  # Execution logs

    # Configuration
    operation_config: Mapped[dict[str, Any] | None] = mapped_column(
        JSON
    )  # Operation-specific config
    from_version: Mapped[str | None] = mapped_column(String(50))  # Source version (for upgrades)
    to_version: Mapped[str | None] = mapped_column(String(50))  # Target version (for upgrades)

    # Results
    result: Mapped[str | None] = mapped_column(String(50))  # success, failure, timeout
    error_message: Mapped[str | None] = mapped_column(Text)  # Error details if failed
    rollback_execution_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("deployment_executions.id")
    )  # Rollback reference

    # Audit
    triggered_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )  # User or system
    trigger_type: Mapped[str | None] = mapped_column(String(50))  # manual, automated, scheduled

    def __repr__(self) -> str:
        return (
            f"<DeploymentExecution {self.operation} instance={self.instance_id} state={self.state}>"
        )


class DeploymentHealth(Base, TimestampMixin):
    """
    Deployment Health Record

    Stores health check results and metrics for deployment monitoring.
    """

    __tablename__ = "deployment_health"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Instance reference
    instance_id: Mapped[int] = mapped_column(ForeignKey("deployment_instances.id"), index=True)
    instance: Mapped["DeploymentInstance"] = relationship(
        "DeploymentInstance",
        back_populates="health_records",
    )

    # Health check details
    check_type: Mapped[str] = mapped_column(String(50))  # http, tcp, grpc, custom
    endpoint: Mapped[str | None] = mapped_column(String(500))  # Checked endpoint
    status: Mapped[str] = mapped_column(String(50), index=True)  # healthy, degraded, unhealthy
    response_time_ms: Mapped[int | None] = mapped_column(Integer)  # Response time in milliseconds

    # Metrics
    cpu_usage_percent: Mapped[int | None] = mapped_column(Integer)  # CPU utilization
    memory_usage_percent: Mapped[int | None] = mapped_column(Integer)  # Memory utilization
    disk_usage_percent: Mapped[int | None] = mapped_column(Integer)  # Disk utilization
    active_connections: Mapped[int | None] = mapped_column(Integer)  # Active connections/sessions
    request_rate: Mapped[int | None] = mapped_column(Integer)  # Requests per second
    error_rate: Mapped[int | None] = mapped_column(Integer)  # Errors per second

    # Details
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # Additional health information
    error_message: Mapped[str | None] = mapped_column(Text)  # Error if unhealthy
    alerts_triggered: Mapped[list[str] | None] = mapped_column(JSON)  # List of triggered alerts

    # Timestamp
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return f"<DeploymentHealth instance={self.instance_id} status={self.status}>"
