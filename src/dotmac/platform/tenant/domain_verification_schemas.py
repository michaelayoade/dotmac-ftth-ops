"""
Pydantic schemas for domain verification API.

Provides type-safe request/response models for domain ownership verification.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DomainVerificationInitiate(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to initiate domain verification."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    domain: str = Field(
        description="Domain to verify (e.g., example.com)",
        min_length=3,
        max_length=255,
    )
    method: str = Field(
        description="Verification method (dns_txt, dns_cname, meta_tag, file_upload)",
        pattern=r"^(dns_txt|dns_cname|meta_tag|file_upload)$",
    )

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        """Validate domain format."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Domain cannot be empty")

        # Basic validation - detailed validation in service layer
        domain = v.strip().lower()

        # Check for invalid characters
        if any(char in domain for char in [" ", "\t", "\n", "\r"]):
            raise ValueError("Domain cannot contain whitespace")

        return domain


class DomainVerificationCheck(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to check domain verification status."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    domain: str = Field(
        description="Domain to verify",
        min_length=3,
        max_length=255,
    )
    token: str = Field(
        description="Verification token",
        min_length=32,
        max_length=64,
    )
    method: str = Field(
        description="Verification method used",
        pattern=r"^(dns_txt|dns_cname|meta_tag|file_upload)$",
    )


class DNSRecordInstruction(BaseModel):  # BaseModel resolves to Any in isolation
    """DNS record configuration instructions."""

    model_config = ConfigDict(str_strip_whitespace=True)

    type: str = Field(description="Record type (TXT or CNAME)")
    name: str = Field(description="Record name")
    value: str | None = Field(None, description="Record value (for TXT)")
    target: str | None = Field(None, description="Record target (for CNAME)")
    ttl: int = Field(default=3600, description="TTL in seconds")


class DomainVerificationInstructions(BaseModel):  # BaseModel resolves to Any in isolation
    """Domain verification instructions."""

    model_config = ConfigDict(str_strip_whitespace=True)

    type: str = Field(description="Verification type")
    description: str = Field(description="Human-readable description")
    steps: list[str] = Field(description="Step-by-step instructions")
    dns_record: DNSRecordInstruction | None = Field(None, description="DNS record configuration")
    verification_command: str | None = Field(None, description="Command to verify DNS propagation")


class DomainVerificationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for domain verification operations."""

    model_config = ConfigDict(str_strip_whitespace=True)

    domain: str = Field(description="Domain being verified")
    status: str = Field(description="Verification status (pending, verified, failed, expired)")
    method: str = Field(description="Verification method")
    token: str | None = Field(None, description="Verification token (if pending)")
    expires_at: datetime | None = Field(None, description="Token expiration time (if pending)")
    verified_at: datetime | None = Field(
        None, description="Verification completion time (if verified)"
    )
    instructions: DomainVerificationInstructions | None = Field(
        None, description="Verification instructions (if pending)"
    )
    error_message: str | None = Field(None, description="Error message (if failed)")


class DomainVerificationStatusResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for domain verification status check."""

    model_config = ConfigDict(str_strip_whitespace=True)

    tenant_id: str = Field(description="Tenant ID")
    domain: str | None = Field(None, description="Current verified domain")
    is_verified: bool = Field(description="Whether domain is verified")
    verified_at: datetime | None = Field(None, description="When domain was verified")


class DomainRemovalResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for domain removal."""

    model_config = ConfigDict(str_strip_whitespace=True)

    domain: str = Field(description="Removed domain")
    status: str = Field(description="Removal status")
    removed_at: datetime = Field(description="When domain was removed")


class DomainVerificationErrorResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Error response for domain verification operations."""

    model_config = ConfigDict(str_strip_whitespace=True)

    error: str = Field(description="Error type")
    message: str = Field(description="Error message")
    details: dict[str, Any] | None = Field(None, description="Additional error details")
