"""
Better Auth Integration Service for FastAPI.

This module provides session validation and user data extraction from Better Auth.
Better Auth stores sessions in PostgreSQL tables and uses cookie-based authentication.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo

if TYPE_CHECKING:
    from dotmac.platform.auth.rbac_service import RBACService

logger = structlog.get_logger(__name__)

# Permission matrix aligned to frontend/shared/lib/better-auth/auth.ts.
# Stored permissions are flattened as "<resource>:<action>" strings.
_ROLE_PERMISSION_MATRIX: dict[str, dict[str, list[str]]] = {
    "super_admin": {
        "users": ["create", "read", "update", "delete"],
        "customers": ["create", "read", "update", "delete"],
        "subscribers": ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
        "network": ["read", "configure", "monitor"],
        "billing": ["read", "manage", "payments"],
        "tickets": ["create", "read", "update", "assign"],
        "organization": ["read", "update", "delete", "members", "billing"],
        "reports": ["view", "export"],
    },
    "platform_admin": {
        "users": ["read", "update"],
        "organization": ["read", "update"],
        "reports": ["view", "export"],
    },
    "tenant_owner": {
        "users": ["create", "read", "update", "delete"],
        "customers": ["create", "read", "update", "delete"],
        "subscribers": ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
        "network": ["read", "configure", "monitor"],
        "billing": ["read", "manage", "payments"],
        "tickets": ["create", "read", "update", "assign"],
        "organization": ["read", "update", "members", "billing"],
        "reports": ["view", "export"],
    },
    "tenant_admin": {
        "users": ["create", "read", "update"],
        "customers": ["create", "read", "update"],
        "subscribers": ["create", "read", "update", "provision", "suspend"],
        "network": ["read", "monitor"],
        "billing": ["read"],
        "tickets": ["create", "read", "update", "assign"],
        "organization": ["read"],
        "reports": ["view"],
    },
    "tenant_member": {
        "customers": ["read"],
        "subscribers": ["read"],
        "network": ["read"],
        "billing": ["read"],
        "tickets": ["create", "read"],
        "organization": ["read"],
    },
    "network_admin": {
        "network": ["read", "configure", "monitor"],
        "subscribers": ["read", "provision", "suspend"],
        "tickets": ["read", "update"],
    },
    "support_agent": {
        "customers": ["read"],
        "subscribers": ["read"],
        "tickets": ["create", "read", "update"],
        "billing": ["read"],
    },
    "technician": {
        "network": ["read", "monitor"],
        "subscribers": ["read"],
        "tickets": ["read", "update"],
    },
    "sales_manager": {
        "customers": ["create", "read", "update"],
        "subscribers": ["create", "read"],
        "reports": ["view"],
    },
    "billing_manager": {
        "billing": ["read", "manage", "payments"],
        "customers": ["read"],
        "subscribers": ["read"],
        "reports": ["view", "export"],
    },
    "customer": {
        "subscribers": ["read"],
        "billing": ["read"],
        "tickets": ["create", "read"],
    },
    "reseller_owner": {
        "customers": ["create", "read", "update"],
        "subscribers": ["create", "read", "update"],
        "billing": ["read"],
        "tickets": ["create", "read"],
        "organization": ["read", "update", "members"],
        "reports": ["view"],
    },
    "reseller_admin": {
        "customers": ["create", "read", "update"],
        "subscribers": ["create", "read", "update"],
        "billing": ["read"],
        "tickets": ["create", "read"],
        "organization": ["read"],
    },
    "reseller_agent": {
        "customers": ["create", "read"],
        "subscribers": ["read"],
        "tickets": ["create", "read"],
    },
}

ROLE_PERMISSIONS: dict[str, list[str]] = {
    role: [f"{resource}:{action}" for resource, actions in resources.items() for action in actions]
    for role, resources in _ROLE_PERMISSION_MATRIX.items()
}


class BetterAuthService:
    """Service for validating Better Auth sessions and extracting user data."""

    def __init__(self, db: AsyncSession, rbac_service: "RBACService | None" = None):
        """Initialize with database session.

        Args:
            db: AsyncSession for querying Better Auth tables
            rbac_service: Optional RBAC service for syncing roles
        """
        self.db = db
        self.rbac_service = rbac_service

    async def validate_session(
        self,
        session_token: str,
        tenant_id: str | None = None,
    ) -> UserInfo | None:
        """Validate a Better Auth session token and return user info.

        Better Auth stores sessions with the following structure:
        - session table: id, user_id, token, expires_at, etc.
        - user table: id, email, name, email_verified, etc.
        - account table: user_id, provider, provider_account_id, etc.
        - organization_member table: user_id, organization_id, role, permissions
        - tenant_id: optional tenant context to scope membership selection

        Args:
            session_token: The session token from cookie
            tenant_id: Optional tenant context (e.g., X-Active-Tenant-Id) to
                select the matching organization membership

        Returns:
            UserInfo if session is valid, None otherwise
        """
        try:
            # Query Better Auth session table
            # Better Auth session tokens are stored in the 'session' table
            query = text("""
                SELECT
                    s.user_id,
                    s.expires_at,
                    u.email,
                    u.name as username,
                    u.email_verified
                FROM "session" s
                JOIN "user" u ON s.user_id = u.id
                WHERE s.token = :token
                AND s.expires_at > :now
                LIMIT 1
            """)

            result = await self.db.execute(
                query,
                {"token": session_token, "now": datetime.now(UTC)}
            )
            session_data = result.fetchone()

            if not session_data:
                logger.debug("Better Auth session not found or expired", token=session_token[:10] + "...")
                return None

            # Extract session data
            user_id = str(session_data[0])  # Convert UUID to string
            email = session_data[2]
            username = session_data[3] or email.split("@")[0]  # Fallback to email prefix

            # Query organization memberships and roles
            org_query = text("""
                SELECT
                    om.organization_id as tenant_id,
                    om.role,
                    o.name as org_name
                FROM "organization_member" om
                JOIN "organization" o ON om.organization_id = o.id
                WHERE om.user_id = :user_id
            """)

            org_result = await self.db.execute(org_query, {"user_id": user_id})
            org_memberships = org_result.fetchall()

            selected_membership = None
            if tenant_id:
                # Prefer membership that matches the requested tenant context
                selected_membership = next(
                    (row for row in org_memberships if str(row[0]) == tenant_id),
                    None,
                )

            if tenant_id and not selected_membership:
                logger.warning(
                    "Requested tenant_id not found in Better Auth memberships",
                    user_id=user_id,
                    requested_tenant_id=tenant_id,
                )
                return None

            if not tenant_id and not selected_membership and org_memberships:
                # Fallback to first membership for backwards compatibility when no tenant specified
                selected_membership = org_memberships[0]

            # Extract tenant and role info
            resolved_tenant_id = None
            roles = []
            permissions = []

            if selected_membership:
                resolved_tenant_id = str(selected_membership[0])  # organization_id becomes tenant_id
                role = selected_membership[1]  # role from Better Auth

                # Map Better Auth roles to our system roles
                roles = self._map_better_auth_role(role)

                # Get permissions for this role from Better Auth configuration
                permissions = self._get_role_permissions_for_role(role)
            else:
                # No organization membership - assign default role
                roles = ["user"]
                permissions = []

            # Check if user is platform admin (super_admin role in Better Auth)
            is_platform_admin = "super_admin" in roles or "platform_admin" in roles

            # Sync user to our database if not already synced
            # This ensures Better Auth users have corresponding records in our User table
            try:
                from dotmac.platform.auth.better_auth_sync import sync_better_auth_user
                await sync_better_auth_user(
                    user_id,
                    self.db,
                    rbac_service=self.rbac_service,
                )
                logger.debug("User synced from Better Auth to local database", user_id=user_id)
            except Exception as sync_error:
                # Don't fail authentication if sync fails
                # User can still be authenticated via Better Auth session
                logger.warning("Failed to sync user to local database", user_id=user_id, error=str(sync_error))

            logger.info(
                "Better Auth session validated",
                user_id=user_id,
                email=email,
                roles=roles,
                tenant_id=resolved_tenant_id
            )

            return UserInfo(
                user_id=user_id,
                email=email,
                username=username,
                roles=roles,
                permissions=permissions,
                tenant_id=resolved_tenant_id,
                is_platform_admin=is_platform_admin,
            )

        except Exception as e:
            logger.error("Error validating Better Auth session", error=str(e), exc_info=True)
            return None

    def _map_better_auth_role(self, better_auth_role: str) -> list[str]:
        """Map Better Auth organization role to our system roles.

        Better Auth roles from frontend/shared/lib/better-auth/auth.ts:
        - super_admin
        - platform_admin
        - tenant_owner
        - tenant_admin
        - tenant_member
        - network_admin
        - support_agent
        - technician
        - sales_manager
        - billing_manager
        - customer
        - reseller_owner
        - reseller_admin
        - reseller_agent

        Args:
            better_auth_role: Role from Better Auth organization

        Returns:
            List of roles compatible with our RBAC system
        """
        # Better Auth uses single role per org membership
        # Our system supports multiple roles, so return as list
        return [better_auth_role] if better_auth_role else ["user"]

    def _get_role_permissions_for_role(self, role: str | None) -> list[str]:
        """Return permissions for a given Better Auth role."""
        if not role:
            return []

        return ROLE_PERMISSIONS.get(role, [])


async def get_better_auth_user(
    session_token: str,
    db: AsyncSession,
    tenant_id: str | None = None,
    rbac_service: "RBACService | None" = None,
) -> UserInfo | None:
    """Get user info from Better Auth session token.

    This is a helper function for use in FastAPI dependencies.

    Args:
        session_token: Better Auth session token from cookie
        db: Database session
        tenant_id: Optional tenant context to scope organization membership
        rbac_service: Optional RBAC service for syncing roles

    Returns:
        UserInfo if valid session, None otherwise
    """
    service = BetterAuthService(db, rbac_service=rbac_service)
    return await service.validate_session(session_token, tenant_id=tenant_id)
