"""Comprehensive tests for auth/token_with_rbac.py (0% coverage -> 90%+)

Tests the RBAC-enhanced JWT token service including:
- Access token creation with permissions and roles
- Refresh token creation
- Token verification with permission checks
- Token refresh flow
- Token revocation and blacklisting
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import uuid4

import pytest

from dotmac.platform.auth.core import JWTService
from dotmac.platform.auth.exceptions import InvalidToken
from dotmac.platform.auth.models import Role
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.auth.token_with_rbac import RBACTokenService, get_rbac_token_service
from dotmac.platform.user_management.models import User


@pytest.fixture
def jwt_service():
    """Create mock JWT service."""
    service = Mock(spec=JWTService)
    service._create_token = Mock(return_value="mocked_jwt_token")
    service.verify_token = Mock(
        return_value={
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read", "user.write"],
            "roles": ["admin"],
            "exp": (datetime.now(UTC) + timedelta(hours=1)).timestamp(),
        }
    )
    return service


@pytest.fixture
def rbac_service():
    """Create mock RBAC service."""
    service = AsyncMock(spec=RBACService)

    # Mock get_user_permissions
    service.get_user_permissions = AsyncMock(
        return_value={"user.read", "user.write", "admin.role.manage"}
    )

    # Mock get_user_roles
    admin_role = Mock(spec=Role)
    admin_role.name = "admin"
    user_role = Mock(spec=Role)
    user_role.name = "user"
    service.get_user_roles = AsyncMock(return_value=[admin_role, user_role])

    return service


@pytest.fixture
def test_user():
    """Create test user."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.email = "test@example.com"
    user.username = "testuser"
    user.tenant_id = uuid4()
    user.is_active = True
    return user


@pytest.fixture
def rbac_token_service(jwt_service, rbac_service):
    """Create RBAC token service instance."""
    return RBACTokenService(jwt_service, rbac_service)


@pytest.fixture
def mock_cache():
    """Mock cache functions."""
    with (
        patch("dotmac.platform.auth.token_with_rbac.cache_set") as mock_set,
        patch("dotmac.platform.auth.token_with_rbac.cache_get") as mock_get,
    ):
        mock_get.return_value = None
        yield {"set": mock_set, "get": mock_get}


@pytest.fixture
def mock_settings():
    """Mock settings."""
    with patch("dotmac.platform.auth.token_with_rbac.settings") as mock:
        # Create nested jwt settings
        mock.jwt = Mock()
        mock.jwt.access_token_expire_minutes = 15
        mock.jwt.refresh_token_expire_days = 7
        mock.jwt.algorithm = "HS256"
        mock.jwt.secret_key = "test-secret-key"
        yield mock


# ==================== Access Token Creation Tests ====================


@pytest.mark.unit
class TestAccessTokenCreation:
    """Test access token creation with RBAC."""

    @pytest.mark.asyncio
    async def test_create_access_token_success(
        self, rbac_token_service, test_user, jwt_service, rbac_service, mock_cache, mock_settings
    ):
        """Test successful access token creation with permissions and roles."""
        db_session = Mock()

        token = await rbac_token_service.create_access_token(test_user, db_session)

        assert token == "mocked_jwt_token"

        # Verify RBAC service was called
        rbac_service.get_user_permissions.assert_called_once_with(test_user.id)
        rbac_service.get_user_roles.assert_called_once_with(test_user.id)

        # Verify JWT service was called with correct claims
        jwt_service._create_token.assert_called_once()
        claims = jwt_service._create_token.call_args[0][0]

        assert claims["sub"] == str(test_user.id)
        assert claims["email"] == test_user.email
        assert claims["username"] == test_user.username
        assert "user.read" in claims["permissions"]
        assert "user.write" in claims["permissions"]
        assert "admin" in claims["roles"]
        assert "user" in claims["roles"]
        assert claims["type"] == "access"
        # exp and iat are added by _create_token, not in the claims parameter

    @pytest.mark.asyncio
    async def test_create_access_token_with_custom_expiry(
        self, rbac_token_service, test_user, jwt_service, mock_cache, mock_settings
    ):
        """Test access token creation with custom expiration."""
        db_session = Mock()
        custom_delta = timedelta(hours=2)

        token = await rbac_token_service.create_access_token(
            test_user, db_session, expires_delta=custom_delta
        )

        assert token == "mocked_jwt_token"

        # Verify custom expiration delta was passed to _create_token
        jwt_service._create_token.assert_called_once()
        expires_delta_arg = jwt_service._create_token.call_args[0][1]

        # Should be ~2 hours
        assert expires_delta_arg.total_seconds() == 7200  # 2 hours

    @pytest.mark.asyncio
    async def test_create_access_token_with_additional_claims(
        self, rbac_token_service, test_user, jwt_service, mock_cache, mock_settings
    ):
        """Test access token creation with additional custom claims."""
        db_session = Mock()
        additional = {"custom_claim": "custom_value", "another": 123}

        await rbac_token_service.create_access_token(
            test_user, db_session, additional_claims=additional
        )

        claims = jwt_service._create_token.call_args[0][0]
        assert claims["custom_claim"] == "custom_value"
        assert claims["another"] == 123

    @pytest.mark.asyncio
    async def test_create_access_token_caches_metadata(
        self, rbac_token_service, test_user, jwt_service, mock_cache, mock_settings
    ):
        """Test that token metadata is cached."""
        db_session = Mock()

        await rbac_token_service.create_access_token(test_user, db_session)

        # Verify cache was set
        mock_cache["set"].assert_called_once()
        call_args = mock_cache["set"].call_args

        # Check cache key format
        cache_key = call_args[0][0]
        assert cache_key.startswith(f"token:{test_user.id}:")

        # Check cached data
        cached_data = call_args[0][1]
        assert cached_data["user_id"] == str(test_user.id)
        assert "permissions" in cached_data
        assert "roles" in cached_data

    @pytest.mark.asyncio
    async def test_create_access_token_user_without_tenant(
        self, rbac_token_service, jwt_service, mock_cache, mock_settings
    ):
        """Test access token creation for user without tenant_id."""
        user = Mock(spec=User)
        user.id = uuid4()
        user.email = "test@example.com"
        user.username = "testuser"
        user.tenant_id = None  # Explicitly set to None

        db_session = Mock()

        await rbac_token_service.create_access_token(user, db_session)

        claims = jwt_service._create_token.call_args[0][0]
        assert claims["tenant_id"] is None


# ==================== Refresh Token Creation Tests ====================


@pytest.mark.unit
class TestRefreshTokenCreation:
    """Test refresh token creation."""

    @pytest.mark.asyncio
    async def test_create_refresh_token_success(
        self, rbac_token_service, test_user, jwt_service, mock_settings
    ):
        """Test successful refresh token creation."""
        token = await rbac_token_service.create_refresh_token(test_user)

        assert token == "mocked_jwt_token"

        # Verify JWT service was called
        jwt_service._create_token.assert_called_once()
        claims = jwt_service._create_token.call_args[0][0]

        assert claims["sub"] == str(test_user.id)
        assert claims["type"] == "refresh"
        # exp and iat are added by _create_token, not in the claims parameter
        # Refresh tokens should NOT include permissions
        assert "permissions" not in claims
        assert "roles" not in claims

    @pytest.mark.asyncio
    async def test_create_refresh_token_with_custom_expiry(
        self, rbac_token_service, test_user, jwt_service, mock_settings
    ):
        """Test refresh token creation with custom expiration."""
        custom_delta = timedelta(days=14)

        token = await rbac_token_service.create_refresh_token(test_user, expires_delta=custom_delta)

        assert token == "mocked_jwt_token"

        # Verify custom expiration delta was passed to _create_token
        expires_delta_arg = jwt_service._create_token.call_args[0][1]

        # Expiration should be 14 days
        total_days = expires_delta_arg.total_seconds() / 86400
        assert total_days == 14.0

    @pytest.mark.asyncio
    async def test_create_refresh_token_default_expiry(
        self, rbac_token_service, test_user, jwt_service, mock_settings
    ):
        """Test refresh token uses default expiry from settings."""
        mock_settings.jwt.refresh_token_expire_days = 7

        await rbac_token_service.create_refresh_token(test_user)

        # Verify default expiration delta was used
        expires_delta_arg = jwt_service._create_token.call_args[0][1]

        total_days = expires_delta_arg.total_seconds() / 86400
        assert total_days == 7.0


# ==================== Token Verification Tests ====================


@pytest.mark.unit
class TestTokenVerification:
    """Test token verification with permission checks."""

    @pytest.mark.asyncio
    async def test_verify_token_success(self, rbac_token_service, jwt_service):
        """Test successful token verification."""
        token = "valid_token"

        payload = await rbac_token_service.verify_token_with_permissions(token)

        jwt_service.verify_token.assert_called_once_with(token)
        assert payload["type"] == "access"

    @pytest.mark.asyncio
    async def test_verify_token_with_required_permissions_all(
        self, rbac_token_service, jwt_service
    ):
        """Test token verification with all required permissions."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read", "user.write", "user.delete"],
            "roles": ["admin"],
        }

        # User has all required permissions
        payload = await rbac_token_service.verify_token_with_permissions(
            token,
            required_permissions=["user.read", "user.write"],
            require_all_permissions=True,
        )

        assert payload is not None

    @pytest.mark.asyncio
    async def test_verify_token_missing_required_permissions(self, rbac_token_service, jwt_service):
        """Test token verification fails when missing required permissions."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read"],  # Missing user.write
            "roles": ["admin"],
        }

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.verify_token_with_permissions(
                token,
                required_permissions=["user.read", "user.write"],
                require_all_permissions=True,
            )

        assert "Missing required permissions" in str(exc.value)

    @pytest.mark.asyncio
    async def test_verify_token_with_any_permission(self, rbac_token_service, jwt_service):
        """Test token verification with ANY required permission."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read"],  # Has one of the required
            "roles": ["admin"],
        }

        # User has at least one required permission
        payload = await rbac_token_service.verify_token_with_permissions(
            token,
            required_permissions=["user.read", "user.write"],
            require_all_permissions=False,
        )

        assert payload is not None

    @pytest.mark.asyncio
    async def test_verify_token_no_matching_permissions(self, rbac_token_service, jwt_service):
        """Test token verification fails when no matching permissions."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["other.permission"],
            "roles": ["admin"],
        }

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.verify_token_with_permissions(
                token,
                required_permissions=["user.read", "user.write"],
                require_all_permissions=False,
            )

        assert "at least one of" in str(exc.value)

    @pytest.mark.asyncio
    async def test_verify_token_with_required_roles(self, rbac_token_service, jwt_service):
        """Test token verification with required roles."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read"],
            "roles": ["admin", "user"],
        }

        # User has one of the required roles
        payload = await rbac_token_service.verify_token_with_permissions(
            token, required_roles=["admin", "superadmin"]
        )

        assert payload is not None

    @pytest.mark.asyncio
    async def test_verify_token_missing_required_roles(self, rbac_token_service, jwt_service):
        """Test token verification fails when missing required roles."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": ["user.read"],
            "roles": ["user"],
        }

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.verify_token_with_permissions(
                token, required_roles=["admin", "superadmin"]
            )

        assert "Requires one of these roles" in str(exc.value)

    @pytest.mark.asyncio
    async def test_verify_token_invalid_signature(self, rbac_token_service, jwt_service):
        """Test token verification fails with invalid signature."""
        from jwt.exceptions import InvalidSignatureError

        token = "invalid_token"
        jwt_service.verify_token.side_effect = InvalidSignatureError("Invalid signature")

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.verify_token_with_permissions(token)

        assert "Invalid or expired token" in str(exc.value)

    @pytest.mark.asyncio
    async def test_verify_token_not_access_token(self, rbac_token_service, jwt_service):
        """Test verification fails for non-access tokens."""
        token = "refresh_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "refresh",  # Not an access token
        }

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.verify_token_with_permissions(token)

        assert "not an access token" in str(exc.value)


# ==================== Token Refresh Tests ====================


@pytest.mark.unit
class TestTokenRefresh:
    """Test token refresh functionality."""

    @pytest.mark.asyncio
    async def test_refresh_access_token_success(
        self, rbac_token_service, test_user, jwt_service, mock_cache, mock_settings
    ):
        """Test successful token refresh."""
        refresh_token = "valid_refresh_token"

        # Mock refresh token verification
        jwt_service.verify_token.return_value = {
            "sub": str(test_user.id),
            "type": "refresh",
        }

        # Mock database session
        db_session = MagicMock()
        db_session.query.return_value.filter_by.return_value.first.return_value = test_user

        access_token, new_refresh_token = await rbac_token_service.refresh_access_token(
            refresh_token, db_session
        )

        assert access_token == "mocked_jwt_token"
        assert new_refresh_token == "mocked_jwt_token"

    @pytest.mark.asyncio
    async def test_refresh_access_token_invalid_token(self, rbac_token_service, jwt_service):
        """Test token refresh with invalid token."""
        from jwt.exceptions import DecodeError

        refresh_token = "invalid_token"
        jwt_service.verify_token.side_effect = DecodeError("Invalid token")

        db_session = Mock()

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.refresh_access_token(refresh_token, db_session)

        assert "Invalid refresh token" in str(exc.value)

    @pytest.mark.asyncio
    async def test_refresh_access_token_not_refresh_type(self, rbac_token_service, jwt_service):
        """Test token refresh fails with access token."""
        refresh_token = "access_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",  # Not a refresh token
        }

        db_session = Mock()

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.refresh_access_token(refresh_token, db_session)

        assert "not a refresh token" in str(exc.value)

    @pytest.mark.asyncio
    async def test_refresh_access_token_user_not_found(self, rbac_token_service, jwt_service):
        """Test token refresh fails when user not found."""
        refresh_token = "valid_refresh_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "refresh",
        }

        # User not found in database
        db_session = MagicMock()
        db_session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.refresh_access_token(refresh_token, db_session)

        assert "User not found" in str(exc.value)

    @pytest.mark.asyncio
    async def test_refresh_access_token_user_inactive(
        self, rbac_token_service, test_user, jwt_service
    ):
        """Test token refresh fails for inactive user."""
        refresh_token = "valid_refresh_token"
        jwt_service.verify_token.return_value = {
            "sub": str(test_user.id),
            "type": "refresh",
        }

        # User is inactive
        test_user.is_active = False

        db_session = MagicMock()
        db_session.query.return_value.filter_by.return_value.first.return_value = test_user

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.refresh_access_token(refresh_token, db_session)

        assert "disabled" in str(exc.value)


# ==================== Token Revocation Tests ====================


@pytest.mark.unit
class TestTokenRevocation:
    """Test token revocation and blacklisting."""

    @pytest.mark.asyncio
    async def test_revoke_token_success(self, rbac_token_service, jwt_service, mock_cache):
        """Test successful token revocation."""
        token = "valid_token"
        future_exp = (datetime.now(UTC) + timedelta(hours=1)).timestamp()

        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "exp": future_exp,
        }

        await rbac_token_service.revoke_token(token)

        # Verify token was added to blacklist
        mock_cache["set"].assert_called_once()
        call_args = mock_cache["set"].call_args
        assert call_args[0][0].startswith("blacklist:")
        assert call_args[0][1] is True

    @pytest.mark.asyncio
    async def test_revoke_token_already_expired(self, rbac_token_service, jwt_service, mock_cache):
        """Test revoking already expired token does nothing."""
        token = "expired_token"
        past_exp = (datetime.now(UTC) - timedelta(hours=1)).timestamp()

        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "exp": past_exp,
        }

        await rbac_token_service.revoke_token(token)

        # Should not add to blacklist (already expired)
        mock_cache["set"].assert_not_called()

    @pytest.mark.asyncio
    async def test_revoke_invalid_token(self, rbac_token_service, jwt_service, mock_cache):
        """Test revoking invalid token doesn't raise error."""
        from jwt.exceptions import DecodeError

        token = "invalid_token"
        jwt_service.verify_token.side_effect = DecodeError("Invalid")

        # Should not raise error
        await rbac_token_service.revoke_token(token)

        mock_cache["set"].assert_not_called()

    @pytest.mark.asyncio
    async def test_is_token_revoked_true(self, rbac_token_service, mock_cache):
        """Test checking if token is revoked (true case)."""
        token = "revoked_token"
        mock_cache["get"].return_value = True

        is_revoked = await rbac_token_service.is_token_revoked(token)

        assert is_revoked is True
        mock_cache["get"].assert_called_once_with(f"blacklist:{token[:50]}")

    @pytest.mark.asyncio
    async def test_is_token_revoked_false(self, rbac_token_service, mock_cache):
        """Test checking if token is revoked (false case)."""
        token = "active_token"
        mock_cache["get"].return_value = None

        is_revoked = await rbac_token_service.is_token_revoked(token)

        assert is_revoked is False


# ==================== Get User From Token Tests ====================


@pytest.mark.unit
class TestGetUserFromToken:
    """Test getting user from token."""

    @pytest.mark.asyncio
    async def test_get_user_from_token_success(self, rbac_token_service, test_user, jwt_service):
        """Test successfully getting user from token."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(test_user.id),
            "type": "access",
            "permissions": ["user.read", "user.write"],
            "roles": ["admin"],
        }

        db_session = MagicMock()
        db_session.query.return_value.filter_by.return_value.first.return_value = test_user

        user, permissions, roles = await rbac_token_service.get_user_from_token(token, db_session)

        assert user == test_user
        assert "user.read" in permissions
        assert "admin" in roles

    @pytest.mark.asyncio
    async def test_get_user_from_token_user_not_found(self, rbac_token_service, jwt_service):
        """Test getting user from token when user doesn't exist."""
        token = "valid_token"
        jwt_service.verify_token.return_value = {
            "sub": str(uuid4()),
            "type": "access",
            "permissions": [],
            "roles": [],
        }

        db_session = MagicMock()
        db_session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(InvalidToken) as exc:
            await rbac_token_service.get_user_from_token(token, db_session)

        assert "User not found" in str(exc.value)


# ==================== Factory Function Test ====================


@pytest.mark.unit
class TestFactoryFunction:
    """Test factory function."""

    def test_get_rbac_token_service_factory(self, jwt_service, rbac_service):
        """Test factory function creates service correctly."""
        service = get_rbac_token_service(jwt_service, rbac_service)

        assert isinstance(service, RBACTokenService)
        assert service.jwt_service == jwt_service
        assert service.rbac_service == rbac_service
