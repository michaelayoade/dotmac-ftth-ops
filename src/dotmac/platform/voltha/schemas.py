"""
VOLTHA Pydantic Schemas

Request and response schemas for VOLTHA PON management.
"""

from typing import Any

from pydantic import BaseModel, Field

# ============================================================================
# Device Schemas
# ============================================================================


class DeviceType(BaseModel):
    """Device type information"""

    id: str
    vendor: str | None = None
    model: str | None = None
    adapter: str | None = None

    model_config = {"from_attributes": True}


class Port(BaseModel):
    """Device port information"""

    port_no: int
    label: str | None = None
    type: str | None = None
    admin_state: str | None = None
    oper_status: str | None = None
    device_id: str | None = None
    peers: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class Device(BaseModel):
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

    model_config = {"from_attributes": True}


class DeviceListResponse(BaseModel):
    """Device list response"""

    devices: list[Device]
    total: int


class DeviceDetailResponse(BaseModel):
    """Device detail response"""

    device: Device
    ports: list[Port] = Field(default_factory=list)


# ============================================================================
# Logical Device Schemas (OLTs)
# ============================================================================


class LogicalPort(BaseModel):
    """Logical port information"""

    id: str
    ofp_port: dict[str, Any] | None = None
    device_id: str | None = None
    device_port_no: int | None = None

    model_config = {"from_attributes": True}


class LogicalDevice(BaseModel):
    """Logical device (OLT)"""

    id: str
    datapath_id: str | None = None
    desc: dict[str, Any] | None = None
    switch_features: dict[str, Any] | None = None
    root_device_id: str | None = None

    model_config = {"from_attributes": True}


class LogicalDeviceListResponse(BaseModel):
    """Logical device list response"""

    devices: list[LogicalDevice]
    total: int


class LogicalDeviceDetailResponse(BaseModel):
    """Logical device detail response"""

    device: LogicalDevice
    ports: list[LogicalPort] = Field(default_factory=list)
    flows: list[dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# Flow Schemas
# ============================================================================


class Flow(BaseModel):
    """OpenFlow entry"""

    id: str | None = None
    table_id: int | None = None
    priority: int | None = None
    cookie: int | None = None
    match: dict[str, Any] | None = None
    instructions: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ============================================================================
# Adapter Schemas
# ============================================================================


class Adapter(BaseModel):
    """Device adapter information"""

    id: str
    vendor: str | None = None
    version: str | None = None
    config: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# Operation Schemas
# ============================================================================


class DeviceEnableRequest(BaseModel):
    """Enable device request"""

    device_id: str = Field(..., description="Device ID to enable")


class DeviceDisableRequest(BaseModel):
    """Disable device request"""

    device_id: str = Field(..., description="Device ID to disable")


class DeviceRebootRequest(BaseModel):
    """Reboot device request"""

    device_id: str = Field(..., description="Device ID to reboot")


class DeviceOperationResponse(BaseModel):
    """Device operation response"""

    success: bool
    message: str
    device_id: str


# ============================================================================
# Statistics Schemas
# ============================================================================


class PONStatistics(BaseModel):
    """PON network statistics"""

    total_olts: int = 0
    total_onus: int = 0
    online_onus: int = 0
    offline_onus: int = 0
    total_flows: int = 0
    adapters: list[str] = Field(default_factory=list)


# ============================================================================
# Health Schemas
# ============================================================================


class VOLTHAHealthResponse(BaseModel):
    """VOLTHA health check response"""

    healthy: bool
    state: str
    message: str
    total_devices: int | None = None


# ============================================================================
# ONU Auto-Discovery Schemas
# ============================================================================


class DiscoveredONU(BaseModel):
    """Discovered ONU information"""

    serial_number: str
    vendor_id: str | None = None
    vendor_specific: str | None = None
    olt_device_id: str
    pon_port: int
    onu_id: int | None = None
    discovered_at: str  # ISO timestamp
    status: str = "discovered"  # discovered, provisioning, provisioned, failed

    model_config = {"from_attributes": True}


class ONUDiscoveryResponse(BaseModel):
    """ONU discovery response"""

    discovered: list[DiscoveredONU]
    total: int
    olt_device_id: str | None = None


class ONUProvisionRequest(BaseModel):
    """ONU provision request"""

    serial_number: str = Field(..., description="ONU serial number")
    olt_device_id: str = Field(..., description="Parent OLT device ID")
    pon_port: int = Field(..., description="PON port number")
    subscriber_id: str | None = Field(None, description="Subscriber ID to associate")
    vlan: int | None = Field(None, description="Service VLAN")
    bandwidth_profile: str | None = Field(None, description="Bandwidth profile name")


class ONUProvisionResponse(BaseModel):
    """ONU provision response"""

    success: bool
    message: str
    device_id: str | None = None
    serial_number: str
    olt_device_id: str
    pon_port: int


class ONUAutoDiscoveryConfig(BaseModel):
    """ONU auto-discovery configuration"""

    enabled: bool = True
    polling_interval_seconds: int = Field(
        default=60, description="Polling interval for discovery"
    )
    auto_provision: bool = Field(
        default=False, description="Auto-provision discovered ONUs"
    )
    default_vlan: int | None = Field(None, description="Default service VLAN")
    default_bandwidth_profile: str | None = Field(
        None, description="Default bandwidth profile"
    )


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


class VOLTHAAlarm(BaseModel):
    """VOLTHA alarm/event"""

    id: str
    type: str
    category: str
    severity: str
    state: str  # RAISED, CLEARED
    resource_id: str  # Device ID
    description: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    raised_ts: str  # ISO timestamp
    changed_ts: str | None = None

    model_config = {"from_attributes": True}


class VOLTHAAlarmListResponse(BaseModel):
    """VOLTHA alarm list response"""

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


class VOLTHAEvent(BaseModel):
    """VOLTHA event"""

    id: str
    event_type: str
    category: str
    resource_id: str  # Device ID
    description: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    timestamp: str  # ISO timestamp

    model_config = {"from_attributes": True}


class VOLTHAEventStreamResponse(BaseModel):
    """VOLTHA event stream response"""

    events: list[VOLTHAEvent]
    total: int
