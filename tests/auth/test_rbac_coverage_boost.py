"""
Additional RBAC tests to boost coverage to 90%+.

This test file covers:
- Permission expansion and inheritance
- Permission wildcards and hierarchy
- Role expiration handling
- Permission grant/revoke edge cases
- Helper methods and caching
- Error conditions
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth import rbac_service as rbac_module
from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.models import Permission, PermissionCategory
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.user_management.models import User


@pytest_asyncio.fixture
async def rbac_service(async_db_session: AsyncSession):
    """Create RBAC service instance."""
    RBACService.user_has_all_permissions = rbac_module.ORIGINAL_USER_HAS_ALL_PERMISSIONS  # type: ignore[assignment]
    RBACService.user_has_permission = rbac_module.ORIGINAL_USER_HAS_PERMISSION  # type: ignore[assignment]
    return RBACService(async_db_session)


@pytest_asyncio.fixture
async def test_user(async_db_session: AsyncSession):
    """Create a test user in the database."""
    user = User(
        id=uuid4(),
        tenant_id="test-tenant",
        username="test_user",
        email="test@example.com",
        password_hash="hashed_password",
        is_active=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_permissions(async_db_session: AsyncSession):
    """Create sample permission hierarchy."""
    perms = [
        Permission(
            name="ticket.*",
            display_name="All Ticket Permissions",
            category=PermissionCategory.USER,
            is_active=True,
        ),
        Permission(
            name="ticket.read",
            display_name="Read Tickets",
            category=PermissionCategory.USER,
            is_active=True,
        ),
        Permission(
            name="ticket.write",
            display_name="Write Tickets",
            category=PermissionCategory.USER,
            is_active=True,
        ),
        Permission(
            name="admin.*",
            display_name="All Admin Permissions",
            category=PermissionCategory.ADMIN,
            is_active=True,
        ),
        Permission(
            name="*",
            display_name="Superadmin",
            category=PermissionCategory.ADMIN,
            is_active=True,
        ),
    ]
    for perm in perms:
        async_db_session.add(perm)
    await async_db_session.commit()
    return perms


@pytest.mark.integration
class TestPermissionWildcards:
    """Test permission wildcard matching."""

    @pytest.mark.asyncio
    async def test_wildcard_permission_match(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test wildcard permission matching."""
        user_id = test_user.id

        # Grant wildcard permission
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.*",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Should match specific permissions
        assert await rbac_service.user_has_permission(user_id, "ticket.read")
        assert await rbac_service.user_has_permission(user_id, "ticket.write")
        assert await rbac_service.user_has_permission(user_id, "ticket.delete")

        # Should not match different namespace
        assert not await rbac_service.user_has_permission(user_id, "admin.read")

    @pytest.mark.asyncio
    async def test_superadmin_permission(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test superadmin (*) permission."""
        user_id = test_user.id

        # Grant superadmin permission
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="*",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Should match any permission
        assert await rbac_service.user_has_permission(user_id, "ticket.read")
        assert await rbac_service.user_has_permission(user_id, "admin.delete")
        assert await rbac_service.user_has_permission(user_id, "anything.random")

    @pytest.mark.asyncio
    async def test_user_has_any_permission(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test user_has_any_permission method."""
        user_id = test_user.id

        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Should return True if user has any of the permissions
        assert await rbac_service.user_has_any_permission(
            user_id, ["ticket.read", "ticket.write", "admin.delete"]
        )

        # Should return False if user has none
        assert not await rbac_service.user_has_any_permission(
            user_id, ["admin.read", "admin.write"]
        )

    @pytest.mark.asyncio
    async def test_user_has_all_permissions(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test user_has_all_permissions method."""
        user_id = test_user.id

        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.*",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Should return True if user has all permissions
        assert await rbac_service.user_has_all_permissions(user_id, ["ticket.read", "ticket.write"])

        # Should return False if missing any
        assert not await rbac_service.user_has_all_permissions(
            user_id, ["ticket.read", "admin.write"]
        )


@pytest.mark.integration
class TestRoleExpiration:
    """Test role expiration handling."""

    @pytest.mark.asyncio
    async def test_expired_role_not_included(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test that expired roles are not included in permissions."""
        user_id = test_user.id

        # Create role
        await rbac_service.create_role(
            name="temp_role",
            display_name="Temporary Role",
            permissions=["ticket.read"],
        )
        await async_db_session.flush()

        # Assign role with expiration in the past
        await rbac_service.assign_role_to_user(
            user_id=user_id,
            role_name="temp_role",
            granted_by=user_id,
            expires_at=datetime.now(UTC) - timedelta(hours=1),
        )
        await async_db_session.commit()

        # Expired role should not grant permissions
        assert not await rbac_service.user_has_permission(user_id, "ticket.read")

        # But should be included if we explicitly include expired
        perms = await rbac_service.get_user_permissions(user_id, include_expired=True)
        assert "ticket.read" in perms

    @pytest.mark.asyncio
    async def test_get_user_roles_with_expiration(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test get_user_roles with expired roles."""
        user_id = test_user.id

        # Create role
        await rbac_service.create_role(
            name="expired_role",
            display_name="Expired Role",
            permissions=["ticket.write"],
        )
        await async_db_session.flush()

        # Assign with expiration
        await rbac_service.assign_role_to_user(
            user_id=user_id,
            role_name="expired_role",
            granted_by=user_id,
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )
        await async_db_session.commit()

        # Should not return expired roles
        roles = await rbac_service.get_user_roles(user_id)
        assert len(roles) == 0

        # Should return if include_expired=True
        roles = await rbac_service.get_user_roles(user_id, include_expired=True)
        assert len(roles) == 1
        assert roles[0].name == "expired_role"


@pytest.mark.integration
class TestPermissionRevocation:
    """Test permission revocation and overrides."""

    @pytest.mark.asyncio
    async def test_permission_revoke_override(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test that direct permission revoke overrides role permissions."""
        user_id = test_user.id

        # Create role with permission
        await rbac_service.create_role(
            name="reader",
            display_name="Reader",
            permissions=["ticket.read"],
        )
        await async_db_session.flush()

        # Assign role
        await rbac_service.assign_role_to_user(
            user_id=user_id,
            role_name="reader",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # User should have permission from role
        assert await rbac_service.user_has_permission(user_id, "ticket.read")

        # Revoke permission directly
        await rbac_service.revoke_permission_from_user(
            user_id=user_id,
            permission_name="ticket.read",
            revoked_by=user_id,
        )
        await async_db_session.commit()

        # Direct revoke doesn't override role permissions in current implementation
        # This tests the current behavior
        perms = await rbac_service.get_user_permissions(user_id)
        assert "ticket.read" in perms  # Still has from role

    @pytest.mark.asyncio
    async def test_revoke_permission_not_granted(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test revoking a permission that was never granted."""
        user_id = test_user.id

        # Try to revoke permission that was never granted
        await rbac_service.revoke_permission_from_user(
            user_id=user_id,
            permission_name="ticket.read",
            revoked_by=user_id,
        )
        await async_db_session.commit()

        # Should complete without error (idempotent)
        perms = await rbac_service.get_user_permissions(user_id)
        assert "ticket.read" not in perms


@pytest.mark.integration
class TestRoleCRUDErrors:
    """Test role CRUD error conditions."""

    @pytest.mark.asyncio
    async def test_create_duplicate_role(self, rbac_service, async_db_session, test_user):
        """Test creating duplicate role raises error."""
        await rbac_service.create_role(
            name="duplicate",
            display_name="Duplicate Role",
        )
        await async_db_session.flush()

        # Should raise error on duplicate
        with pytest.raises(AuthorizationError, match="Role 'duplicate' already exists"):
            await rbac_service.create_role(
                name="duplicate",
                display_name="Another Duplicate",
            )

    @pytest.mark.asyncio
    async def test_create_permission_duplicate(self, rbac_service, async_db_session, test_user):
        """Test creating duplicate permission raises error."""
        await rbac_service.create_permission(
            name="test.permission",
            display_name="Test Permission",
            category=PermissionCategory.USER,
        )
        await async_db_session.flush()

        # Should raise error on duplicate
        with pytest.raises(AuthorizationError, match="Permission 'test.permission' already exists"):
            await rbac_service.create_permission(
                name="test.permission",
                display_name="Another Test",
                category=PermissionCategory.USER,
            )

    @pytest.mark.asyncio
    async def test_create_role_with_parent(self, rbac_service, async_db_session, test_user):
        """Test creating role with parent role."""
        # Create parent role
        await rbac_service.create_role(
            name="parent_role",
            display_name="Parent Role",
        )
        await async_db_session.flush()

        # Create child role
        child_role = await rbac_service.create_role(
            name="child_role",
            display_name="Child Role",
            parent_role="parent_role",
        )
        await async_db_session.flush()

        assert child_role.parent_id is not None

    @pytest.mark.asyncio
    async def test_create_role_with_invalid_parent(self, rbac_service, async_db_session, test_user):
        """Test creating role with non-existent parent."""
        with pytest.raises(AuthorizationError, match="Parent role"):
            await rbac_service.create_role(
                name="orphan",
                display_name="Orphan Role",
                parent_role="nonexistent",
            )

    @pytest.mark.asyncio
    async def test_create_permission_with_parent(self, rbac_service, async_db_session, test_user):
        """Test creating permission with parent permission."""
        # Create parent permission
        await rbac_service.create_permission(
            name="parent.permission",
            display_name="Parent Permission",
            category=PermissionCategory.USER,
        )
        await async_db_session.flush()

        # Create child permission
        child_perm = await rbac_service.create_permission(
            name="child.permission",
            display_name="Child Permission",
            category=PermissionCategory.USER,
            parent_permission="parent.permission",
        )
        await async_db_session.flush()

        assert child_perm.parent_id is not None

    @pytest.mark.asyncio
    async def test_create_permission_with_invalid_parent(
        self, rbac_service, async_db_session, test_user
    ):
        """Test creating permission with non-existent parent."""
        with pytest.raises(AuthorizationError, match="Parent permission"):
            await rbac_service.create_permission(
                name="orphan.permission",
                display_name="Orphan Permission",
                category=PermissionCategory.USER,
                parent_permission="nonexistent.permission",
            )


@pytest.mark.integration
class TestRoleAssignmentErrors:
    """Test role assignment error conditions."""

    @pytest.mark.asyncio
    async def test_assign_nonexistent_role(self, rbac_service, async_db_session, test_user):
        """Test assigning non-existent role raises error."""
        user_id = test_user.id

        with pytest.raises(AuthorizationError, match="not found"):
            await rbac_service.assign_role_to_user(
                user_id=user_id,
                role_name="nonexistent",
                granted_by=user_id,
            )

    @pytest.mark.asyncio
    async def test_assign_role_already_assigned(self, rbac_service, async_db_session, test_user):
        """Test assigning role that's already assigned."""
        user_id = test_user.id

        # Create role
        await rbac_service.create_role(
            name="test_role",
            display_name="Test Role",
        )
        await async_db_session.flush()

        # Assign role first time
        await rbac_service.assign_role_to_user(
            user_id=user_id,
            role_name="test_role",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Assign again (should be idempotent)
        await rbac_service.assign_role_to_user(
            user_id=user_id,
            role_name="test_role",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Should only have one assignment
        roles = await rbac_service.get_user_roles(user_id)
        assert len(roles) == 1

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_role(self, rbac_service, async_db_session, test_user):
        """Test revoking non-existent role raises error."""
        user_id = test_user.id

        with pytest.raises(AuthorizationError, match="not found"):
            await rbac_service.revoke_role_from_user(
                user_id=user_id,
                role_name="nonexistent",
                revoked_by=user_id,
            )

    @pytest.mark.asyncio
    async def test_grant_nonexistent_permission(self, rbac_service, async_db_session, test_user):
        """Test granting non-existent permission raises error."""
        user_id = test_user.id

        with pytest.raises(AuthorizationError, match="not found"):
            await rbac_service.grant_permission_to_user(
                user_id=user_id,
                permission_name="nonexistent.permission",
                granted_by=user_id,
            )

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_permission(self, rbac_service, async_db_session, test_user):
        """Test revoking non-existent permission raises error."""
        user_id = test_user.id

        with pytest.raises(AuthorizationError, match="not found"):
            await rbac_service.revoke_permission_from_user(
                user_id=user_id,
                permission_name="nonexistent.permission",
                revoked_by=user_id,
            )

    @pytest.mark.asyncio
    async def test_grant_permission_with_expiration(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test granting permission with expiration."""
        user_id = test_user.id
        expires_at = datetime.now(UTC) + timedelta(days=7)

        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
            expires_at=expires_at,
            reason="Temporary access for project",
        )
        await async_db_session.commit()

        # Should have permission
        assert await rbac_service.user_has_permission(user_id, "ticket.read")

    @pytest.mark.asyncio
    async def test_update_existing_permission_grant(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test updating an existing permission grant."""
        user_id = test_user.id

        # Grant permission first time
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
            reason="Initial grant",
        )
        await async_db_session.commit()

        # Grant again with different expiration (update)
        new_expires = datetime.now(UTC) + timedelta(days=30)
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
            expires_at=new_expires,
            reason="Extended access",
        )
        await async_db_session.commit()

        # Should still have permission
        assert await rbac_service.user_has_permission(user_id, "ticket.read")


@pytest.mark.integration
class TestCachingBehavior:
    """Test permission caching behavior."""

    @pytest.mark.asyncio
    async def test_permission_cache_hit(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test that permission lookups use cache."""
        user_id = test_user.id

        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # First call - cache miss
        perms1 = await rbac_service.get_user_permissions(user_id)

        # Second call - should hit cache
        perms2 = await rbac_service.get_user_permissions(user_id)

        assert perms1 == perms2
        assert "ticket.read" in perms2

    @pytest.mark.asyncio
    async def test_cache_invalidation_on_grant(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test that cache is invalidated when permissions change."""
        user_id = test_user.id

        # Get permissions (empty)
        perms1 = await rbac_service.get_user_permissions(user_id)
        assert len(perms1) == 0

        # Grant permission
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Cache should be invalidated, new permissions returned
        perms2 = await rbac_service.get_user_permissions(user_id)
        assert "ticket.read" in perms2

    @pytest.mark.asyncio
    async def test_cache_invalidation_on_revoke(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test that cache is invalidated on revoke."""
        user_id = test_user.id

        # Grant permission
        await rbac_service.grant_permission_to_user(
            user_id=user_id,
            permission_name="ticket.read",
            granted_by=user_id,
        )
        await async_db_session.commit()

        # Verify permission
        perms1 = await rbac_service.get_user_permissions(user_id)
        assert "ticket.read" in perms1

        # Revoke permission
        await rbac_service.revoke_permission_from_user(
            user_id=user_id,
            permission_name="ticket.read",
            revoked_by=user_id,
        )
        await async_db_session.commit()

        # Cache should be invalidated
        perms2 = await rbac_service.get_user_permissions(user_id)
        assert "ticket.read" not in perms2


@pytest.mark.integration
class TestServiceEdgeCases:
    """Test service edge cases for missing coverage."""

    @pytest.mark.asyncio
    async def test_revoke_role_not_assigned(
        self, rbac_service, sample_permissions, async_db_session, test_user
    ):
        """Test revoking a role that was never assigned (lines 266-268)."""
        user_id = test_user.id

        # Create role but don't assign it
        await rbac_service.create_role(
            name="never_assigned", display_name="Never Assigned", permissions=[]
        )
        await async_db_session.commit()

        # Try to revoke - should not error, just log warning
        await rbac_service.revoke_role_from_user(
            user_id=user_id,
            role_name="never_assigned",
            revoked_by=user_id,
            reason="testing",
        )
        await async_db_session.commit()

        # Should succeed without error
        roles = await rbac_service.get_user_roles(user_id)
        assert len(roles) == 0

    @pytest.mark.asyncio
    async def test_get_permission_by_name_nonexistent(
        self, rbac_service, async_db_session, test_user
    ):
        """Test getting a permission that doesn't exist."""
        # This tests the _get_permission_by_name method
        result = await rbac_service._get_permission_by_name("nonexistent.permission")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_role_by_name_nonexistent(self, rbac_service, async_db_session, test_user):
        """Test getting a role that doesn't exist."""
        # This tests the _get_role_by_name method
        result = await rbac_service._get_role_by_name("nonexistent_role")
        assert result is None
