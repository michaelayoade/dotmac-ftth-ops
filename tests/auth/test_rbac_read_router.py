"""Tests for RBAC read-only router."""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.models import Role
from dotmac.platform.auth.rbac_read_router import router
from dotmac.platform.db import get_session_dependency

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app."""
    from dotmac.platform.tenant import TenantConfiguration, TenantMiddleware, TenantMode

    app = FastAPI()

    # Add tenant middleware for multi-tenant support
    tenant_config = TenantConfiguration(
        mode=TenantMode.MULTI,
        require_tenant_header=True,
        tenant_header_name="X-Tenant-ID",
    )
    app.add_middleware(TenantMiddleware, config=tenant_config)
    app.include_router(router, prefix="/rbac")
    return app


@pytest.fixture
def mock_user():
    """Create mock user info."""
    return UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["admin", "user"],
        permissions=["user.profile.read", "user.profile.write", "billing.invoice.view"],
    )


@pytest.fixture
def client(app, async_db_session: AsyncSession, mock_user):
    """Create test client with overrides."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_session_dependency] = lambda: async_db_session
    return TestClient(app)


@pytest.fixture
def tenant_headers():
    """Standard tenant headers for API requests."""
    return {"X-Tenant-ID": "test-tenant"}


@pytest_asyncio.fixture
async def sample_roles(async_db_session: AsyncSession):
    """Create sample roles in database."""
    roles = [
        Role(
            id=uuid4(),
            name="admin",
            display_name="Administrator",
            description="Admin role",
            is_system=True,
            is_active=True,
        ),
        Role(
            id=uuid4(),
            name="user",
            display_name="User",
            description="Standard user",
            is_system=False,
            is_active=True,
        ),
        Role(
            id=uuid4(),
            name="inactive_role",
            display_name="Inactive",
            description="Inactive role",
            is_system=False,
            is_active=False,
        ),
    ]
    for role in roles:
        async_db_session.add(role)
    await async_db_session.commit()
    return roles


class TestGetMyPermissions:
    """Test GET /my-permissions endpoint."""

    @pytest.mark.asyncio
    async def test_get_my_permissions_with_roles(
        self, client, tenant_headers, sample_roles, async_db_session
    ):
        """Test getting user permissions with roles in database."""
        # Create a user in the database
        from dotmac.platform.auth.core import hash_password
        from dotmac.platform.user_management.models import User

        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=hash_password("test123"),
            is_superuser=True,
        )
        async_db_session.add(user)
        await async_db_session.commit()

        # Override user_id to match
        app = client.app
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(user.id),
            username="testuser",
            email="test@example.com",
            tenant_id="test-tenant",
            roles=["admin", "user"],
            permissions=["user.profile.read", "user.profile.write"],
        )

        response = client.get(
            "/rbac/my-permissions",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "roles" in data
        assert "direct_permissions" in data
        assert "effective_permissions" in data
        assert data["is_superuser"] is True

        # Check roles
        assert len(data["roles"]) == 2
        role_names = [r["name"] for r in data["roles"]]
        assert "admin" in role_names
        assert "user" in role_names

        # Check permissions
        assert len(data["direct_permissions"]) == 2
        perm_names = [p["name"] for p in data["direct_permissions"]]
        assert "user.profile.read" in perm_names

        # Check permission parsing
        read_perm = next(p for p in data["direct_permissions"] if p["name"] == "user.profile.read")
        assert read_perm["category"] == "user"
        assert read_perm["resource"] == "profile"
        assert read_perm["action"] == "read"

    @pytest.mark.asyncio
    async def test_get_my_permissions_role_not_in_db(
        self, client, tenant_headers, async_db_session
    ):
        """Test permissions when role not found in database."""
        # Create a user but no roles in DB
        from dotmac.platform.auth.core import hash_password
        from dotmac.platform.user_management.models import User

        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=hash_password("test123"),
            is_superuser=False,
        )
        async_db_session.add(user)
        await async_db_session.commit()

        # Override with user that has roles not in DB
        app = client.app
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(user.id),
            username="testuser",
            email="test@example.com",
            tenant_id="test-tenant",
            roles=["nonexistent_role"],
            permissions=["some.permission"],
        )

        response = client.get(
            "/rbac/my-permissions",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should still return role with fallback values
        assert len(data["roles"]) == 1
        assert data["roles"][0]["name"] == "nonexistent_role"
        assert data["roles"][0]["display_name"] == "Nonexistent Role"
        assert data["roles"][0]["is_system"] is False

    @pytest.mark.asyncio
    async def test_get_my_permissions_no_user_in_db(self, client, tenant_headers, async_db_session):
        """Test permissions when user not in database."""
        response = client.get(
            "/rbac/my-permissions",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_superuser"] is False

    @pytest.mark.asyncio
    async def test_get_my_permissions_empty_roles(self, client, tenant_headers, async_db_session):
        """Test permissions with no roles."""
        from dotmac.platform.auth.core import hash_password
        from dotmac.platform.user_management.models import User

        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=hash_password("test123"),
            is_superuser=False,
        )
        async_db_session.add(user)
        await async_db_session.commit()

        app = client.app
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(user.id),
            username="testuser",
            email="test@example.com",
            tenant_id="test-tenant",
            roles=[],
            permissions=[],
        )

        response = client.get(
            "/rbac/my-permissions",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["roles"] == []
        assert data["direct_permissions"] == []

    @pytest.mark.asyncio
    async def test_get_my_permissions_complex_permission_parsing(
        self, client, tenant_headers, async_db_session
    ):
        """Test permission name parsing with various formats."""
        from dotmac.platform.auth.core import hash_password
        from dotmac.platform.user_management.models import User

        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=hash_password("test123"),
        )
        async_db_session.add(user)
        await async_db_session.commit()

        app = client.app
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(user.id),
            username="testuser",
            email="test@example.com",
            tenant_id="test-tenant",
            roles=[],
            permissions=["simple", "one.two", "full.permission.name"],
        )

        response = client.get(
            "/rbac/my-permissions",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()

        perms = {p["name"]: p for p in data["direct_permissions"]}

        # Simple permission
        assert perms["simple"]["category"] == "simple"
        assert perms["simple"]["resource"] == ""
        assert perms["simple"]["action"] == ""

        # Two-part permission
        assert perms["one.two"]["category"] == "one"
        assert perms["one.two"]["resource"] == "two"
        assert perms["one.two"]["action"] == ""

        # Full permission
        assert perms["full.permission.name"]["category"] == "full"
        assert perms["full.permission.name"]["resource"] == "permission"
        assert perms["full.permission.name"]["action"] == "name"


class TestGetRoles:
    """Test GET /roles endpoint."""

    @pytest.mark.asyncio
    async def test_get_roles_active_only(self, client, tenant_headers, sample_roles):
        """Test getting active roles only."""
        response = client.get(
            "/rbac/roles?active_only=true",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 2  # Only active roles
        role_names = [r["name"] for r in data]
        assert "admin" in role_names
        assert "user" in role_names
        assert "inactive_role" not in role_names

    @pytest.mark.asyncio
    async def test_get_roles_include_inactive(self, client, tenant_headers, sample_roles):
        """Test getting all roles including inactive."""
        response = client.get(
            "/rbac/roles?active_only=false",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 3  # All roles
        role_names = [r["name"] for r in data]
        assert "admin" in role_names
        assert "user" in role_names
        assert "inactive_role" in role_names

    @pytest.mark.asyncio
    async def test_get_roles_default_active_only(self, client, tenant_headers, sample_roles):
        """Test default behavior is active_only=true."""
        response = client.get(
            "/rbac/roles",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 2  # Only active by default

    @pytest.mark.asyncio
    async def test_get_roles_empty(self, client, tenant_headers):
        """Test getting roles when none exist."""
        response = client.get(
            "/rbac/roles",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data == []


class TestGetMyRoles:
    """Test GET /my-roles endpoint."""

    def test_get_my_roles_success(self, client, tenant_headers):
        """Test getting current user's roles."""
        response = client.get(
            "/rbac/my-roles",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "admin" in data
        assert "user" in data

    def test_get_my_roles_empty(self, app, tenant_headers):
        """Test getting roles when user has none."""
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(uuid4()),
            username="noroles",
            email="noroles@example.com",
            tenant_id="test-tenant",
            roles=[],
            permissions=[],
        )
        app.dependency_overrides[get_session_dependency] = lambda: AsyncMock()

        client = TestClient(app)
        response = client.get(
            "/rbac/my-roles",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_get_my_roles_with_single_role(self, app, tenant_headers):
        """Test getting roles when user has a single role."""
        app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id=str(uuid4()),
            username="singlerole",
            email="singlerole@example.com",
            tenant_id="test-tenant",
            roles=["viewer"],
            permissions=[],
        )
        app.dependency_overrides[get_session_dependency] = lambda: AsyncMock()

        client = TestClient(app)
        response = client.get(
            "/rbac/my-roles",
            headers=tenant_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data == ["viewer"]
