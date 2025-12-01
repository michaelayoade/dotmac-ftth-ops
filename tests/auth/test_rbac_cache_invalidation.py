"""
Unit tests for RBAC cache invalidation logic.

Tests that role/permission mutations properly clear both cached permission
variants (include_expired=True and include_expired=False) to prevent stale
grants from lingering in lookups.

Note: These tests use mocks for the database operations to avoid SQLite
foreign key constraint issues. The cache invalidation logic is what we're
testing, not the database insert behavior.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.core.caching import cache_delete, cache_get, cache_set


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    session = AsyncMock()
    # Mock execute to return a result that has first() returning None
    mock_result = MagicMock()
    mock_result.first.return_value = None
    mock_result.scalars.return_value.first.return_value = None
    session.execute = AsyncMock(return_value=mock_result)
    session.commit = AsyncMock()
    session.get = AsyncMock()
    return session


@pytest.fixture
def rbac_service(mock_session) -> RBACService:
    """Create RBAC service with mock session."""
    return RBACService(mock_session)


@pytest.fixture
def test_user_id() -> str:
    """Generate a test user ID."""
    return str(uuid4())


@pytest.fixture
def test_granter_id() -> str:
    """Generate a granter user ID."""
    return str(uuid4())


@pytest.fixture
def test_role_name() -> str:
    """Generate a test role name."""
    return f"test_role_{uuid4().hex[:8]}"


@pytest.fixture
def test_permission_name() -> str:
    """Generate a test permission name."""
    return f"test.permission.{uuid4().hex[:8]}"


def clear_test_cache(user_id: str):
    """Clear all cache keys for a user."""
    cache_delete(f"user_perms:{user_id}")
    cache_delete(f"user_perms:{user_id}:expired=False")
    cache_delete(f"user_perms:{user_id}:expired=True")


class TestRoleCacheInvalidation:
    """Test that assigning/revoking roles clears both cache keys."""

    @pytest.mark.asyncio
    async def test_assign_role_clears_both_cache_keys(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_role_name: str,
    ):
        """Test that assign_role_to_user clears both expired=True and expired=False cache keys."""
        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["old.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["old.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["old.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["old.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["old.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["old.permission.true"]

        # Mock the database operations but let the cache invalidation run
        mock_role = MagicMock()
        mock_role.id = uuid4()
        mock_role.name = test_role_name

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            await rbac_service.assign_role_to_user(
                user_id=test_user_id,
                role_name=test_role_name,
                granted_by=test_granter_id,
            )

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_revoke_role_clears_both_cache_keys(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_role_name: str,
    ):
        """Test that revoke_role_from_user clears both expired=True and expired=False cache keys."""
        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["stale.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["stale.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["stale.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["stale.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["stale.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["stale.permission.true"]

        # Mock the database operations
        mock_role = MagicMock()
        mock_role.id = uuid4()
        mock_role.name = test_role_name

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            await rbac_service.revoke_role_from_user(
                user_id=test_user_id,
                role_name=test_role_name,
                revoked_by=test_granter_id,
            )

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None


class TestPermissionCacheInvalidation:
    """Test that granting/revoking permissions clears both cache keys."""

    @pytest.mark.asyncio
    async def test_grant_permission_clears_both_cache_keys(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_permission_name: str,
    ):
        """Test that grant_permission_to_user clears both expired=True and expired=False cache keys."""
        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["old.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["old.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["old.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["old.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["old.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["old.permission.true"]

        # Mock the database operations
        mock_permission = MagicMock()
        mock_permission.id = uuid4()
        mock_permission.name = test_permission_name

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            await rbac_service.grant_permission_to_user(
                user_id=test_user_id,
                permission_name=test_permission_name,
                granted_by=test_granter_id,
            )

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_revoke_permission_clears_both_cache_keys(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_permission_name: str,
    ):
        """Test that revoke_permission_from_user clears both expired=True and expired=False cache keys."""
        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["stale.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["stale.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["stale.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["stale.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["stale.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["stale.permission.true"]

        # Mock the database operations
        mock_permission = MagicMock()
        mock_permission.id = uuid4()
        mock_permission.name = test_permission_name

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            await rbac_service.revoke_permission_from_user(
                user_id=test_user_id,
                permission_name=test_permission_name,
                revoked_by=test_granter_id,
            )

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None


class TestExpiredPermissionCacheHandling:
    """Test that expired permissions are handled correctly with cache invalidation."""

    @pytest.mark.asyncio
    async def test_grant_expired_permission_clears_cache(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_permission_name: str,
    ):
        """Test that granting an expired permission still clears cache properly."""
        # Seed cache
        cache_set(f"user_perms:{test_user_id}:expired=False", ["cached.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["cached.expired.permission"])

        # Grant permission that's already expired
        past_time = datetime.now(UTC) - timedelta(days=1)

        mock_permission = MagicMock()
        mock_permission.id = uuid4()
        mock_permission.name = test_permission_name

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            await rbac_service.grant_permission_to_user(
                user_id=test_user_id,
                permission_name=test_permission_name,
                granted_by=test_granter_id,
                expires_at=past_time,
            )

        # Both cache keys should be cleared
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_revoke_expired_permission_clears_cache(
        self,
        rbac_service: RBACService,
        test_user_id: str,
        test_granter_id: str,
        test_permission_name: str,
    ):
        """Test that revoking an expired permission still clears cache properly."""
        # Seed cache
        cache_set(f"user_perms:{test_user_id}:expired=False", ["cached.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["cached.expired.permission"])

        mock_permission = MagicMock()
        mock_permission.id = uuid4()
        mock_permission.name = test_permission_name

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            await rbac_service.revoke_permission_from_user(
                user_id=test_user_id,
                permission_name=test_permission_name,
                revoked_by=test_granter_id,
            )

        # Both cache keys should be cleared
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None


class TestDirectInvalidationMethod:
    """Test the _invalidate_user_permission_cache method directly."""

    @pytest.mark.asyncio
    async def test_direct_invalidation_clears_all_variants(
        self, rbac_service: RBACService, test_user_id: str
    ):
        """Test that _invalidate_user_permission_cache clears all cache key variants."""
        # Seed all three cache key variants
        cache_set(f"user_perms:{test_user_id}", ["legacy.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["current.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["expired.permission"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["legacy.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["current.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["expired.permission"]

        # Call the invalidation method directly
        rbac_service._invalidate_user_permission_cache(test_user_id)

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_invalidation_with_no_cached_data(
        self, rbac_service: RBACService, test_user_id: str
    ):
        """Test that invalidation doesn't error when no cache exists."""
        # Clear any existing cache
        clear_test_cache(test_user_id)

        # Verify cache is empty
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

        # Call invalidation - should not error
        rbac_service._invalidate_user_permission_cache(test_user_id)

        # Still empty
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_invalidation_partial_cache(
        self, rbac_service: RBACService, test_user_id: str
    ):
        """Test that invalidation works with only some cache keys set."""
        # Only set one variant
        cache_set(f"user_perms:{test_user_id}:expired=False", ["partial.permission"])

        # Verify only one is set
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["partial.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

        # Invalidate
        rbac_service._invalidate_user_permission_cache(test_user_id)

        # All should be None
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None
