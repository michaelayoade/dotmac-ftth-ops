"""Pydantic schemas for tenant OSS configuration endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from dotmac.platform.tenant.oss_config import OSSService, ServiceConfig


class OSSServiceConfigResponse(BaseModel):
    """Response payload for OSS configuration."""

    service: OSSService
    config: ServiceConfig
    overrides: dict[str, Any] = Field(default_factory=dict)


class OSSServiceConfigUpdate(BaseModel):
    """Partial update payload for OSS configuration."""

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
