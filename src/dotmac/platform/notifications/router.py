"""
Notification API Router.

Provides REST API endpoints for user notifications and preferences.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, ensure_uuid, get_current_user
from dotmac.platform.core.exceptions import NotFoundError
from dotmac.platform.database import get_async_session as get_db
from dotmac.platform.notifications.models import NotificationPriority, NotificationType
from dotmac.platform.notifications.schemas import (
    NotificationCreateRequest,
    NotificationFromTemplateRequest,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
    NotificationResponse,
    TeamNotificationRequest,
    TeamNotificationResponse,
)
from dotmac.platform.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _ensure_tenant_id(user: UserInfo) -> str:
    """Ensure user has a tenant_id and return it."""
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for notifications",
        )
    return user.tenant_id


# Notification Endpoints
@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    priority: NotificationPriority | None = None,
    notification_type: NotificationType | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Get current user's notifications with filters.

    Supports filtering by:
    - unread_only: Only show unread notifications
    - priority: Filter by priority level
    - notification_type: Filter by notification type
    - offset/limit: Pagination
    """
    service = NotificationService(db)

    user_uuid = ensure_uuid(current_user.user_id)

    notifications = await service.get_user_notifications(
        tenant_id=_ensure_tenant_id(current_user),
        user_id=user_uuid,
        unread_only=unread_only,
        priority=priority,
        notification_type=notification_type,
        offset=offset,
        limit=limit,
    )

    unread_count = await service.get_unread_count(
        tenant_id=_ensure_tenant_id(current_user), user_id=user_uuid
    )

    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=len(notifications),
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=dict[str, int])
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, int]:
    """Get count of unread notifications for current user."""
    service = NotificationService(db)

    count = await service.get_unread_count(
        tenant_id=_ensure_tenant_id(current_user), user_id=ensure_uuid(current_user.user_id)
    )

    return {"unread_count": count}


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    request: NotificationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Create a notification for a user.

    This endpoint is typically used by system/admin users to send
    notifications to other users. Regular users would receive notifications
    automatically from system events.
    """
    service = NotificationService(db)

    try:
        notification = await service.create_notification(
            tenant_id=_ensure_tenant_id(current_user),
            user_id=request.user_id,
            notification_type=request.type,
            title=request.title,
            message=request.message,
            priority=request.priority,
            action_url=request.action_url,
            action_label=request.action_label,
            related_entity_type=request.related_entity_type,
            related_entity_id=request.related_entity_id,
            channels=request.channels,
            metadata=request.metadata,
            auto_send=True,
        )
        await db.commit()

        return NotificationResponse.model_validate(notification)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/from-template", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED
)
async def create_notification_from_template(
    request: NotificationFromTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Create a notification from a template.

    Templates allow consistent notification formatting and support
    variable substitution for dynamic content.
    """
    service = NotificationService(db)

    try:
        notification = await service.create_from_template(
            tenant_id=_ensure_tenant_id(current_user),
            user_id=request.user_id,
            notification_type=request.type,
            variables=request.variables,
            auto_send=True,
        )
        await db.commit()

        return NotificationResponse.model_validate(notification)
    except NotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """Mark a specific notification as read."""
    service = NotificationService(db)

    try:
        notification = await service.mark_as_read(
            tenant_id=_ensure_tenant_id(current_user),
            user_id=ensure_uuid(current_user.user_id),
            notification_id=notification_id,
        )
        await db.commit()

        return NotificationResponse.model_validate(notification)
    except NotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/read-all", response_model=dict[str, int])
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, int]:
    """Mark all notifications as read for current user."""
    service = NotificationService(db)

    try:
        count = await service.mark_all_as_read(
            tenant_id=_ensure_tenant_id(current_user), user_id=ensure_uuid(current_user.user_id)
        )
        await db.commit()

        return {"marked_read": count}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{notification_id}/archive", response_model=NotificationResponse)
async def archive_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """Archive a notification (remove from main inbox)."""
    service = NotificationService(db)

    try:
        notification = await service.archive_notification(
            tenant_id=_ensure_tenant_id(current_user),
            user_id=ensure_uuid(current_user.user_id),
            notification_id=notification_id,
        )
        await db.commit()

        return NotificationResponse.model_validate(notification)
    except NotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Preference Endpoints
@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """Get notification preferences for current user."""
    service = NotificationService(db)

    preferences = await service.get_user_preferences(
        tenant_id=_ensure_tenant_id(current_user), user_id=ensure_uuid(current_user.user_id)
    )

    return NotificationPreferenceResponse.model_validate(preferences)


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    request: NotificationPreferenceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Update notification preferences for current user.

    Allows users to:
    - Enable/disable notifications globally
    - Configure per-channel preferences (email, SMS, push)
    - Set quiet hours
    - Configure per-type preferences
    - Set minimum priority threshold
    """
    service = NotificationService(db)

    try:
        preferences = await service.update_user_preferences(
            tenant_id=_ensure_tenant_id(current_user),
            user_id=ensure_uuid(current_user.user_id),
            enabled=request.enabled,
            email_enabled=request.email_enabled,
            sms_enabled=request.sms_enabled,
            push_enabled=request.push_enabled,
            quiet_hours_enabled=request.quiet_hours_enabled,
            quiet_hours_start=request.quiet_hours_start,
            quiet_hours_end=request.quiet_hours_end,
            type_preferences=request.type_preferences,
            minimum_priority=request.minimum_priority,
        )
        await db.commit()

        return NotificationPreferenceResponse.model_validate(preferences)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Statistics Endpoint
@router.get("/stats", response_model=dict[str, Any])
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get notification statistics for current user.

    Returns breakdown of notifications by:
    - Status (read/unread)
    - Priority level
    - Type
    """
    service = NotificationService(db)

    # Get all notifications
    user_uuid = ensure_uuid(current_user.user_id)

    all_notifications = await service.get_user_notifications(
        tenant_id=_ensure_tenant_id(current_user),
        user_id=user_uuid,
        unread_only=False,
        offset=0,
        limit=1000,
    )

    unread_count = await service.get_unread_count(
        tenant_id=_ensure_tenant_id(current_user), user_id=user_uuid
    )

    # Count by priority
    priority_counts = {
        "low": 0,
        "medium": 0,
        "high": 0,
        "urgent": 0,
    }
    for n in all_notifications:
        priority_counts[n.priority.value] += 1

    # Count by type (top 5)
    type_counts: dict[str, int] = {}
    for n in all_notifications:
        type_counts[n.type.value] = type_counts.get(n.type.value, 0) + 1

    top_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total": len(all_notifications),
        "unread": unread_count,
        "read": len(all_notifications) - unread_count,
        "by_priority": priority_counts,
        "top_types": dict(top_types),
    }


# Team Notification Endpoint
@router.post("/team", response_model=TeamNotificationResponse, status_code=status.HTTP_201_CREATED)
async def notify_team(
    request: TeamNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Send notifications to a team of users.

    Supports two modes:
    1. Specific team members: Provide list of user IDs in `team_members`
    2. Role-based: Provide `role_filter` to notify all users with that role

    At least one of `team_members` or `role_filter` must be provided.

    Example requests:

    1. Notify specific team members:
    ```json
    {
        "team_members": ["uuid1", "uuid2", "uuid3"],
        "title": "System Maintenance Alert",
        "message": "Scheduled maintenance tonight at 10 PM",
        "priority": "high"
    }
    ```

    2. Notify by role:
    ```json
    {
        "role_filter": "support_agent",
        "title": "New Ticket Assigned",
        "message": "High priority ticket requires attention",
        "priority": "urgent"
    }
    ```
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user must be associated with a tenant",
        )

    service = NotificationService(db)

    try:
        notifications = await service.notify_team(
            tenant_id=_ensure_tenant_id(current_user),
            team_members=request.team_members,
            role_filter=request.role_filter,
            notification_type=request.notification_type,
            title=request.title,
            message=request.message,
            priority=request.priority,
            action_url=request.action_url,
            action_label=request.action_label,
            related_entity_type=request.related_entity_type,
            related_entity_id=request.related_entity_id,
            metadata=request.metadata,
            auto_send=request.auto_send,
        )

        return TeamNotificationResponse(
            notifications_created=len(notifications),
            target_count=len(request.team_members) if request.team_members else len(notifications),
            team_members=request.team_members,
            role_filter=request.role_filter,
            notification_type=request.notification_type.value,
            priority=request.priority.value,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send team notifications: {str(e)}",
        )
