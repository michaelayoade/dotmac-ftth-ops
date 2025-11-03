"""
GraphQL types for RADIUS subscribers and sessions.

Provides types for ISP subscriber management and session tracking.
"""

from datetime import datetime

import strawberry


@strawberry.type
class Session:
    """RADIUS accounting session."""

    radacctid: int
    username: str
    nasipaddress: str
    acctsessionid: str
    acctsessiontime: int | None
    acctinputoctets: int | None
    acctoutputoctets: int | None
    acctstarttime: datetime | None
    acctstoptime: datetime | None


@strawberry.type
class Subscriber:
    """RADIUS subscriber with authentication credentials."""

    id: int
    subscriber_id: str
    username: str
    enabled: bool
    framed_ip_address: str | None
    bandwidth_profile_id: str | None
    created_at: datetime | None
    updated_at: datetime | None

    # Related sessions will be loaded via DataLoader
    sessions: list[Session] = strawberry.field(default_factory=list)


@strawberry.type
class SubscriberMetrics:
    """Aggregated metrics for RADIUS subscribers."""

    total_count: int
    enabled_count: int
    disabled_count: int
    active_sessions_count: int
    total_data_usage_mb: float
