"""
GenieACS Pydantic Schemas

Request and response schemas for GenieACS TR-069/CWMP operations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.core.ip_validation import (
    IPv4AddressValidator,
    IPv6AddressValidator,
)

# ============================================================================
# Device Schemas
# ============================================================================


class DeviceQuery(BaseModel):  # BaseModel resolves to Any in isolation
    """Query parameters for device search"""

    model_config = ConfigDict()

    query: dict[str, Any] | None = Field(None, description="MongoDB-style query")
    projection: str | None = Field(None, description="Comma-separated fields")
    skip: int = Field(0, ge=0, description="Records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum records")


class DeviceInfo(BaseModel):  # BaseModel resolves to Any in isolation
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

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DeviceResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Detailed device response"""

    device_id: str = Field(..., description="Device ID")
    device_info: dict[str, Any] = Field(default_factory=dict, description="Device information")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Device parameters")
    tags: list[str] = Field(default_factory=list, description="Device tags")

    model_config = ConfigDict(from_attributes=True)


class DeviceListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Device list response"""

    model_config = ConfigDict()

    devices: list[DeviceInfo]
    total: int
    skip: int
    limit: int


# ============================================================================
# Task Schemas
# ============================================================================


class TaskCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create task for device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    task_name: str = Field(..., description="Task name (refreshObject, setParameterValues, etc.)")
    task_data: dict[str, Any] | None = Field(None, description="Task-specific data")


class RefreshRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Refresh device parameters"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    object_path: str = Field(
        default="InternetGatewayDevice",
        description="TR-069 object path to refresh",
    )


class SetParameterRequest(BaseModel):
    """Set parameter values on device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    parameters: dict[str, Any] = Field(..., description="Parameter path and values")


# Backward compatibility alias for older imports
SetParametersRequest = SetParameterRequest


class DeviceOperationRequest(BaseModel):
    """Generic device operation request (legacy compatibility)."""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    operation: str = Field(..., description="Operation identifier (e.g., factory_reset, reboot)")
    parameters: dict[str, Any] | None = Field(
        default=None, description="Optional operation parameters"
    )


class GetParametersRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Get parameter values from device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    parameter_names: list[str] = Field(..., description="List of parameter paths")


# Backward-compatible alias (singular naming)
GetParameterRequest = GetParametersRequest


class RebootRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Reboot device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")


class FactoryResetRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Factory reset device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")


class FirmwareDownloadRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Download firmware to device"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    file_type: str = Field(
        default="1 Firmware Upgrade Image",
        description="TR-069 file type",
    )
    file_name: str = Field(..., description="File name on GenieACS server")
    target_file_name: str | None = Field(None, description="Target filename on device")


class TaskResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Task creation response"""

    model_config = ConfigDict()

    success: bool
    message: str
    task_id: str | None = None
    details: Any | None = None


class FirmwareUpgradeRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to upgrade firmware on a device."""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    firmware_version: str = Field(..., description="Firmware version to install")
    download_url: str = Field(..., description="URL to firmware image")
    file_type: str | None = Field(
        None, description="TR-069 file type (defaults to firmware upgrade image)"
    )
    target_filename: str | None = Field(None, description="Optional target filename for download")
    schedule_time: str | None = Field(
        None,
        description="ISO timestamp to schedule upgrade (immediate if omitted)",
    )


class BulkFirmwareUpgradeRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Bulk firmware upgrade request for multiple devices."""

    model_config = ConfigDict()

    device_ids: list[str] = Field(..., min_length=1, description="List of device IDs")
    firmware_version: str = Field(..., description="Firmware version to install")
    download_url: str = Field(..., description="URL to firmware image")
    file_type: str | None = Field(None, description="TR-069 file type")
    schedule_time: str | None = Field(None, description="Scheduled execution time (ISO)")


class DiagnosticRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Diagnostic request (ping, traceroute, speed test)."""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    diagnostic_type: str = Field(..., description="Diagnostic type (ping, traceroute, speed_test)")
    target: str | None = Field(None, description="Ping/traceroute target hostname or IP")
    count: int | None = Field(None, description="Number of probes (ping)")
    max_hop_count: int | None = Field(None, description="Maximum hop count (traceroute)")
    test_server: str | None = Field(None, description="Speed test server URL/identifier")


class BulkSetParametersRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Bulk parameter update request."""

    model_config = ConfigDict()

    device_ids: list[str] = Field(..., min_length=1, description="List of device IDs")
    parameters: dict[str, Any] = Field(..., description="Parameters to apply to devices")


class BulkOperationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Generic bulk operation request (reboot, factory_reset, etc.)."""

    model_config = ConfigDict()

    device_ids: list[str] = Field(..., min_length=1, description="List of device IDs")
    operation: str = Field(..., description="Operation to perform on each device")
    parameters: dict[str, Any] | None = Field(None, description="Optional operation parameters")


# ============================================================================
# Preset Schemas
# ============================================================================


class PresetCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create preset configuration"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Preset name")
    channel: str = Field(..., description="Channel (e.g., default)")
    schedule: dict[str, Any] | None = Field(None, description="Schedule configuration")
    events: dict[str, bool] = Field(default_factory=dict, description="Event triggers")
    precondition: str | None = Field(None, description="JavaScript precondition")
    configurations: list[dict[str, Any]] = Field(
        default_factory=list, description="Configuration array"
    )


class PresetUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update preset configuration"""

    model_config = ConfigDict()

    channel: str | None = None
    schedule: dict[str, Any] | None = None
    events: dict[str, bool] | None = None
    precondition: str | None = None
    configurations: list[dict[str, Any]] | None = None


class PresetResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Preset response"""

    preset_id: str = Field(..., alias="_id", description="Preset ID")
    name: str
    channel: str
    events: dict[str, bool]
    configurations: list[dict[str, Any]]

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# Provision Schemas
# ============================================================================


class ProvisionResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Provision script response"""

    provision_id: str = Field(..., alias="_id", description="Provision ID")
    script: str = Field(..., description="JavaScript provision script")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# File Schemas
# ============================================================================


class FileResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """File metadata response"""

    file_id: str = Field(..., alias="_id", description="File ID")
    metadata: dict[str, Any] = Field(default_factory=dict, description="File metadata")
    length: int | None = Field(None, description="File size in bytes")
    upload_date: datetime | None = Field(None, description="Upload date")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# Fault Schemas
# ============================================================================


class FaultResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Fault/error response"""

    fault_id: str = Field(..., alias="_id", description="Fault ID")
    device: str = Field(..., description="Device ID")
    channel: str = Field(..., description="Channel")
    code: str = Field(..., description="Fault code")
    message: str = Field(..., description="Fault message")
    detail: dict[str, Any] | None = Field(None, description="Fault details")
    timestamp: datetime = Field(..., description="Fault timestamp")
    retries: int = Field(default=0, description="Retry count")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# CPE Configuration Schemas
# ============================================================================


class WiFiConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """WiFi configuration"""

    model_config = ConfigDict()

    ssid: str = Field(..., min_length=1, max_length=32, description="WiFi SSID")
    password: str = Field(..., min_length=8, description="WiFi password")
    security_mode: str = Field(
        default="WPA2-PSK",
        description="Security mode (WPA2-PSK, WPA3-SAE, etc.)",
    )
    channel: int | None = Field(None, ge=1, le=13, description="WiFi channel")
    enabled: bool = Field(default=True, description="Enable WiFi")


class LANConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """LAN configuration"""

    model_config = ConfigDict()

    # IPv4 LAN configuration
    ipv4_address: str | None = Field(None, description="LAN IPv4 address")
    subnet_mask: str | None = Field(None, description="IPv4 subnet mask")

    # IPv6 LAN configuration
    ipv6_address: str | None = Field(None, description="LAN IPv6 address")
    ipv6_prefix_length: int | None = Field(None, ge=1, le=128, description="IPv6 prefix length")

    # DHCP configuration (IPv4)
    dhcp_enabled: bool = Field(default=True, description="Enable DHCP server")
    dhcp_start: str | None = Field(None, description="DHCP pool start (IPv4)")
    dhcp_end: str | None = Field(None, description="DHCP pool end (IPv4)")

    # DHCPv6 configuration
    dhcpv6_enabled: bool = Field(default=False, description="Enable DHCPv6 server")

    # Backward compatibility
    ip_address: str | None = Field(None, description="[DEPRECATED] Use ipv4_address instead")

    @field_validator("ipv4_address")
    @classmethod
    def validate_ipv4(cls, v: str | None) -> str | None:
        """Validate IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("ipv6_address")
    @classmethod
    def validate_ipv6(cls, v: str | None) -> str | None:
        """Validate IPv6 address"""
        return IPv6AddressValidator.validate(v)

    @field_validator("dhcp_start", "dhcp_end")
    @classmethod
    def validate_dhcp_ips(cls, v: str | None) -> str | None:
        """Validate DHCP pool IPs"""
        return IPv4AddressValidator.validate(v)

    def model_post_init(self, __context: Any) -> None:
        """Handle backward compatibility for ip_address"""
        if self.ip_address and not self.ipv4_address:
            self.ipv4_address = self.ip_address


class WANConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """WAN configuration"""

    model_config = ConfigDict()

    # Connection type
    connection_type: str = Field(
        ..., description="Connection type (DHCP, PPPoE, Static, DHCPv6, PPPoEv6)"
    )

    # PPPoE credentials (IPv4/IPv6)
    username: str | None = Field(None, description="PPPoE/PPPoEv6 username")
    password: str | None = Field(None, description="PPPoE/PPPoEv6 password")

    # VLAN configuration
    vlan_id: int | None = Field(None, ge=1, le=4094, description="VLAN ID")

    # Static IPv4 configuration
    static_ipv4: str | None = Field(None, description="Static IPv4 address")
    static_ipv4_gateway: str | None = Field(None, description="Static IPv4 gateway")
    static_ipv4_netmask: str | None = Field(None, description="Static IPv4 netmask")

    # Static IPv6 configuration
    static_ipv6: str | None = Field(None, description="Static IPv6 address")
    static_ipv6_gateway: str | None = Field(None, description="Static IPv6 gateway")
    static_ipv6_prefix_length: int | None = Field(
        None, ge=1, le=128, description="Static IPv6 prefix length"
    )

    # IPv6 prefix delegation (DHCPv6-PD)
    ipv6_pd_enabled: bool = Field(default=True, description="Enable IPv6 prefix delegation")
    delegated_ipv6_prefix: str | None = Field(
        None,
        description="Delegated IPv6 prefix from ISP (e.g., 2001:db8:1::/56)",
    )

    @field_validator("static_ipv4", "static_ipv4_gateway", "static_ipv4_netmask")
    @classmethod
    def validate_static_ipv4(cls, v: str | None) -> str | None:
        """Validate static IPv4 addresses"""
        return IPv4AddressValidator.validate(v)

    @field_validator("static_ipv6", "static_ipv6_gateway")
    @classmethod
    def validate_static_ipv6(cls, v: str | None) -> str | None:
        """Validate static IPv6 addresses"""
        return IPv6AddressValidator.validate(v)


class CPEConfigRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """CPE configuration request"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID")
    wifi: WiFiConfig | None = Field(None, description="WiFi configuration")
    lan: LANConfig | None = Field(None, description="LAN configuration")
    wan: WANConfig | None = Field(None, description="WAN configuration")


# ============================================================================
# Health and Status Schemas
# ============================================================================


class GenieACSHealthResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """GenieACS health check response"""

    model_config = ConfigDict()

    healthy: bool
    message: str
    device_count: int | None = None
    fault_count: int | None = None


class DeviceStatusResponse(BaseModel):
    """Device online/offline status"""

    model_config = ConfigDict()

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

    model_config = ConfigDict()

    total_devices: int
    online_devices: int
    offline_devices: int
    manufacturers: dict[str, int] = Field(default_factory=lambda: {})
    models: dict[str, int] = Field(default_factory=lambda: {})


# ============================================================================
# Scheduled Firmware Upgrade Schemas
# ============================================================================


class FirmwareUpgradeSchedule(BaseModel):  # BaseModel resolves to Any in isolation
    """Scheduled firmware upgrade"""

    schedule_id: str | None = Field(None, description="Schedule ID (auto-generated)")
    name: str = Field(..., min_length=1, description="Schedule name")
    description: str | None = Field(None, description="Schedule description")
    firmware_file: str = Field(..., description="Firmware file name on GenieACS")
    file_type: str = Field(default="1 Firmware Upgrade Image", description="TR-069 file type")
    device_filter: dict[str, Any] = Field(..., description="Device filter query (MongoDB-style)")
    scheduled_at: datetime = Field(..., description="Scheduled execution time")
    timezone: str = Field(default="UTC", description="Timezone for scheduled_at")
    max_concurrent: int = Field(default=10, ge=1, le=100, description="Maximum concurrent upgrades")
    status: str = Field(
        default="pending",
        description="Status: pending, queued, running, completed, failed, cancelled",
    )
    created_at: datetime | None = Field(None, description="Creation timestamp")
    started_at: datetime | None = Field(None, description="Execution start time")
    completed_at: datetime | None = Field(None, description="Completion time")

    model_config = ConfigDict(from_attributes=True)


class FirmwareUpgradeResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Firmware upgrade result for a device"""

    device_id: str
    status: str  # success, failed, pending, in_progress
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FirmwareUpgradeScheduleResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Firmware upgrade schedule response"""

    model_config = ConfigDict()

    schedule: FirmwareUpgradeSchedule
    total_devices: int
    completed_devices: int
    failed_devices: int
    pending_devices: int
    results: list[FirmwareUpgradeResult] = Field(default_factory=lambda: [])


class FirmwareUpgradeScheduleCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create firmware upgrade schedule"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, description="Schedule name")
    description: str | None = Field(None, description="Schedule description")
    firmware_file: str = Field(..., description="Firmware file name on GenieACS")
    file_type: str = Field(default="1 Firmware Upgrade Image", description="TR-069 file type")
    device_filter: dict[str, Any] = Field(
        ...,
        description="Device filter query (e.g., {'manufacturer': 'Huawei', 'model': 'HG8245H'})",
    )
    scheduled_at: datetime = Field(..., description="Scheduled execution time (ISO 8601)")
    timezone: str = Field(default="UTC", description="Timezone")
    max_concurrent: int = Field(default=10, ge=1, le=100, description="Maximum concurrent upgrades")


class FirmwareUpgradeScheduleList(BaseModel):  # BaseModel resolves to Any in isolation
    """List of firmware upgrade schedules"""

    model_config = ConfigDict()

    schedules: list[FirmwareUpgradeSchedule]
    total: int


# ============================================================================
# Mass CPE Configuration Schemas
# ============================================================================


class MassConfigFilter(BaseModel):  # BaseModel resolves to Any in isolation
    """Device filter for mass configuration"""

    model_config = ConfigDict()

    query: dict[str, Any] = Field(..., description="MongoDB-style query filter")
    expected_count: int | None = Field(None, description="Expected device count (for validation)")


class MassWiFiConfig(BaseModel):
    """Mass WiFi configuration"""

    model_config = ConfigDict()

    ssid: str | None = Field(None, min_length=1, max_length=32, description="New SSID")
    password: str | None = Field(None, min_length=8, description="New password")
    security_mode: str | None = Field(None, description="Security mode")
    channel: int | None = Field(None, ge=1, le=13, description="WiFi channel")
    enabled: bool | None = Field(None, description="Enable/disable WiFi")


class MassLANConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass LAN configuration"""

    model_config = ConfigDict()

    # IPv4 LAN configuration
    ipv4_address: str | None = Field(None, description="LAN IPv4 address")
    subnet_mask: str | None = Field(None, description="IPv4 subnet mask")

    # IPv6 LAN configuration
    ipv6_address: str | None = Field(None, description="LAN IPv6 address")
    ipv6_prefix_length: int | None = Field(None, ge=1, le=128, description="IPv6 prefix length")

    # DHCP configuration
    dhcp_enabled: bool | None = Field(None, description="Enable/disable DHCP server (IPv4)")
    dhcp_start: str | None = Field(None, description="DHCP pool start (IPv4)")
    dhcp_end: str | None = Field(None, description="DHCP pool end (IPv4)")

    # DHCPv6 configuration
    dhcpv6_enabled: bool | None = Field(None, description="Enable/disable DHCPv6 server")

    @field_validator("ipv4_address")
    @classmethod
    def validate_ipv4(cls, v: str | None) -> str | None:
        """Validate IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("ipv6_address")
    @classmethod
    def validate_ipv6(cls, v: str | None) -> str | None:
        """Validate IPv6 address"""
        return IPv6AddressValidator.validate(v)

    @field_validator("dhcp_start", "dhcp_end")
    @classmethod
    def validate_dhcp_ips(cls, v: str | None) -> str | None:
        """Validate DHCP pool IPs"""
        return IPv4AddressValidator.validate(v)


class MassWANConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass WAN configuration"""

    model_config = ConfigDict()

    connection_type: str | None = Field(
        None, description="Connection type (DHCP, PPPoE, Static, DHCPv6, PPPoEv6)"
    )
    vlan_id: int | None = Field(None, ge=1, le=4094, description="VLAN ID")

    # Static IPv4 configuration
    static_ipv4: str | None = Field(None, description="Static IPv4 address")
    static_ipv4_gateway: str | None = Field(None, description="Static IPv4 gateway")
    static_ipv4_netmask: str | None = Field(None, description="Static IPv4 netmask")

    # Static IPv6 configuration
    static_ipv6: str | None = Field(None, description="Static IPv6 address")
    static_ipv6_gateway: str | None = Field(None, description="Static IPv6 gateway")
    static_ipv6_prefix_length: int | None = Field(
        None, ge=1, le=128, description="Static IPv6 prefix length"
    )

    # IPv6 prefix delegation
    ipv6_pd_enabled: bool | None = Field(None, description="Enable/disable IPv6 prefix delegation")

    @field_validator("static_ipv4", "static_ipv4_gateway", "static_ipv4_netmask")
    @classmethod
    def validate_static_ipv4(cls, v: str | None) -> str | None:
        """Validate static IPv4 addresses"""
        return IPv4AddressValidator.validate(v)

    @field_validator("static_ipv6", "static_ipv6_gateway")
    @classmethod
    def validate_static_ipv6(cls, v: str | None) -> str | None:
        """Validate static IPv6 addresses"""
        return IPv6AddressValidator.validate(v)


class MassConfigRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass CPE configuration request"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, description="Configuration job name")
    description: str | None = Field(None, description="Job description")
    device_filter: MassConfigFilter = Field(..., description="Device filter")
    wifi: MassWiFiConfig | None = Field(None, description="WiFi changes")
    lan: MassLANConfig | None = Field(None, description="LAN changes")
    wan: MassWANConfig | None = Field(None, description="WAN changes")
    custom_parameters: dict[str, Any] | None = Field(
        None, description="Custom TR-069 parameters to set"
    )
    max_concurrent: int = Field(
        default=10, ge=1, le=100, description="Maximum concurrent configuration tasks"
    )
    dry_run: bool = Field(default=False, description="Preview changes without applying them")


class MassConfigResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass configuration result for a device"""

    device_id: str
    status: str  # success, failed, pending, in_progress, skipped
    parameters_changed: dict[str, Any] = Field(default_factory=lambda: {})
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class MassConfigJob(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass configuration job"""

    job_id: str
    name: str
    description: str | None = None
    device_filter: dict[str, Any]
    total_devices: int
    completed_devices: int = 0
    failed_devices: int = 0
    pending_devices: int = 0
    status: str = "pending"  # pending, queued, running, completed, failed, cancelled
    dry_run: bool = False
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class MassConfigResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Mass configuration response"""

    model_config = ConfigDict()

    job: MassConfigJob
    preview: list[str] | None = Field(
        None, description="Device IDs that will be affected (dry run)"
    )
    results: list[MassConfigResult] = Field(default_factory=lambda: [])


class MassConfigJobList(BaseModel):  # BaseModel resolves to Any in isolation
    """List of mass configuration jobs"""

    model_config = ConfigDict()

    jobs: list[MassConfigJob]
    total: int
