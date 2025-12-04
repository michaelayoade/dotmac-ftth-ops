"""Tests for JWT token revocation and session management fixes."""

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from dotmac.platform.auth.core import JWTService, SessionManager, get_current_user

pytestmark = pytest.mark.integration


class TestJWTRevocation:
    """Test JWT token revocation functionality."""

    @pytest.fixture
    def jwt_service(self):
        """Create JWT service with mocked Redis."""
        return JWTService(secret="test-secret", redis_url="redis://localhost:6379")

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis_mock = AsyncMock()
        return redis_mock

    @pytest.mark.asyncio
    async def test_revoke_token_success(self, jwt_service, mock_redis):
        """Test successful token revocation."""
        # Create a token
        token = jwt_service.create_access_token("user123")

        with patch.object(jwt_service, "_get_redis", return_value=mock_redis):
            # Mock Redis operations
            mock_redis.setex = AsyncMock(return_value=True)
            mock_redis.set = AsyncMock(return_value=True)

            result = await jwt_service.revoke_token(token)

            assert result is True
            # Verify Redis was called to blacklist the token
            mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_token_no_redis(self, jwt_service):
        """Test token revocation when Redis is not available."""
        with patch.object(jwt_service, "_get_redis", return_value=None):
            result = await jwt_service.revoke_token("some-token")
            assert result is False

    @pytest.mark.asyncio
    async def test_revoke_token_invalid_token(self, jwt_service, mock_redis):
        """Test revoking invalid token."""
        with patch.object(jwt_service, "_get_redis", return_value=mock_redis):
            result = await jwt_service.revoke_token("invalid-token")
            assert result is False

    @pytest.mark.asyncio
    async def test_is_token_revoked(self, jwt_service, mock_redis):
        """Test checking if token is revoked."""
        with patch.object(jwt_service, "_get_redis", return_value=mock_redis):
            mock_redis.exists = AsyncMock(return_value=True)

            is_revoked = await jwt_service.is_token_revoked("test-jti")

            assert is_revoked is True
            mock_redis.exists.assert_called_once_with("blacklist:test-jti")

    @pytest.mark.asyncio
    async def test_verify_token_async_with_revoked_token(self, jwt_service, mock_redis):
        """Test token verification fails for revoked token."""
        # Create a token
        token = jwt_service.create_access_token("user123")

        with patch.object(jwt_service, "_get_redis", return_value=mock_redis):
            # Mock token as revoked
            with patch.object(jwt_service, "is_token_revoked", return_value=True):
                with pytest.raises(Exception):  # Should raise HTTPException  # noqa: B017
                    await jwt_service.verify_token_async(token)

    @pytest.mark.asyncio
    async def test_verify_token_async_success(self, jwt_service, mock_redis):
        """Test successful async token verification."""
        token = jwt_service.create_access_token("user123")

        with patch.object(jwt_service, "_get_redis", return_value=mock_redis):
            with patch.object(jwt_service, "is_token_revoked", return_value=False):
                claims = await jwt_service.verify_token_async(token)

                assert claims["sub"] == "user123"
                assert claims["type"] == "access"

    def test_is_token_revoked_sync(self, jwt_service):
        """Test synchronous token revocation check."""
        with patch("dotmac.platform.core.caching.get_redis") as mock_get_redis:
            mock_redis = MagicMock()
            mock_get_redis.return_value = mock_redis
            mock_redis.exists.return_value = True

            is_revoked = jwt_service.is_token_revoked_sync("test-jti")

            assert is_revoked is True
            mock_redis.exists.assert_called_once_with("blacklist:test-jti")

    def test_is_token_revoked_sync_no_redis(self, jwt_service):
        """Test sync revocation check when Redis is not available."""
        with patch("dotmac.platform.core.caching.get_redis") as mock_get_redis:
            mock_get_redis.return_value = None

            is_revoked = jwt_service.is_token_revoked_sync("test-jti")

            assert is_revoked is False

    def test_is_token_revoked_sync_error(self, jwt_service):
        """Test sync revocation check with Redis error."""
        with patch("dotmac.platform.core.caching.get_redis") as mock_get_redis:
            mock_redis = MagicMock()
            mock_get_redis.return_value = mock_redis
            mock_redis.exists.side_effect = Exception("Redis connection error")

            is_revoked = jwt_service.is_token_revoked_sync("test-jti")

            assert is_revoked is False

    def test_verify_token_sync_with_revoked_token(self, jwt_service):
        """Test sync token verification fails for revoked token."""
        # Create a token
        token = jwt_service.create_access_token("user123")

        with patch.object(jwt_service, "is_token_revoked_sync", return_value=True):
            with pytest.raises(Exception):  # Should raise HTTPException  # noqa: B017
                jwt_service.verify_token(token)

    def test_verify_token_sync_success(self, jwt_service):
        """Test successful sync token verification with blacklist check."""
        token = jwt_service.create_access_token("user123")

        with patch.object(jwt_service, "is_token_revoked_sync", return_value=False):
            claims = jwt_service.verify_token(token)

            assert claims["sub"] == "user123"
            assert claims["type"] == "access"


class TestAuthenticationDependencyFix:
    """Test that get_current_user properly uses async token verification."""

    @pytest.fixture
    def jwt_service_mock(self):
        """Mock JWT service."""
        mock_service = MagicMock()
        mock_service.verify_token_async = AsyncMock()
        return mock_service

    @pytest.fixture
    def api_key_service_mock(self):
        """Mock API key service."""
        mock_service = AsyncMock()
        return mock_service

    @pytest.mark.asyncio
    async def test_get_current_user_bearer_token_revoked(
        self, jwt_service_mock, api_key_service_mock
    ):
        """Test get_current_user rejects revoked bearer token."""
        # Mock revoked token (async verification fails)
        jwt_service_mock.verify_token_async.side_effect = HTTPException(
            status_code=401, detail="Token has been revoked"
        )

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="revoked-token")
        mock_request = Mock(spec=Request)
        mock_request.cookies = {}

        with patch("dotmac.platform.auth.core.jwt_service", jwt_service_mock):
            with patch("dotmac.platform.auth.core.api_key_service", api_key_service_mock):
                with pytest.raises(HTTPException) as exc_info:
                    await get_current_user(
                        request=mock_request, token=None, api_key=None, credentials=credentials
                    )

                assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_oauth_token_revoked(
        self, jwt_service_mock, api_key_service_mock
    ):
        """Test get_current_user rejects revoked OAuth token."""
        # Mock revoked token
        jwt_service_mock.verify_token_async.side_effect = HTTPException(
            status_code=401, detail="Token has been revoked"
        )

        mock_request = Mock(spec=Request)
        mock_request.cookies = {}

        with patch("dotmac.platform.auth.core.jwt_service", jwt_service_mock):
            with patch("dotmac.platform.auth.core.api_key_service", api_key_service_mock):
                with pytest.raises(HTTPException) as exc_info:
                    await get_current_user(
                        request=mock_request,
                        token="revoked-oauth-token",
                        api_key=None,
                        credentials=None,
                    )

                assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_valid_token_success(
        self, jwt_service_mock, api_key_service_mock
    ):
        """Test get_current_user works with valid token."""
        # Mock valid token
        jwt_service_mock.verify_token_async.return_value = {
            "sub": "user123",
            "type": "access",
            "exp": (datetime.now(UTC) + timedelta(hours=1)).timestamp(),
            "iat": datetime.now(UTC).timestamp(),
        }

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        mock_request = Mock(spec=Request)
        mock_request.cookies = {}

        with patch("dotmac.platform.auth.core.jwt_service", jwt_service_mock):
            with patch("dotmac.platform.auth.core.api_key_service", api_key_service_mock):
                user_info = await get_current_user(
                    request=mock_request, token=None, api_key=None, credentials=credentials
                )

                assert user_info.user_id == "user123"
                # Verify async version called with token and token type
                from dotmac.platform.auth.core import TokenType

                jwt_service_mock.verify_token_async.assert_called_once_with(
                    "valid-token", TokenType.ACCESS
                )

    @pytest.mark.asyncio
    async def test_get_current_user_uses_async_verification(
        self, jwt_service_mock, api_key_service_mock
    ):
        """Test that get_current_user calls the async version that checks blacklist."""
        jwt_service_mock.verify_token_async.return_value = {
            "sub": "test_user",
            "type": "access",
            "exp": (datetime.now(UTC) + timedelta(hours=1)).timestamp(),
            "iat": datetime.now(UTC).timestamp(),
        }

        mock_request = Mock(spec=Request)
        mock_request.cookies = {}

        with patch("dotmac.platform.auth.core.jwt_service", jwt_service_mock):
            with patch("dotmac.platform.auth.core.api_key_service", api_key_service_mock):
                await get_current_user(
                    request=mock_request, token="test-token", api_key=None, credentials=None
                )

                # Verify async version was called (which includes blacklist check)
                from dotmac.platform.auth.core import TokenType

                jwt_service_mock.verify_token_async.assert_called_once_with(
                    "test-token", TokenType.ACCESS
                )
                # Verify sync version was NOT called
                assert (
                    not hasattr(jwt_service_mock, "verify_token")
                    or not jwt_service_mock.verify_token.called
                )


class TestSessionManagerEnhancements:
    """Test enhanced session management functionality."""

    @pytest.fixture
    def session_manager(self):
        """Create session manager."""
        return SessionManager(redis_url="redis://localhost:6379")

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis_mock = AsyncMock()
        return redis_mock

    @pytest.mark.asyncio
    async def test_create_session_with_user_tracking(self, session_manager, mock_redis):
        """Test session creation with user session tracking."""
        with patch.object(session_manager, "_get_redis", return_value=mock_redis):
            mock_redis.setex = AsyncMock()
            mock_redis.sadd = AsyncMock()
            mock_redis.expire = AsyncMock()

            session_id = await session_manager.create_session(
                user_id="user123", data={"test": "data"}, ttl=3600
            )

            assert session_id is not None
            # Verify session was stored
            mock_redis.setex.assert_called_once()
            # Verify user session tracking
            mock_redis.sadd.assert_called_once()
            mock_redis.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_sessions(self, session_manager, mock_redis):
        """Test deleting all sessions for a user."""
        with patch.object(session_manager, "_get_redis", return_value=mock_redis):
            # Mock existing sessions
            mock_redis.smembers = AsyncMock(return_value=["session1", "session2", "session3"])
            mock_redis.delete = AsyncMock(return_value=1)

            deleted_count = await session_manager.delete_user_sessions("user123")

            assert deleted_count == 3
            # Verify all sessions were deleted
            assert mock_redis.delete.call_count == 4  # 3 sessions + 1 user sessions set

    @pytest.mark.asyncio
    async def test_delete_session_with_user_cleanup(self, session_manager, mock_redis):
        """Test session deletion with user session set cleanup."""
        session_data = {
            "user_id": "user123",
            "created_at": datetime.now(UTC).isoformat(),
            "data": {"test": "data"},
        }

        with patch.object(session_manager, "_get_redis", return_value=mock_redis):
            mock_redis.get = AsyncMock(return_value=json.dumps(session_data))
            mock_redis.srem = AsyncMock()
            mock_redis.delete = AsyncMock(return_value=1)

            result = await session_manager.delete_session("session123")

            assert result is True
            # Verify session was removed from user sessions set
            mock_redis.srem.assert_called_once_with("user_sessions:user123", "session123")


class TestAuthRouterFixes:
    """Test auth router fixes for logout and refresh token."""

    @pytest.fixture
    def test_client(self):
        """Create test client for the auth router."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from dotmac.platform.auth.router import auth_router

        app = FastAPI()
        app.include_router(auth_router)

        return TestClient(app)

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.close = AsyncMock()
        return session

    @pytest.fixture
    def mock_jwt_service(self):
        """Create mock JWT service."""
        service = MagicMock()
        service.verify_token.return_value = {"sub": "user123", "jti": "test-jti", "type": "refresh"}
        service.revoke_token = AsyncMock(return_value=True)
        service.create_access_token.return_value = "new-access-token"
        service.create_refresh_token.return_value = "new-refresh-token"
        return service

    @pytest.fixture
    def mock_session_manager(self):
        """Create mock session manager."""
        manager = AsyncMock()
        manager.delete_user_sessions = AsyncMock(return_value=2)
        return manager

    def test_logout_with_proper_cleanup(self, mock_jwt_service, mock_session_manager, test_client):
        """Test logout properly cleans up tokens and sessions."""

        # Patch module-level objects
        with patch("dotmac.platform.auth.router.jwt_service", mock_jwt_service):
            with patch("dotmac.platform.auth.router.session_manager", mock_session_manager):
                response = test_client.post(
                    "/auth/logout", headers={"Authorization": "Bearer test-token"}
                )

                assert response.status_code == 200
                result = response.json()
                assert result["message"] == "Logged out successfully"
                assert result["sessions_deleted"] == 2

                # Verify token was revoked
                mock_jwt_service.revoke_token.assert_called_once_with("test-token")
                # Verify sessions were deleted
                mock_session_manager.delete_user_sessions.assert_called_once_with("user123")

    def test_refresh_token_revokes_old_token(self, mock_jwt_service, mock_session, test_client):
        """Test refresh token flow revokes old refresh token."""
        from fastapi import FastAPI

        from dotmac.platform.db import get_session_dependency

        app: FastAPI = test_client.app

        # Mock user
        mock_user = MagicMock()
        mock_user.id = "user123"
        mock_user.username = "testuser"
        mock_user.email = "test@example.com"
        mock_user.roles = ["user"]
        mock_user.tenant_id = "tenant123"
        mock_user.is_active = True

        # Create mock dependencies
        async def mock_get_session():
            yield mock_session

        mock_user_service = AsyncMock()
        mock_user_service.get_user_by_id = AsyncMock(return_value=mock_user)

        # Create mock UserService class that returns our mock instance
        class MockUserServiceClass:
            def __init__(self, session):
                pass

            def __new__(cls, session):
                return mock_user_service

        # Set up dependency overrides
        app.dependency_overrides[get_session_dependency] = mock_get_session

        # Patch module-level objects and UserService class
        with patch("dotmac.platform.auth.router.jwt_service", mock_jwt_service):
            with patch("dotmac.platform.auth.router.UserService", MockUserServiceClass):
                try:
                    response = test_client.post(
                        "/auth/refresh", json={"refresh_token": "old-refresh-token"}
                    )

                    assert response.status_code == 200
                    result = response.json()
                    assert result["access_token"] == "new-access-token"
                    assert result["refresh_token"] == "new-refresh-token"

                    # Verify old refresh token was revoked
                    mock_jwt_service.revoke_token.assert_called_once_with("old-refresh-token")
                finally:
                    app.dependency_overrides.clear()


class TestIntegrationTokenRevocation:
    """Integration tests for token revocation flow."""

    @pytest.mark.asyncio
    async def test_full_token_lifecycle(self):
        """Test complete token lifecycle: create, use, revoke, verify."""
        # This would be an integration test with actual Redis
        # For now, we'll test the components work together correctly
        jwt_service = JWTService(secret="test-secret")

        # Create token
        token = jwt_service.create_access_token("user123")

        # Verify token works
        claims = jwt_service.verify_token(token)
        assert claims["sub"] == "user123"

        # Mock Redis for revocation test
        with patch.object(jwt_service, "_get_redis") as mock_get_redis:
            mock_redis = AsyncMock()
            mock_get_redis.return_value = mock_redis
            mock_redis.setex = AsyncMock()

            # Revoke token
            revoked = await jwt_service.revoke_token(token)
            assert revoked is True

            # Verify revocation was stored
            mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_session_and_token_coordination(self):
        """Test that session management and token revocation work together."""
        session_manager = SessionManager()
        jwt_service = JWTService(secret="test-secret")

        with patch.object(session_manager, "_get_redis") as mock_session_redis:
            with patch.object(jwt_service, "_get_redis") as mock_jwt_redis:
                # Setup mocks
                mock_session_client = AsyncMock()
                mock_jwt_client = AsyncMock()
                mock_session_redis.return_value = mock_session_client
                mock_jwt_redis.return_value = mock_jwt_client

                # Mock session operations
                mock_session_client.setex = AsyncMock()
                mock_session_client.sadd = AsyncMock()
                mock_session_client.expire = AsyncMock()
                mock_session_client.smembers = AsyncMock(return_value=["session1", "session2"])
                mock_session_client.delete = AsyncMock(return_value=1)

                # Mock token operations
                mock_jwt_client.setex = AsyncMock()

                # Create session
                session_id = await session_manager.create_session("user123", {"test": "data"})
                assert session_id is not None

                # Create and revoke token
                token = jwt_service.create_access_token("user123")
                revoked = await jwt_service.revoke_token(token)
                assert revoked is True

                # Delete user sessions
                deleted = await session_manager.delete_user_sessions("user123")
                assert deleted == 2

                # Verify all operations were called
                mock_session_client.setex.assert_called()
                mock_jwt_client.setex.assert_called()
                assert mock_session_client.delete.call_count == 3  # 2 sessions + 1 set
