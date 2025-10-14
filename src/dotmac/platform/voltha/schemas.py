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
