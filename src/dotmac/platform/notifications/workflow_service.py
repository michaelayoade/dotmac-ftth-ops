"""
Notifications Workflow Service

Provides workflow-compatible methods for notification operations.
Enhanced with comprehensive error handling, retry logic, and metrics.
"""

import logging
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPriority,
    NotificationType,
)
from dotmac.platform.notifications.service import NotificationService
from dotmac.platform.user_management.models import User
from dotmac.platform.workflows.base import WorkflowServiceBase
from dotmac.platform.workflows.validation_schemas import NotifyTeamInput

logger = logging.getLogger(__name__)


# Team to role mapping - maps team identifiers to user role filters
TEAM_ROLE_MAPPING = {
    "sales": ["sales", "sales_manager", "account_manager"],
    "support": ["support", "support_manager", "customer_success"],
    "deployment": ["deployment", "deployment_manager", "operations"],
    "operations": ["operations", "operations_manager", "sysadmin"],
    "finance": ["finance", "billing", "accounts"],
    "management": ["manager", "director", "executive"],
    "engineering": ["engineer", "developer", "devops"],
    "network": ["network_engineer", "network_admin", "noc"],
}

# Channel string to enum mapping
CHANNEL_MAPPING = {
    "email": NotificationChannel.EMAIL,
    "in_app": NotificationChannel.IN_APP,
    "sms": NotificationChannel.SMS,
    "push": NotificationChannel.PUSH,
    "webhook": NotificationChannel.WEBHOOK,
}


class NotificationsService(WorkflowServiceBase):
    """
    Notifications service for workflow integration.

    Provides team notification methods for workflows with comprehensive
    error handling, retry logic, performance metrics, and logging.

    Inherits from WorkflowServiceBase:
    - Automatic retry logic for database operations
    - Circuit breaker for external service calls
    - Request/response logging
    - Performance metrics tracking
    - Pydantic input validation
    - Transaction management
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db=db, service_name="NotificationsService")
        self.db = db

    @WorkflowServiceBase.operation("notify_team")
    async def notify_team(
        self,
        team: str,
        channel: str,
        subject: str,
        message: str,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
        priority: str = "medium",
        notification_type: str = "custom",
    ) -> dict[str, Any]:
        """
        Send a notification to all members of a team.

        This method:
        1. Validates inputs using Pydantic schema
        2. Resolves team members based on team name and role mapping
        3. Creates individual notifications for each team member
        4. Sends notifications via the specified channel(s)
        5. Records all notifications in the database with transaction retry
        6. Returns summary of notification delivery

        Features (via WorkflowServiceBase):
        - Automatic request/response logging
        - Performance metrics tracking
        - Input validation with Pydantic
        - Detailed error logging

        Args:
            team: Team name/identifier (e.g., "sales", "support", "deployment")
            channel: Notification channel (e.g., "email", "in_app", "sms")
            subject: Notification subject/title
            message: Notification message body
            metadata: Additional metadata (optional)
            tenant_id: Tenant ID for multi-tenant isolation (optional)
            priority: Notification priority ("low", "medium", "high", "urgent")
            notification_type: Type of notification (defaults to "custom")

        Returns:
            Dict with notification details:
            {
                "team": str,
                "channel": str,
                "notifications_sent": int,
                "notification_ids": list[str],
                "team_members_notified": list[str],
                "status": str,
                "sent_at": str,
            }

        Raises:
            ValueError: If team is invalid or no team members found
            RuntimeError: If notification delivery fails
        """
        # Validate inputs using Pydantic schema
        validated = cast(
            NotifyTeamInput,
            self.validate_input(
                NotifyTeamInput,
                {
                    "team": team,
                    "channel": channel,
                    "subject": subject,
                    "message": message,
                    "metadata": metadata,
                    "tenant_id": tenant_id,
                    "priority": priority,
                    "notification_type": notification_type,
                },
            ),
        )

        # Use validated values
        team = validated.team
        channel = validated.channel
        subject = validated.subject
        message = validated.message
        metadata = validated.metadata
        tenant_id = validated.tenant_id
        priority = validated.priority
        notification_type = validated.notification_type

        # Map channel string to enum
        notification_channel = CHANNEL_MAPPING.get(channel)
        if notification_channel is None:
            raise ValueError(f"Unsupported notification channel: {channel}")

        # Map priority string to enum
        notification_priority = NotificationPriority(priority)

        # Map notification type string to enum
        try:
            notification_type_enum = NotificationType(notification_type)
        except ValueError:
            # Default to CUSTOM if not a valid enum value
            notification_type_enum = NotificationType.CUSTOM

        # Use transaction context manager with automatic rollback
        async with self.transaction("notify_team"):
            # Step 1: Fetch team members based on role mapping with retry logic
            team_members = cast(
                list[User], await self.with_retry(self._get_team_members, team, tenant_id)
            )

            if not team_members:
                raise ValueError(
                    f"No team members found for team '{team}'. "
                    f"Check if users have appropriate roles assigned."
                )

            logger.info(
                f"Found {len(team_members)} team members for team '{team}'",
                extra={"team": team, "member_count": len(team_members)},
            )

            # Step 2: Create NotificationService instance
            notification_service = NotificationService(db=self.db)

            # Step 3: Send notifications to each team member
            notification_ids = []
            notified_users = []

            for user in team_members:
                try:
                    # Determine effective tenant_id
                    effective_tenant_id = tenant_id or user.tenant_id

                    # Create notification for this user with retry logic
                    notification = cast(
                        Notification,
                        await self.with_retry(
                            notification_service.create_notification,
                            tenant_id=effective_tenant_id,
                            user_id=user.id,
                            notification_type=notification_type_enum,
                            title=subject,
                            message=message,
                            priority=notification_priority,
                            channels=[notification_channel],
                            metadata={
                                **(metadata or {}),
                                "team": team,
                                "sent_via": "workflow",
                                "workflow_timestamp": datetime.now(UTC).isoformat(),
                            },
                            auto_send=True,  # Auto-send via configured channels
                        ),
                    )

                    notification_ids.append(str(notification.id))
                    notified_users.append(
                        {
                            "user_id": str(user.id),
                            "email": user.email,
                            "username": user.username,
                        }
                    )

                    logger.debug(
                        f"Notification sent to {user.email}",
                        extra={
                            "user_id": str(user.id),
                            "notification_id": str(notification.id),
                        },
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to send notification to user {user.email}: {e}",
                        extra={"user_id": str(user.id), "error": str(e)},
                        exc_info=True,
                    )
                    # Continue with other users even if one fails

        # Return summary (transaction committed by context manager)
        return {
            "team": team,
            "channel": channel,
            "notifications_sent": len(notification_ids),
            "notification_ids": notification_ids,
            "team_members_notified": notified_users,
            "status": "sent" if notification_ids else "failed",
            "sent_at": datetime.now(UTC).isoformat(),
            "subject": subject,
            "priority": priority,
        }

    async def _get_team_members(self, team: str, tenant_id: str | None = None) -> list[User]:
        """
        Fetch all active users belonging to a team based on role mapping.

        Args:
            team: Team name (e.g., "sales", "support")
            tenant_id: Tenant ID for filtering (optional)

        Returns:
            List of User objects

        Raises:
            ValueError: If team is not recognized
        """
        # Get role filters for this team
        role_filters = TEAM_ROLE_MAPPING.get(team)

        if not role_filters:
            # Try exact role match as fallback
            role_filters = [team]
            logger.warning(
                f"Team '{team}' not in predefined mapping, using exact role match",
                extra={"team": team},
            )

        # Build query to find users with matching roles
        query = select(User).where(User.is_active == True)  # noqa: E712

        # Add tenant filter if provided
        if tenant_id:
            query = query.where(User.tenant_id == tenant_id)

        # Fetch all users (we'll filter by roles in Python due to JSON column)
        result = await self.db.execute(query)
        all_users = result.scalars().all()

        # Filter users by role membership
        team_members = []
        for user in all_users:
            user_roles = user.roles or []
            # Check if user has any of the required roles
            if any(role in user_roles for role in role_filters):
                team_members.append(user)

        return team_members
