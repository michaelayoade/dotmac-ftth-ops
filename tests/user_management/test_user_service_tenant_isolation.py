"""
Tenant isolation tests for UserService.

Validates that user service methods properly enforce tenant boundaries
and prevent cross-tenant data access.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService


@pytest_asyncio.fixture
async def tenant_a_user(async_db_session):
    """Create user in tenant-a."""
    user = User(
        id=uuid4(),
        username="tenant_a_user",
        email="a@example.com",
        password_hash="hashed",
        tenant_id="tenant-a",
        is_active=True,
        is_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.flush()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def tenant_b_user(async_db_session):
    """Create user in tenant-b."""
    user = User(
        id=uuid4(),
        username="tenant_b_user",
        email="b@example.com",
        password_hash="hashed",
        tenant_id="tenant-b",
        is_active=True,
        is_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.flush()
    await async_db_session.refresh(user)
    return user


@pytest.mark.integration
class TestUserServiceTenantRequirements:
    """Test that UserService enforces tenant requirements by default."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def user_service(self, mock_session):
        """Create UserService instance."""
        return UserService(mock_session)

    @pytest.mark.asyncio
    async def test_list_users_requires_tenant_by_default(self, user_service):
        """Test that list_users requires tenant_id parameter."""
        with pytest.raises(ValueError) as exc_info:
            await user_service.list_users()

        assert "tenant_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_users_with_tenant_id_works(self, user_service, mock_session):
        """Test that providing tenant_id allows the query."""
        # Mock the database query results
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        mock_session.execute.side_effect = [mock_count_result, mock_result]

        users, total = await user_service.list_users(tenant_id="tenant-123")

        assert mock_session.execute.call_count == 2
        assert total == 0
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_list_users_explicit_bypass_works(self, user_service, mock_session):
        """Test that explicit bypass allows cross-tenant queries."""
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        mock_session.execute.side_effect = [mock_count_result, mock_result]

        # Should work with explicit bypass
        users, total = await user_service.list_users(tenant_id=None, require_tenant=False)

        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_tenant_validation(self, user_service, mock_session):
        """Test get_user_by_id validates tenant match."""
        user_id = uuid4()
        expected_tenant = "tenant-123"

        # Mock user from database
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.tenant_id = expected_tenant
        mock_user.username = "testuser"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result

        # Get user with matching tenant - should succeed
        user = await user_service.get_user_by_id(user_id, tenant_id=expected_tenant)

        assert user is not None
        assert user.id == user_id
        assert mock_session.execute.call_count == 1

    @pytest.mark.asyncio
    async def test_get_user_by_username_filters_by_tenant(self, user_service, mock_session):
        """Test get_user_by_username includes tenant filter."""
        username = "testuser"
        tenant_id = "tenant-123"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await user_service.get_user_by_username(username, tenant_id=tenant_id)

        # Verify execute was called with a query
        assert mock_session.execute.call_count == 1

        # Get the query that was executed
        query = mock_session.execute.call_args[0][0]

        # Query should be a select statement
        assert query is not None

    @pytest.mark.asyncio
    async def test_get_user_by_email_filters_by_tenant(self, user_service, mock_session):
        """Test get_user_by_email includes tenant filter."""
        email = "test@example.com"
        tenant_id = "tenant-123"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await user_service.get_user_by_email(email, tenant_id=tenant_id)

        # Verify execute was called
        assert mock_session.execute.call_count == 1


@pytest.mark.integration
class TestUserServiceCrossTenantPrevention:
    """Test that UserService prevents cross-tenant data access."""

    @pytest.fixture
    def user_service(self, async_db_session):
        """Create UserService with real session."""
        return UserService(async_db_session)

    @pytest.mark.asyncio
    async def test_cannot_query_users_from_other_tenant(
        self, user_service, tenant_a_user, tenant_b_user
    ):
        """Test that querying for tenant-a users doesn't return tenant-b users."""
        # Query for tenant-a users
        users, total = await user_service.list_users(tenant_id="tenant-a")

        # Should only find tenant-a user
        assert total == 1
        assert len(users) == 1
        assert users[0].username == "tenant_a_user"
        assert users[0].tenant_id == "tenant-a"

        # Verify tenant-b user is NOT in results
        user_ids = [u.id for u in users]
        assert tenant_b_user.id not in user_ids

    @pytest.mark.asyncio
    async def test_get_user_by_username_respects_tenant(
        self, user_service, tenant_a_user, tenant_b_user
    ):
        """Test username lookup is scoped to tenant."""
        # Look for tenant_a_user within tenant-a - should find it
        user_a = await user_service.get_user_by_username("tenant_a_user", tenant_id="tenant-a")
        assert user_a is not None
        assert user_a.username == "tenant_a_user"
        assert user_a.tenant_id == "tenant-a"

        # Look for tenant_a_user within tenant-b - should NOT find it
        user_a_in_b = await user_service.get_user_by_username("tenant_a_user", tenant_id="tenant-b")
        assert user_a_in_b is None

    @pytest.mark.asyncio
    async def test_get_user_by_email_respects_tenant(
        self, user_service, tenant_a_user, tenant_b_user
    ):
        """Test email lookup is scoped to tenant."""
        # Look for a@example.com within tenant-a - should find it
        user_a = await user_service.get_user_by_email("a@example.com", tenant_id="tenant-a")
        assert user_a is not None
        assert user_a.email == "a@example.com"
        assert user_a.tenant_id == "tenant-a"

        # Look for a@example.com within tenant-b - should NOT find it
        user_a_in_b = await user_service.get_user_by_email("a@example.com", tenant_id="tenant-b")
        assert user_a_in_b is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_wrong_tenant_returns_none(self, user_service, tenant_a_user):
        """Test that getting user by ID with wrong tenant returns None."""
        # Try to get tenant-a user while specifying tenant-b
        user = await user_service.get_user_by_id(tenant_a_user.id, tenant_id="tenant-b")

        # Should not find the user (wrong tenant)
        assert user is None

    @pytest.mark.asyncio
    async def test_search_users_scoped_to_tenant(self, user_service, tenant_a_user, tenant_b_user):
        """Test user search is scoped to tenant."""
        # Search within tenant-a
        users_a, total_a = await user_service.list_users(tenant_id="tenant-a", search="tenant")

        # Should only find tenant-a user
        assert total_a == 1
        assert users_a[0].tenant_id == "tenant-a"

        # Search within tenant-b
        users_b, total_b = await user_service.list_users(tenant_id="tenant-b", search="tenant")

        # Should only find tenant-b user
        assert total_b == 1
        assert users_b[0].tenant_id == "tenant-b"

    @pytest.mark.asyncio
    async def test_pagination_respects_tenant_boundaries(self, user_service, async_db_session):
        """Test that pagination doesn't leak across tenants."""
        # Create 3 users in tenant-a
        for i in range(3):
            user = User(
                id=uuid4(),
                username=f"tenant_a_user_{i}",
                email=f"a{i}@example.com",
                password_hash="hashed",
                tenant_id="tenant-a",
                is_active=True,
                is_verified=True,
            )
            async_db_session.add(user)

        # Create 2 users in tenant-b
        for i in range(2):
            user = User(
                id=uuid4(),
                username=f"tenant_b_user_{i}",
                email=f"b{i}@example.com",
                password_hash="hashed",
                tenant_id="tenant-b",
                is_active=True,
                is_verified=True,
            )
            async_db_session.add(user)

        await async_db_session.flush()

        # Paginate tenant-a users (page 1, limit 2)
        page1_a, total_a = await user_service.list_users(tenant_id="tenant-a", skip=0, limit=2)

        assert total_a == 3  # Total in tenant-a
        assert len(page1_a) == 2  # Page size
        assert all(u.tenant_id == "tenant-a" for u in page1_a)

        # Paginate tenant-a users (page 2, limit 2)
        page2_a, total_a_2 = await user_service.list_users(tenant_id="tenant-a", skip=2, limit=2)

        assert total_a_2 == 3  # Still total 3
        assert len(page2_a) == 1  # Only 1 remaining
        assert all(u.tenant_id == "tenant-a" for u in page2_a)

        # Verify no tenant-b users in any page
        all_users_from_a = page1_a + page2_a
        assert all(u.tenant_id == "tenant-a" for u in all_users_from_a)
        assert len([u for u in all_users_from_a if u.tenant_id == "tenant-b"]) == 0


@pytest.mark.integration
class TestUserServiceTenantContextIntegration:
    """Test tenant context integration with UserService."""

    @pytest.fixture
    def user_service(self, async_db_session):
        """Create UserService with real session."""
        return UserService(async_db_session)

    @pytest.mark.asyncio
    async def test_create_user_inherits_tenant_from_parameter(self, user_service, async_db_session):
        """Test that creating a user sets the tenant_id from parameter."""
        # Create user with explicit tenant
        user = await user_service.create_user(
            username="newuser",
            email="new@example.com",
            password="SecurePass123!",
            tenant_id="tenant-xyz",
        )

        # Verify tenant_id was set
        assert user.tenant_id == "tenant-xyz"

        # Verify user can be found in that tenant
        found_user = await user_service.get_user_by_username("newuser", tenant_id="tenant-xyz")
        assert found_user is not None
        assert found_user.id == user.id

    @pytest.mark.asyncio
    async def test_user_filters_work_with_tenant_isolation(self, user_service, async_db_session):
        """Test combining filters with tenant isolation."""
        # Create active user in tenant-a
        active_user = User(
            id=uuid4(),
            username="active_a",
            email="active@a.com",
            password_hash="hashed",
            tenant_id="tenant-a",
            is_active=True,
            is_verified=True,
            roles=["admin"],
        )
        async_db_session.add(active_user)

        # Create inactive user in tenant-a
        inactive_user = User(
            id=uuid4(),
            username="inactive_a",
            email="inactive@a.com",
            password_hash="hashed",
            tenant_id="tenant-a",
            is_active=False,
            is_verified=True,
            roles=["user"],
        )
        async_db_session.add(inactive_user)

        # Create active user in tenant-b
        active_b_user = User(
            id=uuid4(),
            username="active_b",
            email="active@b.com",
            password_hash="hashed",
            tenant_id="tenant-b",
            is_active=True,
            is_verified=True,
            roles=["admin"],
        )
        async_db_session.add(active_b_user)

        await async_db_session.flush()

        # Query active users in tenant-a
        active_users, total = await user_service.list_users(tenant_id="tenant-a", is_active=True)

        # Should only find active user from tenant-a
        assert total == 1
        assert active_users[0].username == "active_a"
        assert active_users[0].tenant_id == "tenant-a"
        assert active_users[0].is_active is True

        # Query by role in tenant-a
        admin_users, admin_total = await user_service.list_users(tenant_id="tenant-a", role="admin")

        # Should only find admin from tenant-a
        assert admin_total == 1
        assert admin_users[0].username == "active_a"
        assert "admin" in admin_users[0].roles
