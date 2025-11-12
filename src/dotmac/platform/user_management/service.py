"""
User management service.

Production-ready user service with proper database operations.
"""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from passlib.context import CryptContext
from sqlalchemy import Text, and_, func, or_, select
from sqlalchemy.exc import IntegrityError, MultipleResultsFound
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.utils.crypto_compat import ensure_bcrypt_metadata

from ..settings import settings
from ..webhooks.events import get_event_bus
from ..webhooks.models import WebhookEvent
from .models import User

ensure_bcrypt_metadata()

logger = structlog.get_logger(__name__)


class UserService:
    """Production user service with database operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize with database session."""
        self.session = session
        # Configure password hashing
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    async def get_user_by_id(
        self, user_id: str | UUID, tenant_id: str | None = None
    ) -> User | None:
        """Get user by ID.

        Args:
            user_id: User ID to search for
            tenant_id: Optional tenant ID to filter by. If provided, only returns
                      the user if they belong to the specified tenant.
        """
        if isinstance(user_id, str):
            try:
                user_id = UUID(user_id)
            except ValueError:
                return None

        query = select(User).where(User.id == user_id)
        if tenant_id is not None:
            query = query.where(User.tenant_id == tenant_id)
        try:
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        except MultipleResultsFound:
            result = await self.session.execute(query.limit(1))
            return result.scalars().first()

    async def get_user_by_username(
        self, username: str, tenant_id: str | None = None
    ) -> User | None:
        """Get user by username.

        Args:
            username: Username to search for
            tenant_id: Optional tenant ID to filter by. If provided, only returns
                      users in the specified tenant.
        """
        query = select(User).where(User.username == username)
        if tenant_id is not None:
            query = query.where(User.tenant_id == tenant_id)
        try:
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        except MultipleResultsFound:
            result = await self.session.execute(query.limit(1))
            return result.scalars().first()

    async def get_user_by_email(self, email: str, tenant_id: str | None = None) -> User | None:
        """Get user by email.

        Args:
            email: Email to search for
            tenant_id: Optional tenant ID to filter by. If provided, only returns
                      users in the specified tenant.
        """
        query = select(User).where(User.email == email.lower())
        if tenant_id is not None:
            query = query.where(User.tenant_id == tenant_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str | None = None,
        roles: list[str] | None = None,
        is_active: bool = True,
        tenant_id: str | None = None,
    ) -> User:
        """Create a new user."""
        # Check if user exists
        existing = await self.get_user_by_username(username, tenant_id=tenant_id)
        if existing:
            raise IntegrityError(  # type: ignore[arg-type]
                statement="user.username",
                params={"username": username, "tenant_id": tenant_id},
                orig=ValueError(f"Username {username} already exists"),
            )

        existing = await self.get_user_by_email(email, tenant_id=tenant_id)
        if existing:
            raise IntegrityError(  # type: ignore[arg-type]
                statement="user.email",
                params={"email": email, "tenant_id": tenant_id},
                orig=ValueError(f"Email {email} already exists"),
            )

        # Hash password
        password_hash = self._hash_password(password)

        # Create user
        user = User(
            username=username,
            email=email.lower(),
            password_hash=password_hash,
            full_name=full_name,
            roles=roles or [],
            is_active=is_active,
            tenant_id=tenant_id,
        )

        self.session.add(user)

        try:
            await self.session.commit()
            await self.session.refresh(user)
            logger.info(f"Created user: {username} (ID: {user.id})")

            tenant_for_event = tenant_id or user.tenant_id
            if tenant_for_event:
                try:
                    await get_event_bus().publish(
                        event_type=WebhookEvent.USER_REGISTERED.value,
                        event_data={
                            "user_id": str(user.id),
                            "username": user.username,
                            "email": user.email,
                            "full_name": user.full_name,
                            "roles": user.roles,
                            "is_active": user.is_active,
                            "registered_at": user.created_at.isoformat()
                            if user.created_at
                            else None,
                        },
                        tenant_id=tenant_for_event,
                        db=self.session,
                    )
                except Exception as e:
                    logger.warning("Failed to publish user.registered event", error=str(e))
            else:
                logger.debug("Skipping user.registered event publish (no tenant_id)")

            return user
        except IntegrityError as e:
            await self.session.rollback()
            logger.error(f"Failed to create user {username}: {e}")
            raise ValueError("User creation failed - username or email may already exist")

    async def _update_email(self, user: User, email: str) -> None:
        """Update user email with uniqueness check."""
        existing = await self.get_user_by_email(email, tenant_id=user.tenant_id)
        if existing and existing.id != user.id:
            raise ValueError(f"Email {email} is already in use")
        user.email = email.lower()

    def _update_profile_fields(
        self,
        user: User,
        full_name: str | None,
        phone_number: str | None,
    ) -> None:
        """Update user profile fields."""
        if full_name is not None:
            user.full_name = full_name
        if phone_number is not None:
            user.phone_number = phone_number

    def _update_authorization_fields(
        self,
        user: User,
        roles: list[str] | None,
        permissions: list[str] | None,
    ) -> None:
        """Update user authorization fields."""
        if roles is not None:
            user.roles = roles
        if permissions is not None:
            user.permissions = permissions

    def _update_status_fields(
        self,
        user: User,
        is_active: bool | None,
        is_verified: bool | None,
    ) -> None:
        """Update user status fields."""
        if is_active is not None:
            user.is_active = is_active
        if is_verified is not None:
            user.is_verified = is_verified

    def _update_metadata(self, user: User, metadata: dict[str, Any]) -> None:
        """Update user metadata."""
        user.metadata_ = metadata

    async def update_user(
        self,
        user_id: str | UUID,
        email: str | None = None,
        full_name: str | None = None,
        roles: list[str] | None = None,
        permissions: list[str] | None = None,
        is_active: bool | None = None,
        is_verified: bool | None = None,
        phone_number: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> User | None:
        """Update user information."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return None

        # Update fields using grouped helpers
        if email is not None:
            await self._update_email(user, email)

        self._update_profile_fields(user, full_name, phone_number)
        self._update_authorization_fields(user, roles, permissions)
        self._update_status_fields(user, is_active, is_verified)

        if metadata is not None:
            self._update_metadata(user, metadata)

        user.updated_at = datetime.now(UTC)

        try:
            await self.session.commit()
            await self.session.refresh(user)
            logger.info(f"Updated user: {user.username} (ID: {user.id})")

            tenant_for_event = tenant_id or user.tenant_id
            if tenant_for_event:
                try:
                    await get_event_bus().publish(
                        event_type=WebhookEvent.USER_UPDATED.value,
                        event_data={
                            "user_id": str(user.id),
                            "username": user.username,
                            "email": user.email,
                            "full_name": user.full_name,
                            "roles": user.roles,
                            "is_active": user.is_active,
                            "is_verified": user.is_verified,
                            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                        },
                        tenant_id=tenant_for_event,
                        db=self.session,
                    )
                except Exception as e:
                    logger.warning("Failed to publish user.updated event", error=str(e))
            else:
                logger.debug("Skipping user.updated event publish (no tenant_id)")

            return user
        except IntegrityError as e:
            await self.session.rollback()
            logger.error(f"Failed to update user {user_id}: {e}")
            raise

    async def delete_user(self, user_id: str | UUID, tenant_id: str | None = None) -> bool:
        """Delete a user."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return False

        # Store user info for webhook before deletion
        user_data = {
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "deleted_at": datetime.now(UTC).isoformat(),
        }

        await self.session.delete(user)
        await self.session.commit()
        logger.info(f"Deleted user: {user.username} (ID: {user.id})")

        tenant_for_event = tenant_id or user.tenant_id
        if tenant_for_event:
            try:
                await get_event_bus().publish(
                    event_type=WebhookEvent.USER_DELETED.value,
                    event_data=user_data,
                    tenant_id=tenant_for_event,
                    db=self.session,
                )
            except Exception as e:
                logger.warning("Failed to publish user.deleted event", error=str(e))
        else:
            logger.debug("Skipping user.deleted event publish (no tenant_id)")

        return True

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
        role: str | None = None,
        tenant_id: str | None = None,
        search: str | None = None,
        require_tenant: bool = True,  # Default to requiring tenant for safety
    ) -> tuple[list[User], int]:
        """List users with pagination and filters."""
        # Enforce tenant isolation by default
        if require_tenant and (not tenant_id or not tenant_id.strip()):
            raise ValueError("tenant_id is required when require_tenant=True")

        query = select(User)

        # Apply filters
        conditions = []
        if is_active is not None:
            conditions.append(User.is_active == is_active)
        if role:
            # Database-agnostic role filtering: convert JSON array to text and search
            # Works in both PostgreSQL and SQLite
            # Matches role as exact element in the JSON array
            role_pattern = f'%"{role}"%'
            conditions.append(func.cast(User.roles, Text).like(role_pattern))
        if tenant_id:
            conditions.append(User.tenant_id == tenant_id)
        if search:
            search_pattern = f"%{search}%"
            conditions.append(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.full_name.ilike(search_pattern),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        # Get total count
        count_query = select(func.count()).select_from(User)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())

        # Execute query
        result = await self.session.execute(query)
        users = list(result.scalars().all())

        return users, total

    async def verify_password(self, user: User, password: str) -> bool:
        """Verify user password."""
        return self.pwd_context.verify(password, user.password_hash)

    async def change_password(
        self,
        user_id: str | UUID,
        current_password: str,
        new_password: str,
        tenant_id: str | None = None,
    ) -> bool:
        """Change user password."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return False

        # Verify current password
        if not await self.verify_password(user, current_password):
            logger.warning(f"Invalid password attempt for user: {user.username}")
            return False

        # Update password
        user.password_hash = self._hash_password(new_password)
        user.updated_at = datetime.now(UTC)

        await self.session.commit()
        logger.info(f"Password changed for user: {user.username}")
        return True

    async def authenticate(
        self,
        username_or_email: str,
        password: str,
        tenant_id: str | None = None,
    ) -> User | None:
        """Authenticate user with username/email and password.

        Args:
            username_or_email: Username or email to authenticate
            password: Password to verify
            tenant_id: Optional tenant ID for multi-tenant isolation.
                      If provided, only users in this tenant can authenticate.
        """
        # Try to find user by username or email within tenant scope
        user = await self.get_user_by_username(username_or_email, tenant_id=tenant_id)
        if not user:
            user = await self.get_user_by_email(username_or_email, tenant_id=tenant_id)

        if not user:
            logger.debug(f"User not found: {username_or_email}")
            return None

        # SECURITY: Validate tenant isolation
        if tenant_id and user.tenant_id != tenant_id:
            logger.warning(
                f"Tenant isolation: User {username_or_email} belongs to tenant {user.tenant_id}, "
                f"but authentication attempted for tenant {tenant_id}"
            )
            return None

        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.now(UTC):
            logger.warning(f"Account locked for user: {user.username}")
            return None

        # Verify password
        if not await self.verify_password(user, password):
            # Increment failed attempts
            user.failed_login_attempts += 1

            # Lock account after max failed attempts (from settings)
            if user.failed_login_attempts >= settings.security.max_failed_login_attempts:
                user.locked_until = datetime.now(UTC) + timedelta(
                    hours=settings.security.account_lockout_duration_hours
                )
                logger.warning(
                    f"Account locked due to {settings.security.max_failed_login_attempts} "
                    f"failed attempts: {user.username}"
                )

            await self.session.commit()
            return None

        # Check if user is active
        if not user.is_active:
            logger.warning(f"Inactive user login attempt: {user.username}")
            return None

        # Reset failed attempts
        user.failed_login_attempts = 0
        user.locked_until = None
        # Note: last_login is updated in the router after successful authentication

        await self.session.commit()
        logger.info(f"User authenticated: {user.username}")
        return user

    async def enable_mfa(self, user_id: str | UUID, tenant_id: str | None = None) -> str:
        """Enable MFA for user and return secret."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            raise ValueError("User not found")

        # Generate MFA secret
        secret = secrets.token_hex(20)
        user.mfa_enabled = True
        user.mfa_secret = secret

        await self.session.commit()
        logger.info(f"MFA enabled for user: {user.username}")
        return secret

    async def disable_mfa(self, user_id: str | UUID, tenant_id: str | None = None) -> bool:
        """Disable MFA for user."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return False

        user.mfa_enabled = False
        user.mfa_secret = None

        await self.session.commit()
        logger.info(f"MFA disabled for user: {user.username}")
        return True

    async def add_role(
        self, user_id: str | UUID, role: str, tenant_id: str | None = None
    ) -> User | None:
        """Add role to user."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return None

        if role not in user.roles:
            user.roles = user.roles + [role]
            await self.session.commit()
            logger.info(f"Added role {role} to user: {user.username}")

        return user

    async def remove_role(
        self, user_id: str | UUID, role: str, tenant_id: str | None = None
    ) -> User | None:
        """Remove role from user."""
        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return None

        if role in user.roles:
            user.roles = [r for r in user.roles if r != role]
            await self.session.commit()
            logger.info(f"Removed role {role} from user: {user.username}")

        return user

    async def update_last_login(
        self,
        user_id: str | UUID,
        ip_address: str | None = None,
        tenant_id: str | None = None,
    ) -> User | None:
        """Update user's last login timestamp and IP address.

        Args:
            user_id: The user ID to update
            ip_address: Optional IP address of the login

        Returns:
            Updated user object or None if user not found
        """
        from datetime import datetime

        user = await self.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            return None

        # Update last login fields
        user.last_login = datetime.now(UTC).replace(tzinfo=None)
        if ip_address:
            user.last_login_ip = ip_address

        await self.session.commit()
        logger.info(f"Updated last login for user: {user.username}")

        return user

    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt via passlib."""
        return self.pwd_context.hash(password)
