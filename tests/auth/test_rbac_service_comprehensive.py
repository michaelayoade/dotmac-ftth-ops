"""Comprehensive tests for RBAC service to achieve 90%+ coverage."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.models import Permission, Role
from dotmac.platform.auth.rbac_service import RBACService, get_rbac_service

pytestmark = pytest.mark.asyncio


@pytest.mark.asyncio
class TestUserPermissions:
    """Test user permission retrieval and checking."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.get = AsyncMock()
        return session

    @pytest.fixture
    def rbac_service(self, mock_session):
        """Create RBAC service."""
        return RBACService(mock_session)

    async def test_user_has_permission_exact_match(self, rbac_service):
        """Test user has permission with exact match."""
        user_id = uuid4()

        with patch.object(
            rbac_service, "get_user_permissions", return_value={"read:users", "write:users"}
        ):
            result = await rbac_service.user_has_permission(user_id, "read:users")
            assert result is True

    async def test_user_has_permission_wildcard_match(self, rbac_service):
        """Test user has permission with wildcard match."""
        user_id = uuid4()

        with patch.object(rbac_service, "get_user_permissions", return_value={"ticket.*"}):
            result = await rbac_service.user_has_permission(user_id, "ticket.read")
            assert result is True

    async def test_user_has_permission_superadmin(self, rbac_service):
        """Test superadmin has all permissions."""
        user_id = uuid4()

        with patch.object(rbac_service, "get_user_permissions", return_value={"*"}):
            result = await rbac_service.user_has_permission(user_id, "any.permission")
            assert result is True

    async def test_user_has_permission_no_match(self, rbac_service):
        """Test user doesn't have permission."""
        user_id = uuid4()

        with patch.object(rbac_service, "get_user_permissions", return_value={"read:users"}):
            result = await rbac_service.user_has_permission(user_id, "write:users")
            assert result is False

    async def test_user_has_any_permission_success(self, rbac_service):
        """Test user has any of the permissions."""
        user_id = uuid4()

        with patch.object(rbac_service, "user_has_permission", side_effect=[False, True, False]):
            result = await rbac_service.user_has_any_permission(
                user_id, ["write:users", "read:users", "delete:users"]
            )
            assert result is True

    async def test_user_has_any_permission_failure(self, rbac_service):
        """Test user doesn't have any of the permissions."""
        user_id = uuid4()

        with patch.object(rbac_service, "user_has_permission", return_value=False):
            result = await rbac_service.user_has_any_permission(user_id, ["write:users"])
            assert result is False

    async def test_user_has_all_permissions_success(self, rbac_service):
        """Test user has all permissions."""
        user_id = uuid4()

        with patch.object(rbac_service, "user_has_permission", return_value=True):
            result = await rbac_service.user_has_all_permissions(
                user_id, ["read:users", "write:users"]
            )
            assert result is True

    async def test_user_has_all_permissions_failure(self, rbac_service):
        """Test user doesn't have all permissions."""
        user_id = uuid4()

        with patch.object(rbac_service, "user_has_permission", side_effect=[True, False]):
            result = await rbac_service.user_has_all_permissions(
                user_id, ["read:users", "write:users"]
            )
            assert result is False


@pytest.mark.asyncio
class TestRoleManagement:
    """Test role management operations."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def rbac_service(self, mock_session):
        """Create RBAC service."""
        return RBACService(mock_session)

    @pytest.fixture
    def mock_role(self):
        """Create mock role."""
        role = MagicMock(spec=Role)
        role.id = uuid4()
        role.name = "test_role"
        role.is_active = True
        role.permissions = []
        return role

    async def test_get_user_roles_active_only(self, rbac_service, mock_role):
        """Test getting active user roles only."""
        user_id = uuid4()

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_role]

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        roles = await rbac_service.get_user_roles(user_id)

        assert len(roles) == 1
        assert roles[0] == mock_role

    async def test_get_user_roles_include_expired(self, rbac_service, mock_role):
        """Test getting user roles including expired."""
        user_id = uuid4()

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_role]

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        roles = await rbac_service.get_user_roles(user_id, include_expired=True)

        assert len(roles) == 1

    async def test_assign_role_to_user_success(self, rbac_service, mock_role):
        """Test assigning role to user."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            # Mock existing check to return None (no existing assignment)
            mock_result = MagicMock()
            mock_result.first.return_value = None
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            with patch.object(rbac_service, "_log_permission_grant"):
                with patch("dotmac.platform.auth.rbac_service.cache_delete"):
                    with patch(
                        "dotmac.platform.auth.rbac_service.get_current_tenant_id",
                        return_value="tenant1",
                    ):
                        with patch(
                            "dotmac.platform.auth.rbac_service.rbac_audit_logger"
                        ) as mock_audit:
                            mock_audit.log_role_assigned = AsyncMock()

                            await rbac_service.assign_role_to_user(user_id, "test_role", granted_by)

                            rbac_service.db.execute.assert_called()

    async def test_assign_role_already_assigned(self, rbac_service, mock_role):
        """Test assigning role that's already assigned."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            # Mock existing check to return existing assignment
            mock_result = MagicMock()
            mock_result.first.return_value = {"role_id": mock_role.id}
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            await rbac_service.assign_role_to_user(user_id, "test_role", granted_by)

            # Should not commit when already assigned
            rbac_service.db.commit.assert_not_called()

    async def test_assign_role_not_found(self, rbac_service):
        """Test assigning non-existent role."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=None):
            with pytest.raises(AuthorizationError, match="Role 'invalid_role' not found"):
                await rbac_service.assign_role_to_user(user_id, "invalid_role", granted_by)

    async def test_revoke_role_from_user_success(self, rbac_service, mock_role):
        """Test revoking role from user."""
        user_id = uuid4()
        revoked_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            mock_result = AsyncMock()
            mock_result.rowcount = 1
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            with patch.object(rbac_service, "_log_permission_grant"):
                with patch("dotmac.platform.auth.rbac_service.cache_delete"):
                    with patch(
                        "dotmac.platform.auth.rbac_service.get_current_tenant_id",
                        return_value="tenant1",
                    ):
                        with patch(
                            "dotmac.platform.auth.rbac_service.rbac_audit_logger"
                        ) as mock_audit:
                            mock_audit.log_role_revoked = AsyncMock()

                            await rbac_service.revoke_role_from_user(
                                user_id, "test_role", revoked_by, reason="Test reason"
                            )

                            rbac_service.db.execute.assert_called()

    async def test_revoke_role_not_assigned(self, rbac_service, mock_role):
        """Test revoking role that's not assigned."""
        user_id = uuid4()
        revoked_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=mock_role):
            mock_result = AsyncMock()
            mock_result.rowcount = 0  # No rows deleted
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            await rbac_service.revoke_role_from_user(user_id, "test_role", revoked_by)

            # Should not commit when role wasn't assigned
            rbac_service.db.commit.assert_not_called()

    async def test_revoke_role_not_found(self, rbac_service):
        """Test revoking non-existent role."""
        user_id = uuid4()
        revoked_by = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", return_value=None):
            with pytest.raises(AuthorizationError, match="Role 'invalid_role' not found"):
                await rbac_service.revoke_role_from_user(user_id, "invalid_role", revoked_by)


@pytest.mark.asyncio
class TestPermissionManagement:
    """Test permission grant operations."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def rbac_service(self, mock_session):
        """Create RBAC service."""
        return RBACService(mock_session)

    @pytest.fixture
    def mock_permission(self):
        """Create mock permission."""
        perm = MagicMock(spec=Permission)
        perm.id = uuid4()
        perm.name = "test:permission"
        perm.is_active = True
        return perm

    async def test_grant_permission_new(self, rbac_service, mock_permission):
        """Test granting new permission to user."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            # Mock no existing grant
            mock_result = MagicMock()
            mock_result.first.return_value = None
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            with patch.object(rbac_service, "_log_permission_grant"):
                with patch("dotmac.platform.auth.rbac_service.cache_delete"):
                    with patch(
                        "dotmac.platform.auth.rbac_service.get_current_tenant_id",
                        return_value="tenant1",
                    ):
                        with patch(
                            "dotmac.platform.auth.rbac_service.rbac_audit_logger"
                        ) as mock_audit:
                            mock_audit.log_permission_granted = AsyncMock()

                            await rbac_service.grant_permission_to_user(
                                user_id, "test:permission", granted_by, reason="Test grant"
                            )

                            rbac_service.db.execute.assert_called()

    async def test_grant_permission_update_existing(self, rbac_service, mock_permission):
        """Test updating existing permission grant."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            # Mock existing grant
            mock_result = MagicMock()
            mock_result.first.return_value = {"permission_id": mock_permission.id}
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            with patch.object(rbac_service, "_log_permission_grant"):
                with patch("dotmac.platform.auth.rbac_service.cache_delete"):
                    with patch(
                        "dotmac.platform.auth.rbac_service.get_current_tenant_id",
                        return_value="tenant1",
                    ):
                        with patch(
                            "dotmac.platform.auth.rbac_service.rbac_audit_logger"
                        ) as mock_audit:
                            mock_audit.log_permission_granted = AsyncMock()

                            await rbac_service.grant_permission_to_user(
                                user_id, "test:permission", granted_by
                            )

                            rbac_service.db.execute.assert_called()

    async def test_grant_permission_not_found(self, rbac_service):
        """Test granting non-existent permission."""
        user_id = uuid4()
        granted_by = uuid4()

        with patch.object(rbac_service, "_get_permission_by_name", return_value=None):
            with pytest.raises(
                AuthorizationError, match="Permission 'invalid:permission' not found"
            ):
                await rbac_service.grant_permission_to_user(
                    user_id, "invalid:permission", granted_by
                )

    async def test_grant_permission_with_expiration(self, rbac_service, mock_permission):
        """Test granting permission with expiration."""
        user_id = uuid4()
        granted_by = uuid4()
        expires_at = datetime.now(UTC) + timedelta(days=30)

        with patch.object(rbac_service, "_get_permission_by_name", return_value=mock_permission):
            mock_result = MagicMock()
            mock_result.first.return_value = None
            rbac_service.db.execute = AsyncMock(return_value=mock_result)

            with patch.object(rbac_service, "_log_permission_grant"):
                with patch("dotmac.platform.auth.rbac_service.cache_delete"):
                    with patch(
                        "dotmac.platform.auth.rbac_service.get_current_tenant_id",
                        return_value="tenant1",
                    ):
                        with patch(
                            "dotmac.platform.auth.rbac_service.rbac_audit_logger"
                        ) as mock_audit:
                            mock_audit.log_permission_granted = AsyncMock()

                            await rbac_service.grant_permission_to_user(
                                user_id, "test:permission", granted_by, expires_at=expires_at
                            )

                            rbac_service.db.execute.assert_called()


@pytest.mark.asyncio
class TestRolePermissionCRUD:
    """Test role and permission creation."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def rbac_service(self, mock_session):
        """Create RBAC service."""
        return RBACService(mock_session)

    async def test_create_role_success(self, rbac_service):
        """Test creating new role."""
        with patch.object(rbac_service, "_get_role_by_name", return_value=None):
            role = await rbac_service.create_role(
                name="test_role",
                display_name="Test Role",
                description="Test role description",
            )

            assert role is not None
            rbac_service.db.add.assert_called_once()
            rbac_service.db.flush.assert_called()

    async def test_create_role_with_parent(self, rbac_service):
        """Test creating role with parent role."""
        parent_role = MagicMock(spec=Role)
        parent_role.id = uuid4()

        with patch.object(rbac_service, "_get_role_by_name", side_effect=[None, parent_role]):
            role = await rbac_service.create_role(
                name="child_role", display_name="Child Role", parent_role="parent_role"
            )

            assert role is not None
            rbac_service.db.flush.assert_called()

    async def test_create_role_already_exists(self, rbac_service):
        """Test creating role that already exists."""
        existing_role = MagicMock(spec=Role)

        with patch.object(rbac_service, "_get_role_by_name", return_value=existing_role):
            with pytest.raises(AuthorizationError, match="Role 'existing_role' already exists"):
                await rbac_service.create_role(name="existing_role", display_name="Existing")

    async def test_create_role_parent_not_found(self, rbac_service):
        """Test creating role with non-existent parent."""
        with patch.object(rbac_service, "_get_role_by_name", side_effect=[None, None]):
            with pytest.raises(AuthorizationError, match="Parent role 'invalid_parent' not found"):
                await rbac_service.create_role(
                    name="child_role", display_name="Child", parent_role="invalid_parent"
                )


@pytest.mark.asyncio
class TestHelperMethods:
    """Test helper methods."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.get = AsyncMock()
        return session

    @pytest.fixture
    def rbac_service(self, mock_session):
        """Create RBAC service."""
        return RBACService(mock_session)

    async def test_get_role_by_name_cached(self, rbac_service):
        """Test getting role from cache."""
        mock_role = MagicMock(spec=Role)
        rbac_service._role_cache["cached_role"] = mock_role

        role = await rbac_service._get_role_by_name("cached_role")

        assert role == mock_role
        rbac_service.db.execute.assert_not_called()

    async def test_get_role_by_name_from_db(self, rbac_service):
        """Test getting role from database."""
        mock_role = MagicMock(spec=Role)
        mock_role.name = "test_role"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_role

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        role = await rbac_service._get_role_by_name("test_role")

        assert role == mock_role
        assert "test_role" in rbac_service._role_cache

    async def test_get_role_by_name_not_found(self, rbac_service):
        """Test getting non-existent role."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        role = await rbac_service._get_role_by_name("nonexistent")

        assert role is None

    async def test_get_permission_by_name_cached(self, rbac_service):
        """Test getting permission from cache."""
        mock_perm = MagicMock(spec=Permission)
        rbac_service._permission_cache["cached:perm"] = mock_perm

        perm = await rbac_service._get_permission_by_name("cached:perm")

        assert perm == mock_perm
        rbac_service.db.execute.assert_not_called()

    async def test_get_permission_by_name_from_db(self, rbac_service):
        """Test getting permission from database."""
        mock_perm = MagicMock(spec=Permission)
        mock_perm.name = "test:permission"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_perm

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        perm = await rbac_service._get_permission_by_name("test:permission")

        assert perm == mock_perm
        assert "test:permission" in rbac_service._permission_cache

    async def test_get_permission_by_name_not_found(self, rbac_service):
        """Test getting non-existent permission."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        rbac_service.db.execute = AsyncMock(return_value=mock_result)

        perm = await rbac_service._get_permission_by_name("nonexistent:perm")

        assert perm is None

    async def test_expand_permissions_with_parent(self, rbac_service):
        """Test permission expansion with parent."""
        child_perm = MagicMock(spec=Permission)
        child_perm.name = "child:perm"
        child_perm.parent_id = uuid4()

        parent_perm = MagicMock(spec=Permission)
        parent_perm.name = "parent:perm"

        rbac_service._permission_cache["child:perm"] = child_perm
        rbac_service.db.get = AsyncMock(return_value=parent_perm)

        expanded = await rbac_service._expand_permissions({"child:perm"})

        assert "child:perm" in expanded
        assert "parent:perm" in expanded

    async def test_expand_permissions_with_wildcard(self, rbac_service):
        """Test permission expansion with wildcards."""
        with patch.object(rbac_service, "_get_permission_by_name", return_value=None):
            expanded = await rbac_service._expand_permissions({"ticket.read.all"})

            assert "ticket.read.all" in expanded
            assert "ticket.*" in expanded
            assert "ticket.read.*" in expanded

    async def test_log_permission_grant(self, rbac_service):
        """Test logging permission grant."""
        user_id = uuid4()
        role_id = uuid4()
        granted_by = uuid4()

        await rbac_service._log_permission_grant(
            user_id=user_id,
            role_id=role_id,
            granted_by=granted_by,
            action="grant",
            reason="Test reason",
        )

        rbac_service.db.add.assert_called_once()


@pytest.mark.integration
class TestGetRBACService:
    """Test dependency function."""

    @pytest.mark.asyncio
    async def test_get_rbac_service(self):
        """Test getting RBAC service via dependency."""
        mock_db = AsyncMock()

        service = await get_rbac_service(mock_db)

        assert isinstance(service, RBACService)
        assert service.db == mock_db
