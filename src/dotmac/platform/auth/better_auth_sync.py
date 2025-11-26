"""
User Synchronization between Better Auth and FastAPI.

This module handles syncing user data between Better Auth tables and our application's
User model. It ensures that users authenticated via Better Auth have corresponding
records in our database for application-specific features.
"""

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import User
from dotmac.platform.auth.rbac_service import RBACService

logger = structlog.get_logger(__name__)


class BetterAuthSyncService:
    """Service for synchronizing users between Better Auth and FastAPI."""

    def __init__(self, db: AsyncSession, rbac_service: RBACService | None = None):
        """Initialize sync service.

        Args:
            db: AsyncSession for database operations
            rbac_service: Optional RBAC service for role/permission management
        """
        self.db = db
        self.rbac_service = rbac_service

    async def sync_user_from_better_auth(self, user_id: str) -> User | None:
        """Sync a user from Better Auth to our User model.

        This method:
        1. Queries Better Auth user table for user data
        2. Checks if user exists in our User table
        3. Creates or updates the user record
        4. Syncs roles and permissions

        Args:
            user_id: Better Auth user ID (UUID string)

        Returns:
            Synced User model or None if sync failed
        """
        try:
            # Query Better Auth user data
            query = text("""
                SELECT
                    u.id,
                    u.email,
                    u.name,
                    u.email_verified,
                    u.created_at,
                    u.updated_at
                FROM "user" u
                WHERE u.id = :user_id
                LIMIT 1
            """)

            result = await self.db.execute(query, {"user_id": user_id})
            better_auth_user = result.fetchone()

            if not better_auth_user:
                logger.warning("Better Auth user not found", user_id=user_id)
                return None

            # Extract user data
            _ba_id = better_auth_user[0]
            email = better_auth_user[1]
            name = better_auth_user[2]
            email_verified = better_auth_user[3] or False
            created_at = better_auth_user[4]

            # Check if user exists in our database
            user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
            stmt = select(User).where(User.id == user_uuid)
            result = await self.db.execute(stmt)
            existing_user = cast(User | None, result.scalar_one_or_none())

            if existing_user:
                # Update existing user
                existing_user.email = email
                existing_user.full_name = name
                existing_user.is_active = email_verified
                existing_user.is_verified = email_verified
                if not existing_user.username:
                    existing_user.username = email.split("@")[0]
                existing_user.updated_at = datetime.now(UTC)

                logger.info("Updated existing user from Better Auth", user_id=user_id, email=email)
                await self.db.commit()
                await self.db.refresh(existing_user)

                if self.rbac_service:
                    await self._sync_user_roles(str(user_uuid))

                return existing_user
            else:
                # Create new user
                new_user = User(
                    id=user_uuid,
                    email=email,
                    username=email.split("@")[0],  # Use email prefix as username
                    full_name=name,
                    is_active=email_verified,
                    is_verified=email_verified,
                    created_at=created_at or datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                    # Note: password_hash is not needed for Better Auth users
                    # They authenticate via Better Auth session tokens
                )

                self.db.add(new_user)
                await self.db.commit()
                await self.db.refresh(new_user)

                logger.info("Created new user from Better Auth", user_id=user_id, email=email)

                # Sync roles if RBAC service is available
                if self.rbac_service:
                    await self._sync_user_roles(str(user_uuid))

                return new_user

        except Exception as e:
            logger.error("Error syncing user from Better Auth", user_id=user_id, error=str(e), exc_info=True)
            await self.db.rollback()
            return None

    async def _sync_user_roles(self, user_id: str) -> None:
        """Sync user roles from Better Auth to our RBAC system.

        Args:
            user_id: User ID
        """
        try:
            if not self.rbac_service:
                return

            # Query Better Auth organization memberships
            query = text("""
                SELECT
                    om.organization_id,
                    om.role,
                    o.name as org_name
                FROM "organization_member" om
                JOIN "organization" o ON om.organization_id = o.id
                WHERE om.user_id = :user_id
            """)

            result = await self.db.execute(query, {"user_id": user_id})
            memberships = result.fetchall()

            # Map Better Auth role names to existing RBAC role names where appropriate.
            role_name_map: dict[str, str] = {
                # Platform / super admin map to existing 'admin' RBAC role
                "super_admin": "admin",
                "platform_admin": "admin",
                # Tenant ownership/admin map
                "tenant_owner": "tenant_admin",
                "tenant_admin": "tenant_admin",
                "tenant_member": "tenant_user",
                # Billing manager maps to tenant billing manager role
                "billing_manager": "tenant_billing_manager",
                # Generic customer role gets base tenant user permissions
                "customer": "tenant_user",
            }

            for membership in memberships:
                org_id = str(membership[0])
                raw_role_name = membership[1]
                role_name = role_name_map.get(raw_role_name, raw_role_name)

                # Assign role to user in our RBAC system
                try:
                    await self.rbac_service.assign_role_to_user(
                        user_id=UUID(user_id),
                        role_name=role_name,
                        granted_by=UUID(user_id),
                        metadata={
                            "source": "better_auth",
                            "organization_id": org_id,
                            "better_auth_role": raw_role_name,
                        },
                    )
                    logger.info(
                        "Synced role from Better Auth",
                        user_id=user_id,
                        role=role_name,
                        org_id=org_id,
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to sync role",
                        user_id=user_id,
                        role=role_name,
                        better_auth_role=raw_role_name,
                        error=str(e),
                    )

        except Exception as e:
            logger.error("Error syncing user roles", user_id=user_id, error=str(e))

    async def ensure_user_synced(self, user_id: str) -> User | None:
        """Ensure a user is synced from Better Auth to our database.

        This is a convenience method that can be called whenever we need to
        ensure a Better Auth user exists in our database.

        Args:
            user_id: Better Auth user ID

        Returns:
            User model if sync successful, None otherwise
        """
        try:
            # First check if user already exists
            user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
            stmt = select(User).where(User.id == user_uuid)
            result = await self.db.execute(stmt)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # User already exists, just return it
                return existing_user

            # User doesn't exist, sync from Better Auth
            return await self.sync_user_from_better_auth(user_id)

        except Exception as e:
            logger.error("Error ensuring user sync", user_id=user_id, error=str(e))
            return None


async def sync_better_auth_user(
    user_id: str,
    db: AsyncSession,
    rbac_service: RBACService | None = None,
) -> User | None:
    """Helper function to sync a Better Auth user.

    Args:
        user_id: Better Auth user ID
        db: Database session
        rbac_service: Optional RBAC service for role synchronization

    Returns:
        Synced User model or None
    """
    sync_service = BetterAuthSyncService(db, rbac_service=rbac_service)
    return await sync_service.ensure_user_synced(user_id)
