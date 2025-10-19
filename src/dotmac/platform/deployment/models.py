"""
Deployment Orchestration Models

Data models for multi-tenant deployment management.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from ..db import Base, TenantMixin, TimestampMixin


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

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    description = Column(Text)

    # Template configuration
    backend = Column(Enum(DeploymentBackend), nullable=False)
    deployment_type = Column(Enum(DeploymentType), nullable=False)
    version = Column(String(50), nullable=False)

    # Resource specifications
    cpu_cores = Column(Integer)  # Min CPU cores
    memory_gb = Column(Integer)  # Min memory in GB
    storage_gb = Column(Integer)  # Min storage in GB
    max_users = Column(Integer)  # Max concurrent users

    # Configuration
    config_schema = Column(JSON)  # JSON schema for template variables
    default_config = Column(JSON)  # Default configuration values
    required_secrets = Column(JSON)  # List of required secrets
    feature_flags = Column(JSON)  # Default feature flags

    # Execution artifacts
    helm_chart_url = Column(String(500))  # Helm chart repository
    helm_chart_version = Column(String(50))  # Helm chart version
    ansible_playbook_path = Column(String(500))  # Ansible playbook path
    terraform_module_path = Column(String(500))  # Terraform module path
    docker_compose_path = Column(String(500))  # Docker compose file path

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    requires_approval = Column(Boolean, default=False)  # Manual approval needed
    estimated_provision_time_minutes = Column(Integer)  # Expected provision time
    tags = Column(JSON)  # Tags for categorization

    # Relationships
    instances = relationship("DeploymentInstance", back_populates="template")

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

    id = Column(Integer, primary_key=True)

    # Template reference
    template_id = Column(Integer, ForeignKey("deployment_templates.id"), nullable=False)
    template = relationship("DeploymentTemplate", back_populates="instances")

    # Environment identification
    environment = Column(String(50), nullable=False, index=True)  # prod, staging, dev
    region = Column(String(50))  # Geographic region (us-east-1, eu-west-1)
    availability_zone = Column(String(50))  # Availability zone

    # Deployment state
    state = Column(Enum(DeploymentState), default=DeploymentState.PENDING, nullable=False, index=True)
    state_reason = Column(Text)  # Reason for current state
    last_state_change = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Configuration
    config = Column(JSON, nullable=False)  # Instance-specific configuration
    secrets_path = Column(String(500))  # Vault/SOPS secrets path
    version = Column(String(50), nullable=False)  # Deployed version

    # Topology metadata
    endpoints = Column(JSON)  # Service endpoints (API, UI, DB, etc.)
    namespace = Column(String(255))  # K8s namespace or resource group
    cluster_name = Column(String(255))  # K8s cluster or datacenter name
    backend_job_id = Column(String(255))  # AWX job ID, Helm release name, etc.

    # Resource allocation
    allocated_cpu = Column(Integer)  # Allocated CPU cores
    allocated_memory_gb = Column(Integer)  # Allocated memory
    allocated_storage_gb = Column(Integer)  # Allocated storage

    # Health and monitoring
    health_check_url = Column(String(500))  # Health check endpoint
    last_health_check = Column(DateTime)  # Last health check time
    health_status = Column(String(50))  # healthy, degraded, unhealthy
    health_details = Column(JSON)  # Detailed health information

    # Metadata
    tags = Column(JSON)  # Instance tags
    notes = Column(Text)  # Operator notes
    deployed_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))  # User who deployed
    approved_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))  # User who approved

    # Relationships
    executions = relationship("DeploymentExecution", back_populates="instance", cascade="all, delete-orphan")
    health_records = relationship("DeploymentHealth", back_populates="instance", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DeploymentInstance tenant={self.tenant_id} env={self.environment} state={self.state.value}>"


class DeploymentExecution(Base, TimestampMixin):
    """
    Deployment Execution

    Tracks individual deployment operations (provision, upgrade, suspend, etc.)
    with logs and execution metadata.
    """

    __tablename__ = "deployment_executions"

    id = Column(Integer, primary_key=True)

    # Instance reference
    instance_id = Column(Integer, ForeignKey("deployment_instances.id"), nullable=False)
    instance = relationship("DeploymentInstance", back_populates="executions")

    # Execution details
    operation = Column(String(50), nullable=False, index=True)  # provision, upgrade, suspend, destroy
    state = Column(String(50), default="running", nullable=False, index=True)  # running, succeeded, failed
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Backend execution
    backend_job_id = Column(String(255), index=True)  # AWX job ID, Helm release, etc.
    backend_job_url = Column(String(500))  # Link to backend job
    backend_logs = Column(Text)  # Execution logs

    # Configuration
    operation_config = Column(JSON)  # Operation-specific config
    from_version = Column(String(50))  # Source version (for upgrades)
    to_version = Column(String(50))  # Target version (for upgrades)

    # Results
    result = Column(String(50))  # success, failure, timeout
    error_message = Column(Text)  # Error details if failed
    rollback_execution_id = Column(Integer, ForeignKey("deployment_executions.id"))  # Rollback reference

    # Audit
    triggered_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))  # User or system
    trigger_type = Column(String(50))  # manual, automated, scheduled

    def __repr__(self) -> str:
        return f"<DeploymentExecution {self.operation} instance={self.instance_id} state={self.state}>"


class DeploymentHealth(Base, TimestampMixin):
    """
    Deployment Health Record

    Stores health check results and metrics for deployment monitoring.
    """

    __tablename__ = "deployment_health"

    id = Column(Integer, primary_key=True)

    # Instance reference
    instance_id = Column(Integer, ForeignKey("deployment_instances.id"), nullable=False, index=True)
    instance = relationship("DeploymentInstance", back_populates="health_records")

    # Health check details
    check_type = Column(String(50), nullable=False)  # http, tcp, grpc, custom
    endpoint = Column(String(500))  # Checked endpoint
    status = Column(String(50), nullable=False, index=True)  # healthy, degraded, unhealthy
    response_time_ms = Column(Integer)  # Response time in milliseconds

    # Metrics
    cpu_usage_percent = Column(Integer)  # CPU utilization
    memory_usage_percent = Column(Integer)  # Memory utilization
    disk_usage_percent = Column(Integer)  # Disk utilization
    active_connections = Column(Integer)  # Active connections/sessions
    request_rate = Column(Integer)  # Requests per second
    error_rate = Column(Integer)  # Errors per second

    # Details
    details = Column(JSON)  # Additional health information
    error_message = Column(Text)  # Error if unhealthy
    alerts_triggered = Column(JSON)  # List of triggered alerts

    # Timestamp
    checked_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<DeploymentHealth instance={self.instance_id} status={self.status}>"
