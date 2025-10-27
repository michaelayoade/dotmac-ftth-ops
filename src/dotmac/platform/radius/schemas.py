"""
RADIUS Pydantic Schemas

Request and response schemas for RADIUS API endpoints.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.core.ip_validation import (
    IPv4AddressValidator,
    IPv6AddressValidator,
    IPv6NetworkValidator,
)

# ============================================================================
# RADIUS Subscriber Schemas
# ============================================================================


class RADIUSSubscriberCreate(BaseModel):
    """Create RADIUS subscriber credentials"""

    model_config = ConfigDict()

    subscriber_id: str = Field(..., description="Internal subscriber ID")
    username: str = Field(..., min_length=3, max_length=64, description="RADIUS username")
    password: str = Field(..., min_length=8, description="RADIUS password")
    bandwidth_profile_id: str | None = Field(None, description="Bandwidth profile to apply")

    # IPv4 Support
    framed_ipv4_address: str | None = Field(None, description="Static IPv4 address (optional)")

    # IPv6 Support (NEW)
    framed_ipv6_address: str | None = Field(None, description="Static IPv6 address (optional)")
    delegated_ipv6_prefix: str | None = Field(
        None, description="IPv6 prefix delegation (e.g., 2001:db8::/64)"
    )

    # Timeouts
    session_timeout: int | None = Field(None, gt=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, gt=0, description="Idle timeout in seconds")

    # Backward compatibility: map old field to new field
    framed_ip_address: str | None = Field(
        None, description="[DEPRECATED] Use framed_ipv4_address instead"
    )

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not v.replace("_", "").replace("-", "").replace(".", "").replace("@", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, _, -, ., @")
        return v.lower()

    @field_validator("framed_ipv4_address")
    @classmethod
    def validate_framed_ipv4(cls, v: str | None) -> str | None:
        """Validate IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("framed_ipv6_address")
    @classmethod
    def validate_framed_ipv6(cls, v: str | None) -> str | None:
        """Validate IPv6 address"""
        return IPv6AddressValidator.validate(v)

    @field_validator("delegated_ipv6_prefix")
    @classmethod
    def validate_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix (CIDR notation)"""
        return IPv6NetworkValidator.validate(v, strict=False)

    def model_post_init(self, __context) -> None:
        """Handle backward compatibility for framed_ip_address"""
        if self.framed_ip_address and not self.framed_ipv4_address:
            self.framed_ipv4_address = self.framed_ip_address


class RADIUSSubscriberUpdate(BaseModel):
    """Update RADIUS subscriber credentials"""

    model_config = ConfigDict()

    password: str | None = Field(None, min_length=8, description="New password")
    bandwidth_profile_id: str | None = Field(None, description="New bandwidth profile")

    # IPv4 Support
    framed_ipv4_address: str | None = Field(None, description="Static IPv4 address")

    # IPv6 Support (NEW)
    framed_ipv6_address: str | None = Field(None, description="Static IPv6 address")
    delegated_ipv6_prefix: str | None = Field(None, description="IPv6 prefix delegation")

    # Timeouts
    session_timeout: int | None = Field(None, gt=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, gt=0, description="Idle timeout in seconds")
    enabled: bool | None = Field(None, description="Enable/disable RADIUS access")

    # Backward compatibility
    framed_ip_address: str | None = Field(
        None, description="[DEPRECATED] Use framed_ipv4_address instead"
    )

    @field_validator("framed_ipv4_address")
    @classmethod
    def validate_framed_ipv4(cls, v: str | None) -> str | None:
        """Validate IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("framed_ipv6_address")
    @classmethod
    def validate_framed_ipv6(cls, v: str | None) -> str | None:
        """Validate IPv6 address"""
        return IPv6AddressValidator.validate(v)

    @field_validator("delegated_ipv6_prefix")
    @classmethod
    def validate_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix"""
        return IPv6NetworkValidator.validate(v, strict=False)

    def model_post_init(self, __context) -> None:
        """Handle backward compatibility"""
        if self.framed_ip_address and not self.framed_ipv4_address:
            self.framed_ipv4_address = self.framed_ip_address


class RADIUSSubscriberResponse(BaseModel):
    """RADIUS subscriber response"""

    id: int
    tenant_id: str
    subscriber_id: str
    username: str
    bandwidth_profile_id: str | None = None

    # IPv4 Support
    framed_ipv4_address: str | None = None

    # IPv6 Support (NEW)
    framed_ipv6_address: str | None = None
    delegated_ipv6_prefix: str | None = None

    # Timeouts
    session_timeout: int | None = None
    idle_timeout: int | None = None
    enabled: bool = True
    created_at: datetime
    updated_at: datetime

    # Backward compatibility - computed field
    @property
    def framed_ip_address(self) -> str | None:
        """Backward compatibility: return IPv4 address"""
        return self.framed_ipv4_address

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# RADIUS Session Schemas
# ============================================================================


class RADIUSSessionResponse(BaseModel):
    """Active RADIUS session"""

    radacctid: int
    tenant_id: str
    subscriber_id: str | None = None
    username: str
    acctsessionid: str
    nasipaddress: str

    # IPv4 session info
    framedipaddress: str | None = None

    # IPv6 session info (NEW)
    framedipv6address: str | None = None
    framedipv6prefix: str | None = None
    delegatedipv6prefix: str | None = None

    # Session timing and accounting
    acctstarttime: datetime | None = None
    acctsessiontime: int | None = None  # Seconds
    acctinputoctets: int | None = None  # Bytes downloaded
    acctoutputoctets: int | None = None  # Bytes uploaded
    total_bytes: int = 0
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class RADIUSSessionDisconnect(BaseModel):
    """Disconnect RADIUS session"""

    model_config = ConfigDict()

    username: str | None = Field(None, description="Username to disconnect")
    nasipaddress: str | None = Field(None, description="NAS IP address")
    acctsessionid: str | None = Field(None, description="Session ID to disconnect")

    @field_validator("username", "nasipaddress", "acctsessionid")
    @classmethod
    def prevent_radius_injection(cls, v: str | None) -> str | None:
        """
        Prevent RADIUS attribute injection attacks.

        SECURITY: This validator prevents injection of additional RADIUS attributes
        via newline/carriage return characters. Without this validation, an attacker
        could inject arbitrary attributes like Filter-Id to bypass bandwidth limits.

        Example attack: username = 'victim"\\nFilter-Id = "unlimited"\\nUser-Name = "admin'
        """
        if v is None:
            return v

        # Check for newline injection (primary attack vector)
        if "\n" in v or "\r" in v:
            raise ValueError(
                "Input cannot contain newline or carriage return characters. "
                "These can be used to inject additional RADIUS attributes."
            )

        # Check for null bytes (secondary attack vector)
        if "\x00" in v:
            raise ValueError("Input cannot contain null bytes")

        # Additional safety: validate character set for RADIUS-safe values
        # Allow: alphanumeric, @, ., _, -, :, / (common in usernames, IPs, session IDs)
        import re

        if not re.match(r"^[a-zA-Z0-9@._\-:/]+$", v):
            raise ValueError(
                "Input contains invalid characters. "
                "Only alphanumeric characters and @._-:/ are allowed for RADIUS attributes."
            )

        return v


# ============================================================================
# RADIUS Accounting Schemas
# ============================================================================


class RADIUSUsageResponse(BaseModel):
    """Usage statistics for a subscriber"""

    model_config = ConfigDict()

    subscriber_id: str
    username: str
    total_sessions: int
    total_session_time: int  # Total seconds
    total_download_bytes: int  # Total bytes downloaded
    total_upload_bytes: int  # Total bytes uploaded
    total_bytes: int  # Total bytes transferred
    active_sessions: int
    last_session_start: datetime | None = None
    last_session_stop: datetime | None = None

    @property
    def total_input_octets(self) -> int:
        """Backward compatibility alias for download bytes.

        RADIUS traditionally uses 'input' from the NAS perspective (data sent TO user).
        """
        return self.total_download_bytes

    @property
    def total_output_octets(self) -> int:
        """Backward compatibility alias for upload bytes.

        RADIUS traditionally uses 'output' from the NAS perspective (data sent FROM user).
        """
        return self.total_upload_bytes


class RADIUSUsageQuery(BaseModel):
    """Query parameters for usage statistics"""

    model_config = ConfigDict()

    subscriber_id: str | None = None
    username: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    include_active_only: bool = False


# ============================================================================
# NAS (Network Access Server) Schemas
# ============================================================================


class NASCreate(BaseModel):
    """Create NAS device"""

    model_config = ConfigDict()

    nasname: str = Field(..., description="IP address or hostname")
    shortname: str = Field(..., min_length=1, max_length=32, description="Short identifier")
    type: str = Field(default="other", description="NAS type (cisco, mikrotik, other)")
    secret: str = Field(..., min_length=8, description="Shared secret")
    ports: int | None = Field(None, gt=0, description="Number of ports")
    community: str | None = Field(None, description="SNMP community string")
    description: str | None = Field(None, max_length=200, description="Description")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """Validate NAS type"""
        valid_types = ["cisco", "mikrotik", "juniper", "huawei", "zte", "nokia", "other"]
        if v.lower() not in valid_types:
            raise ValueError(f"NAS type must be one of: {', '.join(valid_types)}")
        return v.lower()


class NASUpdate(BaseModel):
    """Update NAS device"""

    model_config = ConfigDict()

    shortname: str | None = Field(None, min_length=1, max_length=32)
    type: str | None = None
    secret: str | None = Field(None, min_length=8)
    ports: int | None = Field(None, gt=0)
    community: str | None = None
    description: str | None = Field(None, max_length=200)


class NASResponse(BaseModel):
    """NAS device response without exposing shared secrets"""

    id: int
    tenant_id: str
    nasname: str
    shortname: str
    type: str
    secret_configured: bool = Field(
        ...,
        description="Indicates whether a shared secret has been configured. The secret value is never returned.",
    )
    ports: int | None = None
    community: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Bandwidth Profile Schemas
# ============================================================================


class BandwidthProfileCreate(BaseModel):
    """Create bandwidth profile"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Profile name")
    description: str | None = None
    download_rate_kbps: int = Field(..., gt=0, description="Download speed in Kbps")
    upload_rate_kbps: int = Field(..., gt=0, description="Upload speed in Kbps")
    download_burst_kbps: int | None = Field(None, gt=0, description="Download burst speed")
    upload_burst_kbps: int | None = Field(None, gt=0, description="Upload burst speed")


class BandwidthProfileUpdate(BaseModel):
    """Update bandwidth profile"""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    download_rate_kbps: int | None = Field(None, gt=0)
    upload_rate_kbps: int | None = Field(None, gt=0)
    download_burst_kbps: int | None = Field(None, gt=0)
    upload_burst_kbps: int | None = Field(None, gt=0)


class BandwidthProfileResponse(BaseModel):
    """Bandwidth profile response"""

    id: str
    tenant_id: str
    name: str
    description: str | None = None
    download_rate_kbps: int
    upload_rate_kbps: int
    download_burst_kbps: int | None = None
    upload_burst_kbps: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Authentication Test Schemas
# ============================================================================


class RADIUSAuthTest(BaseModel):
    """Test RADIUS authentication"""

    model_config = ConfigDict()

    username: str = Field(..., description="Username to test")
    password: str = Field(..., description="Password to test")
    nas_ip: str | None = Field(None, description="NAS IP to test against")


class RADIUSAuthTestResponse(BaseModel):
    """RADIUS authentication test result"""

    model_config = ConfigDict()

    success: bool
    message: str
    attributes: dict[str, Any] | None = None
    response_time_ms: float | None = None
