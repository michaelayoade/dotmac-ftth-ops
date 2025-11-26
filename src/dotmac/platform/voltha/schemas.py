"""
VOLTHA Pydantic Schemas

Request and response schemas for VOLTHA PON management.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# Device Schemas
# ============================================================================


class DeviceType(BaseModel):  # BaseModel resolves to Any in isolation
    """Device type information"""

    id: str
    vendor: str | None = None
    model: str | None = None
    adapter: str | None = None

    model_config = ConfigDict(from_attributes=True)


class Port(BaseModel):  # BaseModel resolves to Any in isolation
    """Device port information"""

    port_no: int
    label: str | None = None
    type: str | None = None
    admin_state: str | None = None
    oper_status: str | None = None
    device_id: str | None = None
    peers: list[dict[str, Any]] = Field(default_factory=lambda: [])

    model_config = ConfigDict(from_attributes=True)


class Device(BaseModel):  # BaseModel resolves to Any in isolation
    """Physical device (ONU)"""

    id: str
    type: str | None = None
    root: bool = False
    parent_id: str | None = None
    parent_port_no: int | None = None
    vendor: str | None = None
    model: str | None = None
    hardware_version: str | None = None
    firmware_version: str | None = None
    serial_number: str | None = None
    adapter: str | None = None
    vlan: int | None = None
    admin_state: str | None = None
    oper_status: str | None = None
    connect_status: str | None = None
    reason: str | None = None
    metadata: dict[str, Any] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class DeviceListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Device list response"""

    model_config = ConfigDict()

    devices: list[Device]
    total: int


class DeviceDetailResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Device detail response"""

    model_config = ConfigDict()

    device: Device
    ports: list[Port] = Field(default_factory=lambda: [])


# ============================================================================
# Logical Device Schemas (OLTs)
# ============================================================================


class LogicalPort(BaseModel):  # BaseModel resolves to Any in isolation
    """Logical port information"""

    id: str
    ofp_port: dict[str, Any] | None = None
    device_id: str | None = None
    device_port_no: int | None = None

    model_config = ConfigDict(from_attributes=True)


class LogicalDevice(BaseModel):  # BaseModel resolves to Any in isolation
    """Logical device (OLT)"""

    id: str
    datapath_id: str | None = None
    desc: dict[str, Any] | None = None
    switch_features: dict[str, Any] | None = None
    root_device_id: str | None = None
    ports: list[dict[str, Any]] = Field(default_factory=list)
    flows: list[dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LogicalDeviceListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Logical device list response"""

    model_config = ConfigDict()

    devices: list[LogicalDevice]
    total: int


class LogicalDeviceDetailResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Logical device detail response"""

    model_config = ConfigDict()

    device: LogicalDevice
    ports: list[LogicalPort] = Field(default_factory=lambda: [])
    flows: list[dict[str, Any]] = Field(default_factory=lambda: [])


# ============================================================================
# Flow Schemas
# ============================================================================


class Flow(BaseModel):  # BaseModel resolves to Any in isolation
    """OpenFlow entry"""

    id: str | None = None
    table_id: int | None = None
    priority: int | None = None
    cookie: int | None = None
    match: dict[str, Any] | None = None
    instructions: list[dict[str, Any]] = Field(default_factory=lambda: [])

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Adapter Schemas
# ============================================================================


class Adapter(BaseModel):  # BaseModel resolves to Any in isolation
    """Device adapter information"""

    id: str
    vendor: str | None = None
    version: str | None = None
    config: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Operation Schemas
# ============================================================================


class DeviceEnableRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Enable device request"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID to enable")


class DeviceDisableRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Disable device request"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID to disable")


class DeviceRebootRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Reboot device request"""

    model_config = ConfigDict()

    device_id: str = Field(..., description="Device ID to reboot")


class DeviceOperationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Device operation response"""

    model_config = ConfigDict()

    success: bool
    message: str
    device_id: str


# ============================================================================
# Statistics Schemas
# ============================================================================


class PONStatistics(BaseModel):  # BaseModel resolves to Any in isolation
    """PON network statistics"""

    model_config = ConfigDict()

    total_olts: int = 0
    active_olts: int = 0
    total_onus: int = 0
    active_onus: int = 0
    online_onus: int = 0
    offline_onus: int = 0
    total_flows: int = 0
    total_ports: int = 0
    active_ports: int = 0
    adapters: list[str] = Field(default_factory=lambda: [])


# ============================================================================
# Health Schemas
# ============================================================================


class VOLTHAHealthResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """VOLTHA health check response"""

    model_config = ConfigDict()

    healthy: bool
    state: str
    message: str
    total_devices: int | None = None
    alarm_actions_enabled: bool | None = Field(
        default=None, description="Indicates whether alarm acknowledge/clear is enabled"
    )


# ============================================================================
# ONU Auto-Discovery Schemas
# ============================================================================


class DiscoveredONU(BaseModel):  # BaseModel resolves to Any in isolation
    """Discovered ONU information"""

    serial_number: str
    vendor_id: str | None = None
    vendor_specific: str | None = None
    olt_device_id: str
    pon_port: int
    onu_id: int | None = None
    discovered_at: str  # ISO timestamp
    status: str = "discovered"  # discovered, provisioning, provisioned, failed

    model_config = ConfigDict(from_attributes=True)


class ONUDiscoveryResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """ONU discovery response"""

    model_config = ConfigDict()

    discovered: list[DiscoveredONU]
    total: int
    olt_device_id: str | None = None


class ONUProvisionRequest(BaseModel):
    """ONU provision request"""

    model_config = ConfigDict()

    serial_number: str = Field(..., description="ONU serial number")
    olt_device_id: str = Field(..., description="Parent OLT device ID")
    pon_port: int = Field(..., description="PON port number")
    subscriber_id: str | None = Field(None, description="Subscriber ID to associate")
    vlan: int | None = Field(
        None, description="Service VLAN (C-TAG for single VLAN, S-VLAN for QinQ)"
    )
    bandwidth_profile: str | None = Field(None, description="Bandwidth profile name")
    qinq_enabled: bool = Field(False, description="Enable QinQ (802.1ad) double VLAN tagging")
    inner_vlan: int | None = Field(None, description="Customer VLAN (C-VLAN) for QinQ mode")


class ONUProvisionResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """ONU provision response"""

    model_config = ConfigDict()

    success: bool
    message: str
    device_id: str | None = None
    serial_number: str
    olt_device_id: str
    pon_port: int


class ONUAutoDiscoveryConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """ONU auto-discovery configuration"""

    model_config = ConfigDict()

    enabled: bool = True
    polling_interval_seconds: int = Field(default=60, description="Polling interval for discovery")
    auto_provision: bool = Field(default=False, description="Auto-provision discovered ONUs")
    default_vlan: int | None = Field(None, description="Default service VLAN")
    default_bandwidth_profile: str | None = Field(None, description="Default bandwidth profile")


# ============================================================================
# Alarm/Event Schemas
# ============================================================================


class VOLTHAAlarmSeverity(str):
    """VOLTHA alarm severity levels"""

    INDETERMINATE = "INDETERMINATE"
    WARNING = "WARNING"
    MINOR = "MINOR"
    MAJOR = "MAJOR"
    CRITICAL = "CRITICAL"


class VOLTHAAlarmCategory(str):
    """VOLTHA alarm categories"""

    PON = "PON"
    OLT = "OLT"
    ONU = "ONU"
    NNI = "NNI"


class VOLTHAAlarm(BaseModel):  # BaseModel resolves to Any in isolation
    """VOLTHA alarm/event"""

    id: str
    type: str
    category: str
    severity: str
    state: str  # RAISED, CLEARED
    resource_id: str  # Device ID
    description: str | None = None
    context: dict[str, Any] = Field(default_factory=lambda: {})
    raised_ts: str  # ISO timestamp
    changed_ts: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VOLTHAAlarmListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """VOLTHA alarm list response"""

    model_config = ConfigDict()

    alarms: list[VOLTHAAlarm]
    total: int
    active: int
    cleared: int


class VOLTHAEventType(str):
    """VOLTHA event types"""

    ONU_DISCOVERED = "onu_discovered"
    ONU_ACTIVATED = "onu_activated"
    ONU_DEACTIVATED = "onu_deactivated"
    ONU_LOSS_OF_SIGNAL = "onu_los"
    OLT_PORT_UP = "olt_port_up"
    OLT_PORT_DOWN = "olt_port_down"
    DEVICE_STATE_CHANGE = "device_state_change"


class VOLTHAEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """VOLTHA event"""

    id: str
    event_type: str
    category: str
    resource_id: str  # Device ID
    description: str | None = None
    context: dict[str, Any] = Field(default_factory=lambda: {})
    timestamp: str  # ISO timestamp

    model_config = ConfigDict(from_attributes=True)


class VOLTHAEventStreamResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """VOLTHA event stream response"""

    model_config = ConfigDict()

    events: list[VOLTHAEvent]
    total: int


# ============================================================================
# Alarm Operations Schemas
# ============================================================================


class AlarmAcknowledgeRequest(BaseModel):
    """Request to acknowledge an alarm"""

    model_config = ConfigDict()

    acknowledged_by: str = Field(..., description="User who acknowledged the alarm")
    note: str | None = Field(None, description="Optional note about acknowledgement")


class AlarmClearRequest(BaseModel):
    """Request to clear an alarm"""

    model_config = ConfigDict()

    cleared_by: str = Field(..., description="User who cleared the alarm")
    note: str | None = Field(None, description="Optional note about clearing")


class AlarmOperationResponse(BaseModel):
    """Response from alarm acknowledge/clear operation"""

    model_config = ConfigDict()

    success: bool
    message: str
    alarm_id: str
    operation: str  # "acknowledge" or "clear"
    timestamp: str  # ISO timestamp


# ============================================================================
# Bandwidth Profile Schemas
# ============================================================================


class BandwidthProfile(BaseModel):  # BaseModel resolves to Any in isolation
    """Bandwidth profile (meter) configuration"""

    name: str = Field(..., description="Profile name")
    committed_information_rate: int = Field(..., description="CIR in kbps (guaranteed bandwidth)")
    committed_burst_size: int = Field(..., description="CBS in bytes (burst allowance)")
    peak_information_rate: int | None = Field(None, description="PIR in kbps (maximum bandwidth)")
    peak_burst_size: int | None = Field(None, description="PBS in bytes (peak burst allowance)")
    meter_id: int | None = Field(None, description="Meter ID (assigned by VOLTHA)")

    model_config = ConfigDict(from_attributes=True)


class BandwidthProfileRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to create/update bandwidth profile"""

    model_config = ConfigDict()

    name: str
    committed_information_rate: int = Field(..., ge=0, description="CIR in kbps")
    committed_burst_size: int = Field(..., ge=0, description="CBS in bytes")
    peak_information_rate: int | None = Field(None, ge=0, description="PIR in kbps")
    peak_burst_size: int | None = Field(None, ge=0, description="PBS in bytes")


class BandwidthProfileResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response after creating/updating bandwidth profile"""

    model_config = ConfigDict()

    success: bool
    message: str
    profile: BandwidthProfile | None = None
    meter_id: int | None = None


# ============================================================================
# Technology Profile Schemas
# ============================================================================


class TechnologyProfile(BaseModel):  # BaseModel resolves to Any in isolation
    """Technology profile configuration"""

    profile_id: int = Field(..., description="Technology profile ID")
    profile_type: str = Field(..., description="Profile type (XGSPON, GPON, EPON)")
    version: int = Field(default=1, description="Profile version")
    num_gem_ports: int = Field(default=1, description="Number of GEM ports")
    instance_control: dict[str, Any] = Field(
        default_factory=dict, description="Instance control parameters"
    )
    us_scheduler: dict[str, Any] = Field(default_factory=dict, description="Upstream scheduler")
    ds_scheduler: dict[str, Any] = Field(default_factory=dict, description="Downstream scheduler")
    upstream_gem_port_attribute_list: list[dict[str, Any]] = Field(
        default_factory=list, description="Upstream GEM port attributes"
    )
    downstream_gem_port_attribute_list: list[dict[str, Any]] = Field(
        default_factory=list, description="Downstream GEM port attributes"
    )

    model_config = ConfigDict(from_attributes=True)


class TechnologyProfileRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to assign technology profile"""

    model_config = ConfigDict()

    profile_id: int = Field(..., description="Technology profile ID")
    profile_type: str = Field(default="XGSPON", description="Profile type")


class TechnologyProfileResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response after assigning technology profile"""

    model_config = ConfigDict()

    success: bool
    message: str
    profile_id: int | None = None
    device_id: str | None = None


# ============================================================================
# VLAN Configuration Schemas
# ============================================================================


class VLANConfiguration(BaseModel):  # BaseModel resolves to Any in isolation
    """VLAN configuration for ONU"""

    c_vlan: int = Field(..., ge=1, le=4094, description="Customer VLAN (C-TAG)")
    s_vlan: int | None = Field(None, ge=1, le=4094, description="Service VLAN (S-TAG)")
    vlan_mode: str = Field(
        default="transparent", description="VLAN mode (transparent, single-tag, double-tag)"
    )
    priority: int = Field(default=0, ge=0, le=7, description="VLAN priority (802.1p)")

    model_config = ConfigDict(from_attributes=True)


class VLANConfigurationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to configure VLAN"""

    model_config = ConfigDict()

    c_vlan: int = Field(..., ge=1, le=4094, description="Customer VLAN")
    s_vlan: int | None = Field(None, ge=1, le=4094, description="Service VLAN (optional)")
    vlan_mode: str = Field(default="transparent")
    priority: int = Field(default=0, ge=0, le=7)


class VLANConfigurationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response after configuring VLAN"""

    model_config = ConfigDict()

    success: bool
    message: str
    configuration: VLANConfiguration | None = None


# ============================================================================
# Service Configuration (Combined)
# ============================================================================


class ServiceConfiguration(BaseModel):  # BaseModel resolves to Any in isolation
    """Complete service configuration for ONU"""

    vlan: VLANConfiguration
    bandwidth_profile: BandwidthProfile
    technology_profile_id: int = Field(default=64, description="Technology profile ID")

    model_config = ConfigDict(from_attributes=True)


class ServiceConfigurationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to configure ONU service"""

    model_config = ConfigDict()

    vlan_config: VLANConfigurationRequest
    bandwidth_config: BandwidthProfileRequest
    technology_profile_id: int = Field(default=64)


class ServiceConfigurationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response after configuring ONU service"""

    model_config = ConfigDict()

    success: bool
    message: str
    device_id: str
    configuration: ServiceConfiguration | None = None
    errors: list[str] = Field(default_factory=lambda: [])
