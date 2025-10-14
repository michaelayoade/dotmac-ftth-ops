"""
RADIUS Pydantic Schemas

Request and response schemas for RADIUS API endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# ============================================================================
# RADIUS Subscriber Schemas
# ============================================================================


class RADIUSSubscriberCreate(BaseModel):
    """Create RADIUS subscriber credentials"""

    subscriber_id: str = Field(..., description="Internal subscriber ID")
    username: str = Field(..., min_length=3, max_length=64, description="RADIUS username")
    password: str = Field(..., min_length=8, description="RADIUS password")
    bandwidth_profile_id: str | None = Field(None, description="Bandwidth profile to apply")
    framed_ip_address: str | None = Field(None, description="Static IP address (optional)")
    session_timeout: int | None = Field(None, gt=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, gt=0, description="Idle timeout in seconds")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not v.replace("_", "").replace("-", "").replace(".", "").replace("@", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, _, -, ., @")
        return v.lower()


class RADIUSSubscriberUpdate(BaseModel):
    """Update RADIUS subscriber credentials"""

    password: str | None = Field(None, min_length=8, description="New password")
    bandwidth_profile_id: str | None = Field(None, description="New bandwidth profile")
    framed_ip_address: str | None = Field(None, description="Static IP address")
    session_timeout: int | None = Field(None, gt=0, description="Session timeout in seconds")
    idle_timeout: int | None = Field(None, gt=0, description="Idle timeout in seconds")
    enabled: bool | None = Field(None, description="Enable/disable RADIUS access")


class RADIUSSubscriberResponse(BaseModel):
    """RADIUS subscriber response"""

    id: int
    tenant_id: str
    subscriber_id: str
    username: str
    bandwidth_profile_id: str | None = None
    framed_ip_address: str | None = None
    session_timeout: int | None = None
    idle_timeout: int | None = None
    enabled: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
    framedipaddress: str | None = None
    acctstarttime: datetime | None = None
    acctsessiontime: int | None = None  # Seconds
    acctinputoctets: int | None = None  # Bytes downloaded
    acctoutputoctets: int | None = None  # Bytes uploaded
    total_bytes: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


class RADIUSSessionDisconnect(BaseModel):
    """Disconnect RADIUS session"""

    username: str | None = Field(None, description="Username to disconnect")
    nasipaddress: str | None = Field(None, description="NAS IP address")
    acctsessionid: str | None = Field(None, description="Session ID to disconnect")


# ============================================================================
# RADIUS Accounting Schemas
# ============================================================================


class RADIUSUsageResponse(BaseModel):
    """Usage statistics for a subscriber"""

    subscriber_id: str
    username: str
    total_sessions: int
    total_session_time: int  # Total seconds
    total_input_octets: int  # Total bytes downloaded
    total_output_octets: int  # Total bytes uploaded
    total_bytes: int  # Total bytes transferred
    active_sessions: int
    last_session_start: datetime | None = None
    last_session_stop: datetime | None = None


class RADIUSUsageQuery(BaseModel):
    """Query parameters for usage statistics"""

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

    shortname: str | None = Field(None, min_length=1, max_length=32)
    type: str | None = None
    secret: str | None = Field(None, min_length=8)
    ports: int | None = Field(None, gt=0)
    community: str | None = None
    description: str | None = Field(None, max_length=200)


class NASResponse(BaseModel):
    """NAS device response"""

    id: int
    tenant_id: str
    nasname: str
    shortname: str
    type: str
    ports: int | None = None
    community: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Bandwidth Profile Schemas
# ============================================================================


class BandwidthProfileCreate(BaseModel):
    """Create bandwidth profile"""

    name: str = Field(..., min_length=1, max_length=100, description="Profile name")
    description: str | None = None
    download_rate_kbps: int = Field(..., gt=0, description="Download speed in Kbps")
    upload_rate_kbps: int = Field(..., gt=0, description="Upload speed in Kbps")
    download_burst_kbps: int | None = Field(None, gt=0, description="Download burst speed")
    upload_burst_kbps: int | None = Field(None, gt=0, description="Upload burst speed")


class BandwidthProfileUpdate(BaseModel):
    """Update bandwidth profile"""

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

    model_config = {"from_attributes": True}


# ============================================================================
# Authentication Test Schemas
# ============================================================================


class RADIUSAuthTest(BaseModel):
    """Test RADIUS authentication"""

    username: str = Field(..., description="Username to test")
    password: str = Field(..., description="Password to test")
    nas_ip: str | None = Field(None, description="NAS IP to test against")


class RADIUSAuthTestResponse(BaseModel):
    """RADIUS authentication test result"""

    success: bool
    message: str
    attributes: dict | None = None
    response_time_ms: float | None = None
