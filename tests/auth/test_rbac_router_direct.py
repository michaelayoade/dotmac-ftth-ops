"""
Direct async tests for RBAC router to improve coverage.

These tests call router functions directly without TestClient
to avoid async/greenlet issues and improve coverage.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.models import Permission, PermissionCategory, Role
from dotmac.platform.auth.rbac_router import (
    delete_role,
    get_permission,
    list_permissions,
    list_roles,
)
from dotmac.platform.auth.rbac_service import RBACService


@pytest_asyncio.fixture
async def mock_admin_user():
    """Mock admin user."""
    return UserInfo(
        user_id=str(uuid4()),
        email="admin@test.com",
        tenant_id="test",
        roles=["admin"],
        permissions=["admin.*"],
    )


class TestPermissionEndpointsDirect:
    """Direct tests for permission endpoints."""

    @pytest.mark.asyncio
    async def test_list_permissions_with_category(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test list permissions filtered by category."""
        # Create permissions
        perm1 = Permission(
            name="user.read",
            display_name="Read User",
            category=PermissionCategory.USER,
            is_active=True,
        )
        perm2 = Permission(
            name="admin.read",
            display_name="Read Admin",
            category=PermissionCategory.ADMIN,
            is_active=True,
        )
        async_db_session.add_all([perm1, perm2])
        await async_db_session.commit()

        # Call endpoint directly
        result = await list_permissions(
            category=PermissionCategory.USER, db=async_db_session, current_user=mock_admin_user
        )

        # Should only return USER category
        assert len(result) == 1
        assert result[0].category == PermissionCategory.USER

    @pytest.mark.asyncio
    async def test_get_permission_not_found(self, async_db_session: AsyncSession, mock_admin_user):
        """Test get permission that doesn't exist."""
        with pytest.raises(HTTPException) as exc_info:
            await get_permission(
                permission_name="nonexistent.perm",
                db=async_db_session,
                current_user=mock_admin_user,
            )

        assert exc_info.value.status_code == 404


class TestRoleEndpointsDirect:
    """Direct tests for role endpoints."""

    @pytest.mark.asyncio
    async def test_list_roles_with_permissions_and_count(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test listing roles with both permissions and user count."""
        # Create role with permission
        perm = Permission(
            name="test.read",
            display_name="Test Read",
            category=PermissionCategory.USER,
            is_active=True,
        )
        async_db_session.add(perm)
        await async_db_session.flush()

        rbac = RBACService(async_db_session)
        await rbac.create_role(
            name="test_role", display_name="Test Role", permissions=["test.read"]
        )
        await async_db_session.commit()

        # Call endpoint with both options
        result = await list_roles(
            include_permissions=True,
            include_user_count=True,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        # Find our role
        test_role = next((r for r in result if r.name == "test_role"), None)
        assert test_role is not None
        assert hasattr(test_role, "permissions")
        assert len(test_role.permissions) > 0
        assert hasattr(test_role, "user_count")
        assert test_role.user_count == 0

    @pytest.mark.asyncio
    async def test_delete_role_not_found(self, async_db_session: AsyncSession, mock_admin_user):
        """Test deleting non-existent role."""
        fake_id = uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await delete_role(role_id=fake_id, db=async_db_session, current_user=mock_admin_user)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_system_role_forbidden(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test deleting system role raises 403."""
        # Create system role
        role = Role(
            name="system_role",
            display_name="System Role",
            is_system=True,
            is_active=True,
        )
        async_db_session.add(role)
        await async_db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await delete_role(role_id=role.id, db=async_db_session, current_user=mock_admin_user)

        assert exc_info.value.status_code == 403


class TestUserPermissionEndpointsDirect:
    """Direct tests for user permission management endpoints."""

    @pytest.mark.asyncio
    async def test_get_user_permissions_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test getting user permissions directly."""
        from dotmac.platform.auth.rbac_router import get_user_permissions

        user_id = uuid4()

        # Create and grant permission
        perm = Permission(
            name="direct.test",
            display_name="Direct Test",
            category=PermissionCategory.USER,
            is_active=True,
        )
        async_db_session.add(perm)
        await async_db_session.flush()

        rbac = RBACService(async_db_session)
        await rbac.grant_permission_to_user(
            user_id=user_id, permission_name="direct.test", granted_by=user_id
        )
        await async_db_session.commit()

        # Call endpoint
        result = await get_user_permissions(
            user_id=user_id,
            rbac_service=rbac,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        # Result is a Pydantic model
        assert hasattr(result, "permissions")
        assert "direct.test" in result.permissions

    @pytest.mark.asyncio
    async def test_revoke_permission_from_user_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test revoking permission directly."""
        from dotmac.platform.auth.rbac_router import revoke_permission_from_user

        user_id = uuid4()

        # Create and grant permission
        perm = Permission(
            name="revoke.test",
            display_name="Revoke Test",
            category=PermissionCategory.USER,
            is_active=True,
        )
        async_db_session.add(perm)
        await async_db_session.flush()

        rbac = RBACService(async_db_session)
        await rbac.grant_permission_to_user(
            user_id=user_id, permission_name="revoke.test", granted_by=user_id
        )
        await async_db_session.commit()

        # Revoke via endpoint
        await revoke_permission_from_user(
            user_id=user_id,
            permission_name="revoke.test",
            rbac_service=rbac,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        # Verify revoked
        perms = await rbac.get_user_permissions(user_id)
        assert "revoke.test" not in perms

    @pytest.mark.asyncio
    async def test_revoke_role_from_user_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test revoking role from user directly."""
        from dotmac.platform.auth.rbac_router import revoke_role_from_user

        user_id = uuid4()

        # Create role
        rbac = RBACService(async_db_session)
        role = await rbac.create_role(
            name="revoke_role", display_name="Revoke Role", permissions=[]
        )
        await async_db_session.flush()

        # Assign role
        await rbac.assign_role_to_user(user_id=user_id, role_name="revoke_role", granted_by=user_id)
        await async_db_session.commit()

        # Revoke via endpoint
        await revoke_role_from_user(
            user_id=user_id,
            role_id=role.id,
            rbac_service=rbac,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        # Verify revoked
        roles = await rbac.get_user_roles(user_id)
        assert len(roles) == 0


class TestRoleCRUDEndpointsDirect:
    """Direct tests for role CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_role_success_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test creating a role via endpoint."""
        from dotmac.platform.auth.rbac_router import RoleCreateRequest, create_role

        # Create permission first
        perm = Permission(
            name="create.test",
            display_name="Create Test",
            category=PermissionCategory.USER,
            is_active=True,
        )
        async_db_session.add(perm)
        await async_db_session.commit()

        request = RoleCreateRequest(
            name="new_role",
            display_name="New Role",
            description="Test role",
            permissions=["create.test"],
        )

        rbac = RBACService(async_db_session)

        result = await create_role(
            request=request,
            rbac_service=rbac,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        assert result.name == "new_role"
        assert result.display_name == "New Role"

    @pytest.mark.asyncio
    async def test_update_role_description_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test updating role description."""
        from dotmac.platform.auth.rbac_router import RoleUpdateRequest, update_role

        # Create role
        rbac = RBACService(async_db_session)
        role = await rbac.create_role(
            name="update_role", display_name="Update Role", permissions=[]
        )
        await async_db_session.commit()

        request = RoleUpdateRequest(description="Updated description")

        result = await update_role(
            role_id=role.id, request=request, db=async_db_session, current_user=mock_admin_user
        )

        assert result.description == "Updated description"

    @pytest.mark.asyncio
    async def test_update_role_is_active_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test updating role is_active status."""
        from dotmac.platform.auth.rbac_router import RoleUpdateRequest, update_role

        # Create role
        rbac = RBACService(async_db_session)
        role = await rbac.create_role(
            name="active_role", display_name="Active Role", permissions=[]
        )
        await async_db_session.commit()

        request = RoleUpdateRequest(is_active=False)

        result = await update_role(
            role_id=role.id, request=request, db=async_db_session, current_user=mock_admin_user
        )

        assert result.is_active is False

    @pytest.mark.asyncio
    async def test_update_role_permissions_list_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test updating role with permissions list."""
        from dotmac.platform.auth.rbac_router import RoleUpdateRequest, update_role

        # Create permissions
        perm1 = Permission(
            name="perm1", display_name="Perm 1", category=PermissionCategory.USER, is_active=True
        )
        perm2 = Permission(
            name="perm2", display_name="Perm 2", category=PermissionCategory.USER, is_active=True
        )
        async_db_session.add_all([perm1, perm2])
        await async_db_session.flush()

        # Create role
        rbac = RBACService(async_db_session)
        role = await rbac.create_role(name="perm_role", display_name="Perm Role", permissions=[])
        await async_db_session.commit()

        # Update with permissions
        request = RoleUpdateRequest(permissions=["perm1", "perm2"])
        result = await update_role(
            role_id=role.id, request=request, db=async_db_session, current_user=mock_admin_user
        )

        assert result.name == "perm_role"

    @pytest.mark.asyncio
    async def test_grant_permission_to_user_direct(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test granting permission via endpoint."""
        from dotmac.platform.auth.rbac_router import (
            PermissionGrantRequest,
            grant_permission_to_user,
        )

        user_id = uuid4()

        # Create permission
        perm = Permission(
            name="grant.test",
            display_name="Grant Test",
            category=PermissionCategory.USER,
            is_active=True,
        )
        async_db_session.add(perm)
        await async_db_session.commit()

        rbac = RBACService(async_db_session)

        request = PermissionGrantRequest(
            permission_name="grant.test",
            expires_at=datetime.now(UTC) + timedelta(days=30),
            reason="Test grant",
        )

        await grant_permission_to_user(
            user_id=user_id,
            request=request,
            rbac_service=rbac,
            db=async_db_session,
            current_user=mock_admin_user,
        )

        # Verify granted
        perms = await rbac.get_user_permissions(user_id)
        assert "grant.test" in perms

    @pytest.mark.asyncio
    async def test_assign_role_to_user_not_found(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test assigning non-existent role."""
        from dotmac.platform.auth.rbac_router import assign_role_to_user

        user_id = uuid4()
        fake_role_id = uuid4()
        rbac = RBACService(async_db_session)

        with pytest.raises(HTTPException) as exc_info:
            await assign_role_to_user(
                user_id=user_id,
                role_id=fake_role_id,
                rbac_service=rbac,
                db=async_db_session,
                current_user=mock_admin_user,
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_role_not_found(self, async_db_session: AsyncSession, mock_admin_user):
        """Test updating non-existent role."""
        from dotmac.platform.auth.rbac_router import RoleUpdateRequest, update_role

        fake_id = uuid4()
        request = RoleUpdateRequest(display_name="Updated")

        with pytest.raises(HTTPException) as exc_info:
            await update_role(
                role_id=fake_id, request=request, db=async_db_session, current_user=mock_admin_user
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_system_role_forbidden(
        self, async_db_session: AsyncSession, mock_admin_user
    ):
        """Test updating system role is forbidden."""
        from dotmac.platform.auth.rbac_router import RoleUpdateRequest, update_role

        # Create system role
        role = Role(name="sys_role", display_name="System Role", is_system=True, is_active=True)
        async_db_session.add(role)
        await async_db_session.commit()

        request = RoleUpdateRequest(display_name="Hacked")

        with pytest.raises(HTTPException) as exc_info:
            await update_role(
                role_id=role.id, request=request, db=async_db_session, current_user=mock_admin_user
            )

        assert exc_info.value.status_code == 403
