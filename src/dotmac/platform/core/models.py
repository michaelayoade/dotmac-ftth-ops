"""Core domain models for DotMac Platform."""

from typing import Any
from uuid import uuid4

from pydantic import BaseModel as PydanticBaseModel
from pydantic import ConfigDict, Field


class BaseModel(PydanticBaseModel):  # PydanticBaseModel resolves to Any in isolation
    """Base model for DotMac Framework entities.

    This base model provides common configuration for all domain entities
    in the platform.
    """

    model_config = ConfigDict(
        from_attributes=True, validate_assignment=True, str_strip_whitespace=True, extra="forbid"
    )


class TenantContext(BaseModel):  # BaseModel resolves to Any in isolation
    """Tenant context information for multi-tenant operations.

    This model represents the tenant context that flows through the
    application to enable proper data isolation and access control.
    """

    model_config = ConfigDict()

    tenant_id: str
    tenant_name: str | None = None
    domain: str | None = None
    is_active: bool = True
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @classmethod
    def create_default(cls) -> "TenantContext":
        """Create a default tenant context for testing."""
        return cls(
            tenant_id=str(uuid4()),
            tenant_name="Test Tenant",
            domain="test.example.com",
            is_active=True,
        )
