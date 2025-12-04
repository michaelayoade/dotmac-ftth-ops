"""
GraphQL subscription types for Customer 360° real-time updates.

These types are used for WebSocket-based real-time data streaming.
"""

from datetime import datetime
from decimal import Decimal

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
    ipv4_address: str | None
    ipv6_address: str | None
    mac_address: str | None
    vlan_id: int | None

    # Signal quality
    signal_strength: int | None
    signal_quality: int | None
    uptime_seconds: int | None
    uptime_percentage: Decimal | None

    # Performance metrics
    bandwidth_usage_mbps: Decimal | None
    download_speed_mbps: Decimal | None
    upload_speed_mbps: Decimal | None
    packet_loss: Decimal | None
    latency_ms: int | None
    jitter: Decimal | None

    # OLT/PON metrics
    ont_rx_power: Decimal | None
    ont_tx_power: Decimal | None
    olt_rx_power: Decimal | None

    # Service status
    service_status: str | None

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
    last_seen_at: datetime | None

    # Performance metrics
    signal_strength: int | None
    temperature: int | None
    cpu_usage: int | None
    memory_usage: int | None
    uptime_seconds: int | None

    # Firmware
    firmware_version: str | None
    needs_firmware_update: bool

    # What changed
    change_type: str  # "status" | "health" | "performance" | "firmware"
    previous_value: str | None
    new_value: str | None

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
    description: str | None
    status: str
    priority: str
    category: str | None
    sub_category: str | None

    # Assignment
    assigned_to: str | None
    assigned_to_name: str | None
    assigned_team: str | None

    # Dates
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None

    # Customer
    customer_id: str
    customer_name: str | None


@strawberry.type
class CustomerTicketUpdate:
    """Real-time ticket update notification."""

    customer_id: str
    action: str  # "created" | "updated" | "assigned" | "resolved" | "closed" | "commented"
    ticket: CustomerTicketUpdateData

    # Who made the change
    changed_by: str | None
    changed_by_name: str | None

    # What changed
    changes: list[str] | None  # ["status: open -> resolved", "assigned_to: user123"]

    # Comment (if action is "commented")
    comment: str | None

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
    description: str | None
    performed_by: str | None
    performed_by_name: str | None
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
    created_by_name: str | None
    created_at: datetime
    updated_at: datetime


@strawberry.type
class CustomerNoteUpdate:
    """Real-time note update notification."""

    customer_id: str
    action: str  # "created" | "updated" | "deleted"
    note: CustomerNoteData | None

    # Who made the change
    changed_by: str
    changed_by_name: str | None

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
    previous_plan: str | None
    bandwidth_mbps: int | None
    monthly_fee: Decimal | None

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
    invoice_id: str | None
    invoice_number: str | None
    payment_id: str | None
    amount: Decimal | None
    currency: str | None

    # Balance changes
    outstanding_balance: Decimal | None
    overdue_balance: Decimal | None

    # Timestamp
    updated_at: datetime
