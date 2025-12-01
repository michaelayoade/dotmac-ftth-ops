"""
Simplified Auth Core - Replaces multiple complex files.

This module provides all auth functionality using standard libraries:
- JWT with Authlib
- Sessions with Redis
- OAuth with Authlib
- API keys with Redis
- Password hashing with Passlib
"""

import inspect
import json
import os
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, cast
from uuid import UUID

import structlog
from authlib.integrations.httpx_client import AsyncOAuth2Client
from authlib.jose import JoseError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import (
    APIKeyHeader,
    HTTPAuthorizationCredentials,
    HTTPBearer,
    OAuth2PasswordBearer,
)
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from dotmac.platform.utils.crypto_compat import ensure_bcrypt_metadata

redis_async: Any | None
try:
    import redis.asyncio as redis_async
except ImportError:  # pragma: no cover - optional dependency
    redis_async = None

# Ensure bcrypt metadata is available
ensure_bcrypt_metadata()

REDIS_AVAILABLE = redis_async is not None

logger = structlog.get_logger(__name__)

# ============================================
# Configuration
# ============================================

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# FastAPI Security schemes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

# Configuration from centralized settings
try:
    from ..settings import settings

    # Use new centralized AuthSettings (Phase 1 implementation)
    _jwt_secret = (
        settings.auth.jwt_secret_key or settings.jwt.secret_key
    )  # Fallback to old jwt settings
    _jwt_algorithm = settings.auth.jwt_algorithm
    _access_token_expire_minutes = settings.auth.access_token_expire_minutes
    _refresh_token_expire_days = settings.auth.refresh_token_expire_days
    _redis_url = settings.auth.session_redis_url
    _default_user_role = settings.auth.default_user_role
    _session_idle_timeout_minutes = settings.auth.session_idle_timeout_minutes
    _token_expiry_leeway_seconds = settings.auth.token_expiry_leeway_seconds
    _max_sessions_per_user = settings.auth.max_sessions_per_user
except ImportError:
    # Fallback values if settings not available (should only happen in tests)
    _jwt_secret = "default-secret-change-this"
    _jwt_algorithm = "HS256"
    _access_token_expire_minutes = 15
    _refresh_token_expire_days = 7
    _redis_url = "redis://localhost:6379"
    _default_user_role = "user"
    _session_idle_timeout_minutes = 60
    _token_expiry_leeway_seconds = 60
    _max_sessions_per_user = 5
except AttributeError:
    # Handle case where settings exists but auth field is not yet initialized
    # This provides backwards compatibility during rollout
    from ..settings import settings

    _jwt_secret = settings.jwt.secret_key
    _jwt_algorithm = settings.jwt.algorithm
    _access_token_expire_minutes = settings.jwt.access_token_expire_minutes
    _refresh_token_expire_days = settings.jwt.refresh_token_expire_days
    _redis_url = settings.redis.redis_url
    _default_user_role = getattr(settings, "default_user_role", "user")
    _session_idle_timeout_minutes = getattr(settings, "session_idle_timeout_minutes", 60)
    _token_expiry_leeway_seconds = getattr(settings, "token_expiry_leeway_seconds", 60)
    _max_sessions_per_user = getattr(settings, "max_sessions_per_user", 5)

# Module constants
JWT_SECRET = _jwt_secret
JWT_ALGORITHM = _jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = _access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = _refresh_token_expire_days
REDIS_URL = _redis_url
DEFAULT_USER_ROLE = _default_user_role
SESSION_IDLE_TIMEOUT_SECONDS = int(_session_idle_timeout_minutes * 60)
TOKEN_EXP_LEEWAY_SECONDS = int(_token_expiry_leeway_seconds)
MAX_SESSIONS_PER_USER = int(_max_sessions_per_user)

# ============================================
# Models
# ============================================


class TokenType(str, Enum):
    """Token types."""

    ACCESS = "access"
    REFRESH = "refresh"
    API_KEY = "api_key"


class UserInfo(BaseModel):
    """User information from auth.

    This model is used in JWT tokens and API authentication.
    User IDs are stored as strings for JWT/HTTP compatibility.

    Platform Admin Support:
        - is_platform_admin=True: User can access ALL tenants (SaaS admin)
        - tenant_id=None: Platform admins are not assigned to any specific tenant
        - Platform admins can set X-Target-Tenant-ID header to impersonate tenants

    Partner Multi-Tenant Access:
        - partner_id: UUID of partner organization (if user belongs to a partner)
        - managed_tenant_ids: List of tenant IDs this partner can manage
        - active_managed_tenant_id: Currently active managed tenant context (via X-Active-Tenant-Id header)

    Important: When using user_id with database models that expect UUID,
    convert using UUID(user_info.user_id) or the ensure_uuid() helper.

    Example:
        >>> from uuid import UUID
        >>> user = await db.get(User, UUID(current_user.user_id))
        >>> # Or using helper:
        >>> user = await db.get(User, ensure_uuid(current_user.user_id))

        >>> # Platform admin checking:
        >>> if current_user.is_platform_admin:
        >>>     # Can access all tenants
        >>>     pass

        >>> # Partner multi-tenant checking:
        >>> if current_user.partner_id and current_user.active_managed_tenant_id:
        >>>     # Partner accessing a managed tenant
        >>>     effective_tenant_id = current_user.active_managed_tenant_id
        >>> else:
        >>>     effective_tenant_id = current_user.tenant_id
    """

    model_config = ConfigDict(extra="forbid")

    user_id: str  # String representation of UUID for JWT/API compatibility
    email: EmailStr | None = None
    username: str | None = None
    roles: list[str] = Field(default_factory=lambda: [])
    permissions: list[str] = Field(default_factory=lambda: [])
    tenant_id: str | None = None  # None for platform admins
    is_platform_admin: bool = Field(
        default=False, description="Platform admin with cross-tenant access"
    )

    # Partner multi-tenant access fields
    partner_id: str | None = Field(
        default=None, description="Partner organization UUID (if user belongs to a partner)"
    )
    managed_tenant_ids: list[str] = Field(
        default_factory=lambda: [],
        description="Tenant IDs this partner can manage (empty for non-partner users)",
    )
    active_managed_tenant_id: str | None = Field(
        default=None,
        description="Currently active managed tenant context (set via X-Active-Tenant-Id header)",
    )

    @property
    def effective_tenant_id(self) -> str | None:
        """Get the effective tenant ID for the current request context.

        Returns:
            - active_managed_tenant_id if partner is in cross-tenant context
            - tenant_id otherwise (user's home tenant)
        """
        return self.active_managed_tenant_id or self.tenant_id

    @property
    def is_cross_tenant_access(self) -> bool:
        """Check if this is a cross-tenant access request.

        Returns:
            True if partner is accessing a managed tenant, False otherwise
        """
        return bool(
            self.partner_id
            and self.active_managed_tenant_id
            and self.active_managed_tenant_id != self.tenant_id
        )


class TokenData(BaseModel):
    """Token response."""

    model_config = ConfigDict()

    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int


class OAuthProvider(str, Enum):
    """Supported OAuth providers."""

    GOOGLE = "google"
    GITHUB = "github"
    MICROSOFT = "microsoft"


# OAuth configurations
OAUTH_CONFIGS = {
    OAuthProvider.GOOGLE: {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
    },
    OAuthProvider.GITHUB: {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "user:email",
    },
    OAuthProvider.MICROSOFT: {
        "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scope": "openid email profile",
    },
}

# ============================================
# Helper Functions
# ============================================


def ensure_uuid(value: str | UUID) -> UUID:
    """Convert string to UUID if needed.

    This helper ensures consistent UUID handling across the auth layer.
    UserInfo stores user_id as string (for JWT/API compatibility), but
    database models use UUID type (for type safety).

    Args:
        value: Either a string representation of UUID or UUID object

    Returns:
        UUID object

    Raises:
        ValueError: If string is not a valid UUID format

    Example:
        >>> from dotmac.platform.auth.core import UserInfo, ensure_uuid
        >>> user_info = UserInfo(user_id="550e8400-e29b-41d4-a716-446655440000", ...)
        >>> user = await db.get(User, ensure_uuid(user_info.user_id))
    """
    if isinstance(value, str):
        return UUID(value)
    return value


# ============================================
# JWT Service
# ============================================


class JWTService:
    """Simplified JWT service using Authlib with token revocation support.

    SECURITY ENHANCEMENTS:
    - Session-bound token validation: Access tokens are validated against active sessions
    - Refresh token tracking: All refresh JTIs are tracked per user for proper revocation
    - Logout invalidation: Both access and refresh tokens are properly blacklisted on logout
    """

    def __init__(
        self, secret: str | None = None, algorithm: str | None = None, redis_url: str | None = None
    ):
        self.secret = secret or JWT_SECRET
        self.algorithm = algorithm or JWT_ALGORITHM
        self.header = {"alg": self.algorithm}
        self.redis_url = redis_url or REDIS_URL
        self._redis: Any | None = None

    def create_access_token(
        self,
        subject: str,
        additional_claims: dict[str, Any] | None = None,
        expire_minutes: int | None = None,
    ) -> str:
        """Create access token."""
        data = {"sub": subject, "type": TokenType.ACCESS.value}
        if additional_claims:
            data.update(additional_claims)

        # Backwards compatibility: if no session_id was provided, mark the token as session-optional
        # so it can still pass validation (e.g., test tokens or bootstrap tokens).
        if "session_id" not in data:
            data.setdefault("session_optional", True)

        expires_delta = timedelta(minutes=expire_minutes or ACCESS_TOKEN_EXPIRE_MINUTES)
        return self._create_token(data, expires_delta)

    def create_refresh_token(
        self, subject: str, additional_claims: dict[str, Any] | None = None
    ) -> str:
        """Create refresh token and track its JTI for revocation.

        SECURITY: Refresh tokens are tracked per-user so they can be properly
        revoked on logout. The JTI is stored in Redis with a TTL matching the
        token expiry.
        """
        data = {"sub": subject, "type": TokenType.REFRESH.value}
        if additional_claims:
            data.update(additional_claims)

        expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        token = self._create_token(data, expires_delta)

        # Track refresh token JTI for this user (async operation, fire and forget)
        # The JTI is embedded in the token during _create_token
        try:
            claims = jwt.decode(token, self.secret)
            jti = claims.get("jti")
            if jti:
                # Use sync redis client to track the refresh token
                from dotmac.platform.core.caching import get_redis

                redis_client = get_redis()
                if redis_client:
                    # Store JTI in user's refresh token set with TTL
                    ttl_seconds = int(expires_delta.total_seconds())
                    user_refresh_key = f"user_refresh_tokens:{subject}"
                    redis_client.sadd(user_refresh_key, jti)
                    redis_client.expire(user_refresh_key, ttl_seconds)
                    logger.debug(
                        "Tracked refresh token JTI",
                        user_id=subject,
                        jti=jti[:8] + "...",
                    )
        except Exception as e:
            logger.warning("Failed to track refresh token JTI", error=str(e))

        return token

    # ------------------------------------------------------------------
    # Compatibility helpers (legacy call sites expect decode_* methods)
    # ------------------------------------------------------------------

    def decode_access_token(self, token: str) -> dict[str, Any]:
        """Decode and validate an access token (backwards compatible helper)."""
        return self.verify_token(token, expected_type=TokenType.ACCESS)

    def decode_refresh_token(self, token: str) -> dict[str, Any]:
        """Decode and validate a refresh token (backwards compatible helper)."""
        return self.verify_token(token, expected_type=TokenType.REFRESH)

    def decode_token(self, token: str) -> dict[str, Any]:
        """Decode a token without enforcing a specific token type."""
        return self.verify_token(token)

    def _create_token(self, data: dict[str, Any], expires_delta: timedelta) -> str:
        """Internal token creation."""
        to_encode = data.copy()
        expire = datetime.now(UTC) + expires_delta

        to_encode.update(
            {"exp": expire, "iat": datetime.now(UTC), "jti": secrets.token_urlsafe(16)}
        )

        token = jwt.encode(self.header, to_encode, self.secret)
        return token.decode("utf-8") if isinstance(token, bytes) else token

    def verify_token(
        self,
        token: str,
        expected_type: TokenType | None = None,
        *,
        leeway_seconds: int | float | None = None,
    ) -> dict[str, Any]:
        """Verify and decode token with sync blacklist check.

        Args:
            token: JWT token to verify
            expected_type: Optional expected token type (ACCESS, REFRESH, or API_KEY)

        Returns:
            Token claims dictionary

        Raises:
            HTTPException: If token is invalid, revoked, or has wrong type
        """
        try:
            claims_raw = jwt.decode(token, self.secret)
            claims_raw.validate(leeway=leeway_seconds or 0)
            claims = cast(dict[str, Any], dict(claims_raw))

            # Validate token type if specified
            if expected_type:
                token_type = claims.get("type")
                if token_type != expected_type.value:
                    raise JoseError(
                        f"Invalid token type. Expected {expected_type.value}, got {token_type}"
                    )

            # Check if token is revoked (sync version)
            jti = claims.get("jti")
            if jti and self.is_token_revoked_sync(jti):
                raise JoseError("Token has been revoked")

            return claims
        except JoseError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def _get_redis(self) -> Any | None:
        """Get Redis connection."""
        if not REDIS_AVAILABLE:
            return None
        if self._redis is None and redis_async is not None:
            self._redis = redis_async.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def revoke_token(self, token: str) -> bool:
        """Revoke a token by adding its JTI to blacklist."""
        try:
            redis_client = await self._get_redis()
            if not redis_client:
                logger.warning("Redis not available, cannot revoke tokens")
                return False

            claims = jwt.decode(token, self.secret)
            jti = claims.get("jti")
            if not jti:
                return False

            # Calculate TTL based on token expiry
            exp = claims.get("exp")
            if exp:
                ttl = max(0, exp - int(datetime.now(UTC).timestamp()))
                await redis_client.setex(f"blacklist:{jti}", ttl, "1")
            else:
                await redis_client.set(f"blacklist:{jti}", "1")

            logger.info(f"Revoked token with JTI: {jti}")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke token: {e}")
            return False

    def is_token_revoked_sync(self, jti: str) -> bool:
        """Check if token is revoked (sync version)."""
        try:
            from dotmac.platform.core.caching import get_redis

            redis_client = get_redis()
            if not redis_client:
                return False
            return bool(redis_client.exists(f"blacklist:{jti}"))
        except Exception as e:
            logger.error(f"Failed to check token revocation status: {e}")
            return False

    async def is_token_revoked(self, jti: str) -> bool:
        """Check if a token is revoked."""
        try:
            redis_client = await self._get_redis()
            if not redis_client:
                return False
            return bool(await redis_client.exists(f"blacklist:{jti}"))
        except Exception:
            return False

    async def verify_token_async(
        self,
        token: str,
        expected_type: TokenType | None = None,
        *,
        leeway_seconds: int | float | None = None,
        validate_session: bool = True,
    ) -> dict[str, Any]:
        """Verify and decode token with revocation and session check (async version).

        SECURITY FIX: Access tokens are now validated against their session. If the
        session has been deleted (via logout or revocation), the token is rejected
        even if it hasn't expired. This ensures logout is immediate and effective.

        Args:
            token: JWT token to verify
            expected_type: Optional expected token type (ACCESS, REFRESH, or API_KEY)
            validate_session: If True, validate that the session_id in the token
                            is still active. Default True for ACCESS tokens.

        Returns:
            Token claims dictionary

        Raises:
            HTTPException: If token is invalid, revoked, session invalid, or has wrong type
        """
        try:
            claims_raw = jwt.decode(token, self.secret)
            claims_raw.validate(leeway=leeway_seconds or 0)
            claims = cast(dict[str, Any], dict(claims_raw))

            # Validate token type if specified
            if expected_type:
                token_type = claims.get("type")
                if token_type != expected_type.value:
                    raise JoseError(
                        f"Invalid token type. Expected {expected_type.value}, got {token_type}"
                    )

            # Check if token is revoked
            jti = claims.get("jti")
            if jti and await self.is_token_revoked(jti):
                raise JoseError("Token has been revoked")

            # SECURITY: Validate session is still active for ACCESS tokens
            # This ensures logout/session revocation is immediately effective
            if validate_session and expected_type == TokenType.ACCESS:
                session_id = claims.get("session_id")
                if session_id:
                    session_active = await self._is_session_active(session_id)
                    if not session_active:
                        logger.warning(
                            "Token rejected: session no longer active",
                            session_id=session_id[:8] + "..." if session_id else None,
                            user_id=claims.get("sub"),
                        )
                        raise JoseError("Session has been invalidated")

            return claims
        except JoseError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def _is_session_active(self, session_id: str) -> bool:
        """Check if a session is still active in Redis.

        Returns True if session exists, False otherwise.
        Falls back to True if Redis is unavailable (fail-open for availability).
        """
        try:
            session = await session_manager.get_session(session_id)
            if session is not None:
                return True

            redis_healthy = getattr(session_manager, "_redis_healthy", True)
            if not session_manager._fallback_enabled and not redis_healthy:
                logger.warning("Session store unavailable during validation; allowing token")
                return True

            return False
        except Exception as e:
            logger.error("Session check failed", session_id=session_id, error=str(e))
            return True  # Fail-open for availability

    async def revoke_user_tokens(self, user_id: str) -> int:
        """Revoke all tokens associated with a user by blacklisting their JTIs.

        SECURITY FIX: This now properly blacklists all refresh token JTIs that were
        tracked when tokens were created. Previously this scanned a namespace that
        was never written to, making logout ineffective.

        Returns the count of revoked tokens.
        """
        redis_client = await self._get_redis()
        if not redis_client:
            logger.warning("Redis not available, cannot revoke user tokens")
            return 0

        revoked = 0
        try:
            # Get all tracked refresh token JTIs for this user
            user_refresh_key = f"user_refresh_tokens:{user_id}"
            refresh_jtis = await redis_client.smembers(user_refresh_key)

            for jti in refresh_jtis:
                # Add JTI to blacklist with TTL matching refresh token expiry
                ttl = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
                await redis_client.setex(f"blacklist:{jti}", ttl, "1")
                revoked += 1
                logger.debug("Blacklisted refresh token", jti=jti[:8] + "...")

            # Clean up the tracking set
            await redis_client.delete(user_refresh_key)

            logger.info(
                "Revoked user tokens",
                user_id=user_id,
                revoked_count=revoked,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Failed to revoke user tokens", user_id=user_id, error=str(exc))

        return revoked


# ============================================
# Session Management
# ============================================


class SessionManager:
    """Redis-based session manager with fallback support.

    SECURITY: The fallback store now tracks TTLs and expires entries automatically.
    This prevents 2FA pending sessions from persisting indefinitely when Redis is down.
    """

    def __init__(
        self,
        redis_url: str | None = None,
        fallback_enabled: bool = True,
        *,
        idle_timeout_seconds: int | None = None,
        max_sessions_per_user: int | None = None,
    ) -> None:
        self.redis_url = redis_url or REDIS_URL
        self._redis: Any | None = None
        self._fallback_store: dict[str, dict[str, Any]] = {}  # In-memory fallback
        self._fallback_ttl: dict[str, float] = {}  # SECURITY: TTL tracking for fallback store
        self._fallback_enabled = fallback_enabled
        self._redis_healthy = True
        self.idle_timeout_seconds = idle_timeout_seconds or SESSION_IDLE_TIMEOUT_SECONDS
        self.max_sessions_per_user = max_sessions_per_user or MAX_SESSIONS_PER_USER

        # SECURITY: Disable fallback automatically in production environments
        try:
            environment = getattr(settings, "environment", None)
            env_value = (
                getattr(environment, "value", str(environment)) if environment else "development"
            )
        except Exception:  # pragma: no cover - defensive
            env_value = "development"

        if self._fallback_enabled and str(env_value).lower() == "production":
            logger.warning(
                "Session fallback disabled for production deployment; Redis availability is required."
            )
            self._fallback_enabled = False

    async def _get_redis(self) -> Any | None:
        """Get Redis connection with health check."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis library not available, using in-memory fallback")
            self._redis_healthy = False
            return None

        if self._redis is None and redis_async is not None:
            try:
                client = redis_async.from_url(self.redis_url, decode_responses=True)
                if inspect.isawaitable(client):
                    client = await client
                self._redis = client
                # Verify connection
                await self._redis.ping()
                self._redis_healthy = True
                logger.info("Redis connection established")
            except Exception as e:
                logger.error("Redis connection failed", error=str(e))
                self._redis_healthy = False
                self._redis = None

                if not self._fallback_enabled:
                    raise RuntimeError("Session service unavailable (Redis connection failed)")
        return self._redis

    async def create_session(
        self,
        user_id: str,
        data: dict[str, Any],
        ttl: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        session_id: str | None = None,
    ) -> str:
        """Create new session with Redis or fallback."""
        session_id = session_id or secrets.token_urlsafe(32)
        session_key = f"session:{session_id}"

        ttl_seconds = ttl or self.idle_timeout_seconds
        now = datetime.now(UTC).isoformat()
        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": now,
            "last_accessed": now,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "data": data,
            "expires_at": (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).isoformat(),
        }

        client = await self._get_redis()
        if client:
            try:
                await client.setex(session_key, ttl_seconds, json.dumps(session_data))
                # Track user sessions
                user_key = f"user_sessions:{user_id}"
                await client.sadd(user_key, session_id)
                await client.expire(user_key, ttl_seconds)
            except Exception as e:
                logger.warning("Redis session write failed, using fallback", error=str(e))
                if self._fallback_enabled:
                    self._fallback_store[session_id] = session_data
                else:
                    raise HTTPException(status_code=503, detail="Session service unavailable")
        else:
            # Use fallback
            if self._fallback_enabled:
                logger.info("Using in-memory session store (single-server only)")
                self._fallback_store[session_id] = session_data
            else:
                raise HTTPException(
                    status_code=503, detail="Session service unavailable (Redis not available)"
                )

        await self._enforce_session_limit(user_id)
        return session_id

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Get session data from Redis or fallback."""
        client = await self._get_redis()
        if client:
            try:
                data = await client.get(f"session:{session_id}")
                if data:
                    return cast(dict[str, Any], json.loads(data))
            except Exception as e:
                logger.warning(
                    "Failed to get session from Redis", session_id=session_id, error=str(e)
                )

        # Check fallback store
        if self._fallback_enabled and session_id in self._fallback_store:
            session = self._fallback_store.get(session_id)
            if session and not self._is_fallback_expired(session):
                logger.debug("Session retrieved from fallback store", session_id=session_id)
                return session
            self._fallback_store.pop(session_id, None)

        return None

    def _is_fallback_expired(self, session: dict[str, Any]) -> bool:
        """Check expiry for fallback sessions and evict stale ones."""
        expires_at = session.get("expires_at")
        if not expires_at:
            return False
        try:
            return datetime.fromisoformat(expires_at) <= datetime.now(UTC)
        except Exception:
            return False

    async def touch_session(self, session_id: str) -> bool:
        """Refresh session last access time and TTL."""
        ttl_seconds = self.idle_timeout_seconds
        now = datetime.now(UTC).isoformat()

        client = await self._get_redis()
        if client:
            session = await self.get_session(session_id)
            if not session:
                return False

            session["last_accessed"] = now
            session["expires_at"] = (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).isoformat()
            try:
                await client.setex(f"session:{session_id}", ttl_seconds, json.dumps(session))
                user_id = session.get("user_id")
                if user_id:
                    await client.expire(f"user_sessions:{user_id}", ttl_seconds)
            except Exception as exc:
                logger.warning("Failed to refresh session TTL", session_id=session_id, error=str(exc))
            return True

        if self._fallback_enabled and session_id in self._fallback_store:
            session = self._fallback_store.get(session_id)
            if not session:
                return False
            session["last_accessed"] = now
            session["expires_at"] = (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).isoformat()
            self._fallback_store[session_id] = session
            return True

        return False

    async def delete_session(self, session_id: str) -> bool:
        """Delete session."""
        try:
            client = await self._get_redis()
            if client:
                # Get session to find user_id
                session = await self.get_session(session_id)
                if session:
                    user_id = session.get("user_id")
                    if user_id:
                        # Remove session from user's session set
                        await client.srem(f"user_sessions:{user_id}", session_id)

                deleted_count = await client.delete(f"session:{session_id}")
                return bool(deleted_count)

            # Fallback cleanup
            self._fallback_store.pop(session_id, None)
            return True
        except Exception as e:
            logger.error("Failed to delete session", session_id=session_id, error=str(e))
            return False

    async def get_user_sessions(self, user_id: str) -> dict[str, dict[str, Any]]:
        """Get all sessions for a user."""
        try:
            client = await self._get_redis()
            if not client:
                # Fallback: scan in-memory store when enabled
                if self._fallback_enabled:
                    sessions: dict[str, dict[str, Any]] = {}
                    expired: list[str] = []
                    for sid, data in self._fallback_store.items():
                        if data.get("user_id") != user_id:
                            continue
                        if self._is_fallback_expired(data):
                            expired.append(sid)
                            continue
                        sessions[f"session:{sid}"] = data
                    for sid in expired:
                        self._fallback_store.pop(sid, None)
                    return sessions
                return {}

            user_sessions_key = f"user_sessions:{user_id}"

            # Get all session IDs for this user
            session_ids = await client.smembers(user_sessions_key)

            sessions: dict[str, dict[str, Any]] = {}
            for session_id in session_ids:
                session_key = f"session:{session_id}"
                session_data = await client.get(session_key)
                if session_data:
                    sessions[session_key] = cast(dict[str, Any], json.loads(session_data))

            return sessions
        except Exception as e:
            logger.error(f"Failed to get user sessions for {user_id}: {e}")
            return {}

    async def _enforce_session_limit(self, user_id: str) -> None:
        """Enforce maximum concurrent sessions per user by evicting oldest sessions."""
        try:
            limit = self.max_sessions_per_user
            if not limit or limit < 1:
                return

            client = await self._get_redis()
            if client:
                user_sessions_key = f"user_sessions:{user_id}"
                session_ids = await client.smembers(user_sessions_key)
                if len(session_ids) <= limit:
                    return

                sessions: list[tuple[str, str]] = []
                for sid in session_ids:
                    session_raw = await client.get(f"session:{sid}")
                    created_at = ""
                    if session_raw:
                        try:
                            payload = json.loads(session_raw)
                            created_at = payload.get("created_at", "")
                        except Exception:
                            created_at = ""
                    sessions.append((created_at, sid))

                # Evict oldest sessions first
                sessions.sort(key=lambda item: item[0] or "")
                overflow = sessions[:-limit] if len(sessions) > limit else []
                for _, sid in overflow:
                    await client.delete(f"session:{sid}")
                    await client.srem(user_sessions_key, sid)
                return

            if not self._fallback_enabled:
                return

            # Fallback store eviction
            user_sessions: list[tuple[str, str]] = []
            for sid, data in self._fallback_store.items():
                if data.get("user_id") == user_id:
                    user_sessions.append((data.get("created_at", ""), sid))

            if len(user_sessions) <= limit:
                return

            user_sessions.sort(key=lambda item: item[0] or "")
            overflow = user_sessions[:-limit] if len(user_sessions) > limit else []
            for _, sid in overflow:
                self._fallback_store.pop(sid, None)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to enforce session limit", user_id=user_id, error=str(exc))

    async def delete_user_sessions(self, user_id: str) -> int:
        """Delete all sessions for a user."""
        try:
            client = await self._get_redis()
            if not client:
                self._fallback_store = {
                    sid: data
                    for sid, data in self._fallback_store.items()
                    if data.get("user_id") != user_id
                }
                return 0
            user_sessions_key = f"user_sessions:{user_id}"

            # Get all session IDs for this user
            session_ids = await client.smembers(user_sessions_key)

            deleted_count = 0
            for session_id in session_ids:
                session_key = f"session:{session_id}"
                if await client.delete(session_key):
                    deleted_count += 1

            # Clean up the user sessions set
            await client.delete(user_sessions_key)

            logger.info(f"Deleted {deleted_count} sessions for user {user_id}")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete user sessions for {user_id}: {e}")
            return 0


# ============================================
# OAuth Service
# ============================================


class OAuthService:
    """OAuth service using Authlib."""

    def __init__(self, client_id: str | None = None, client_secret: str | None = None) -> None:
        self.client_id = client_id or ""
        self.client_secret = client_secret or ""

    def get_authorization_url(
        self, provider: OAuthProvider, redirect_uri: str, state: str | None = None
    ) -> tuple[str, str]:
        """Get authorization URL."""
        config = OAUTH_CONFIGS[provider]
        state = state or secrets.token_urlsafe(32)

        client = AsyncOAuth2Client(
            client_id=self.client_id,
            client_secret=self.client_secret,
            scope=config["scope"],
            redirect_uri=redirect_uri,
        )

        url = client.create_authorization_url(config["authorize_url"], state=state)
        return url, state

    async def exchange_code(
        self, provider: OAuthProvider, code: str, redirect_uri: str
    ) -> dict[str, Any]:
        """Exchange code for tokens."""
        config = OAUTH_CONFIGS[provider]

        client = AsyncOAuth2Client(
            client_id=self.client_id, client_secret=self.client_secret, redirect_uri=redirect_uri
        )

        token = await client.fetch_token(config["token_url"], code=code)
        return cast(dict[str, Any], token)

    async def get_user_info(self, provider: OAuthProvider, access_token: str) -> dict[str, Any]:
        """Get user info from provider."""
        config = OAUTH_CONFIGS[provider]

        client = AsyncOAuth2Client(token={"access_token": access_token})
        resp = await client.get(config["userinfo_url"])
        return cast(dict[str, Any], resp.json())


# ============================================
# API Key Service
# ============================================


class APIKeyService:
    """API key management with Redis."""

    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url or REDIS_URL
        self._redis: Any | None = None
        self._memory_keys: dict[str, dict[str, Any]] = {}
        self._memory_meta: dict[str, dict[str, Any]] = {}
        self._memory_lookup: dict[str, str] = {}
        self._serialize: Callable[[dict[str, Any]], str] = json.dumps
        self._deserialize: Callable[[str], dict[str, Any]] = json.loads
        try:
            environment = getattr(settings, "environment", None)
            env_value = (
                getattr(environment, "value", str(environment)) if environment else "development"
            )
        except Exception:  # pragma: no cover
            env_value = "development"
        self._fallback_allowed = str(env_value).lower() != "production"

    async def _get_redis(self) -> Any | None:
        """Get Redis connection."""
        if not REDIS_AVAILABLE:
            return None

        if self._redis is None and redis_async is not None:
            self._redis = redis_async.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def create_api_key(
        self, user_id: str, name: str, scopes: list[str] | None = None, tenant_id: str | None = None
    ) -> str:
        """
        Create API key with tenant binding.

        SECURITY: API keys MUST be bound to a tenant to prevent cross-tenant access.
        The tenant_id is stored with the key and populated in UserInfo during verification.

        NOTE: This method stores minimal data for backwards compatibility.
        For production use, prefer the enhanced API key creation in api_keys_router.py
        which includes hashing, metadata, and expiration.

        Args:
            user_id: User ID (UUID as string)
            name: Human-readable key name
            scopes: Optional permission scopes
            tenant_id: Tenant ID for multi-tenant isolation (REQUIRED for production)

        Returns:
            The generated API key (plaintext - only shown once)
        """
        import hashlib

        api_key = f"sk_{secrets.token_urlsafe(32)}"

        data = {
            "user_id": user_id,
            "name": name,
            "scopes": scopes or [],
            "tenant_id": tenant_id,  # SECURITY: Bind API key to tenant
            "created_at": datetime.now(UTC).isoformat(),
        }

        # SECURITY: Hash the API key before storing
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        client = await self._get_redis()
        if client:
            # Store with hash as key instead of plaintext
            await client.set(f"api_key:{api_key_hash}", json.dumps(data))
        else:
            if not self._fallback_allowed:
                raise RuntimeError("API key service unavailable: Redis connection required")
            # Fallback to memory (also use hash)
            self._memory_keys[api_key_hash] = data

        return api_key

    async def verify_api_key(self, api_key: str) -> dict[str, Any] | None:
        """
        Verify API key by hashing and looking up.

        SECURITY: The API key is hashed before lookup to prevent
        plaintext credential exposure in Redis. Also validates is_active
        and expires_at from metadata to prevent disabled/expired keys from working.
        """
        try:
            import hashlib

            # Hash the provided API key for lookup
            api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

            client = await self._get_redis()
            if client:
                data = await client.get(f"api_key:{api_key_hash}")
                if not data:
                    return None

                key_data: dict[str, Any] = json.loads(data)

                # SECURITY: Load metadata to check is_active and expires_at
                # First get the key_id from the lookup table
                key_id = await client.get(f"api_key_lookup:{api_key_hash}")
                if key_id:
                    if isinstance(key_id, bytes):
                        key_id = key_id.decode("utf-8")

                    # Load metadata
                    metadata_str = await client.get(f"api_key_meta:{key_id}")
                    if metadata_str:
                        metadata = self._deserialize(metadata_str)

                        # Check if key is active
                        if not metadata.get("is_active", True):
                            logger.warning(f"API key {key_id} is disabled")
                            return None

                        # Check if key is expired
                        expires_at_str = metadata.get("expires_at")
                        if expires_at_str:
                            expires_at = datetime.fromisoformat(expires_at_str)
                            if expires_at < datetime.now(UTC):
                                logger.warning(f"API key {key_id} is expired")
                                return None

                        # Merge metadata into key_data for backward compatibility
                        key_data.update(metadata)

                return key_data

            if not self._fallback_allowed:
                logger.error(
                    "API key verification failed: Redis unavailable and fallback disabled."
                )
                return None

            # Fallback to memory (also uses hash)
            return self._memory_keys.get(api_key_hash)
        except Exception as e:
            logger.error("Failed to verify API key", error=str(e))
            return None

    async def revoke_api_key(self, api_key: str) -> bool:
        """
        Revoke API key by hashing and deleting.

        SECURITY: The API key is hashed before deletion lookup.

        Args:
            api_key: The plaintext API key to revoke

        Returns:
            True if the key was revoked, False otherwise
        """
        try:
            import hashlib

            # Hash the API key for lookup
            api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

            client = await self._get_redis()
            if client:
                deleted_count = await client.delete(f"api_key:{api_key_hash}")
                return bool(deleted_count)
            if not self._fallback_allowed:
                logger.error("API key revocation failed: Redis unavailable and fallback disabled.")
                return False
            # Fallback to memory (also uses hash)
            return bool(self._memory_keys.pop(api_key_hash, None))
        except Exception as e:
            logger.error("Failed to revoke API key", error=str(e))
            return False

    async def revoke_api_key_by_hash(self, api_key_hash: str) -> bool:
        """
        Revoke API key using an already-computed hash.

        SECURITY: This method is for internal use when the hash is already available.
        Use revoke_api_key() when you have the plaintext key.

        Args:
            api_key_hash: The SHA-256 hash of the API key

        Returns:
            True if the key was revoked, False otherwise
        """
        try:
            client = await self._get_redis()
            if client:
                deleted_count = await client.delete(f"api_key:{api_key_hash}")
                return bool(deleted_count)
            if not self._fallback_allowed:
                logger.error("API key revocation failed: Redis unavailable and fallback disabled.")
                return False
            # Fallback to memory
            return bool(self._memory_keys.pop(api_key_hash, None))
        except Exception as e:
            logger.error("Failed to revoke API key by hash", error=str(e))
            return False


# ============================================
# Service Instances
# ============================================

# Global service instances
jwt_service = JWTService()

# SECURITY: Disable session fallback in production to ensure revocation works across workers
# In production, Redis is mandatory for proper session management
# Use settings.environment instead of os.getenv to respect .env files
try:
    _is_production = getattr(settings, "is_production", False)
except (ImportError, AttributeError):
    # Fallback if settings not available
    _is_production = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")

_require_redis_for_sessions = (
    os.getenv("REQUIRE_REDIS_SESSIONS", str(_is_production)).lower() == "true"
)

session_manager = SessionManager(
    fallback_enabled=not _require_redis_for_sessions,
    idle_timeout_seconds=SESSION_IDLE_TIMEOUT_SECONDS,
    max_sessions_per_user=MAX_SESSIONS_PER_USER,
)

oauth_service = OAuthService()
api_key_service = APIKeyService()

# ============================================
# Dependencies
# ============================================


async def _verify_token_with_fallback(
    token: str,
    expected_type: TokenType | None = None,
    *,
    leeway_seconds: int | float | None = None,
) -> dict[str, Any]:
    """Verify tokens using async path when available, falling back to the sync method.

    Args:
        token: JWT token to verify
        expected_type: Optional expected token type for validation
        leeway_seconds: Optional leeway for expiration validation

    Returns:
        Token claims dictionary
    """
    verify_async = getattr(jwt_service, "verify_token_async", None)
    if verify_async:
        try:
            result = verify_async(token, expected_type, leeway_seconds=leeway_seconds)
            if inspect.isawaitable(result):
                resolved = await result
                return cast(dict[str, Any], resolved)
            if isinstance(result, dict):
                return cast(dict[str, Any], result)
        except TypeError:
            # Mocked objects (MagicMock) may not support awaiting
            pass

    return jwt_service.verify_token(token, expected_type, leeway_seconds=leeway_seconds)


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_header),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserInfo:
    """Get current authenticated user from Bearer token, OAuth2, API key, or HttpOnly cookie.

    Authentication priority:
    1. Bearer token (JWT)
    2. OAuth2 token (JWT)
    3. HttpOnly cookie (JWT)
    4. API key

    SECURITY: All JWT tokens are validated for ACCESS token type to prevent
    refresh token reuse attacks. API keys are handled separately.
    """

    # Try Bearer token - must be ACCESS token
    if credentials and credentials.credentials:
        try:
            claims = await _verify_token_with_fallback(credentials.credentials, TokenType.ACCESS)
            await _enforce_active_session(claims)
            return _claims_to_user_info(claims)
        except HTTPException:
            pass

    # Try OAuth2 token - must be ACCESS token
    if token:
        try:
            claims = await _verify_token_with_fallback(token, TokenType.ACCESS)
            await _enforce_active_session(claims)
            return _claims_to_user_info(claims)
        except HTTPException:
            pass

    # Try HttpOnly cookie access token - must be ACCESS token
    access_token = request.cookies.get("access_token")
    if access_token:
        try:
            claims = await _verify_token_with_fallback(access_token, TokenType.ACCESS)
            await _enforce_active_session(claims)
            return _claims_to_user_info(claims)
        except HTTPException:
            pass

    # Try API key (no token type check needed - different auth mechanism)
    if api_key:
        key_data = await api_key_service.verify_api_key(api_key)
        if key_data:
            return UserInfo(
                user_id=key_data["user_id"],
                username=key_data["name"],
                roles=["api_user"],
                permissions=key_data.get("scopes", []),
                tenant_id=key_data.get("tenant_id"),  # SECURITY: Populate tenant_id for isolation
            )

    # No valid auth
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_optional(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_header),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserInfo | None:
    """Get current user if authenticated, None otherwise."""
    try:
        return await get_current_user(request, token, api_key, credentials)
    except HTTPException:
        return None


def _claims_to_user_info(claims: dict[str, Any]) -> UserInfo:
    """Convert JWT claims to UserInfo."""
    return UserInfo(
        user_id=claims.get("sub", ""),
        email=claims.get("email"),
        username=claims.get("username"),
        roles=claims.get("roles", []),
        permissions=claims.get("permissions", []),
        tenant_id=claims.get("tenant_id"),
        is_platform_admin=claims.get("is_platform_admin", False),
        # Partner multi-tenant fields
        partner_id=claims.get("partner_id"),
        managed_tenant_ids=claims.get("managed_tenant_ids", []),
        active_managed_tenant_id=claims.get("active_managed_tenant_id"),
    )


async def _enforce_active_session(claims: dict[str, Any]) -> None:
    """Validate that the session referenced in the token is still active and refresh TTL."""
    if claims.get("session_optional"):
        # Service or bootstrap tokens that intentionally skip session validation
        return

    session_id = claims.get("session_id")
    if not session_id:
        logger.warning(
            "Token missing session_id; rejecting for safety",
            user_id=claims.get("sub"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is required for this token",
        )

    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    session_user_id = session.get("user_id")
    if session_user_id and str(session_user_id) != str(claims.get("sub")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session does not match user",
        )

    await session_manager.touch_session(session_id)


# ============================================
# Utility Functions
# ============================================


def hash_password(password: str) -> str:
    """Hash password."""
    return str(pwd_context.hash(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password."""
    return bool(pwd_context.verify(plain_password, hashed_password))


def create_access_token(user_id: str, **kwargs: Any) -> str:
    """Create access token."""
    try:
        subject = str(ensure_uuid(user_id))
    except ValueError:
        # Allow non-UUID identifiers (e.g., legacy string IDs) for token creation
        subject = str(user_id)

    additional_claims = kwargs or None
    return jwt_service.create_access_token(subject, additional_claims)


def create_refresh_token(user_id: str, **kwargs: Any) -> str:
    """Create refresh token."""
    try:
        subject = str(ensure_uuid(user_id))
    except ValueError:
        subject = str(user_id)

    additional_claims = kwargs or None
    return jwt_service.create_refresh_token(subject, additional_claims)


# ============================================
# Configuration Function
# ============================================


def configure_auth(
    jwt_secret: str | None = None,
    jwt_algorithm: str | None = None,
    access_token_expire_minutes: int | None = None,
    refresh_token_expire_days: int | None = None,
    redis_url: str | None = None,
    session_idle_timeout_seconds: int | None = None,
    token_expiry_leeway_seconds: int | None = None,
    max_sessions_per_user: int | None = None,
) -> None:
    """Configure auth services."""
    global \
        JWT_SECRET, \
        JWT_ALGORITHM, \
        ACCESS_TOKEN_EXPIRE_MINUTES, \
        REFRESH_TOKEN_EXPIRE_DAYS, \
        REDIS_URL, \
        SESSION_IDLE_TIMEOUT_SECONDS, \
        TOKEN_EXP_LEEWAY_SECONDS, \
        MAX_SESSIONS_PER_USER
    global jwt_service, session_manager, oauth_service, api_key_service

    # Dynamic configuration requires "constant" reassignment
    if jwt_secret is not None:
        JWT_SECRET = jwt_secret
    if jwt_algorithm is not None:
        JWT_ALGORITHM = jwt_algorithm
    if access_token_expire_minutes is not None:
        ACCESS_TOKEN_EXPIRE_MINUTES = access_token_expire_minutes
    if refresh_token_expire_days is not None:
        REFRESH_TOKEN_EXPIRE_DAYS = refresh_token_expire_days
    if redis_url is not None:
        REDIS_URL = redis_url
    if session_idle_timeout_seconds is not None:
        SESSION_IDLE_TIMEOUT_SECONDS = session_idle_timeout_seconds
    if token_expiry_leeway_seconds is not None:
        TOKEN_EXP_LEEWAY_SECONDS = token_expiry_leeway_seconds
    if max_sessions_per_user is not None:
        MAX_SESSIONS_PER_USER = max_sessions_per_user

    # Recreate services with new config
    jwt_service = JWTService(JWT_SECRET, JWT_ALGORITHM)
    session_manager = SessionManager(
        redis_url=REDIS_URL,
        fallback_enabled=not _require_redis_for_sessions,
        idle_timeout_seconds=SESSION_IDLE_TIMEOUT_SECONDS,
        max_sessions_per_user=MAX_SESSIONS_PER_USER,
    )
    oauth_service = OAuthService()
    api_key_service = APIKeyService(REDIS_URL)
