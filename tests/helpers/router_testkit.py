"""
Router test helper factory.

Provides reusable test scaffolding for FastAPI router testing with
tenant-scoped users, dependency overrides, and background task fixtures.
"""

from collections.abc import AsyncGenerator, Callable
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo

pytestmark = pytest.mark.unit


class RouterTestKit:
    """
    Test kit for FastAPI router testing with common patterns.

    Provides:
    - Tenant-scoped user fixtures
    - Dependency override helpers
    - Background task mocking
    - Common HTTP assertions
    """

    def __init__(
        self,
        app: FastAPI,
        tenant_id: str | None = None,
        user_id: str | None = None,
        email: str | None = None,
        is_platform_admin: bool = False,
    ):
        """
        Initialize router test kit.

        Args:
            app: FastAPI application instance
            tenant_id: Tenant ID for user context
            user_id: User ID for user context
            email: User email
            is_platform_admin: Whether user is platform admin
        """
        self.app = app
        self.tenant_id = tenant_id or f"tenant_{uuid4()}"
        self.user_id = user_id or str(uuid4())
        self.email = email or "test@example.com"
        self.is_platform_admin = is_platform_admin
        self._dependency_overrides: dict[Callable, Callable] = {}

    def create_user_info(
        self,
        tenant_id: str | None = None,
        user_id: str | None = None,
        email: str | None = None,
        is_platform_admin: bool | None = None,
        **extra_fields,
    ) -> UserInfo:
        """
        Create a UserInfo instance for testing.

        Args:
            tenant_id: Override default tenant_id
            user_id: Override default user_id
            email: Override default email
            is_platform_admin: Override admin status
            **extra_fields: Additional fields for UserInfo

        Returns:
            UserInfo instance
        """
        return UserInfo(
            user_id=user_id or self.user_id,
            tenant_id=tenant_id or self.tenant_id,
            email=email or self.email,
            is_platform_admin=is_platform_admin
            if is_platform_admin is not None
            else self.is_platform_admin,
            **extra_fields,
        )

    def override_dependency(
        self,
        dependency: Callable,
        override: Callable | Any,
    ) -> None:
        """
        Override a dependency for testing.

        Args:
            dependency: Original dependency function
            override: Override function or value
        """
        if not callable(override):
            # If override is not callable, wrap it in a lambda
            def override():
                return override

        self.app.dependency_overrides[dependency] = override
        self._dependency_overrides[dependency] = override

    def override_auth(
        self,
        user_info: UserInfo | None = None,
    ) -> None:
        """
        Override authentication to return a specific user.

        Args:
            user_info: UserInfo to return, or uses default from __init__
        """
        from dotmac.platform.auth.core import get_current_user

        if user_info is None:
            user_info = self.create_user_info()

        self.override_dependency(get_current_user, lambda: user_info)

    def override_db_session(
        self,
        mock_session: AsyncSession | AsyncMock,
    ) -> None:
        """
        Override database session dependency.

        Args:
            mock_session: Mock or real AsyncSession to use
        """
        from dotmac.platform.database import get_async_session

        async def get_mock_session():
            yield mock_session

        self.override_dependency(get_async_session, get_mock_session)

    def override_service(
        self,
        service_dependency: Callable,
        mock_service: Any,
    ) -> None:
        """
        Override a service dependency with a mock.

        Args:
            service_dependency: Service dependency function
            mock_service: Mock service instance
        """
        self.override_dependency(service_dependency, lambda: mock_service)

    def create_mock_background_tasks(self) -> Mock:
        """
        Create a mock BackgroundTasks instance.

        Returns:
            Mock BackgroundTasks with add_task method
        """
        mock_tasks = Mock()
        mock_tasks.add_task = Mock()
        return mock_tasks

    def clear_overrides(self) -> None:
        """Clear all dependency overrides."""
        for dependency in self._dependency_overrides:
            if dependency in self.app.dependency_overrides:
                del self.app.dependency_overrides[dependency]
        self._dependency_overrides.clear()

    def create_test_client(self) -> TestClient:
        """
        Create a TestClient for synchronous tests.

        Returns:
            TestClient instance with overrides applied
        """
        return TestClient(self.app)

    async def create_async_client(self) -> AsyncGenerator[AsyncClient]:
        """
        Create an AsyncClient for async tests.

        Returns:
            AsyncClient instance with overrides applied
        """
        from httpx import ASGITransport, AsyncClient

        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            yield client


def create_router_testkit(
    app: FastAPI,
    tenant_id: str | None = None,
    user_id: str | None = None,
    email: str | None = None,
    is_platform_admin: bool = False,
) -> RouterTestKit:
    """
    Factory function to create a RouterTestKit.

    Args:
        app: FastAPI application
        tenant_id: Tenant ID for user context
        user_id: User ID for user context
        email: User email
        is_platform_admin: Whether user is platform admin

    Returns:
        RouterTestKit instance
    """
    return RouterTestKit(
        app=app,
        tenant_id=tenant_id,
        user_id=user_id,
        email=email,
        is_platform_admin=is_platform_admin,
    )


@pytest.fixture
def router_testkit(fastapi_app: FastAPI) -> RouterTestKit:
    """
    Pytest fixture for router test kit.

    Args:
        fastapi_app: FastAPI application fixture

    Returns:
        RouterTestKit instance
    """
    kit = RouterTestKit(app=fastapi_app)
    yield kit
    kit.clear_overrides()


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """
    Pytest fixture for mock database session.

    Returns:
        AsyncMock session with common methods mocked
    """
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.close = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    session.add = Mock()
    session.delete = Mock()
    return session


@pytest.fixture
def tenant_id() -> str:
    """Generate a unique tenant ID for tests."""
    return f"test_tenant_{uuid4()}"


@pytest.fixture
def user_id() -> UUID:
    """Generate a unique user ID for tests."""
    return uuid4()


@pytest.fixture
def test_user(tenant_id: str, user_id: UUID) -> UserInfo:
    """
    Pytest fixture for test user.

    Returns:
        UserInfo for a standard test user
    """
    return UserInfo(
        user_id=str(user_id),
        tenant_id=tenant_id,
        email="test@example.com",
        is_platform_admin=False,
        username="testuser",
    )


@pytest.fixture
def admin_user(tenant_id: str, user_id: UUID) -> UserInfo:
    """
    Pytest fixture for admin user.

    Returns:
        UserInfo for a platform admin user
    """
    return UserInfo(
        user_id=str(user_id),
        tenant_id=tenant_id,
        email="admin@example.com",
        is_platform_admin=True,
        username="adminuser",
    )


def assert_response_ok(response: Any, expected_status: int = 200) -> None:
    """
    Assert that a response has the expected successful status.

    Args:
        response: Response object
        expected_status: Expected HTTP status code
    """
    assert response.status_code == expected_status, (
        f"Expected status {expected_status}, got {response.status_code}. Response: {response.text}"
    )


def assert_response_error(
    response: Any,
    expected_status: int,
    expected_detail: str | None = None,
) -> None:
    """
    Assert that a response has the expected error status.

    Args:
        response: Response object
        expected_status: Expected HTTP status code
        expected_detail: Expected error detail (optional)
    """
    assert response.status_code == expected_status, (
        f"Expected status {expected_status}, got {response.status_code}. Response: {response.text}"
    )

    if expected_detail:
        data = response.json()
        assert "detail" in data, "Response should contain 'detail' field"
        assert expected_detail in data["detail"], (
            f"Expected detail containing '{expected_detail}', got '{data['detail']}'"
        )


def assert_response_validation_error(response: Any) -> None:
    """
    Assert that a response is a validation error (422).

    Args:
        response: Response object
    """
    assert_response_error(response, 422)


def assert_response_not_found(response: Any) -> None:
    """
    Assert that a response is a 404 not found.

    Args:
        response: Response object
    """
    assert_response_error(response, 404)


def assert_response_forbidden(response: Any) -> None:
    """
    Assert that a response is a 403 forbidden.

    Args:
        response: Response object
    """
    assert_response_error(response, 403)


def assert_response_unauthorized(response: Any) -> None:
    """
    Assert that a response is a 401 unauthorized.

    Args:
        response: Response object
    """
    assert_response_error(response, 401)
