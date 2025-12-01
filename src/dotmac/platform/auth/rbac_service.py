"""
RBAC Service Layer - Handles role and permission management
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.models import (
    Permission,
    PermissionCategory,
    PermissionGrant,
    Role,
    role_permissions,
    user_permissions,
    user_roles,
)
from dotmac.platform.auth.rbac_audit import rbac_audit_logger
from dotmac.platform.core.caching import cache_clear, cache_delete, cache_get, cache_set
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

# Python 3.9/3.10 compatibility: datetime.UTC was added in 3.11
try:
    UTC = datetime.UTC  # type: ignore[attr-defined]
except AttributeError:  # pragma: no cover - older Python versions
    UTC = timezone.utc  # noqa: UP017 - fallback for Python <3.11

logger = logging.getLogger(__name__)


class PermissionSnapshot(Iterable[str]):
    """
    Container for a user's effective permissions, including explicit denies.
    """

    __slots__ = ("allows", "denies")

    def __init__(
        self,
        allows: set[str] | None = None,
        denies: set[str] | None = None,
    ) -> None:
        self.allows: set[str] = set(allows or [])
        self.denies: set[str] = set(denies or [])
        self._prune_conflicting_allows()

    def __iter__(self) -> Iterator[str]:
        return iter(self.allows)

    def __len__(self) -> int:
        return len(self.allows)

    def __contains__(self, item: object) -> bool:
        return item in self.allows

    def _prune_conflicting_allows(self) -> None:
        """Remove allow-listed permissions that are explicitly denied."""
        to_remove = {perm for perm in self.allows if self.is_denied(perm)}
        if to_remove:
            self.allows.difference_update(to_remove)

    def allows_permission(self, permission: str) -> bool:
        return self._matches(self.allows, permission)

    def is_denied(self, permission: str) -> bool:
        return self._matches(self.denies, permission)

    def to_cache_payload(self) -> dict[str, list[str]]:
        return {"allows": list(self.allows), "denies": list(self.denies)}

    @classmethod
    def from_cache_payload(cls, payload: Any) -> PermissionSnapshot | None:
        if isinstance(payload, dict):
            return cls(set(payload.get("allows", [])), set(payload.get("denies", [])))
        if isinstance(payload, list):
            # Backwards compatibility with older cache entries that only stored allows.
            return cls(set(payload), set())
        return None

    def _matches(self, bucket: set[str], permission: str) -> bool:
        if permission in bucket or "*" in bucket:
            return True

        for entry in bucket:
            if not entry.endswith(".*"):
                continue
            prefix = entry[:-2]
            if permission == prefix or permission.startswith(f"{prefix}."):
                return True

        return False


class RBACService:
    """Service for managing roles and permissions"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self._permission_cache: dict[str, Permission] = {}
        self._role_cache: dict[str, Role] = {}

    def _invalidate_user_permission_cache(self, user_id: UUID | str, tenant_id: str | None = None) -> None:
        """Remove cached permissions for a user (clears legacy and new cache keys)."""
        # Legacy keys (no tenant)
        cache_delete(f"user_perms:{user_id}")
        cache_delete(f"user_perms:{user_id}:expired=False")
        cache_delete(f"user_perms:{user_id}:expired=True")
        # Namespaced keys (with tenant)
        tenant_scope = tenant_id or "none"
        cache_delete(f"user_perms:{user_id}:tenant:{tenant_scope}:expired=False")
        cache_delete(f"user_perms:{user_id}:tenant:{tenant_scope}:expired=True")
        # Best-effort clear of any other tracked cache entries for this user
        cache_clear(f"user_perms:{user_id}")

    # ==================== User Permissions ====================

    def _resolve_tenant_scope(self, tenant_id: str | None = None) -> str | None:
        """Resolve tenant scope for permission checks."""
        if tenant_id:
            return tenant_id
        try:
            return get_current_tenant_id()
        except Exception:
            return None

    async def get_user_permissions(
        self, user_id: UUID | str, include_expired: bool = False, tenant_id: str | None = None
    ) -> PermissionSnapshot:
        """Get all permissions for a user (from roles and direct grants)"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)

        tenant_scope = self._resolve_tenant_scope(tenant_id)
        tenant_cache_key = tenant_scope or "none"

        # Include include_expired flag in cache key to prevent cache poisoning
        cache_key = f"user_perms:{user_id}:tenant:{tenant_cache_key}:expired={include_expired}"

        # Check cache first
        cached = cache_get(cache_key)
        snapshot = PermissionSnapshot.from_cache_payload(cached)
        if snapshot is not None:
            return snapshot

        permissions: set[str] = set()
        denied_permissions: set[str] = set()
        now = datetime.now(UTC)

        # Get permissions from roles
        from dotmac.platform.user_management.models import User

        query = (
            select(Permission.name)
            .join(role_permissions)
            .join(Role)
            .join(user_roles)
            .join(User, User.id == user_roles.c.user_id)
            .where(user_roles.c.user_id == user_id)
            .where(Role.is_active)
            .where(Permission.is_active)
        )

        if tenant_scope:
            query = query.where(User.tenant_id == tenant_scope)

        if not include_expired:
            query = query.where(
                or_(user_roles.c.expires_at.is_(None), user_roles.c.expires_at > now)
            )

        role_perms = await self.db.execute(query)
        permissions.update(str(name) for name in role_perms.scalars().all())

        # Get direct user permissions (overrides)
        direct_query = (
            select(Permission.name, user_permissions.c.granted)
            .join(user_permissions)
            .join(User, User.id == user_permissions.c.user_id)
            .where(user_permissions.c.user_id == user_id)
            .where(Permission.is_active)
        )

        if tenant_scope:
            direct_query = direct_query.where(User.tenant_id == tenant_scope)

        if not include_expired:
            direct_query = direct_query.where(
                or_(user_permissions.c.expires_at.is_(None), user_permissions.c.expires_at > now)
            )

        direct_perms = await self.db.execute(direct_query)

        for perm_name, granted in direct_perms.all():
            if granted:
                permissions.add(perm_name)
                denied_permissions.discard(perm_name)
            else:
                permissions.discard(perm_name)  # Revoke permission
                denied_permissions.add(perm_name)

        permissions = await self._include_parent_permissions(permissions)

        snapshot = PermissionSnapshot(permissions, denied_permissions)

        # Cache for 5 minutes
        cache_set(cache_key, snapshot.to_cache_payload(), ttl=300)

        logger.info(f"Loaded {len(snapshot)} permissions for user {user_id}")
        return snapshot

    async def user_has_permission(
        self,
        user_id: UUID | str,
        permission: str,
        is_platform_admin: bool = False,
        tenant_id: str | None = None,
    ) -> bool:
        """Check if user has a specific permission.

        Args:
            user_id: User ID to check
            permission: Permission string to check (e.g., "resource:action")
            is_platform_admin: If True, user has platform admin access (bypasses all checks)

        Returns:
            True if user has the permission
        """
        # Platform admins have all permissions
        if is_platform_admin:
            return True

        user_perms = await self.get_user_permissions(user_id, tenant_id=tenant_id)

        return self._permission_matches(user_perms, permission)

    async def user_has_any_permission(
        self, user_id: UUID | str, permissions: list[str], tenant_id: str | None = None
    ) -> bool:
        """Check if user has any of the specified permissions"""
        # Preserve behaviour for mocked services that override user_has_permission
        bound_impl = getattr(self.user_has_permission, "__func__", None)
        if bound_impl is not RBACService.user_has_permission:
            for perm in permissions:
                if await self.user_has_permission(user_id, perm, tenant_id=tenant_id):
                    return True
            return False

        user_perms = await self.get_user_permissions(user_id, tenant_id=tenant_id)
        return any(self._permission_matches(user_perms, perm) for perm in permissions)

    async def user_has_all_permissions(
        self, user_id: UUID | str, permissions: list[str], tenant_id: str | None = None
    ) -> bool:
        """Check if user has all specified permissions"""
        bound_impl = getattr(self.user_has_permission, "__func__", None)
        if bound_impl is not RBACService.user_has_permission:
            for perm in permissions:
                if not await self.user_has_permission(user_id, perm, tenant_id=tenant_id):
                    return False
            return True

        user_perms = await self.get_user_permissions(user_id, tenant_id=tenant_id)
        return all(self._permission_matches(user_perms, perm) for perm in permissions)

    @staticmethod
    def _permission_matches(snapshot: PermissionSnapshot, permission: str) -> bool:
        """Evaluate whether a permission is satisfied by a user's permission set."""
        if not snapshot:
            return False

        if snapshot.is_denied(permission):
            return False

        return snapshot.allows_permission(permission)

    # ==================== Role Management ====================

    async def get_user_roles(
        self, user_id: UUID | str, include_expired: bool = False
    ) -> list[Role]:
        """Get all roles assigned to a user"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)

        query = (
            select(Role)
            .join(user_roles)
            .where(user_roles.c.user_id == user_id)
            .where(Role.is_active)
        )

        if not include_expired:
            now = datetime.now(UTC)
            query = query.where(
                or_(user_roles.c.expires_at.is_(None), user_roles.c.expires_at > now)
            )

        result = await self.db.execute(query.options(selectinload(Role.permissions)))
        return list(result.scalars().all())

    async def assign_role_to_user(
        self,
        user_id: UUID | str,
        role_name: str,
        granted_by: UUID | str,
        expires_at: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Assign a role to a user"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)
        if isinstance(granted_by, str):
            granted_by = UUID(granted_by)

        # Get role
        role = await self._get_role_by_name(role_name)
        if not role:
            raise AuthorizationError(f"Role '{role_name}' not found")

        # Check if already assigned
        existing = await self.db.execute(
            select(user_roles).where(
                and_(user_roles.c.user_id == user_id, user_roles.c.role_id == role.id)
            )
        )

        if existing.first():
            logger.info(f"Role {role_name} already assigned to user {user_id}")
            return

        # Assign role
        await self.db.execute(
            user_roles.insert().values(
                user_id=user_id,
                role_id=role.id,
                granted_by=granted_by,
                expires_at=expires_at,
                metadata=metadata,
            )
        )

        # Log the grant
        await self._log_permission_grant(
            user_id=user_id,
            role_id=role.id,
            granted_by=granted_by,
            action="grant",
            expires_at=expires_at,
        )

        # Clear cache
        self._invalidate_user_permission_cache(user_id)

        logger.info(f"Assigned role {role_name} to user {user_id}")

        # Audit log the role assignment
        try:
            tenant_id = get_current_tenant_id() or "default"
            await rbac_audit_logger.log_role_assigned(
                user_id=str(user_id),
                role_name=role_name,
                role_id=str(role.id),
                assigned_by=str(granted_by),
                tenant_id=tenant_id,
                expires_at=expires_at.isoformat() if expires_at else None,
                metadata=metadata,
            )
        except Exception as e:
            logger.warning(f"Audit logging failed: {e}")

    async def revoke_role_from_user(
        self,
        user_id: UUID | str,
        role_name: str,
        revoked_by: UUID | str,
        reason: str | None = None,
    ) -> None:
        """Revoke a role from a user"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)
        if isinstance(revoked_by, str):
            revoked_by = UUID(revoked_by)

        role = await self._get_role_by_name(role_name)
        if not role:
            raise AuthorizationError(f"Role '{role_name}' not found")

        # Remove role assignment
        result: Result[Any] = await self.db.execute(
            user_roles.delete().where(
                and_(user_roles.c.user_id == user_id, user_roles.c.role_id == role.id)
            )
        )

        # Result.rowcount is available after execute() for DML statements
        if getattr(result, "rowcount", 0) == 0:
            logger.warning(f"Role {role_name} was not assigned to user {user_id}")
            return

        # Log the revocation
        await self._log_permission_grant(
            user_id=user_id, role_id=role.id, granted_by=revoked_by, action="revoke", reason=reason
        )

        # Clear cache
        self._invalidate_user_permission_cache(user_id)

        logger.info(f"Revoked role {role_name} from user {user_id}")

        # Audit log the role revocation
        try:
            tenant_id = get_current_tenant_id() or "default"
            await rbac_audit_logger.log_role_revoked(
                user_id=str(user_id),
                role_name=role_name,
                role_id=str(role.id),
                revoked_by=str(revoked_by),
                tenant_id=tenant_id,
                reason=reason,
            )
        except Exception as e:
            logger.warning(f"Audit logging failed: {e}")

    # ==================== Permission Management ====================

    async def grant_permission_to_user(
        self,
        user_id: UUID | str,
        permission_name: str,
        granted_by: UUID | str,
        expires_at: datetime | None = None,
        reason: str | None = None,
    ) -> None:
        """Grant a specific permission directly to a user"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)
        if isinstance(granted_by, str):
            granted_by = UUID(granted_by)

        permission = await self._get_permission_by_name(permission_name)
        if not permission:
            raise AuthorizationError(f"Permission '{permission_name}' not found")

        # Check if already granted
        existing = await self.db.execute(
            select(user_permissions).where(
                and_(
                    user_permissions.c.user_id == user_id,
                    user_permissions.c.permission_id == permission.id,
                )
            )
        )

        if existing.first():
            # Update existing grant
            await self.db.execute(
                user_permissions.update()
                .where(
                    and_(
                        user_permissions.c.user_id == user_id,
                        user_permissions.c.permission_id == permission.id,
                    )
                )
                .values(
                    granted=True,
                    granted_by=granted_by,
                    expires_at=expires_at,
                    reason=reason,
                    granted_at=datetime.now(UTC),
                )
            )
        else:
            # Create new grant
            await self.db.execute(
                user_permissions.insert().values(
                    user_id=user_id,
                    permission_id=permission.id,
                    granted=True,
                    granted_by=granted_by,
                    expires_at=expires_at,
                    reason=reason,
                )
            )

        # Log the grant
        await self._log_permission_grant(
            user_id=user_id,
            permission_id=permission.id,
            granted_by=granted_by,
            action="grant",
            expires_at=expires_at,
            reason=reason,
        )

        # Clear cache (need to clear both cache keys for expired=True and expired=False)
        self._invalidate_user_permission_cache(user_id)

        logger.info(f"Granted permission {permission_name} to user {user_id}")

        # Audit log the permission grant
        try:
            tenant_id = get_current_tenant_id() or "default"
            await rbac_audit_logger.log_permission_granted(
                user_id=str(user_id),
                permission_name=permission_name,
                permission_id=str(permission.id),
                granted_by=str(granted_by),
                tenant_id=tenant_id,
                expires_at=expires_at.isoformat() if expires_at else None,
                reason=reason,
            )
        except Exception as e:
            logger.warning(f"Audit logging failed: {e}")

    async def revoke_permission_from_user(
        self,
        user_id: UUID | str,
        permission_name: str,
        revoked_by: UUID | str,
        reason: str | None = None,
    ) -> None:
        """Revoke a specific permission directly from a user"""
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            user_id = UUID(user_id)
        if isinstance(revoked_by, str):
            revoked_by = UUID(revoked_by)

        permission = await self._get_permission_by_name(permission_name)
        if not permission:
            raise AuthorizationError(f"Permission '{permission_name}' not found")

        # Remove the permission grant
        result: Result[Any] = await self.db.execute(
            user_permissions.delete().where(
                and_(
                    user_permissions.c.user_id == user_id,
                    user_permissions.c.permission_id == permission.id,
                )
            )
        )

        # Result.rowcount is available after execute() for DML statements
        if getattr(result, "rowcount", 0) == 0:
            logger.warning(f"Permission {permission_name} was not granted to user {user_id}")
            return

        # Log the revocation
        await self._log_permission_grant(
            user_id=user_id,
            permission_id=permission.id,
            granted_by=revoked_by,
            action="revoke",
            reason=reason,
        )

        # Clear cache
        self._invalidate_user_permission_cache(user_id)

        logger.info(f"Revoked permission {permission_name} from user {user_id}")

        # Audit log the permission revocation
        try:
            tenant_id = get_current_tenant_id() or "default"
            await rbac_audit_logger.log_permission_revoked(
                user_id=str(user_id),
                permission_name=permission_name,
                permission_id=str(permission.id),
                revoked_by=str(revoked_by),
                tenant_id=tenant_id,
                reason=reason,
            )
        except Exception as e:
            logger.warning(f"Audit logging failed: {e}")

    # ==================== Role/Permission CRUD ====================

    async def create_role(
        self,
        name: str,
        display_name: str,
        description: str | None = None,
        permissions: list[str] | None = None,
        parent_role: str | None = None,
        is_default: bool = False,
    ) -> Role:
        """Create a new role"""
        # Check if role exists
        existing = await self._get_role_by_name(name)
        if existing:
            raise AuthorizationError(f"Role '{name}' already exists")

        # Get parent role if specified
        parent = None
        if parent_role:
            parent = await self._get_role_by_name(parent_role)
            if not parent:
                raise AuthorizationError(f"Parent role '{parent_role}' not found")

        # Create role
        role = Role(
            name=name,
            display_name=display_name,
            description=description,
            parent_id=parent.id if parent else None,
            is_default=is_default,
        )
        self.db.add(role)
        await self.db.flush()

        # Add permissions - refresh role with permissions relationship to avoid lazy loading
        if permissions:
            await self.db.refresh(role, ["permissions"])
            perm_objects = []
            for perm_name in permissions:
                perm = await self._get_permission_by_name(perm_name)
                if perm:
                    perm_objects.append(perm)
            role.permissions.extend(perm_objects)
            await self.db.flush()

        logger.info(f"Created role: {name}")
        return role

    async def create_permission(
        self,
        name: str,
        display_name: str,
        category: PermissionCategory,
        description: str | None = None,
        parent_permission: str | None = None,
    ) -> Permission:
        """Create a new permission"""
        # Check if permission exists
        existing = await self._get_permission_by_name(name)
        if existing:
            raise AuthorizationError(f"Permission '{name}' already exists")

        # Get parent permission if specified
        parent = None
        if parent_permission:
            parent = await self._get_permission_by_name(parent_permission)
            if not parent:
                raise AuthorizationError(f"Parent permission '{parent_permission}' not found")

        # Create permission
        permission = Permission(
            name=name,
            display_name=display_name,
            category=category,
            description=description,
            parent_id=parent.id if parent else None,
        )
        self.db.add(permission)
        await self.db.flush()

        logger.info(f"Created permission: {name}")
        return permission

    # ==================== Helper Methods ====================

    async def _get_role_by_name(self, name: str) -> Role | None:
        """Get role by name (cached)"""
        if name in self._role_cache:
            return self._role_cache[name]

        result = await self.db.execute(select(Role).where(Role.name == name))
        role = result.scalar_one_or_none()

        if role:
            self._role_cache[name] = role

        return role

    async def _get_permission_by_name(self, name: str) -> Permission | None:
        """Get permission by name (cached)"""
        if name in self._permission_cache:
            return self._permission_cache[name]

        result = await self.db.execute(select(Permission).where(Permission.name == name))
        permission = result.scalar_one_or_none()

        if permission:
            self._permission_cache[name] = permission

        return permission

    async def _include_parent_permissions(self, permissions: set[str]) -> set[str]:
        """Add parent permissions defined via the permission hierarchy."""
        expanded = set(permissions)

        for perm_name in list(permissions):
            permission_record = await self._get_permission_by_name(perm_name)
            if permission_record and permission_record.parent_id:
                parent = await self.db.get(Permission, permission_record.parent_id)
                if parent:
                    expanded.add(parent.name)

        return expanded

    async def _log_permission_grant(
        self,
        user_id: UUID,
        role_id: UUID | None = None,
        permission_id: UUID | None = None,
        granted_by: UUID | None = None,
        action: str = "grant",
        expires_at: datetime | None = None,
        reason: str | None = None,
    ) -> None:
        """Log permission grant/revoke for audit trail"""
        grant_log = PermissionGrant(
            user_id=user_id,
            role_id=role_id,
            permission_id=permission_id,
            granted_by=granted_by,
            action=action,
            expires_at=expires_at,
            reason=reason,
            metadata={
                "ip_address": "system",  # Would get from request context
                "user_agent": "system",
            },
        )
        self.db.add(grant_log)


# ==================== Dependency Functions ====================


async def get_rbac_service(db: AsyncSession = Depends(get_async_session)) -> RBACService:
    """Dependency to get RBAC service"""
    return RBACService(db)


# Preserve original method references for test environments that temporarily monkeypatch them.
ORIGINAL_USER_HAS_ALL_PERMISSIONS = RBACService.user_has_all_permissions
ORIGINAL_USER_HAS_PERMISSION = RBACService.user_has_permission
