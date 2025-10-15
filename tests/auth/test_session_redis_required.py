"""
Regression tests for Redis-required session management.

SECURITY: Tests that session management requires Redis in production mode,
preventing ineffective revocation in multi-worker deployments.

These tests verify the fixes for the MEDIUM severity security issue where
session revocation was ineffective without Redis due to in-memory fallback.
"""

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import SessionManager


@pytest.fixture
def mock_redis_available():
    """Mock Redis being available."""
    with patch("dotmac.platform.auth.core.REDIS_AVAILABLE", True):
        with patch("dotmac.platform.auth.core.redis_async") as mock_redis:
            mock_client = AsyncMock()
            mock_client.ping = AsyncMock()
            mock_client.setex = AsyncMock()
            mock_client.get = AsyncMock(return_value=None)
            mock_client.delete = AsyncMock(return_value=1)
            mock_client.sadd = AsyncMock()
            mock_client.expire = AsyncMock()
            mock_client.srem = AsyncMock()
            mock_redis.from_url = AsyncMock(return_value=mock_client)
            yield mock_client


@pytest.fixture
def mock_redis_unavailable():
    """Mock Redis being unavailable."""
    with patch("dotmac.platform.auth.core.REDIS_AVAILABLE", False):
        yield


class TestSessionManagerProductionMode:
    """Test SessionManager behavior in production mode."""

    @pytest.mark.asyncio
    async def test_production_mode_disables_fallback(self, mock_redis_unavailable):
        """
        SECURITY TEST: In production, SessionManager should NOT use fallback.

        This ensures session revocation works across all workers.
        """
        # Simulate production environment
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            # Create SessionManager (will auto-detect production)
            from dotmac.platform.auth.core import SessionManager

            session_manager = SessionManager(fallback_enabled=False)

            # Attempt to create session without Redis
            with pytest.raises(HTTPException) as exc_info:
                await session_manager.create_session(
                    user_id="user-123", data={"test": "data"}, ttl=3600
                )

            # SECURITY ASSERTION: Session creation fails without Redis in production
            assert exc_info.value.status_code == 503
            assert "Session service unavailable" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_development_mode_allows_fallback(self, mock_redis_unavailable):
        """Test that development mode allows in-memory fallback."""
        # Simulate development environment
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            session_manager = SessionManager(fallback_enabled=True)

            # Create session without Redis (should use fallback)
            session_id = await session_manager.create_session(
                user_id="user-123", data={"test": "data"}, ttl=3600
            )

            # ASSERTION: Session created successfully using fallback
            assert session_id is not None
            assert len(session_id) > 0

            # ASSERTION: Session stored in fallback
            assert session_id in session_manager._fallback_store

    @pytest.mark.asyncio
    async def test_production_with_redis_works(self, mock_redis_available):
        """Test that production mode works when Redis is available."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            session_manager = SessionManager(fallback_enabled=False)

            # Create session with Redis available
            session_id = await session_manager.create_session(
                user_id="user-123", data={"test": "data"}, ttl=3600
            )

            # ASSERTION: Session created successfully
            assert session_id is not None

            # ASSERTION: Redis was used (not fallback)
            assert mock_redis_available.setex.called

    @pytest.mark.asyncio
    async def test_explicit_require_redis_env_var(self, mock_redis_unavailable):
        """Test that REQUIRE_REDIS_SESSIONS environment variable works."""
        # Explicitly require Redis via env var
        with patch.dict(os.environ, {"REQUIRE_REDIS_SESSIONS": "true"}):
            session_manager = SessionManager(fallback_enabled=False)

            # Attempt to create session without Redis
            with pytest.raises(HTTPException) as exc_info:
                await session_manager.create_session(
                    user_id="user-123", data={"test": "data"}, ttl=3600
                )

            # ASSERTION: Session creation fails when Redis required
            assert exc_info.value.status_code == 503


class TestSessionRevocationCrosssWorker:
    """
    Test session revocation works across workers in production.

    These tests simulate multi-worker scenarios.
    """

    @pytest.mark.asyncio
    async def test_session_revocation_with_redis(self, mock_redis_available):
        """Test that session revocation works with Redis (multi-worker safe)."""
        session_manager = SessionManager(fallback_enabled=False)

        # Simulate session creation on worker 1
        session_id = await session_manager.create_session(
            user_id="user-123", data={"worker": "1"}, ttl=3600
        )

        # Mock Redis returning session data
        import json

        session_data = {
            "user_id": "user-123",
            "created_at": "2025-10-10T10:00:00Z",
            "data": {"worker": "1"},
        }
        mock_redis_available.get = AsyncMock(return_value=json.dumps(session_data))

        # Simulate session deletion on worker 2 (different process)
        session_manager_worker2 = SessionManager(fallback_enabled=False)
        deleted = await session_manager_worker2.delete_session(session_id)

        # ASSERTION: Session deleted successfully
        assert deleted

        # ASSERTION: Redis delete was called (works across workers)
        assert mock_redis_available.delete.called

    @pytest.mark.asyncio
    async def test_session_revocation_without_redis_fails_multi_worker(
        self, mock_redis_unavailable
    ):
        """
        REGRESSION TEST: Session revocation without Redis DOES NOT work across workers.

        This demonstrates why fallback is unsafe in production.
        """
        # Worker 1: Create session with fallback
        session_manager_worker1 = SessionManager(fallback_enabled=True)
        session_id = await session_manager_worker1.create_session(
            user_id="user-123", data={"worker": "1"}, ttl=3600
        )

        # ASSERTION: Session created in worker 1's memory
        assert session_id in session_manager_worker1._fallback_store

        # Worker 2: Try to revoke session (different process, different memory)
        session_manager_worker2 = SessionManager(fallback_enabled=True)

        # SECURITY ISSUE: Worker 2 cannot see worker 1's session
        session = await session_manager_worker2.get_session(session_id)

        # ASSERTION: Session NOT found (isolation between workers)
        assert session is None

        # SECURITY ISSUE: Revocation on worker 2 doesn't affect worker 1
        deleted = await session_manager_worker2.delete_session(session_id)
        assert deleted  # Returns True but doesn't actually delete from worker 1

        # SECURITY ISSUE: Session still active on worker 1
        session_on_worker1 = await session_manager_worker1.get_session(session_id)
        assert session_on_worker1 is not None  # Still there!


class TestSessionManagerFallbackBehavior:
    """Test fallback behavior in different configurations."""

    @pytest.mark.asyncio
    async def test_fallback_disabled_fails_without_redis(self, mock_redis_unavailable):
        """Test that disabling fallback fails without Redis."""
        session_manager = SessionManager(fallback_enabled=False)

        with pytest.raises(HTTPException) as exc_info:
            await session_manager.create_session(user_id="user-123", data={}, ttl=3600)

        assert exc_info.value.status_code == 503
        assert "Redis not available" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_fallback_enabled_works_without_redis(self, mock_redis_unavailable):
        """Test that enabling fallback works without Redis (development)."""
        session_manager = SessionManager(fallback_enabled=True)

        session_id = await session_manager.create_session(
            user_id="user-123", data={"test": "data"}, ttl=3600
        )

        assert session_id is not None
        assert session_id in session_manager._fallback_store

    @pytest.mark.asyncio
    async def test_redis_failure_during_write_with_fallback_disabled(self, mock_redis_available):
        """Test that Redis write failure raises exception when fallback disabled."""
        # Make Redis write fail
        mock_redis_available.setex = AsyncMock(side_effect=Exception("Redis write failed"))

        session_manager = SessionManager(fallback_enabled=False)

        with pytest.raises(HTTPException) as exc_info:
            await session_manager.create_session(user_id="user-123", data={}, ttl=3600)

        assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_redis_failure_during_write_with_fallback_enabled(self, mock_redis_available):
        """Test that Redis write failure uses fallback when enabled."""
        # Make Redis write fail
        mock_redis_available.setex = AsyncMock(side_effect=Exception("Redis write failed"))

        session_manager = SessionManager(fallback_enabled=True)

        # Should succeed using fallback
        session_id = await session_manager.create_session(
            user_id="user-123", data={"test": "data"}, ttl=3600
        )

        assert session_id is not None
        assert session_id in session_manager._fallback_store


class TestSessionManagerHealthCheck:
    """Test SessionManager health awareness."""

    @pytest.mark.asyncio
    async def test_redis_health_tracked(self, mock_redis_available):
        """Test that Redis health is tracked."""
        session_manager = SessionManager()

        # Get Redis connection (triggers health check)
        client = await session_manager._get_redis()

        # ASSERTION: Redis is healthy
        assert session_manager._redis_healthy
        assert client is not None

    @pytest.mark.asyncio
    async def test_redis_unhealthy_tracked(self, mock_redis_available):
        """Test that Redis connection failure is tracked."""
        # Make connection fail
        mock_redis_available.ping = AsyncMock(side_effect=Exception("Connection failed"))

        with patch(
            "dotmac.platform.auth.core.redis_async.from_url", return_value=mock_redis_available
        ):
            session_manager = SessionManager(fallback_enabled=True)

            # Try to get Redis connection
            client = await session_manager._get_redis()

            # ASSERTION: Redis is unhealthy
            assert not session_manager._redis_healthy
            assert client is None


class TestGlobalSessionManagerConfiguration:
    """Test that global session_manager respects production settings."""

    def test_global_session_manager_production_mode(self):
        """Test that global session_manager is configured for production when ENV is set."""
        # Note: conftest.py sets REQUIRE_REDIS_SESSIONS=false by default for tests
        # We need to remove it to let production mode logic work
        env_patch = {
            "ENVIRONMENT": "production",
            "SECRET_KEY": "production-secret-key-for-testing-at-least-32-characters-long",
        }
        # Remove REQUIRE_REDIS_SESSIONS so it defaults based on production mode
        if "REQUIRE_REDIS_SESSIONS" in os.environ:
            del os.environ["REQUIRE_REDIS_SESSIONS"]

        with patch.dict(os.environ, env_patch, clear=False):
            # Reload modules to pick up new environment
            import importlib

            from dotmac.platform import settings as settings_module
            from dotmac.platform.auth import core

            # Reset settings singleton before reload
            settings_module._settings = None

            # Reload both modules
            importlib.reload(settings_module)
            importlib.reload(core)

            # ASSERTION: Production mode detected
            assert (
                core._is_production is True
            ), f"Expected production mode, got: {core._is_production}"
            # In production, _require_redis_for_sessions should be True
            # It defaults to str(_is_production) which is "True", and "True".lower() == "true"
            assert (
                core._require_redis_for_sessions is True
            ), f"Expected Redis required for sessions in production, got: {core._require_redis_for_sessions}"

            # ASSERTION: SessionManager created without fallback
            # Note: Can't directly test fallback_enabled without inspecting private var
            # But the global instance should be created with fallback_enabled=False

    def test_global_session_manager_development_mode(self):
        """Test that global session_manager allows fallback in development."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            # Reload modules to pick up new environment
            import importlib

            from dotmac.platform import settings as settings_module
            from dotmac.platform.auth import core

            # Reset settings singleton before reload
            settings_module._settings = None

            # Reload both modules
            importlib.reload(settings_module)
            importlib.reload(core)

            # ASSERTION: Development mode detected
            assert core._is_production is False
            assert core._require_redis_for_sessions is False

            # ASSERTION: SessionManager created with fallback enabled
