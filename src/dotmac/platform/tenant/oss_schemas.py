"""Pydantic schemas for tenant OSS configuration endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.tenant.oss_config import OSSService, ServiceConfig


class OSSServiceConfigResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response payload for OSS configuration."""

    model_config = ConfigDict()

    service: OSSService
    config: ServiceConfig
    overrides: dict[str, Any] = Field(default_factory=lambda: {})


class OSSServiceConfigUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Partial update payload for OSS configuration."""

    model_config = ConfigDict()

    url: str | None = Field(None, description="Override base URL (null to clear)")
    username: str | None = Field(None, description="Override username (null to clear)")
    password: str | None = Field(None, description="Override password (null to clear)")
    api_token: str | None = Field(None, description="Override API token (null to clear)")
    verify_ssl: bool | None = Field(None, description="Override SSL verification flag")
    timeout_seconds: float | None = Field(
        None, ge=1.0, description="Override HTTP timeout in seconds (null to clear)"
    )
    max_retries: int | None = Field(
        None, ge=0, description="Override automatic retry count (null to clear)"
    )
    extras: dict[str, Any] | None = Field(
        None, description="Override integration-specific extra settings (null to clear)"
    )
