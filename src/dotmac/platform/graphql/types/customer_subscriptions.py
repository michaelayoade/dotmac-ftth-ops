"""
GraphQL subscription types for Customer 360° real-time updates.

These types are used for WebSocket-based real-time data streaming.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

import strawberry


# ============================================================================
# Network Status Types
# ============================================================================


@strawberry.type
class CustomerNetworkStatusUpdate:
    """Real-time network status update for a customer."""

    customer_id: str
    connection_status: str  # "online" | "offline" | "degraded"
    last_seen_at: datetime

    # IP and network configuration
    ipv4_address: Optional[str]
    ipv6_address: Optional[str]
    mac_address: Optional[str]
    vlan_id: Optional[int]

    # Signal quality
    signal_strength: Optional[int]
    signal_quality: Optional[int]
    uptime_seconds: Optional[int]
    uptime_percentage: Optional[Decimal]

    # Performance metrics
    bandwidth_usage_mbps: Optional[Decimal]
    download_speed_mbps: Optional[Decimal]
    upload_speed_mbps: Optional[Decimal]
    packet_loss: Optional[Decimal]
    latency_ms: Optional[int]
    jitter: Optional[Decimal]

    # OLT/PON metrics
    ont_rx_power: Optional[Decimal]
    ont_tx_power: Optional[Decimal]
    olt_rx_power: Optional[Decimal]

    # Service status
    service_status: Optional[str]

    # Timestamp of this update
    updated_at: datetime


# ============================================================================
# Device Status Types
# ============================================================================


@strawberry.type
class CustomerDeviceUpdate:
    """Real-time device status update."""

    customer_id: str
    device_id: str
    device_type: str  # "ONT" | "Router" | "CPE" | "Modem"
    device_name: str

    # Status change
    status: str  # "active" | "inactive" | "faulty"
    health_status: str  # "healthy" | "warning" | "critical"
    is_online: bool
    last_seen_at: Optional[datetime]

    # Performance metrics
    signal_strength: Optional[int]
    temperature: Optional[int]
    cpu_usage: Optional[int]
    memory_usage: Optional[int]
    uptime_seconds: Optional[int]

    # Firmware
    firmware_version: Optional[str]
    needs_firmware_update: bool

    # What changed
    change_type: str  # "status" | "health" | "performance" | "firmware"
    previous_value: Optional[str]
    new_value: Optional[str]

    # Timestamp
    updated_at: datetime


# ============================================================================
# Ticket Update Types
# ============================================================================


@strawberry.type
class CustomerTicketUpdateData:
    """Ticket data in subscription update."""

    id: str
    ticket_number: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    category: Optional[str]
    sub_category: Optional[str]

    # Assignment
    assigned_to: Optional[str]
    assigned_to_name: Optional[str]
    assigned_team: Optional[str]

    # Dates
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]

    # Customer
    customer_id: str
    customer_name: Optional[str]


@strawberry.type
class CustomerTicketUpdate:
    """Real-time ticket update notification."""

    customer_id: str
    action: str  # "created" | "updated" | "assigned" | "resolved" | "closed" | "commented"
    ticket: CustomerTicketUpdateData

    # Who made the change
    changed_by: Optional[str]
    changed_by_name: Optional[str]

    # What changed
    changes: Optional[List[str]]  # ["status: open -> resolved", "assigned_to: user123"]

    # Comment (if action is "commented")
    comment: Optional[str]

    # Timestamp
    updated_at: datetime


# ============================================================================
# Activity Update Types
# ============================================================================


@strawberry.type
class CustomerActivityUpdate:
    """Real-time activity added notification."""

    id: str
    customer_id: str
    activity_type: str
    title: str
    description: Optional[str]
    performed_by: Optional[str]
    performed_by_name: Optional[str]
    created_at: datetime


# ============================================================================
# Note Update Types
# ============================================================================


@strawberry.type
class CustomerNoteData:
    """Note data in subscription update."""

    id: str
    customer_id: str
    subject: str
    content: str
    is_internal: bool
    created_by_id: str
    created_by_name: Optional[str]
    created_at: datetime
    updated_at: datetime


@strawberry.type
class CustomerNoteUpdate:
    """Real-time note update notification."""

    customer_id: str
    action: str  # "created" | "updated" | "deleted"
    note: Optional[CustomerNoteData]

    # Who made the change
    changed_by: str
    changed_by_name: Optional[str]

    # Timestamp
    updated_at: datetime


# ============================================================================
# Subscription Summary Types
# ============================================================================


@strawberry.type
class CustomerSubscriptionUpdate:
    """Real-time subscription change notification."""

    customer_id: str
    action: str  # "activated" | "upgraded" | "downgraded" | "canceled" | "paused" | "renewed"

    subscription_id: str
    plan_name: str
    previous_plan: Optional[str]
    bandwidth_mbps: Optional[int]
    monthly_fee: Optional[Decimal]

    # Effective date
    effective_date: datetime

    # Timestamp
    updated_at: datetime


# ============================================================================
# Billing Update Types
# ============================================================================


@strawberry.type
class CustomerBillingUpdate:
    """Real-time billing update notification."""

    customer_id: str
    action: str  # "invoice_created" | "payment_received" | "payment_failed" | "overdue"

    # Invoice/Payment details
    invoice_id: Optional[str]
    invoice_number: Optional[str]
    payment_id: Optional[str]
    amount: Optional[Decimal]
    currency: Optional[str]

    # Balance changes
    outstanding_balance: Optional[Decimal]
    overdue_balance: Optional[Decimal]

    # Timestamp
    updated_at: datetime
