"""
Base Deployment Adapter

Abstract base class for deployment execution backends.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class ExecutionStatus(str, Enum):
    """Execution status"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class ExecutionContext:
    """Context for deployment execution"""

    tenant_id: str | None  # Tenant slug/identifier
    instance_id: int
    execution_id: int
    operation: str  # provision, upgrade, suspend, destroy, etc.

    # Template and configuration
    template_name: str
    template_version: str
    config: dict[str, Any]
    secrets: dict[str, Any] = field(default_factory=dict)

    # Resource allocation
    cpu_cores: int | None = None
    memory_gb: int | None = None
    storage_gb: int | None = None

    # Target environment
    environment: str = "production"
    region: str | None = None
    availability_zone: str | None = None
    namespace: str = ""
    cluster_name: str | None = None

    # Version info (for upgrades)
    from_version: str | None = None
    to_version: str | None = None

    # Additional metadata
    tags: dict[str, str] = field(default_factory=dict)
    notes: str | None = None
    triggered_by: int | None = None
    dry_run: bool = False

    def __post_init__(self) -> None:
        """Validate context after initialization"""
        if not self.namespace:
            # Generate default namespace
            self.namespace = f"tenant-{self.tenant_id}-{self.environment}"


@dataclass
class DeploymentResult:
    """Result of deployment operation"""

    status: ExecutionStatus
    message: str

    # Backend execution details
    backend_job_id: str | None = None
    backend_job_url: str | None = None
    logs: str | None = None

    # Deployment outputs
    endpoints: dict[str, str] = field(default_factory=dict)
    credentials: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    # Timing
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None

    # Error information
    error_code: str | None = None
    error_details: dict[str, Any] | None = None
    rollback_required: bool = False

    def is_success(self) -> bool:
        """Check if execution succeeded"""
        return self.status == ExecutionStatus.SUCCEEDED

    def is_failure(self) -> bool:
        """Check if execution failed"""
        return self.status in (
            ExecutionStatus.FAILED,
            ExecutionStatus.TIMEOUT,
            ExecutionStatus.CANCELLED,
        )


class DeploymentAdapter(ABC):
    """
    Abstract base class for deployment adapters

    Adapters implement the actual deployment logic for different
    execution backends (Kubernetes, AWX, Docker Compose, etc.)
    """

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize adapter

        Args:
            config: Adapter-specific configuration
        """
        self.config = config or {}
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    @abstractmethod
    async def provision(self, context: ExecutionContext) -> DeploymentResult:
        """
        Provision new deployment

        Args:
            context: Execution context with deployment details

        Returns:
            DeploymentResult with provision outcome
        """
        pass

    @abstractmethod
    async def upgrade(self, context: ExecutionContext) -> DeploymentResult:
        """
        Upgrade existing deployment

        Args:
            context: Execution context with upgrade details

        Returns:
            DeploymentResult with upgrade outcome
        """
        pass

    @abstractmethod
    async def suspend(self, context: ExecutionContext) -> DeploymentResult:
        """
        Suspend deployment (stop services, preserve data)

        Args:
            context: Execution context

        Returns:
            DeploymentResult with suspend outcome
        """
        pass

    @abstractmethod
    async def resume(self, context: ExecutionContext) -> DeploymentResult:
        """
        Resume suspended deployment

        Args:
            context: Execution context

        Returns:
            DeploymentResult with resume outcome
        """
        pass

    @abstractmethod
    async def destroy(self, context: ExecutionContext) -> DeploymentResult:
        """
        Destroy deployment (remove all resources)

        Args:
            context: Execution context

        Returns:
            DeploymentResult with destroy outcome
        """
        pass

    @abstractmethod
    async def scale(self, context: ExecutionContext) -> DeploymentResult:
        """
        Scale deployment resources

        Args:
            context: Execution context with new resource allocations

        Returns:
            DeploymentResult with scale outcome
        """
        pass

    @abstractmethod
    async def get_status(self, context: ExecutionContext) -> dict[str, Any]:
        """
        Get deployment status

        Args:
            context: Execution context

        Returns:
            Status information (health, resources, metrics)
        """
        pass

    @abstractmethod
    async def get_logs(self, context: ExecutionContext, lines: int = 100) -> str:
        """
        Get deployment logs

        Args:
            context: Execution context
            lines: Number of log lines to retrieve

        Returns:
            Log output
        """
        pass

    @abstractmethod
    async def validate_config(self, context: ExecutionContext) -> tuple[bool, list[str]]:
        """
        Validate deployment configuration

        Args:
            context: Execution context

        Returns:
            Tuple of (is_valid, error_messages)
        """
        pass

    async def rollback(self, context: ExecutionContext) -> DeploymentResult:
        """
        Rollback to previous version (default implementation)

        Args:
            context: Execution context with rollback details

        Returns:
            DeploymentResult with rollback outcome
        """
        # Default rollback is an upgrade to previous version
        if not context.from_version:
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message="Cannot rollback: no previous version specified",
                error_code="NO_PREVIOUS_VERSION",
            )

        # Swap versions for rollback
        original_to = context.to_version
        context.to_version = context.from_version
        context.from_version = original_to

        return await self.upgrade(context)

    async def health_check(self, context: ExecutionContext) -> dict[str, Any]:
        """
        Perform health check (default implementation)

        Args:
            context: Execution context

        Returns:
            Health check results
        """
        try:
            status = await self.get_status(context)
            return {
                "status": "healthy" if status.get("ready", False) else "unhealthy",
                "details": status,
                "checked_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "checked_at": datetime.utcnow().isoformat(),
            }

    def _log_operation(self, operation: str, context: ExecutionContext, message: str) -> None:
        """Log operation with context"""
        self.logger.info(
            f"[{operation}] tenant={context.tenant_id} instance={context.instance_id} "
            f"namespace={context.namespace} {message}"
        )

    def _log_error(self, operation: str, context: ExecutionContext, error: Exception) -> None:
        """Log error with context"""
        self.logger.error(
            f"[{operation}] tenant={context.tenant_id} instance={context.instance_id} "
            f"namespace={context.namespace} error={error}",
            exc_info=True,
        )
