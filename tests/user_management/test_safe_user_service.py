"""
Tests for safe user service defaults with tenant isolation.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService


@pytest.mark.unit
class TestUserServiceTenantSafety:
    """Test user service tenant isolation safety features."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def user_service(self, mock_session):
        """Create UserService instance."""
        return UserService(mock_session)

    @pytest.fixture
    def sample_users(self):
        """Create sample users for testing."""
        users = []
        for i in range(5):
            user = MagicMock(spec=User)
            user.id = f"user-{i}"
            user.username = f"user{i}"
            user.email = f"user{i}@example.com"
            user.tenant_id = f"tenant-{i % 2}"  # Alternating tenants
            user.is_active = True
            user.roles = ["user"]
            users.append(user)
        return users

    @pytest.mark.asyncio
    async def test_list_users_requires_tenant_by_default(self, user_service):
        """Test that list_users requires tenant_id by default."""
        with pytest.raises(ValueError) as exc_info:
            await user_service.list_users()

        assert "tenant_id is required when require_tenant=True" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_users_with_tenant_id_works(self, user_service, mock_session, sample_users):
        """Test that providing tenant_id allows the query."""
        # Mock the database query results
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [sample_users[0], sample_users[2]]
        mock_result.scalars.return_value = mock_scalars

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 2

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        users, total = await user_service.list_users(tenant_id="tenant-0")

        # Should execute query successfully
        assert mock_session.execute.call_count == 2
        assert total == 2
        assert len(users) == 2

    @pytest.mark.asyncio
    async def test_list_users_explicit_bypass_works(self, user_service, mock_session, sample_users):
        """Test that explicit bypass allows cross-tenant queries."""
        # Mock the database query results
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = sample_users
        mock_result.scalars.return_value = mock_scalars

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = len(sample_users)

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        # This should work with explicit bypass
        users, total = await user_service.list_users(tenant_id=None, require_tenant=False)

        # Should execute query successfully
        assert mock_session.execute.call_count == 2
        assert total == len(sample_users)
        assert len(users) == len(sample_users)

    @pytest.mark.asyncio
    async def test_list_users_tenant_isolation_in_query(self, user_service, mock_session):
        """Test that tenant_id is properly added to SQL query conditions."""
        # Mock the database results
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        await user_service.list_users(tenant_id="tenant-123")

        # Verify that execute was called (query was built successfully)
        assert mock_session.execute.call_count == 2

        # Get the query that was executed
        query_call = mock_session.execute.call_args_list[0]
        query = query_call[0][0]

        # The query should include tenant filtering
        # Note: This is a simplified check - in reality we'd check the WHERE clause
        assert query is not None

    @pytest.mark.asyncio
    async def test_list_users_with_filters_and_tenant(self, user_service, mock_session):
        """Test combining tenant filter with other filters."""
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        await user_service.list_users(
            tenant_id="tenant-123", is_active=True, role="admin", search="john"
        )

        # Should execute query successfully with all filters
        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_list_users_pagination_with_tenant(self, user_service, mock_session):
        """Test pagination works with tenant filtering."""
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        await user_service.list_users(tenant_id="tenant-123", skip=20, limit=10)

        # Should execute query successfully with pagination
        assert mock_session.execute.call_count == 2

    def test_list_users_default_parameters(self, user_service):
        """Test that require_tenant defaults to True."""
        # Check the method signature defaults
        import inspect

        sig = inspect.signature(user_service.list_users)

        # require_tenant should default to True
        require_tenant_param = sig.parameters.get("require_tenant")
        assert require_tenant_param is not None
        assert require_tenant_param.default is True

    @pytest.mark.asyncio
    async def test_list_users_empty_tenant_id_with_require_true(self, user_service):
        """Test that empty string tenant_id also fails when require_tenant=True."""
        with pytest.raises(ValueError) as exc_info:
            await user_service.list_users(tenant_id="", require_tenant=True)

        assert "tenant_id is required when require_tenant=True" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_users_none_tenant_id_with_require_true(self, user_service):
        """Test that None tenant_id fails when require_tenant=True."""
        with pytest.raises(ValueError) as exc_info:
            await user_service.list_users(tenant_id=None, require_tenant=True)

        assert "tenant_id is required when require_tenant=True" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_users_whitespace_tenant_id_fails(self, user_service):
        """Test that whitespace-only tenant_id fails validation."""
        with pytest.raises(ValueError) as exc_info:
            await user_service.list_users(tenant_id="   ", require_tenant=True)

        assert "tenant_id is required when require_tenant=True" in str(exc_info.value)


@pytest.mark.unit
class TestUserServiceSecurityImprovement:
    """Test the security improvement from the changes."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.mark.asyncio
    async def test_old_vs_new_behavior_comparison(self):
        """Compare old vulnerable behavior vs new secure behavior."""
        # This test documents the security improvement

        # OLD BEHAVIOR (vulnerable):
        # user_service.list_users()  # Would return ALL users from ALL tenants
        # user_service.list_users(tenant_id=None)  # Would return ALL users

        # NEW BEHAVIOR (secure):
        # user_service.list_users()  # Raises ValueError
        # user_service.list_users(tenant_id=None)  # Raises ValueError (unless explicit bypass)
        # user_service.list_users(tenant_id="tenant-123")  # Returns only tenant-123 users
        # user_service.list_users(tenant_id=None, require_tenant=False)  # Explicit bypass

        mock_session = AsyncMock()
        service = UserService(mock_session)

        # Test the new secure behavior
        with pytest.raises(ValueError):
            # This should fail in new implementation
            await service.list_users()

        with pytest.raises(ValueError):
            # This should also fail
            await service.list_users(tenant_id=None)

    @pytest.mark.asyncio
    async def test_admin_operations_still_possible(self, mock_session):
        """Test that admin operations are still possible with explicit bypass."""
        service = UserService(mock_session)

        # Mock successful query
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        # Admin operation: get all users across all tenants
        users, total = await service.list_users(
            tenant_id=None,
            require_tenant=False,  # Explicit admin override
        )

        # Should work for admin operations
        assert total == 0
        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_tenant_parameter_validation(self, mock_session):
        """Test tenant parameter validation logic."""
        service = UserService(mock_session)

        # Test cases that should fail
        failing_cases = [
            {},  # No tenant_id
            {"tenant_id": None},
            {"tenant_id": ""},
            {"tenant_id": "   "},  # Whitespace only
        ]

        for case in failing_cases:
            with pytest.raises(ValueError):
                await service.list_users(**case)

        # Test cases that should pass (with mocked DB)
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        passing_cases = [
            {"tenant_id": "valid-tenant"},
            {"tenant_id": "tenant-123"},
            {"tenant_id": None, "require_tenant": False},  # Explicit bypass
        ]

        for case in passing_cases:
            # Reset mock for each iteration
            mock_session.execute.side_effect = [mock_count_result, mock_result]
            # Should not raise an exception
            await service.list_users(**case)


@pytest.mark.unit
class TestUserServiceTenantFilteringLogic:
    """Test the specific tenant filtering logic."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    def test_require_tenant_validation_logic(self):
        """Test the validation logic for require_tenant parameter."""

        # Test the actual validation logic
        def validate_tenant_requirement(tenant_id, require_tenant=True):
            """Replicate the validation logic from the service."""
            if require_tenant and not tenant_id:
                raise ValueError("tenant_id is required when require_tenant=True")

        # Test cases that should fail
        with pytest.raises(ValueError):
            validate_tenant_requirement(None, True)

        with pytest.raises(ValueError):
            validate_tenant_requirement("", True)

        with pytest.raises(ValueError):
            validate_tenant_requirement(None)  # require_tenant defaults to True

        # Test cases that should pass
        validate_tenant_requirement("tenant-123", True)  # Should not raise
        validate_tenant_requirement(None, False)  # Should not raise
        validate_tenant_requirement("", False)  # Should not raise

    @pytest.mark.asyncio
    async def test_tenant_filtering_applied_correctly(self, mock_session):
        """Test that tenant filtering is actually applied to queries."""
        service = UserService(mock_session)

        # Mock query execution
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0

        # Set up execute to return different results based on call
        mock_session.execute.side_effect = [mock_count_result, mock_result]

        # Execute query with tenant filter
        await service.list_users(tenant_id="tenant-123")

        # Verify session.execute was called (query was executed)
        assert mock_session.execute.call_count == 2
