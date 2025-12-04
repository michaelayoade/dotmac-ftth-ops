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

    subscriber_id: str | None = Field(None, description="Internal subscriber ID (optional)")
    username: str = Field(..., min_length=3, max_length=64, description="RADIUS username")
    password: str = Field(..., min_length=8, description="RADIUS password")
    bandwidth_profile_id: str | None = Field(None, description="Bandwidth profile to apply")

    # IPv4 Support
    framed_ipv4_address: str | None = Field(None, description="Static IPv4 address (optional)")

    # IPv6 Support (NEW)
    framed_ipv6_address: str | None = Field(None, description="Static IPv6 address (optional)")
    framed_ipv6_prefix: str | None = Field(
        None, description="IPv6 prefix for subscriber interface (e.g., 2001:db8:100::/64)"
    )
    delegated_ipv6_prefix: str | None = Field(
        None, description="IPv6 prefix delegation (e.g., 2001:db8::/64)"
    )

    # Timeouts
    session_timeout: int | None = Field(None, ge=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, ge=0, description="Idle timeout in seconds")

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

    @field_validator("framed_ipv6_prefix")
    @classmethod
    def validate_framed_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix (CIDR notation)"""
        return IPv6NetworkValidator.validate(v, strict=False)

    @field_validator("delegated_ipv6_prefix")
    @classmethod
    def validate_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix (CIDR notation)"""
        return IPv6NetworkValidator.validate(v, strict=False)

    def model_post_init(self, __context: Any) -> None:
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
    framed_ipv6_prefix: str | None = Field(None, description="IPv6 prefix for subscriber interface")
    delegated_ipv6_prefix: str | None = Field(None, description="IPv6 prefix delegation")

    # Timeouts
    session_timeout: int | None = Field(None, ge=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, ge=0, description="Idle timeout in seconds")
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

    @field_validator("framed_ipv6_prefix")
    @classmethod
    def validate_framed_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix"""
        return IPv6NetworkValidator.validate(v, strict=False)

    @field_validator("delegated_ipv6_prefix")
    @classmethod
    def validate_ipv6_prefix(cls, v: str | None) -> str | None:
        """Validate IPv6 prefix"""
        return IPv6NetworkValidator.validate(v, strict=False)

    def model_post_init(self, __context: Any) -> None:
        """Handle backward compatibility"""
        if self.framed_ip_address and not self.framed_ipv4_address:
            self.framed_ipv4_address = self.framed_ip_address


class RADIUSSubscriberResponse(BaseModel):
    """RADIUS subscriber response"""

    id: int
    tenant_id: str
    subscriber_id: str | None = None
    username: str
    bandwidth_profile_id: str | None = None

    # IPv4 Support
    framed_ipv4_address: str | None = None

    # IPv6 Support (NEW)
    framed_ipv6_address: str | None = None
    framed_ipv6_prefix: str | None = None
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

    @property
    def is_suspended(self) -> bool:
        """Compatibility property indicating subscriber suspension state."""
        return not self.enabled

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
    nasportid: str | None = None

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
    callingstationid: str | None = None
    acct_stop_time: datetime | None = None
    acct_terminate_cause: str | None = None
    last_update: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @property
    def session_id(self) -> str:
        """Alias for acctsessionid used in tests."""
        return self.acctsessionid

    @property
    def nas_ip_address(self) -> str:
        return self.nasipaddress

    @property
    def nas_port_id(self) -> str | None:
        return self.nasportid

    @property
    def framed_ip_address(self) -> str | None:
        return self.framedipaddress

    @property
    def calling_station_id(self) -> str | None:
        return self.callingstationid

    @property
    def acct_session_time(self) -> int | None:
        return self.acctsessiontime

    @property
    def acct_input_octets(self) -> int | None:
        return self.acctinputoctets

    @property
    def acct_output_octets(self) -> int | None:
        return self.acctoutputoctets


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

    model_config = ConfigDict(populate_by_name=True)

    nasname: str = Field(..., alias="nas_name", description="IP address or hostname")
    shortname: str = Field(
        ..., alias="short_name", min_length=1, max_length=32, description="Short identifier"
    )
    type: str = Field(default="other", alias="nas_type", description="NAS type")
    secret: str = Field(..., min_length=6, description="Shared secret")
    ports: int | None = Field(None, gt=0, description="Number of ports")
    community: str | None = Field(None, description="SNMP community string")
    description: str | None = Field(None, max_length=200, description="Description")
    server_ip: str | None = Field(None, alias="server_ip", description="Server IP address")

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
    secret: str | None = None
    ports: int | None = None
    community: str | None = None
    description: str | None = None
    server_ip: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def nas_name(self) -> str:
        return self.nasname

    @property
    def short_name(self) -> str:
        return self.shortname

    @property
    def nas_type(self) -> str:
        return self.type


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


# ============================================================================
# Phase 3: Option 82 Authorization Schemas
# ============================================================================


class RADIUSAuthorizationRequest(BaseModel):
    """
    RADIUS Access-Request with Option 82 for authorization.

    This schema represents the RADIUS Access-Request packet sent by the NAS,
    including DHCP Option 82 (Relay Agent Information) for subscriber location
    validation.

    FreeRADIUS can forward this request to our API via rlm_rest module.
    """

    model_config = ConfigDict(populate_by_name=True)

    # Standard RADIUS attributes
    username: str = Field(..., description="RADIUS username")
    password: str | None = Field(None, description="RADIUS password (optional for CoA)")
    nas_ip_address: str | None = Field(None, description="NAS IP address")
    nas_port: int | None = Field(None, description="NAS port number")
    nas_port_id: str | None = Field(None, description="NAS port identifier")
    calling_station_id: str | None = Field(None, description="Client MAC address")

    # Option 82 attributes (DHCP Relay Agent Information)
    agent_circuit_id: str | None = Field(
        None,
        description="Circuit-Id (port identifier, e.g., 'OLT1/1/1/1:1')",
        alias="Agent-Circuit-Id",
    )
    agent_remote_id: str | None = Field(
        None, description="Remote-Id (CPE identifier, e.g., ONU serial)", alias="Agent-Remote-Id"
    )

    # Vendor-specific variants (Alcatel-Lucent, Cisco, etc.)
    alcatel_agent_circuit_id: str | None = Field(
        None,
        description="Alcatel-Lucent variant of Agent-Circuit-Id",
        alias="Alcatel-Lucent-Agent-Circuit-Id",
    )
    alcatel_agent_remote_id: str | None = Field(
        None,
        description="Alcatel-Lucent variant of Agent-Remote-Id",
        alias="Alcatel-Lucent-Agent-Remote-Id",
    )


class RADIUSAuthorizationResponse(BaseModel):
    """
    RADIUS authorization decision with attributes.

    Returns:
    - accept: True for Access-Accept, False for Access-Reject
    - reply_attributes: Attributes to include in RADIUS reply (IP, VLAN, bandwidth)
    - reason: Human-readable reason for acceptance/rejection
    - option82_validation: Details about Option 82 validation
    """

    model_config = ConfigDict()

    accept: bool = Field(..., description="True for Access-Accept, False for Access-Reject")
    reason: str = Field(..., description="Reason for authorization decision")
    reply_attributes: dict[str, Any] = Field(
        default_factory=dict,
        description="RADIUS reply attributes (Framed-IP-Address, bandwidth, VLAN, etc.)",
    )

    # Option 82 validation details
    option82_validation: dict[str, Any] | None = Field(
        None, description="Option 82 validation results"
    )
