"""
Real-Time Infrastructure Module

Provides WebSocket and Server-Sent Events (SSE) for real-time updates.
"""

from dotmac.platform.realtime.publishers import (
    EventPublisher,
    publish_job_update,
    publish_onu_online,
)
from dotmac.platform.realtime.schemas import (
    AlertEvent,
    AlertSeverity,
    BaseEvent,
    EventType,
    JobProgressEvent,
    JobStatus,
    ONUStatus,
    ONUStatusEvent,
    RADIUSSessionEvent,
    SubscriberEvent,
    TicketEvent,
)
from dotmac.platform.realtime.sse import (
    AlertStream,
    ONUStatusStream,
    SSEStream,
    SubscriberStream,
    TicketStream,
    create_alert_stream,
    create_onu_status_stream,
    create_subscriber_stream,
    create_ticket_stream,
)
from dotmac.platform.realtime.websocket import (
    WebSocketConnection,
    handle_campaign_ws,
    handle_job_ws,
    handle_sessions_ws,
)

__all__ = [
    # Schemas
    "BaseEvent",
    "EventType",
    "ONUStatusEvent",
    "ONUStatus",
    "RADIUSSessionEvent",
    "JobProgressEvent",
    "JobStatus",
    "TicketEvent",
    "AlertEvent",
    "AlertSeverity",
    "SubscriberEvent",
    # Publishers
    "EventPublisher",
    "publish_onu_online",
    "publish_job_update",
    # SSE
    "SSEStream",
    "ONUStatusStream",
    "AlertStream",
    "TicketStream",
    "SubscriberStream",
    "create_onu_status_stream",
    "create_alert_stream",
    "create_ticket_stream",
    "create_subscriber_stream",
    # WebSocket
    "WebSocketConnection",
    "handle_sessions_ws",
    "handle_job_ws",
    "handle_campaign_ws",
]
