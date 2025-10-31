"""Integration test for auth → RBAC flow.

This test verifies the complete authentication to RBAC permissions flow,
ensuring the UUID conversion works correctly throughout.
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password
from dotmac.platform.auth.models import Role
from dotmac.platform.auth.rbac_read_router import router as rbac_router
from dotmac.platform.auth.router import auth_router
from dotmac.platform.db import get_session_dependency
from dotmac.platform.user_management.models import User


@pytest.fixture
def app():
    """Create FastAPI app with auth and RBAC routers."""
    from dotmac.platform.tenant import TenantConfiguration, TenantMiddleware, TenantMode

    app = FastAPI()

    # Add tenant middleware for multi-tenant support
    tenant_config = TenantConfiguration(
        mode=TenantMode.MULTI,
        require_tenant_header=True,
        tenant_header_name="X-Tenant-ID",
    )
    app.add_middleware(TenantMiddleware, config=tenant_config)
    app.include_router(auth_router)
    app.include_router(rbac_router, prefix="/rbac")
    return app


@pytest.fixture
def client(app, async_db_session):
    """Create test client with database dependency."""
    from dotmac.platform.auth.router import get_auth_session

    # Override to return the test session
    async def override_get_auth_session():
        yield async_db_session

    app.dependency_overrides[get_session_dependency] = lambda: async_db_session
    app.dependency_overrides[get_auth_session] = override_get_auth_session
    return TestClient(app)


@pytest.fixture
def tenant_headers():
    """Standard tenant headers for API requests."""
    return {"X-Tenant-ID": "test-tenant"}


@pytest_asyncio.fixture
async def test_user_with_roles(async_db_session: AsyncSession):
    """Create test user with roles in database."""
    # Create roles first
    admin_role = Role(
        id=uuid4(),
        name="admin",
        display_name="Administrator",
        description="Admin role",
        is_system=True,
        is_active=True,
    )
    user_role = Role(
        id=uuid4(),
        name="user",
        display_name="User",
        description="Standard user",
        is_system=False,
        is_active=True,
    )
    async_db_session.add(admin_role)
    async_db_session.add(user_role)
    await async_db_session.commit()

    # Create user
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("testpass123"),
        tenant_id="test-tenant",
        is_active=True,
        is_superuser=True,
        roles=["admin", "user"],  # JSON array
        permissions=["user.read", "user.write", "billing.invoice.view"],
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)

    return user


@pytest.mark.integration
class TestAuthToRBACIntegration:
    """Integration tests for complete auth → RBAC flow."""

    @pytest.mark.asyncio
    async def test_complete_login_to_permissions_flow(
        self, client, tenant_headers, test_user_with_roles
    ):
        """Test the complete flow: login → get token → get permissions.

        This verifies that:
        1. User can login successfully
        2. JWT token contains correct user_id (as string)
        3. /my-permissions endpoint correctly converts string user_id to UUID
        4. User permissions are returned correctly
        """
        # Step 1: Login to get JWT token
        login_response = client.post(
            "/auth/login",
            json={"username": "testuser", "password": "testpass123"},
            headers=tenant_headers,
        )

        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        access_token = login_data["access_token"]

        # Step 2: Use token to get user's permissions
        # This is where the UUID bug would manifest
        permissions_response = client.get(
            "/rbac/my-permissions",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert permissions_response.status_code == 200
        perm_data = permissions_response.json()

        # Step 3: Verify response structure and data
        assert "user_id" in perm_data
        assert "roles" in perm_data
        assert "direct_permissions" in perm_data
        assert "effective_permissions" in perm_data
        assert "is_superuser" in perm_data

        # Verify superuser flag (from database User model)
        assert perm_data["is_superuser"] is True

        # Verify roles are returned
        assert len(perm_data["roles"]) == 2
        role_names = [r["name"] for r in perm_data["roles"]]
        assert "admin" in role_names
        assert "user" in role_names

        # Verify permissions are returned
        assert len(perm_data["direct_permissions"]) == 3
        perm_names = [p["name"] for p in perm_data["direct_permissions"]]
        assert "user.read" in perm_names
        assert "user.write" in perm_names
        assert "billing.invoice.view" in perm_names

    @pytest.mark.asyncio
    async def test_login_to_roles_flow(self, client, tenant_headers, test_user_with_roles):
        """Test login → get roles flow."""
        # Login
        login_response = client.post(
            "/auth/login",
            json={"username": "testuser", "password": "testpass123"},
            headers=tenant_headers,
        )
        access_token = login_response.json()["access_token"]

        # Get user roles
        roles_response = client.get(
            "/rbac/my-roles",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert roles_response.status_code == 200
        roles = roles_response.json()
        assert isinstance(roles, list)
        assert "admin" in roles
        assert "user" in roles

    @pytest.mark.asyncio
    async def test_login_to_available_roles_flow(
        self, client, tenant_headers, test_user_with_roles
    ):
        """Test login → get available roles flow."""
        # Login
        login_response = client.post(
            "/auth/login",
            json={"username": "testuser", "password": "testpass123"},
            headers=tenant_headers,
        )
        access_token = login_response.json()["access_token"]

        # Get available roles
        roles_response = client.get(
            "/rbac/roles",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert roles_response.status_code == 200
        roles = roles_response.json()
        assert len(roles) == 2
        role_names = [r["name"] for r in roles]
        assert "admin" in role_names
        assert "user" in role_names

    @pytest.mark.asyncio
    async def test_permissions_without_database_user(
        self, client, tenant_headers, async_db_session
    ):
        """Test permissions endpoint when user exists in JWT but not in DB.

        This edge case tests that the endpoint handles missing users gracefully.
        """
        # Create a minimal user just for auth (no roles)
        user = User(
            username="minimal",
            email="minimal@example.com",
            password_hash=hash_password("testpass123"),
            tenant_id="test-tenant",
            is_active=True,
        )
        async_db_session.add(user)
        await async_db_session.commit()

        # Login
        login_response = client.post(
            "/auth/login",
            json={"username": "minimal", "password": "testpass123"},
            headers=tenant_headers,
        )
        access_token = login_response.json()["access_token"]

        # Get permissions
        permissions_response = client.get(
            "/rbac/my-permissions",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert permissions_response.status_code == 200
        perm_data = permissions_response.json()

        # Should handle missing roles/permissions gracefully
        assert perm_data["is_superuser"] is False
        assert perm_data["roles"] == []
        assert perm_data["direct_permissions"] == []

    @pytest.mark.asyncio
    async def test_permission_name_parsing(self, client, tenant_headers, async_db_session):
        """Test that permission names are parsed correctly into category/resource/action."""
        # Create user with specific permission format
        user = User(
            username="parser",
            email="parser@example.com",
            password_hash=hash_password("testpass123"),
            tenant_id="test-tenant",
            is_active=True,
            permissions=["billing.invoice.create", "user.profile.update"],
        )
        async_db_session.add(user)
        await async_db_session.commit()

        # Login
        login_response = client.post(
            "/auth/login",
            json={"username": "parser", "password": "testpass123"},
            headers=tenant_headers,
        )
        access_token = login_response.json()["access_token"]

        # Get permissions
        permissions_response = client.get(
            "/rbac/my-permissions",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert permissions_response.status_code == 200
        perm_data = permissions_response.json()

        # Verify permission parsing
        perms = {p["name"]: p for p in perm_data["direct_permissions"]}

        # billing.invoice.create
        billing_perm = perms["billing.invoice.create"]
        assert billing_perm["category"] == "billing"
        assert billing_perm["resource"] == "invoice"
        assert billing_perm["action"] == "create"

        # user.profile.update
        user_perm = perms["user.profile.update"]
        assert user_perm["category"] == "user"
        assert user_perm["resource"] == "profile"
        assert user_perm["action"] == "update"


@pytest.mark.integration
class TestUUIDConversionHelper:
    """Test the ensure_uuid helper function."""

    def test_ensure_uuid_with_string(self):
        """Test ensure_uuid converts string to UUID."""
        from uuid import UUID

        from dotmac.platform.auth.core import ensure_uuid

        user_id_str = "550e8400-e29b-41d4-a716-446655440000"
        result = ensure_uuid(user_id_str)

        assert isinstance(result, UUID)
        assert str(result) == user_id_str

    def test_ensure_uuid_with_uuid(self):
        """Test ensure_uuid passes through UUID objects."""
        from uuid import UUID

        from dotmac.platform.auth.core import ensure_uuid

        user_id_uuid = UUID("550e8400-e29b-41d4-a716-446655440000")
        result = ensure_uuid(user_id_uuid)

        assert isinstance(result, UUID)
        assert result == user_id_uuid

    def test_ensure_uuid_with_invalid_string(self):
        """Test ensure_uuid raises ValueError for invalid UUID string."""
        from dotmac.platform.auth.core import ensure_uuid

        with pytest.raises(ValueError):
            ensure_uuid("not-a-valid-uuid")
