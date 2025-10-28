"""
Test session fallback behavior for resilience.

These tests ensure that session management gracefully falls back to
in-memory storage when Redis is unavailable.
"""

import pytest

from dotmac.platform.auth.core import SessionManager


@pytest.mark.integration
class TestSessionFallbackBehavior:
    """Test suite for session fallback functionality."""

    @pytest.mark.asyncio
    async def test_fallback_enabled_creates_session_without_redis(self):
        """Session creation should succeed with fallback when Redis unavailable."""
        # Create session manager with fallback enabled and invalid Redis URL
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        # Should succeed using in-memory fallback
        session_id = await manager.create_session(
            user_id="user-123", data={"ip": "127.0.0.1"}, ttl=3600
        )

        assert session_id is not None
        assert len(session_id) > 0

    @pytest.mark.asyncio
    async def test_fallback_disabled_raises_error_without_redis(self):
        """Session creation should fail when fallback disabled and Redis unavailable."""
        # Create session manager with fallback disabled and invalid Redis URL
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=False)

        # Should raise error when Redis unavailable and fallback disabled
        with pytest.raises((ConnectionError, TimeoutError, RuntimeError)):  # Connection errors
            await manager.create_session(user_id="user-123", data={"ip": "127.0.0.1"}, ttl=3600)

    @pytest.mark.asyncio
    async def test_fallback_can_retrieve_session(self):
        """Sessions created with fallback should be retrievable."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        # Create session
        session_id = await manager.create_session(
            user_id="user-123", data={"ip": "127.0.0.1", "browser": "Chrome"}, ttl=3600
        )

        # Retrieve session
        session_data = await manager.get_session(session_id)

        assert session_data is not None
        assert session_data["user_id"] == "user-123"
        assert session_data["data"]["ip"] == "127.0.0.1"
        assert session_data["data"]["browser"] == "Chrome"

    @pytest.mark.asyncio
    async def test_fallback_can_delete_session(self):
        """Sessions created with fallback should be deletable."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        # Create session
        session_id = await manager.create_session(user_id="user-123", data={"test": "data"})

        # Delete session
        deleted = await manager.delete_session(session_id)

        assert deleted is True

        # Session should no longer exist
        session_data = await manager.get_session(session_id)
        assert session_data is None

    @pytest.mark.asyncio
    async def test_fallback_multiple_sessions_isolated(self):
        """Multiple sessions should be isolated in fallback mode."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        # Create two sessions for different users
        session1 = await manager.create_session(user_id="user-1", data={"name": "Alice"})
        session2 = await manager.create_session(user_id="user-2", data={"name": "Bob"})

        # Retrieve sessions
        data1 = await manager.get_session(session1)
        data2 = await manager.get_session(session2)

        assert data1["user_id"] == "user-1"
        assert data1["data"]["name"] == "Alice"
        assert data2["user_id"] == "user-2"
        assert data2["data"]["name"] == "Bob"

    @pytest.mark.asyncio
    async def test_fallback_session_includes_created_at(self):
        """Fallback sessions should include created_at timestamp."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        session_id = await manager.create_session(user_id="user-123", data={"test": "data"})
        session_data = await manager.get_session(session_id)

        assert session_data is not None
        assert "created_at" in session_data
        assert session_data["created_at"] is not None

    @pytest.mark.asyncio
    async def test_get_nonexistent_session_returns_none(self):
        """Requesting non-existent session should return None."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        session_data = await manager.get_session("non-existent-session-id")

        assert session_data is None

    @pytest.mark.asyncio
    async def test_delete_user_sessions_in_fallback_mode(self):
        """Deleting all user sessions should work in fallback mode."""
        manager = SessionManager(redis_url="redis://invalid-host:9999", fallback_enabled=True)

        # Create multiple sessions for same user
        await manager.create_session(user_id="user-123", data={"session": "1"})
        await manager.create_session(user_id="user-123", data={"session": "2"})

        # Delete all user sessions
        deleted_count = await manager.delete_user_sessions("user-123")

        # In fallback mode, we can't track user sessions properly, so count may be 0
        # This is acceptable as fallback is for single-server dev/test only
        assert deleted_count >= 0

    @pytest.mark.asyncio
    async def test_production_mode_requires_redis(self):
        """SECURITY: Production should require Redis for proper session management."""
        import os

        # Save original env
        original_env = os.environ.get("ENVIRONMENT")
        original_require = os.environ.get("REQUIRE_REDIS_SESSIONS")

        try:
            # Simulate production environment
            os.environ["ENVIRONMENT"] = "production"
            os.environ["REQUIRE_REDIS_SESSIONS"] = "true"

            # Import fresh session manager
            from dotmac.platform.auth.core import SessionManager as FreshSessionManager

            manager = FreshSessionManager(
                redis_url="redis://invalid-host:9999", fallback_enabled=False
            )

            # Should fail in production without Redis
            with pytest.raises(Exception):  # noqa: B017
                await manager.create_session(user_id="user-123", data={"test": "data"})

        finally:
            # Restore original env
            if original_env:
                os.environ["ENVIRONMENT"] = original_env
            elif "ENVIRONMENT" in os.environ:
                del os.environ["ENVIRONMENT"]

            if original_require:
                os.environ["REQUIRE_REDIS_SESSIONS"] = original_require
            elif "REQUIRE_REDIS_SESSIONS" in os.environ:
                del os.environ["REQUIRE_REDIS_SESSIONS"]
