"""
Deployment Orchestration Schemas

Pydantic schemas for deployment API requests and responses.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from .models import DeploymentBackend, DeploymentState, DeploymentType

# ============================================================================
# Template Schemas
# ============================================================================


class DeploymentTemplateBase(BaseModel):
    """Base deployment template schema"""

    name: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    backend: DeploymentBackend
    deployment_type: DeploymentType
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$")


class DeploymentTemplateCreate(DeploymentTemplateBase):
    """Schema for creating deployment template"""

    cpu_cores: int | None = Field(None, ge=1, le=128)
    memory_gb: int | None = Field(None, ge=1, le=512)
    storage_gb: int | None = Field(None, ge=10, le=10000)
    max_users: int | None = Field(None, ge=1)

    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    required_secrets: list[str] | None = None
    feature_flags: dict[str, bool] | None = None

    helm_chart_url: str | None = None
    helm_chart_version: str | None = None
    ansible_playbook_path: str | None = None
    terraform_module_path: str | None = None
    docker_compose_path: str | None = None

    requires_approval: bool = False
    estimated_provision_time_minutes: int | None = Field(None, ge=1, le=1440)
    tags: dict[str, str] | None = None


class DeploymentTemplateUpdate(BaseModel):
    """Schema for updating deployment template"""

    display_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    version: str | None = Field(None, pattern=r"^\d+\.\d+\.\d+$")
    is_active: bool | None = None

    cpu_cores: int | None = Field(None, ge=1, le=128)
    memory_gb: int | None = Field(None, ge=1, le=512)
    storage_gb: int | None = Field(None, ge=10, le=10000)
    max_users: int | None = Field(None, ge=1)

    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    required_secrets: list[str] | None = None
    feature_flags: dict[str, bool] | None = None

    helm_chart_url: str | None = None
    helm_chart_version: str | None = None
    ansible_playbook_path: str | None = None
    terraform_module_path: str | None = None
    docker_compose_path: str | None = None

    requires_approval: bool | None = None
    estimated_provision_time_minutes: int | None = Field(None, ge=1, le=1440)
    tags: dict[str, str] | None = None


class DeploymentTemplateResponse(DeploymentTemplateBase):
    """Schema for deployment template response"""

    id: int
    cpu_cores: int | None = None
    memory_gb: int | None = None
    storage_gb: int | None = None
    max_users: int | None = None

    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    required_secrets: list[str] | None = None
    feature_flags: dict[str, bool] | None = None

    helm_chart_url: str | None = None
    helm_chart_version: str | None = None
    ansible_playbook_path: str | None = None
    terraform_module_path: str | None = None
    docker_compose_path: str | None = None

    is_active: bool
    requires_approval: bool
    estimated_provision_time_minutes: int | None = None
    tags: dict[str, str] | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Instance Schemas
# ============================================================================


class DeploymentInstanceBase(BaseModel):
    """Base deployment instance schema"""

    template_id: int = Field(..., gt=0)
    environment: str = Field(..., pattern=r"^(prod|production|staging|stage|dev|development|test)$")
    region: str | None = None
    availability_zone: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class DeploymentInstanceCreate(DeploymentInstanceBase):
    """Schema for creating deployment instance"""

    secrets_path: str | None = None
    allocated_cpu: int | None = Field(None, ge=1, le=128)
    allocated_memory_gb: int | None = Field(None, ge=1, le=512)
    allocated_storage_gb: int | None = Field(None, ge=10, le=10000)
    tags: dict[str, str] | None = None
    notes: str | None = None


class DeploymentInstanceUpdate(BaseModel):
    """Schema for updating deployment instance"""

    config: dict[str, Any] | None = None
    secrets_path: str | None = None
    allocated_cpu: int | None = Field(None, ge=1, le=128)
    allocated_memory_gb: int | None = Field(None, ge=1, le=512)
    allocated_storage_gb: int | None = Field(None, ge=10, le=10000)
    tags: dict[str, str] | None = None
    notes: str | None = None


class DeploymentInstanceResponse(DeploymentInstanceBase):
    """Schema for deployment instance response"""

    id: int
    tenant_id: int
    state: DeploymentState
    state_reason: str | None = None
    last_state_change: datetime
    secrets_path: str | None = None
    version: str

    endpoints: dict[str, str] | None = None
    namespace: str | None = None
    cluster_name: str | None = None
    backend_job_id: str | None = None

    allocated_cpu: int | None = None
    allocated_memory_gb: int | None = None
    allocated_storage_gb: int | None = None

    health_check_url: str | None = None
    last_health_check: datetime | None = None
    health_status: str | None = None
    health_details: dict[str, Any] | None = None

    tags: dict[str, str] | None = None
    notes: str | None = None
    deployed_by: int | None = None
    approved_by: int | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Execution Schemas
# ============================================================================


class DeploymentExecutionCreate(BaseModel):
    """Schema for creating deployment execution"""

    operation: str = Field(
        ..., pattern=r"^(provision|upgrade|suspend|resume|destroy|rollback|scale)$"
    )
    operation_config: dict[str, Any] | None = None
    to_version: str | None = Field(None, pattern=r"^\d+\.\d+\.\d+$")


class DeploymentExecutionResponse(BaseModel):
    """Schema for deployment execution response"""

    id: int
    instance_id: int
    operation: str
    state: str
    started_at: datetime
    completed_at: datetime | None = None
    duration_seconds: int | None = None

    backend_job_id: str | None = None
    backend_job_url: str | None = None
    backend_logs: str | None = None

    operation_config: dict[str, Any] | None = None
    from_version: str | None = None
    to_version: str | None = None

    result: str | None = None
    error_message: str | None = None
    rollback_execution_id: int | None = None

    triggered_by: int | None = None
    trigger_type: str | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Health Schemas
# ============================================================================


class DeploymentHealthCreate(BaseModel):
    """Schema for creating health record"""

    check_type: str = Field(..., pattern=r"^(http|tcp|grpc|icmp|custom)$")
    endpoint: str
    status: str = Field(..., pattern=r"^(healthy|degraded|unhealthy)$")
    response_time_ms: int | None = Field(None, ge=0)

    cpu_usage_percent: int | None = Field(None, ge=0, le=100)
    memory_usage_percent: int | None = Field(None, ge=0, le=100)
    disk_usage_percent: int | None = Field(None, ge=0, le=100)
    active_connections: int | None = Field(None, ge=0)
    request_rate: int | None = Field(None, ge=0)
    error_rate: int | None = Field(None, ge=0)

    details: dict[str, Any] | None = None
    error_message: str | None = None
    alerts_triggered: list[str] | None = None


class DeploymentHealthResponse(DeploymentHealthCreate):
    """Schema for health record response"""

    id: int
    instance_id: int
    checked_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Operation Schemas
# ============================================================================


class ProvisionRequest(BaseModel):
    """Request to provision new deployment"""

    template_id: int = Field(..., gt=0)
    environment: str = Field(..., pattern=r"^(prod|production|staging|stage|dev|development|test)$")
    region: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    allocated_cpu: int | None = Field(None, ge=1, le=128)
    allocated_memory_gb: int | None = Field(None, ge=1, le=512)
    allocated_storage_gb: int | None = Field(None, ge=10, le=10000)
    tags: dict[str, str] | None = None
    notes: str | None = None
    auto_approve: bool = False


class UpgradeRequest(BaseModel):
    """Request to upgrade deployment"""

    to_version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$")
    config_updates: dict[str, Any] | None = None
    rollback_on_failure: bool = True
    maintenance_window_start: datetime | None = None
    maintenance_window_end: datetime | None = None


class ScaleRequest(BaseModel):
    """Request to scale deployment resources"""

    cpu_cores: int | None = Field(None, ge=1, le=128)
    memory_gb: int | None = Field(None, ge=1, le=512)
    storage_gb: int | None = Field(None, ge=10, le=10000)


class SuspendRequest(BaseModel):
    """Request to suspend deployment"""

    reason: str = Field(..., min_length=1, max_length=500)
    preserve_data: bool = True


class ResumeRequest(BaseModel):
    """Request to resume deployment"""

    reason: str = Field(..., min_length=1, max_length=500)


class DestroyRequest(BaseModel):
    """Request to destroy deployment"""

    reason: str = Field(..., min_length=1, max_length=500)
    backup_data: bool = True
    force: bool = False

    @field_validator("force")
    @classmethod
    def validate_force(cls, v: bool, info: Any) -> bool:
        """Validate force flag"""
        if v:
            # Force destroy requires explicit confirmation
            pass
        return v


# ============================================================================
# Response Schemas
# ============================================================================


class OperationResponse(BaseModel):
    """Response for deployment operations"""

    success: bool
    message: str
    instance_id: int
    execution_id: int
    state: DeploymentState
    estimated_completion_time: datetime | None = None


class DeploymentStatusResponse(BaseModel):
    """Deployment status summary"""

    instance_id: int
    tenant_id: int
    environment: str
    state: DeploymentState
    health_status: str | None = None
    version: str
    endpoints: dict[str, str] | None = None
    last_health_check: datetime | None = None
    uptime_seconds: int | None = None


class DeploymentListResponse(BaseModel):
    """Paginated deployment list"""

    instances: list[DeploymentInstanceResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============================================================================
# Scheduled Deployment Schemas
# ============================================================================


class ScheduledDeploymentRequest(BaseModel):
    """Request to schedule a deployment operation"""

    operation: str = Field(..., pattern=r"^(provision|upgrade|scale|suspend|resume|destroy)$")
    scheduled_at: datetime = Field(..., description="When to execute (for one-time schedules)")

    # Operation-specific requests (only one should be provided based on operation)
    provision_request: ProvisionRequest | None = None
    upgrade_request: UpgradeRequest | None = None
    scale_request: ScaleRequest | None = None

    instance_id: int | None = Field(
        None, description="Instance ID (required for upgrade/scale/suspend/resume/destroy)"
    )

    # Recurring schedule options (optional)
    cron_expression: str | None = Field(None, description="Cron schedule for recurring operations")
    interval_seconds: int | None = Field(
        None,
        description="Interval for recurring operations",
        ge=60,
        le=2592000,  # 1 min to 30 days
    )

    metadata: dict[str, Any] | None = Field(default_factory=dict)

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at(cls, v: datetime) -> datetime:
        """Ensure scheduled_at is in the future"""
        if v <= datetime.utcnow():
            raise ValueError("scheduled_at must be in the future")
        return v


class ScheduledDeploymentResponse(BaseModel):
    """Response for scheduled deployment"""

    schedule_id: str
    schedule_type: str  # "one_time" or "recurring"
    operation: str
    scheduled_at: datetime | None = None
    cron_expression: str | None = None
    interval_seconds: int | None = None
    next_run_at: datetime | None = None
    parameters: dict[str, Any]
