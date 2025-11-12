"""
Better Auth Integration Service for FastAPI.

This module provides session validation and user data extraction from Better Auth.
Better Auth stores sessions in PostgreSQL tables and uses cookie-based authentication.
"""

from datetime import UTC, datetime

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo

logger = structlog.get_logger(__name__)


class BetterAuthService:
    """Service for validating Better Auth sessions and extracting user data."""

    def __init__(self, db: AsyncSession):
        """Initialize with database session.

        Args:
            db: AsyncSession for querying Better Auth tables
        """
        self.db = db

    async def validate_session(self, session_token: str) -> UserInfo | None:
        """Validate a Better Auth session token and return user info.

        Better Auth stores sessions with the following structure:
        - session table: id, user_id, token, expires_at, etc.
        - user table: id, email, name, email_verified, etc.
        - account table: user_id, provider, provider_account_id, etc.
        - organization_member table: user_id, organization_id, role, permissions

        Args:
            session_token: The session token from cookie

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
                LIMIT 1
            """)

            org_result = await self.db.execute(org_query, {"user_id": user_id})
            org_data = org_result.fetchone()

            # Extract tenant and role info
            tenant_id = None
            roles = []
            permissions = []

            if org_data:
                tenant_id = str(org_data[0])  # organization_id becomes tenant_id
                role = org_data[1]  # role from Better Auth

                # Map Better Auth roles to our system roles
                roles = self._map_better_auth_role(role)

                # Get permissions for this role from Better Auth
                # Better Auth stores permissions in the role configuration
                permissions = await self._get_role_permissions(user_id)
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
                await sync_better_auth_user(user_id, self.db)
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
                tenant_id=tenant_id
            )

            return UserInfo(
                user_id=user_id,
                email=email,
                username=username,
                roles=roles,
                permissions=permissions,
                tenant_id=tenant_id,
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

    async def _get_role_permissions(self, user_id: str) -> list[str]:
        """Get permissions for a user based on their organization role.

        Better Auth stores permissions in the organization_member table
        via the role configuration.

        Args:
            user_id: User ID

        Returns:
            List of permission strings
        """
        try:
            # Better Auth stores permissions as JSON array in metadata or via role
            # For now, we'll derive permissions from role
            # In Better Auth, permissions are configured per role in the Organization plugin

            # Query role from organization membership
            query = text("""
                SELECT om.role
                FROM "organization_member" om
                WHERE om.user_id = :user_id
                LIMIT 1
            """)

            result = await self.db.execute(query, {"user_id": user_id})
            row = result.fetchone()

            if not row:
                return []

            role = row[0]

            # Map roles to permissions based on Better Auth configuration
            # This matches the permission mapping in frontend/shared/lib/better-auth/auth.ts
            role_permissions = {
                "super_admin": [
                    # All permissions
                    "users:create", "users:read", "users:update", "users:delete",
                    "customers:create", "customers:read", "customers:update", "customers:delete",
                    "subscribers:provision", "subscribers:suspend", "subscribers:terminate",
                    "network:configure", "network:monitor",
                    "billing:manage", "billing:payments",
                    "tickets:assign", "tickets:update",
                    "organization:members", "organization:billing",
                    "reports:view", "reports:export",
                ],
                "platform_admin": [
                    "users:read", "users:update",
                    "customers:read",
                    "organization:members",
                    "reports:view",
                ],
                "tenant_owner": [
                    "users:create", "users:read", "users:update", "users:delete",
                    "customers:create", "customers:read", "customers:update", "customers:delete",
                    "subscribers:provision", "subscribers:suspend", "subscribers:terminate",
                    "network:configure", "network:monitor",
                    "billing:manage", "billing:payments",
                    "organization:members", "organization:billing",
                    "reports:view", "reports:export",
                ],
                "tenant_admin": [
                    "users:read", "users:update",
                    "customers:create", "customers:read", "customers:update",
                    "subscribers:provision", "subscribers:suspend",
                    "network:monitor",
                    "billing:payments",
                    "reports:view",
                ],
                "tenant_member": [
                    "customers:read",
                    "subscribers:read",
                    "reports:view",
                ],
                "network_admin": [
                    "network:configure", "network:monitor",
                    "subscribers:provision", "subscribers:suspend",
                ],
                "support_agent": [
                    "customers:read", "customers:update",
                    "tickets:assign", "tickets:update",
                ],
                "customer": [
                    "profile:read", "profile:update",
                    "billing:view",
                ],
            }

            return role_permissions.get(role, [])

        except Exception as e:
            logger.error("Error getting role permissions", error=str(e))
            return []


async def get_better_auth_user(
    session_token: str,
    db: AsyncSession
) -> UserInfo | None:
    """Get user info from Better Auth session token.

    This is a helper function for use in FastAPI dependencies.

    Args:
        session_token: Better Auth session token from cookie
        db: Database session

    Returns:
        UserInfo if valid session, None otherwise
    """
    service = BetterAuthService(db)
    return await service.validate_session(session_token)
