"""
Data models for service registry.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ServiceStatus(str, Enum):
    """Service health status."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    STARTING = "starting"
    STOPPING = "stopping"
    UNKNOWN = "unknown"


class ServiceHealth(BaseModel):  # BaseModel resolves to Any in isolation
    """Service health information."""

    model_config = ConfigDict()

    status: str
    latency_ms: float | None = None
    cpu_usage: float | None = None
    memory_usage: float | None = None
    error_rate: float | None = None
    request_count: int | None = None
    details: dict[str, Any] = Field(default_factory=lambda: {})
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ServiceInfo(BaseModel):  # BaseModel resolves to Any in isolation
    """Service registration information."""

    model_config = ConfigDict()

    id: str
    name: str
    version: str
    host: str
    port: int
    tags: list[str] = Field(default_factory=lambda: [])
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    health_check_url: str
    status: ServiceStatus = ServiceStatus.UNKNOWN
    health: ServiceHealth | None = None
    registered_at: datetime
    last_heartbeat: datetime
    weight: int = Field(default=100, description="Load balancing weight")
    region: str | None = None
    zone: str | None = None
