"""
Notification Schemas.

Pydantic models for notification API request/response validation.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.notifications.models import (
    NotificationChannel,
    NotificationPriority,
    NotificationType,
)


# Notification Schemas
class NotificationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for notification."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    user_id: UUID
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    action_url: str | None
    action_label: str | None
    related_entity_type: str | None
    related_entity_id: str | None
    channels: list[str]
    is_read: bool
    read_at: datetime | None
    is_archived: bool
    archived_at: datetime | None
    email_sent: bool
    email_sent_at: datetime | None
    sms_sent: bool
    sms_sent_at: datetime | None
    push_sent: bool
    push_sent_at: datetime | None
    notification_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class NotificationCreateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request schema for creating a notification."""

    model_config = ConfigDict()

    user_id: UUID
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1)
    priority: NotificationPriority = NotificationPriority.MEDIUM
    action_url: str | None = Field(None, max_length=1000)
    action_label: str | None = Field(None, max_length=100)
    related_entity_type: str | None = Field(None, max_length=100)
    related_entity_id: str | None = Field(None, max_length=255)
    channels: list[NotificationChannel] | None = None
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class NotificationListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for notification list."""

    model_config = ConfigDict()

    notifications: list[NotificationResponse]
    total: int
    unread_count: int


# Preference Schemas
class NotificationPreferenceResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for notification preferences."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    user_id: UUID
    enabled: bool
    email_enabled: bool
    sms_enabled: bool
    push_enabled: bool
    quiet_hours_enabled: bool
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    quiet_hours_timezone: str | None
    type_preferences: dict[str, Any]
    minimum_priority: NotificationPriority
    email_digest_enabled: bool
    email_digest_frequency: str | None
    created_at: datetime
    updated_at: datetime


class NotificationPreferenceUpdateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request schema for updating notification preferences."""

    model_config = ConfigDict()

    enabled: bool | None = None
    email_enabled: bool | None = None
    sms_enabled: bool | None = None
    push_enabled: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: str | None = Field(None, max_length=5, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: str | None = Field(None, max_length=5, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_timezone: str | None = Field(None, max_length=50)
    type_preferences: dict[str, Any] | None = None
    minimum_priority: NotificationPriority | None = None
    email_digest_enabled: bool | None = None
    email_digest_frequency: str | None = Field(None, max_length=20)


# Template Schemas
class NotificationFromTemplateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request schema for creating notification from template."""

    model_config = ConfigDict()

    user_id: UUID
    type: NotificationType
    variables: dict[str, Any] = Field(default_factory=lambda: {})


# Team Notification Schemas
class TeamNotificationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request schema for notifying a team of users."""

    model_config = ConfigDict()

    team_members: list[UUID] | None = Field(None, description="Specific list of user IDs to notify")
    role_filter: str | None = Field(
        None, description="Role name to filter users (e.g., 'admin', 'support_agent')"
    )
    notification_type: NotificationType = NotificationType.SYSTEM_ALERT
    title: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1)
    priority: NotificationPriority = NotificationPriority.MEDIUM
    action_url: str | None = Field(None, max_length=1000)
    action_label: str | None = Field(None, max_length=100)
    related_entity_type: str | None = Field(None, max_length=100)
    related_entity_id: str | None = Field(None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    auto_send: bool = True


class TeamNotificationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for team notification."""

    model_config = ConfigDict()

    notifications_created: int
    target_count: int
    team_members: list[UUID] | None = None
    role_filter: str | None = None
    notification_type: str
    priority: str
