"""Integrations API request and response models."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IntegrationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Integration response model."""

    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="Integration name")
    type: str = Field(..., description="Integration type (email, sms, storage, etc.)")
    provider: str = Field(..., description="Provider name (sendgrid, twilio, etc.)")
    enabled: bool = Field(..., description="Whether integration is enabled")
    status: str = Field(..., description="Current status (ready, error, disabled, etc.)")
    message: str | None = Field(None, description="Status message")
    last_check: str | None = Field(None, description="Last health check timestamp")
    settings_count: int = Field(0, description="Number of configuration settings")
    has_secrets: bool = Field(False, description="Whether integration has secrets configured")
    required_packages: list[str] = Field(
        default_factory=list, description="Required Python packages"
    )
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class IntegrationListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """List of integrations response."""

    model_config = ConfigDict(from_attributes=True)

    integrations: list[IntegrationResponse] = Field(..., description="List of integrations")
    total: int = Field(..., description="Total number of integrations")


__all__ = [
    "IntegrationResponse",
    "IntegrationListResponse",
]
