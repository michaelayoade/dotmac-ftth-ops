"""
Unit tests for RBAC cache invalidation logic.

Tests that role/permission mutations properly clear both cached permission
variants (include_expired=True and include_expired=False) to prevent stale
grants from lingering in lookups.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, PermissionCategory, Role
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.core.caching import cache_delete, cache_get, cache_set


@pytest.fixture
async def rbac_service(async_db_session: AsyncSession) -> RBACService:
    """Create RBAC service for testing."""
    return RBACService(async_db_session)


@pytest.fixture
async def test_user_id() -> str:
    """Generate a test user ID."""
    return str(uuid4())


@pytest.fixture
async def test_role(async_db_session: AsyncSession) -> Role:
    """Create a test role."""
    role = Role(
        name="test_role_cache",
        display_name="Test Role Cache",
        description="Test role for cache invalidation",
    )
    async_db_session.add(role)
    await async_db_session.commit()
    await async_db_session.refresh(role)
    return role


@pytest.fixture
async def test_permission(async_db_session: AsyncSession) -> Permission:
    """Create a test permission."""
    permission = Permission(
        name="test.permission.cache",
        display_name="Test Permission Cache",
        description="Test permission for cache invalidation",
        category=PermissionCategory.ADMIN,
    )
    async_db_session.add(permission)
    await async_db_session.commit()
    await async_db_session.refresh(permission)
    return permission


class TestRoleCacheInvalidation:
    """Test that assigning/revoking roles clears both cache keys."""

    @pytest.mark.asyncio
    async def test_assign_role_clears_both_cache_keys(
        self, rbac_service: RBACService, test_user_id: str, test_role: Role, async_db_session: AsyncSession
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

        # Assign role to user
        await rbac_service.assign_role_to_user(
            user_id=test_user_id,
            role_name=test_role.name,
            granted_by=str(uuid4()),
        )

        # Assert all three cache keys are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_revoke_role_clears_both_cache_keys(
        self, rbac_service: RBACService, test_user_id: str, test_role: Role, async_db_session: AsyncSession
    ):
        """Test that revoke_role_from_user clears both expired=True and expired=False cache keys."""
        # First assign the role
        await rbac_service.assign_role_to_user(
            user_id=test_user_id,
            role_name=test_role.name,
            granted_by=str(uuid4()),
        )

        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["stale.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["stale.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["stale.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["stale.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["stale.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["stale.permission.true"]

        # Revoke role from user
        await rbac_service.revoke_role_from_user(
            user_id=test_user_id,
            role_name=test_role.name,
            revoked_by=str(uuid4()),
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
        test_permission: Permission,
        async_db_session: AsyncSession,
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

        # Grant permission to user
        await rbac_service.grant_permission_to_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            granted_by=str(uuid4()),
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
        test_permission: Permission,
        async_db_session: AsyncSession,
    ):
        """Test that revoke_permission_from_user clears both expired=True and expired=False cache keys."""
        # First grant the permission
        await rbac_service.grant_permission_to_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            granted_by=str(uuid4()),
        )

        # Seed both cache keys with dummy data
        cache_set(f"user_perms:{test_user_id}", ["stale.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=False", ["stale.permission.false"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["stale.permission.true"])

        # Verify cache is seeded
        assert cache_get(f"user_perms:{test_user_id}") == ["stale.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["stale.permission.false"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["stale.permission.true"]

        # Revoke permission from user
        await rbac_service.revoke_permission_from_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            revoked_by=str(uuid4()),
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
        test_permission: Permission,
        async_db_session: AsyncSession,
    ):
        """Test that granting an expired permission still clears cache properly."""
        # Seed cache
        cache_set(f"user_perms:{test_user_id}:expired=False", ["cached.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["cached.expired.permission"])

        # Grant permission that's already expired
        past_time = datetime.now(UTC) - timedelta(days=1)
        await rbac_service.grant_permission_to_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            granted_by=str(uuid4()),
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
        test_permission: Permission,
        async_db_session: AsyncSession,
    ):
        """Test that revoking an expired permission still clears cache properly."""
        # Grant an expired permission first
        past_time = datetime.now(UTC) - timedelta(days=1)
        await rbac_service.grant_permission_to_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            granted_by=str(uuid4()),
            expires_at=past_time,
        )

        # Seed cache
        cache_set(f"user_perms:{test_user_id}:expired=False", ["cached.permission"])
        cache_set(f"user_perms:{test_user_id}:expired=True", ["cached.expired.permission"])

        # Revoke the expired permission
        await rbac_service.revoke_permission_from_user(
            user_id=test_user_id,
            permission_name=test_permission.name,
            revoked_by=str(uuid4()),
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

        # Verify all are set
        assert cache_get(f"user_perms:{test_user_id}") == ["legacy.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=False") == ["current.permission"]
        assert cache_get(f"user_perms:{test_user_id}:expired=True") == ["expired.permission"]

        # Call the invalidation method directly
        rbac_service._invalidate_user_permission_cache(test_user_id)

        # Assert all three variants are cleared
        assert cache_get(f"user_perms:{test_user_id}") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=False") is None
        assert cache_get(f"user_perms:{test_user_id}:expired=True") is None

    @pytest.mark.asyncio
    async def test_invalidation_with_uuid_user_id(self, rbac_service: RBACService):
        """Test that invalidation works with UUID user IDs."""
        user_uuid = uuid4()

        # Seed cache with UUID key
        cache_set(f"user_perms:{user_uuid}", ["permission1"])
        cache_set(f"user_perms:{user_uuid}:expired=False", ["permission2"])
        cache_set(f"user_perms:{user_uuid}:expired=True", ["permission3"])

        # Invalidate using UUID
        rbac_service._invalidate_user_permission_cache(user_uuid)

        # All should be cleared
        assert cache_get(f"user_perms:{user_uuid}") is None
        assert cache_get(f"user_perms:{user_uuid}:expired=False") is None
        assert cache_get(f"user_perms:{user_uuid}:expired=True") is None
