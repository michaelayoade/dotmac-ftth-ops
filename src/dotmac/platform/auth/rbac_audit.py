"""
RBAC audit logging helper for tracking permission and role changes.
"""

from typing import Any

import structlog

from ..audit.models import ActivitySeverity, ActivityType
from ..audit.service import AuditService

logger = structlog.get_logger(__name__)


class RBACAuditLogger:
    """Helper class for RBAC-related audit logging."""

    def __init__(self, audit_service: AuditService | None = None) -> None:
        """Initialize RBAC audit logger."""
        self._audit_service = audit_service or AuditService()

    async def log_role_created(
        self,
        role_name: str,
        role_id: str,
        created_by: str,
        tenant_id: str,
        permissions: list[str],
        **kwargs: Any,
    ) -> None:
        """Log role creation."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.ROLE_CREATED,
            action="create_role",
            description=f"Created role '{role_name}' with {len(permissions)} permissions",
            user_id=created_by,
            tenant_id=tenant_id,
            resource_type="role",
            resource_id=role_id,
            severity=ActivitySeverity.MEDIUM,
            details={"role_name": role_name, "permissions": permissions, **kwargs},
        )
        logger.info("Audit: Role created", role_name=role_name, created_by=created_by)

    async def log_role_updated(
        self,
        role_name: str,
        role_id: str,
        updated_by: str,
        tenant_id: str,
        changes: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        """Log role update."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.ROLE_UPDATED,
            action="update_role",
            description=f"Updated role '{role_name}'",
            user_id=updated_by,
            tenant_id=tenant_id,
            resource_type="role",
            resource_id=role_id,
            severity=ActivitySeverity.MEDIUM,
            details={"role_name": role_name, "changes": changes, **kwargs},
        )
        logger.info("Audit: Role updated", role_name=role_name, updated_by=updated_by)

    async def log_role_deleted(
        self, role_name: str, role_id: str, deleted_by: str, tenant_id: str, **kwargs: Any
    ) -> None:
        """Log role deletion."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.ROLE_DELETED,
            action="delete_role",
            description=f"Deleted role '{role_name}'",
            user_id=deleted_by,
            tenant_id=tenant_id,
            resource_type="role",
            resource_id=role_id,
            severity=ActivitySeverity.HIGH,
            details={"role_name": role_name, **kwargs},
        )
        logger.info("Audit: Role deleted", role_name=role_name, deleted_by=deleted_by)

    async def log_role_assigned(
        self,
        user_id: str,
        role_name: str,
        role_id: str,
        assigned_by: str,
        tenant_id: str,
        **kwargs: Any,
    ) -> None:
        """Log role assignment to user."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.ROLE_ASSIGNED,
            action="assign_role",
            description=f"Assigned role '{role_name}' to user",
            user_id=assigned_by,
            tenant_id=tenant_id,
            resource_type="user",
            resource_id=user_id,
            severity=ActivitySeverity.MEDIUM,
            details={
                "target_user_id": user_id,
                "role_name": role_name,
                "role_id": role_id,
                **kwargs,
            },
        )
        logger.info(
            "Audit: Role assigned", user_id=user_id, role_name=role_name, assigned_by=assigned_by
        )

    async def log_role_revoked(
        self,
        user_id: str,
        role_name: str,
        role_id: str,
        revoked_by: str,
        tenant_id: str,
        **kwargs: Any,
    ) -> None:
        """Log role revocation from user."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.ROLE_REVOKED,
            action="revoke_role",
            description=f"Revoked role '{role_name}' from user",
            user_id=revoked_by,
            tenant_id=tenant_id,
            resource_type="user",
            resource_id=user_id,
            severity=ActivitySeverity.MEDIUM,
            details={
                "target_user_id": user_id,
                "role_name": role_name,
                "role_id": role_id,
                **kwargs,
            },
        )
        logger.info(
            "Audit: Role revoked", user_id=user_id, role_name=role_name, revoked_by=revoked_by
        )

    async def log_permission_granted(
        self,
        user_id: str,
        permission_name: str,
        permission_id: str,
        granted_by: str,
        tenant_id: str,
        expires_at: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Log direct permission grant to user."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.PERMISSION_GRANTED,
            action="grant_permission",
            description=f"Granted permission '{permission_name}' to user",
            user_id=granted_by,
            tenant_id=tenant_id,
            resource_type="user",
            resource_id=user_id,
            severity=ActivitySeverity.MEDIUM,
            details={
                "target_user_id": user_id,
                "permission_name": permission_name,
                "permission_id": permission_id,
                "expires_at": expires_at,
                **kwargs,
            },
        )
        logger.info(
            "Audit: Permission granted",
            user_id=user_id,
            permission_name=permission_name,
            granted_by=granted_by,
        )

    async def log_permission_revoked(
        self,
        user_id: str,
        permission_name: str,
        permission_id: str,
        revoked_by: str,
        tenant_id: str,
        **kwargs: Any,
    ) -> None:
        """Log direct permission revocation from user."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.PERMISSION_REVOKED,
            action="revoke_permission",
            description=f"Revoked permission '{permission_name}' from user",
            user_id=revoked_by,
            tenant_id=tenant_id,
            resource_type="user",
            resource_id=user_id,
            severity=ActivitySeverity.MEDIUM,
            details={
                "target_user_id": user_id,
                "permission_name": permission_name,
                "permission_id": permission_id,
                **kwargs,
            },
        )
        logger.info(
            "Audit: Permission revoked",
            user_id=user_id,
            permission_name=permission_name,
            revoked_by=revoked_by,
        )

    async def log_permission_created(
        self,
        permission_name: str,
        permission_id: str,
        created_by: str,
        tenant_id: str,
        category: str,
        **kwargs: Any,
    ) -> None:
        """Log permission creation."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.PERMISSION_CREATED,
            action="create_permission",
            description=f"Created permission '{permission_name}' in category '{category}'",
            user_id=created_by,
            tenant_id=tenant_id,
            resource_type="permission",
            resource_id=permission_id,
            severity=ActivitySeverity.LOW,
            details={"permission_name": permission_name, "category": category, **kwargs},
        )
        logger.info(
            "Audit: Permission created", permission_name=permission_name, created_by=created_by
        )

    async def log_permission_updated(
        self,
        permission_name: str,
        permission_id: str,
        updated_by: str,
        tenant_id: str,
        changes: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        """Log permission update."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.PERMISSION_UPDATED,
            action="update_permission",
            description=f"Updated permission '{permission_name}'",
            user_id=updated_by,
            tenant_id=tenant_id,
            resource_type="permission",
            resource_id=permission_id,
            severity=ActivitySeverity.LOW,
            details={"permission_name": permission_name, "changes": changes, **kwargs},
        )
        logger.info(
            "Audit: Permission updated", permission_name=permission_name, updated_by=updated_by
        )

    async def log_permission_deleted(
        self,
        permission_name: str,
        permission_id: str,
        deleted_by: str,
        tenant_id: str,
        **kwargs: Any,
    ) -> None:
        """Log permission deletion."""
        await self._audit_service.log_activity(
            activity_type=ActivityType.PERMISSION_DELETED,
            action="delete_permission",
            description=f"Deleted permission '{permission_name}'",
            user_id=deleted_by,
            tenant_id=tenant_id,
            resource_type="permission",
            resource_id=permission_id,
            severity=ActivitySeverity.HIGH,
            details={"permission_name": permission_name, **kwargs},
        )
        logger.info(
            "Audit: Permission deleted", permission_name=permission_name, deleted_by=deleted_by
        )


# Global instance for easy access
rbac_audit_logger = RBACAuditLogger()
