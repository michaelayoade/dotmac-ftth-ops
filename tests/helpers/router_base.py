"""
Reusable base classes for FastAPI router testing.

This module provides standardized patterns for testing routers that emerged
from fixing 31 test failures across router smoke suite and access router tests.



Key patterns:
1. Automatic authentication and tenant header injection
2. Proper dependency override management
3. Standard fixtures for common scenarios
4. Assertion helpers for consistent validation

Usage:
    class TestMyRouter(RouterTestBase):
        router_module = "dotmac.platform.mymodule.router"
        router_name = "router"
        router_prefix = "/mymodule"

        def test_my_endpoint(self):
            response = self.client.get("/api/v1/mymodule/health")
            self.assert_success(response)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from pydantic import BaseModel
from starlette.testclient import TestClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.database import get_async_session

pytestmark = pytest.mark.unit


class RouterTestBase:
    """
    Base class for router testing that provides standard patterns.

    Subclasses should define:
    - router_module: Module path (e.g., "dotmac.platform.access.router")
    - router_name: Router object name (e.g., "router")
    - router_prefix: Optional additional prefix (e.g., "/access")
    """

    router_module: str | None = None
    router_name: str = "router"
    router_prefix: str | None = None

    @pytest.fixture
    def test_user(self) -> UserInfo:
        """Create a test user with admin privileges for testing."""
        return UserInfo(
            user_id=str(uuid4()),
            tenant_id=f"test_tenant_{uuid4()}",
            email="test@example.com",
            is_platform_admin=True,
            username="testuser",
            roles=["admin"],
            permissions=["read", "write", "admin"],
        )

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        session = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.execute = AsyncMock()
        session.scalar = AsyncMock()

        # Configure default responses
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=None)
        mock_result.scalars = Mock(return_value=Mock(all=Mock(return_value=[])))
        session.execute.return_value = mock_result
        session.scalar.return_value = 0

        return session

    @pytest.fixture
    def client(
        self,
        test_app: FastAPI,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ) -> TestClient:
        """
        Create test client with router registered and proper auth setup.

        This fixture:
        1. Registers the router with correct prefix
        2. Overrides authentication to use test_user
        3. Overrides database to use mock_db
        4. Wraps client to auto-add tenant headers
        5. Cleans up overrides after test
        """
        # Import router dynamically
        if self.router_module:
            module_parts = self.router_module.rsplit(":", 1)
            if len(module_parts) == 2:
                module_path, router_attr = module_parts
            else:
                module_path = module_parts[0]
                router_attr = self.router_name

            import importlib

            router_module = importlib.import_module(module_path)
            router = getattr(router_module, router_attr)

            # Register router with prefix
            prefix = "/api/v1"
            if self.router_prefix:
                prefix = f"{prefix}{self.router_prefix}"
            test_app.include_router(router, prefix="/api/v1")

        # Override authentication
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        # Override database
        async def get_mock_db():
            yield mock_db

        test_app.dependency_overrides[get_async_session] = get_mock_db

        # Apply custom overrides from subclass
        self._setup_dependencies(test_app)

        # Create client with auto tenant header
        test_client = TestClient(test_app)
        original_request = test_client.request

        def request_with_tenant(method: str, url: str, **kwargs) -> Any:
            headers = kwargs.get("headers", {})
            if "X-Tenant-ID" not in headers and "x-tenant-id" not in headers:
                headers["X-Tenant-ID"] = "test-tenant"
            kwargs["headers"] = headers
            return original_request(method, url, **kwargs)

        test_client.request = request_with_tenant

        yield test_client

        # Cleanup
        test_app.dependency_overrides.clear()

    def _setup_dependencies(self, app: FastAPI) -> None:
        """
        Override this method to set up custom dependencies.

        Example:
            def _setup_dependencies(self, app: FastAPI) -> None:
                from mymodule import get_service
                app.dependency_overrides[get_service] = lambda: self.mock_service
        """
        pass

    # ------------------------------------------------------------------ #
    # Assertion Helpers
    # ------------------------------------------------------------------ #

    def assert_success(self, response, status_code: int = 200) -> dict[str, Any]:
        """Assert response is successful and return JSON data."""
        assert response.status_code == status_code, (
            f"Expected {status_code}, got {response.status_code}. Response: {response.text}"
        )
        return response.json()

    def assert_error(
        self, response, status_code: int, expected_detail: str | None = None
    ) -> dict[str, Any]:
        """Assert response is an error with expected status code."""
        assert response.status_code == status_code, (
            f"Expected error {status_code}, got {response.status_code}. Response: {response.text}"
        )
        data = response.json()
        if expected_detail:
            assert expected_detail.lower() in data.get("detail", "").lower(), (
                f"Expected detail containing '{expected_detail}', got: {data.get('detail')}"
            )
        return data

    def assert_unauthorized(self, response) -> dict[str, Any]:
        """Assert response is 401 Unauthorized."""
        return self.assert_error(response, 401)

    def assert_forbidden(self, response) -> dict[str, Any]:
        """Assert response is 403 Forbidden."""
        return self.assert_error(response, 403)

    def assert_not_found(self, response, entity: str | None = None) -> dict[str, Any]:
        """Assert response is 404 Not Found."""
        detail = f"{entity} not found" if entity else "not found"
        return self.assert_error(response, 404, detail)

    def assert_validation_error(self, response) -> dict[str, Any]:
        """Assert response is 422 Validation Error."""
        return self.assert_error(response, 422)

    def assert_not_implemented(self, response) -> dict[str, Any]:
        """Assert response is 501 Not Implemented."""
        return self.assert_error(response, 501, "not supported")

    def assert_fields_present(self, data: dict[str, Any], *fields: str) -> None:
        """Assert all specified fields are present in response data."""
        missing = [f for f in fields if f not in data]
        assert not missing, f"Missing fields in response: {missing}"

    def assert_schema_match(self, data: dict[str, Any], schema: type[BaseModel]) -> None:
        """Assert response data matches Pydantic schema."""
        try:
            if isinstance(data, list):
                [schema(**item) for item in data]
            else:
                schema(**data)
        except Exception as e:
            pytest.fail(f"Response data does not match schema {schema.__name__}: {e}")


class RouterWithServiceTestBase(RouterTestBase):
    """
    Extended base class for routers that use a service layer.

    Provides additional patterns for mocking service dependencies.

    Subclasses should define:
    - service_dependency_name: Name of the service dependency function
    - service_module: Module path for the service
    """

    service_dependency_name: str | None = None
    service_module: str | None = None

    @pytest.fixture
    def mock_service(self) -> AsyncMock:
        """Create a mock service with common methods."""
        service = AsyncMock()

        # Common service methods
        service.get = AsyncMock(return_value=None)
        service.list = AsyncMock(return_value=[])
        service.create = AsyncMock()
        service.update = AsyncMock()
        service.delete = AsyncMock(return_value=True)

        return service

    def _setup_dependencies(self, app: FastAPI) -> None:
        """Override service dependency."""
        if self.service_dependency_name and self.service_module:
            import importlib

            service_mod = importlib.import_module(self.service_module)
            service_dep = getattr(service_mod, self.service_dependency_name)

            # Get mock_service from fixture
            mock_service = getattr(self, "_mock_service", AsyncMock())
            app.dependency_overrides[service_dep] = lambda: mock_service

    @pytest.fixture(autouse=True)
    def _inject_mock_service(self, mock_service: AsyncMock):
        """Auto-inject mock service into test class."""
        self._mock_service = mock_service


class CRUDRouterTestBase(RouterWithServiceTestBase):
    """
    Base class for testing CRUD routers with standard patterns.

    Provides common test scenarios for:
    - List endpoints (GET /)
    - Get endpoint (GET /{id})
    - Create endpoint (POST /)
    - Update endpoint (PUT /{id})
    - Delete endpoint (DELETE /{id})
    """

    resource_name: str = "resource"
    list_endpoint: str = ""
    detail_endpoint: str = "/{resource_id}"
    create_endpoint: str = ""
    update_endpoint: str = "/{resource_id}"
    delete_endpoint: str = "/{resource_id}"

    def get_sample_data(self) -> dict[str, Any]:
        """Override to provide sample data for create/update tests."""
        return {"name": "Test Resource"}

    def get_sample_response(self) -> dict[str, Any]:
        """Override to provide sample response data."""
        return {"id": str(uuid4()), **self.get_sample_data()}

    def test_list_resources(self, client: TestClient, mock_service: AsyncMock):
        """Test listing resources."""
        mock_service.list.return_value = [self.get_sample_response()]

        response = client.get(f"/api/v1{self.router_prefix}{self.list_endpoint}")

        data = self.assert_success(response)
        assert isinstance(data, (list, dict))

    def test_get_resource_success(self, client: TestClient, mock_service: AsyncMock):
        """Test getting a resource by ID."""
        resource_id = str(uuid4())
        mock_service.get.return_value = self.get_sample_response()

        endpoint = self.detail_endpoint.format(resource_id=resource_id)
        response = client.get(f"/api/v1{self.router_prefix}{endpoint}")

        self.assert_success(response)

    def test_get_resource_not_found(self, client: TestClient, mock_service: AsyncMock):
        """Test getting a non-existent resource."""
        resource_id = str(uuid4())
        mock_service.get.return_value = None

        endpoint = self.detail_endpoint.format(resource_id=resource_id)
        response = client.get(f"/api/v1{self.router_prefix}{endpoint}")

        self.assert_not_found(response, self.resource_name)

    def test_create_resource(self, client: TestClient, mock_service: AsyncMock):
        """Test creating a resource."""
        sample_data = self.get_sample_data()
        mock_service.create.return_value = self.get_sample_response()

        response = client.post(
            f"/api/v1{self.router_prefix}{self.create_endpoint}", json=sample_data
        )

        self.assert_success(response, 201)

    def test_update_resource(self, client: TestClient, mock_service: AsyncMock):
        """Test updating a resource."""
        resource_id = str(uuid4())
        sample_data = self.get_sample_data()
        mock_service.update.return_value = self.get_sample_response()

        endpoint = self.update_endpoint.format(resource_id=resource_id)
        response = client.put(f"/api/v1{self.router_prefix}{endpoint}", json=sample_data)

        self.assert_success(response)

    def test_delete_resource(self, client: TestClient, mock_service: AsyncMock):
        """Test deleting a resource."""
        resource_id = str(uuid4())
        mock_service.delete.return_value = True

        endpoint = self.delete_endpoint.format(resource_id=resource_id)
        response = client.delete(f"/api/v1{self.router_prefix}{endpoint}")

        self.assert_success(response)
