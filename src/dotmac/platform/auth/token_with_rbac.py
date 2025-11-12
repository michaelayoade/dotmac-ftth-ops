"""
Enhanced JWT token generation with RBAC permissions
This module extends the existing JWT functionality to include permissions
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException
from jwt.exceptions import InvalidTokenError as JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from dotmac.platform.auth.core import JWTService, UserInfo, get_current_user
from dotmac.platform.auth.exceptions import InvalidToken
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.core.caching import cache_get, cache_set
from dotmac.platform.database import get_async_session
from dotmac.platform.settings import settings
from dotmac.platform.user_management.models import User

logger = logging.getLogger(__name__)


class RBACTokenService:
    """Enhanced JWT service with RBAC permissions"""

    def __init__(self, jwt_service: JWTService, rbac_service: RBACService) -> None:
        self.jwt_service = jwt_service
        self.rbac_service = rbac_service

    async def create_access_token(
        self,
        user: User,
        db_session: Session,
        expires_delta: timedelta | None = None,
        additional_claims: dict[str, Any] | None = None,
    ) -> str:
        """
        Create an access token with user permissions and roles
        """
        # Get user's permissions
        permissions = await self.rbac_service.get_user_permissions(user.id)

        # Get user's roles
        roles = await self.rbac_service.get_user_roles(user.id)
        role_names = [role.name for role in roles]

        # Build token claims
        claims: dict[str, Any] = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "permissions": list(permissions),  # Convert snapshot to list
            "roles": role_names,
            "tenant_id": (
                str(user.tenant_id) if hasattr(user, "tenant_id") and user.tenant_id else None
            ),
        }

        # Enrich token with partner metadata if user belongs to a partner
        partner_metadata = await self._get_partner_metadata(user, db_session)
        if partner_metadata:
            claims.update(partner_metadata)

        # Add any additional claims
        if additional_claims:
            claims.update(additional_claims)

        # Set expiration
        expire_delta = expires_delta or timedelta(minutes=settings.jwt.access_token_expire_minutes)
        expire = datetime.now(UTC) + expire_delta
        claims["type"] = "access"

        # Create token
        token: str = self.jwt_service._create_token(claims, expire_delta)

        # Cache the token metadata for quick validation
        cache_key = f"token:{user.id}:{token[:20]}"  # Use first 20 chars as identifier
        cache_set(
            cache_key,
            {
                "user_id": str(user.id),
                "permissions": list(permissions),
                "roles": role_names,
                "expires_at": expire.isoformat(),
            },
            ttl=int(
                expires_delta.total_seconds()
                if expires_delta
                else settings.jwt.access_token_expire_minutes * 60
            ),
        )

        logger.info(
            f"Created access token for user {user.id} with {len(permissions)} permissions and {len(role_names)} roles"
        )
        return token

    async def _get_partner_metadata(self, user: User, db_session: Session) -> dict[str, Any] | None:
        """
        Get partner metadata for token enrichment.

        Returns partner_id and managed_tenant_ids if user belongs to a partner with active tenant links.
        """
        try:
            from sqlalchemy import select
            from sqlalchemy.ext.asyncio import AsyncSession

            from dotmac.platform.partner_management.models import (
                Partner,
                PartnerTenantLink,
                PartnerUser,
            )

            # Convert sync session to async if needed
            if not isinstance(db_session, AsyncSession):
                return None

            # Check if user is a partner user
            result = await db_session.execute(
                select(PartnerUser).where(PartnerUser.user_id == user.id)
            )
            partner_user = result.scalars().first()

            if not partner_user:
                return None

            # Get partner
            partner_result = await db_session.execute(
                select(Partner).where(Partner.id == partner_user.partner_id)
            )
            partner = partner_result.scalars().first()

            if not partner:
                return None

            # Get active managed tenant links
            links_result = await db_session.execute(
                select(PartnerTenantLink.managed_tenant_id).where(
                    PartnerTenantLink.partner_id == partner.id,
                    PartnerTenantLink.is_active == True,  # noqa: E712
                )
            )
            managed_tenant_ids = list(links_result.scalars().all())

            return {
                "partner_id": str(partner.id),
                "managed_tenant_ids": managed_tenant_ids,
            }
        except Exception as e:
            logger.warning(f"Failed to get partner metadata for user {user.id}: {e}")
            return None

    async def create_refresh_token(self, user: User, expires_delta: timedelta | None = None) -> str:
        """
        Create a refresh token (doesn't include permissions for security)
        """
        claims: dict[str, Any] = {"sub": str(user.id), "type": "refresh"}

        expire_delta = expires_delta or timedelta(days=settings.jwt.refresh_token_expire_days)

        refresh_token: str = self.jwt_service._create_token(claims, expire_delta)
        return refresh_token

    async def verify_token_with_permissions(
        self,
        token: str,
        required_permissions: list[str] | None = None,
        required_roles: list[str] | None = None,
        require_all_permissions: bool = True,
    ) -> dict[str, Any]:
        """
        Verify token and check for required permissions/roles
        """
        # Verify the token signature and expiration
        try:
            payload: dict[str, Any] = self.jwt_service.verify_token(token)
        except HTTPException as exc:
            logger.error(
                "Token verification failed (status %s): %s",
                exc.status_code,
                exc.detail,
            )
            raise InvalidToken("Invalid or expired token", reason=str(exc.detail))
        except JWTError as e:
            logger.error(f"Token verification failed: {e}")
            raise InvalidToken("Invalid or expired token")

        # Check if it's an access token
        if payload.get("type") != "access":
            raise InvalidToken("Token is not an access token")

        # Check for required permissions
        if required_permissions:
            user_permissions = set(payload.get("permissions", []))

            if require_all_permissions:
                # User must have ALL required permissions
                missing = set(required_permissions) - user_permissions
                if missing:
                    logger.warning(f"User {payload.get('sub')} missing permissions: {missing}")
                    raise InvalidToken(f"Missing required permissions: {', '.join(missing)}")
            else:
                # User must have AT LEAST ONE required permission
                if not any(perm in user_permissions for perm in required_permissions):
                    raise InvalidToken(
                        f"Requires at least one of: {', '.join(required_permissions)}"
                    )

        # Check for required roles
        if required_roles:
            user_roles = set(payload.get("roles", []))

            if not any(role in user_roles for role in required_roles):
                raise InvalidToken(f"Requires one of these roles: {', '.join(required_roles)}")

        return payload

    async def refresh_access_token(
        self, refresh_token: str, db_session: Session
    ) -> tuple[str, str]:
        """
        Use refresh token to get new access token with updated permissions
        """
        # Verify refresh token
        try:
            payload = self.jwt_service.verify_token(refresh_token)
        except HTTPException as exc:
            logger.error(
                "Refresh token verification failed (status %s): %s",
                exc.status_code,
                exc.detail,
            )
            raise InvalidToken("Invalid refresh token", reason=str(exc.detail))
        except JWTError:
            raise InvalidToken("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise InvalidToken("Token is not a refresh token")

        # Get user
        user_id = UUID(payload["sub"])
        user = db_session.query(User).filter_by(id=user_id).first()

        if not user:
            raise InvalidToken("User not found")

        if not user.is_active:
            raise InvalidToken("User account is disabled")

        # Create new tokens with current permissions
        access_token = await self.create_access_token(user, db_session)
        new_refresh_token = await self.create_refresh_token(user)

        return access_token, new_refresh_token

    async def revoke_token(self, token: str) -> None:
        """
        Revoke a token by adding it to a blacklist
        """
        try:
            payload = self.jwt_service.verify_token(token)
            exp = payload.get("exp")

            if exp:
                # Calculate TTL for blacklist entry
                ttl = exp - datetime.now(UTC).timestamp()
                if ttl > 0:
                    # Add to blacklist
                    cache_set(f"blacklist:{token[:50]}", True, ttl=int(ttl))  # Use first 50 chars
                    logger.info(f"Token revoked for user {payload.get('sub')}")
        except HTTPException as exc:
            logger.info(
                "Token already invalid during revocation (status %s): %s",
                exc.status_code,
                exc.detail,
            )
        except JWTError:
            pass  # Token is already invalid

    async def is_token_revoked(self, token: str) -> bool:
        """
        Check if token is in the blacklist
        """
        return cache_get(f"blacklist:{token[:50]}") is not None

    async def get_user_from_token(
        self, token: str, db_session: Session
    ) -> tuple[User, list[str], list[str]]:
        """
        Get user, permissions, and roles from token
        Returns: (user, permissions, roles)
        """
        payload = await self.verify_token_with_permissions(token)

        user_id = UUID(payload["sub"])
        user = db_session.query(User).filter_by(id=user_id).first()

        if not user:
            raise InvalidToken("User not found")

        permissions = payload.get("permissions", [])
        roles = payload.get("roles", [])

        return user, permissions, roles


# Factory function to create the service
def get_rbac_token_service(jwt_service: JWTService, rbac_service: RBACService) -> RBACTokenService:
    """Factory function to create RBAC token service"""
    return RBACTokenService(jwt_service, rbac_service)


async def get_current_user_with_rbac(
    current_user_info: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> User:
    """
    FastAPI dependency to get current authenticated user as full User model.

    This is a compatibility function for routers that need the full User object
    instead of just UserInfo. Most new code should use get_current_user from
    auth.core which returns UserInfo.

    Usage:
        @router.get("/endpoint")
        async def my_endpoint(
            current_user: User = Depends(get_current_user_with_rbac)
        ):
            ...

    Returns:
        User: Full User model with all database fields

    Raises:
        HTTPException: If user is not authenticated or not found
    """
    from sqlalchemy import select

    # Fetch full User object from database
    stmt = select(User).where(User.id == UUID(current_user_info.user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found in database",
        )

    return user


# Export for use in routers
__all__ = [
    "RBACTokenService",
    "get_rbac_token_service",
    "get_current_user_with_rbac",
]
