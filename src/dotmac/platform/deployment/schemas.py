"""
Deployment Orchestration Schemas

Pydantic schemas for deployment API requests and responses.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from .models import DeploymentBackend, DeploymentState, DeploymentType


# ============================================================================
# Template Schemas
# ============================================================================


class DeploymentTemplateBase(BaseModel):
    """Base deployment template schema"""

    name: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    backend: DeploymentBackend
    deployment_type: DeploymentType
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$")


class DeploymentTemplateCreate(DeploymentTemplateBase):
    """Schema for creating deployment template"""

    cpu_cores: Optional[int] = Field(None, ge=1, le=128)
    memory_gb: Optional[int] = Field(None, ge=1, le=512)
    storage_gb: Optional[int] = Field(None, ge=10, le=10000)
    max_users: Optional[int] = Field(None, ge=1)

    config_schema: Optional[dict[str, Any]] = None
    default_config: Optional[dict[str, Any]] = None
    required_secrets: Optional[list[str]] = None
    feature_flags: Optional[dict[str, bool]] = None

    helm_chart_url: Optional[str] = None
    helm_chart_version: Optional[str] = None
    ansible_playbook_path: Optional[str] = None
    terraform_module_path: Optional[str] = None
    docker_compose_path: Optional[str] = None

    requires_approval: bool = False
    estimated_provision_time_minutes: Optional[int] = Field(None, ge=1, le=1440)
    tags: Optional[dict[str, str]] = None


class DeploymentTemplateUpdate(BaseModel):
    """Schema for updating deployment template"""

    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = Field(None, pattern=r"^\d+\.\d+\.\d+$")
    is_active: Optional[bool] = None

    cpu_cores: Optional[int] = Field(None, ge=1, le=128)
    memory_gb: Optional[int] = Field(None, ge=1, le=512)
    storage_gb: Optional[int] = Field(None, ge=10, le=10000)
    max_users: Optional[int] = Field(None, ge=1)

    config_schema: Optional[dict[str, Any]] = None
    default_config: Optional[dict[str, Any]] = None
    required_secrets: Optional[list[str]] = None
    feature_flags: Optional[dict[str, bool]] = None

    helm_chart_url: Optional[str] = None
    helm_chart_version: Optional[str] = None
    ansible_playbook_path: Optional[str] = None
    terraform_module_path: Optional[str] = None
    docker_compose_path: Optional[str] = None

    requires_approval: Optional[bool] = None
    estimated_provision_time_minutes: Optional[int] = Field(None, ge=1, le=1440)
    tags: Optional[dict[str, str]] = None


class DeploymentTemplateResponse(DeploymentTemplateBase):
    """Schema for deployment template response"""

    id: int
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    storage_gb: Optional[int] = None
    max_users: Optional[int] = None

    config_schema: Optional[dict[str, Any]] = None
    default_config: Optional[dict[str, Any]] = None
    required_secrets: Optional[list[str]] = None
    feature_flags: Optional[dict[str, bool]] = None

    helm_chart_url: Optional[str] = None
    helm_chart_version: Optional[str] = None
    ansible_playbook_path: Optional[str] = None
    terraform_module_path: Optional[str] = None
    docker_compose_path: Optional[str] = None

    is_active: bool
    requires_approval: bool
    estimated_provision_time_minutes: Optional[int] = None
    tags: Optional[dict[str, str]] = None

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
    region: Optional[str] = None
    availability_zone: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)


class DeploymentInstanceCreate(DeploymentInstanceBase):
    """Schema for creating deployment instance"""

    secrets_path: Optional[str] = None
    allocated_cpu: Optional[int] = Field(None, ge=1, le=128)
    allocated_memory_gb: Optional[int] = Field(None, ge=1, le=512)
    allocated_storage_gb: Optional[int] = Field(None, ge=10, le=10000)
    tags: Optional[dict[str, str]] = None
    notes: Optional[str] = None


class DeploymentInstanceUpdate(BaseModel):
    """Schema for updating deployment instance"""

    config: Optional[dict[str, Any]] = None
    secrets_path: Optional[str] = None
    allocated_cpu: Optional[int] = Field(None, ge=1, le=128)
    allocated_memory_gb: Optional[int] = Field(None, ge=1, le=512)
    allocated_storage_gb: Optional[int] = Field(None, ge=10, le=10000)
    tags: Optional[dict[str, str]] = None
    notes: Optional[str] = None


class DeploymentInstanceResponse(DeploymentInstanceBase):
    """Schema for deployment instance response"""

    id: int
    tenant_id: int
    state: DeploymentState
    state_reason: Optional[str] = None
    last_state_change: datetime
    secrets_path: Optional[str] = None
    version: str

    endpoints: Optional[dict[str, str]] = None
    namespace: Optional[str] = None
    cluster_name: Optional[str] = None
    backend_job_id: Optional[str] = None

    allocated_cpu: Optional[int] = None
    allocated_memory_gb: Optional[int] = None
    allocated_storage_gb: Optional[int] = None

    health_check_url: Optional[str] = None
    last_health_check: Optional[datetime] = None
    health_status: Optional[str] = None
    health_details: Optional[dict[str, Any]] = None

    tags: Optional[dict[str, str]] = None
    notes: Optional[str] = None
    deployed_by: Optional[int] = None
    approved_by: Optional[int] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Execution Schemas
# ============================================================================


class DeploymentExecutionCreate(BaseModel):
    """Schema for creating deployment execution"""

    operation: str = Field(..., pattern=r"^(provision|upgrade|suspend|resume|destroy|rollback|scale)$")
    operation_config: Optional[dict[str, Any]] = None
    to_version: Optional[str] = Field(None, pattern=r"^\d+\.\d+\.\d+$")


class DeploymentExecutionResponse(BaseModel):
    """Schema for deployment execution response"""

    id: int
    instance_id: int
    operation: str
    state: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None

    backend_job_id: Optional[str] = None
    backend_job_url: Optional[str] = None
    backend_logs: Optional[str] = None

    operation_config: Optional[dict[str, Any]] = None
    from_version: Optional[str] = None
    to_version: Optional[str] = None

    result: Optional[str] = None
    error_message: Optional[str] = None
    rollback_execution_id: Optional[int] = None

    triggered_by: Optional[int] = None
    trigger_type: Optional[str] = None

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
    response_time_ms: Optional[int] = Field(None, ge=0)

    cpu_usage_percent: Optional[int] = Field(None, ge=0, le=100)
    memory_usage_percent: Optional[int] = Field(None, ge=0, le=100)
    disk_usage_percent: Optional[int] = Field(None, ge=0, le=100)
    active_connections: Optional[int] = Field(None, ge=0)
    request_rate: Optional[int] = Field(None, ge=0)
    error_rate: Optional[int] = Field(None, ge=0)

    details: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    alerts_triggered: Optional[list[str]] = None


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
    region: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    allocated_cpu: Optional[int] = Field(None, ge=1, le=128)
    allocated_memory_gb: Optional[int] = Field(None, ge=1, le=512)
    allocated_storage_gb: Optional[int] = Field(None, ge=10, le=10000)
    tags: Optional[dict[str, str]] = None
    notes: Optional[str] = None
    auto_approve: bool = False


class UpgradeRequest(BaseModel):
    """Request to upgrade deployment"""

    to_version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$")
    config_updates: Optional[dict[str, Any]] = None
    rollback_on_failure: bool = True
    maintenance_window_start: Optional[datetime] = None
    maintenance_window_end: Optional[datetime] = None


class ScaleRequest(BaseModel):
    """Request to scale deployment resources"""

    cpu_cores: Optional[int] = Field(None, ge=1, le=128)
    memory_gb: Optional[int] = Field(None, ge=1, le=512)
    storage_gb: Optional[int] = Field(None, ge=10, le=10000)


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
    estimated_completion_time: Optional[datetime] = None


class DeploymentStatusResponse(BaseModel):
    """Deployment status summary"""

    instance_id: int
    tenant_id: int
    environment: str
    state: DeploymentState
    health_status: Optional[str] = None
    version: str
    endpoints: Optional[dict[str, str]] = None
    last_health_check: Optional[datetime] = None
    uptime_seconds: Optional[int] = None


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

    operation: str = Field(
        ..., pattern=r"^(provision|upgrade|scale|suspend|resume|destroy)$"
    )
    scheduled_at: datetime = Field(..., description="When to execute (for one-time schedules)")

    # Operation-specific requests (only one should be provided based on operation)
    provision_request: Optional[ProvisionRequest] = None
    upgrade_request: Optional[UpgradeRequest] = None
    scale_request: Optional[ScaleRequest] = None

    instance_id: Optional[int] = Field(
        None, description="Instance ID (required for upgrade/scale/suspend/resume/destroy)"
    )

    # Recurring schedule options (optional)
    cron_expression: Optional[str] = Field(
        None, description="Cron schedule for recurring operations"
    )
    interval_seconds: Optional[int] = Field(
        None, description="Interval for recurring operations", ge=60, le=2592000  # 1 min to 30 days
    )

    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)

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
    scheduled_at: Optional[datetime] = None
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = None
    next_run_at: Optional[datetime] = None
    parameters: dict[str, Any]
