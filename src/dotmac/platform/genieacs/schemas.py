"""
GenieACS Pydantic Schemas

Request and response schemas for GenieACS TR-069/CWMP operations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ============================================================================
# Device Schemas
# ============================================================================


class DeviceQuery(BaseModel):
    """Query parameters for device search"""

    query: dict[str, Any] | None = Field(None, description="MongoDB-style query")
    projection: str | None = Field(None, description="Comma-separated fields")
    skip: int = Field(0, ge=0, description="Records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum records")


class DeviceInfo(BaseModel):
    """Basic device information"""

    device_id: str = Field(..., alias="_id", description="Device ID (serial number)")
    manufacturer: str | None = Field(None, description="Device manufacturer")
    model: str | None = Field(None, description="Device model")
    product_class: str | None = Field(None, description="Product class")
    oui: str | None = Field(None, description="OUI (Organizationally Unique Identifier)")
    serial_number: str | None = Field(None, description="Serial number")
    hardware_version: str | None = Field(None, description="Hardware version")
    software_version: str | None = Field(None, description="Software version")
    connection_request_url: str | None = Field(None, description="Connection request URL")
    last_inform: datetime | None = Field(None, description="Last inform time")
    registered: datetime | None = Field(None, description="Registration time")

    model_config = {"from_attributes": True, "populate_by_name": True}


class DeviceResponse(BaseModel):
    """Detailed device response"""

    device_id: str = Field(..., description="Device ID")
    device_info: dict[str, Any] = Field(default_factory=dict, description="Device information")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Device parameters")
    tags: list[str] = Field(default_factory=list, description="Device tags")

    model_config = {"from_attributes": True}


class DeviceListResponse(BaseModel):
    """Device list response"""

    devices: list[DeviceInfo]
    total: int
    skip: int
    limit: int


# ============================================================================
# Task Schemas
# ============================================================================


class TaskCreate(BaseModel):
    """Create task for device"""

    device_id: str = Field(..., description="Device ID")
    task_name: str = Field(..., description="Task name (refreshObject, setParameterValues, etc.)")
    task_data: dict[str, Any] | None = Field(None, description="Task-specific data")


class RefreshRequest(BaseModel):
    """Refresh device parameters"""

    device_id: str = Field(..., description="Device ID")
    object_path: str = Field(
        default="InternetGatewayDevice",
        description="TR-069 object path to refresh",
    )


class SetParameterRequest(BaseModel):
    """Set parameter values on device"""

    device_id: str = Field(..., description="Device ID")
    parameters: dict[str, Any] = Field(..., description="Parameter path and values")


class GetParameterRequest(BaseModel):
    """Get parameter values from device"""

    device_id: str = Field(..., description="Device ID")
    parameter_names: list[str] = Field(..., description="List of parameter paths")


class RebootRequest(BaseModel):
    """Reboot device"""

    device_id: str = Field(..., description="Device ID")


class FactoryResetRequest(BaseModel):
    """Factory reset device"""

    device_id: str = Field(..., description="Device ID")


class FirmwareDownloadRequest(BaseModel):
    """Download firmware to device"""

    device_id: str = Field(..., description="Device ID")
    file_type: str = Field(
        default="1 Firmware Upgrade Image",
        description="TR-069 file type",
    )
    file_name: str = Field(..., description="File name on GenieACS server")
    target_file_name: str | None = Field(None, description="Target filename on device")


class TaskResponse(BaseModel):
    """Task creation response"""

    success: bool
    message: str
    task_id: str | None = None
    details: dict[str, Any] | None = None


# ============================================================================
# Preset Schemas
# ============================================================================


class PresetCreate(BaseModel):
    """Create preset configuration"""

    name: str = Field(..., min_length=1, max_length=100, description="Preset name")
    channel: str = Field(..., description="Channel (e.g., default)")
    schedule: dict[str, Any] | None = Field(None, description="Schedule configuration")
    events: dict[str, bool] = Field(default_factory=dict, description="Event triggers")
    precondition: str | None = Field(None, description="JavaScript precondition")
    configurations: list[dict[str, Any]] = Field(
        default_factory=list, description="Configuration array"
    )


class PresetUpdate(BaseModel):
    """Update preset configuration"""

    channel: str | None = None
    schedule: dict[str, Any] | None = None
    events: dict[str, bool] | None = None
    precondition: str | None = None
    configurations: list[dict[str, Any]] | None = None


class PresetResponse(BaseModel):
    """Preset response"""

    preset_id: str = Field(..., alias="_id", description="Preset ID")
    name: str
    channel: str
    events: dict[str, bool]
    configurations: list[dict[str, Any]]

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================================
# Provision Schemas
# ============================================================================


class ProvisionResponse(BaseModel):
    """Provision script response"""

    provision_id: str = Field(..., alias="_id", description="Provision ID")
    script: str = Field(..., description="JavaScript provision script")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================================
# File Schemas
# ============================================================================


class FileResponse(BaseModel):
    """File metadata response"""

    file_id: str = Field(..., alias="_id", description="File ID")
    metadata: dict[str, Any] = Field(default_factory=dict, description="File metadata")
    length: int | None = Field(None, description="File size in bytes")
    upload_date: datetime | None = Field(None, description="Upload date")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================================
# Fault Schemas
# ============================================================================


class FaultResponse(BaseModel):
    """Fault/error response"""

    fault_id: str = Field(..., alias="_id", description="Fault ID")
    device: str = Field(..., description="Device ID")
    channel: str = Field(..., description="Channel")
    code: str = Field(..., description="Fault code")
    message: str = Field(..., description="Fault message")
    detail: dict[str, Any] | None = Field(None, description="Fault details")
    timestamp: datetime = Field(..., description="Fault timestamp")
    retries: int = Field(default=0, description="Retry count")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================================
# CPE Configuration Schemas
# ============================================================================


class WiFiConfig(BaseModel):
    """WiFi configuration"""

    ssid: str = Field(..., min_length=1, max_length=32, description="WiFi SSID")
    password: str = Field(..., min_length=8, description="WiFi password")
    security_mode: str = Field(
        default="WPA2-PSK",
        description="Security mode (WPA2-PSK, WPA3-SAE, etc.)",
    )
    channel: int | None = Field(None, ge=1, le=13, description="WiFi channel")
    enabled: bool = Field(default=True, description="Enable WiFi")


class LANConfig(BaseModel):
    """LAN configuration"""

    ip_address: str = Field(..., description="LAN IP address")
    subnet_mask: str = Field(..., description="Subnet mask")
    dhcp_enabled: bool = Field(default=True, description="Enable DHCP server")
    dhcp_start: str | None = Field(None, description="DHCP pool start")
    dhcp_end: str | None = Field(None, description="DHCP pool end")


class WANConfig(BaseModel):
    """WAN configuration"""

    connection_type: str = Field(..., description="Connection type (DHCP, PPPoE, Static)")
    username: str | None = Field(None, description="PPPoE username")
    password: str | None = Field(None, description="PPPoE password")
    vlan_id: int | None = Field(None, ge=1, le=4094, description="VLAN ID")


class CPEConfigRequest(BaseModel):
    """CPE configuration request"""

    device_id: str = Field(..., description="Device ID")
    wifi: WiFiConfig | None = Field(None, description="WiFi configuration")
    lan: LANConfig | None = Field(None, description="LAN configuration")
    wan: WANConfig | None = Field(None, description="WAN configuration")


# ============================================================================
# Health and Status Schemas
# ============================================================================


class GenieACSHealthResponse(BaseModel):
    """GenieACS health check response"""

    healthy: bool
    message: str
    device_count: int | None = None
    fault_count: int | None = None


class DeviceStatusResponse(BaseModel):
    """Device online/offline status"""

    device_id: str
    online: bool
    last_inform: datetime | None = None
    last_boot: datetime | None = None
    uptime: int | None = None  # Seconds


# ============================================================================
# Statistics Schemas
# ============================================================================


class DeviceStatsResponse(BaseModel):
    """Device statistics"""

    total_devices: int
    online_devices: int
    offline_devices: int
    manufacturers: dict[str, int] = Field(default_factory=dict)
    models: dict[str, int] = Field(default_factory=dict)
