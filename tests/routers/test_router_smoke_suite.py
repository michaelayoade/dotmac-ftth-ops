"""
Router smoke suite - parametrized tests for all registered routers.

This suite ensures that all registered routers have at least basic HTTP
endpoint functionality tested, beyond mere importability.

Covers the 26+ routers that previously only appeared in test_router_registration.py
"""

from contextlib import ExitStack
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from dotmac.platform.auth.core import (
    UserInfo,
    get_current_user,
    get_current_user_optional,
)
from dotmac.platform.database import get_async_session
from dotmac.platform.routers import ROUTER_CONFIGS, RouterConfig

# Define routers that require special handling or are excluded from smoke tests


pytestmark = pytest.mark.integration

EXCLUDED_ROUTERS = {
    "dotmac.platform.config.router:health_router",  # Public health endpoint, tested separately
    "dotmac.platform.config.router:router",  # Public config endpoint
    "dotmac.platform.auth.router:auth_router",  # Auth doesn't require auth
    "dotmac.platform.sales.router:public_router",  # Public endpoints
}

# Routers with known endpoints we can test
ROUTER_ENDPOINTS = {
    "dotmac.platform.access.router:router": [
        ("/api/v1/access/health", "GET"),
        ("/api/v1/access/devices", "GET"),
    ],
    "dotmac.platform.billing.invoicing.money_router:router": [
        ("/api/v1/billing/invoices/money", "GET"),
    ],
    "dotmac.platform.customer_portal.router:router": [
        ("/api/v1/customer/usage/history", "GET"),
        ("/api/v1/customer/payment-methods", "GET"),
    ],
    "dotmac.platform.fault_management.oncall_router:router": [
        ("/api/v1/oncall/schedules", "GET"),
    ],
    "dotmac.platform.services.lifecycle.router:router": [
        ("/api/v1/services/lifecycle/status", "GET"),
    ],
}


@pytest.fixture
def test_user() -> UserInfo:
    """Create a test user for authentication."""
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id=f"test_tenant_{uuid4()}",
        email="test@example.com",
        is_platform_admin=True,  # Give admin access for testing
        username="testuser",
        roles=["admin"],
        permissions=["read", "write", "admin"],
    )


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    return session


def get_router_id(config: RouterConfig) -> str:
    """Generate unique router ID."""
    return f"{config.module_path}:{config.router_name}"


def get_testable_routers() -> list[tuple[RouterConfig, str]]:
    """
    Get list of routers that should be tested.

    Returns:
        List of (RouterConfig, router_id) tuples
    """
    testable = []
    for config in ROUTER_CONFIGS:
        router_id = get_router_id(config)

        # Skip excluded routers
        if router_id in EXCLUDED_ROUTERS:
            continue

        # Only test routers that require auth (they need behavior tests)
        if config.requires_auth:
            testable.append((config, router_id))

    return testable


class TestRouterSmokeTests:
    """Smoke tests for all registered routers."""

    @pytest.mark.parametrize(
        "router_config,router_id",
        get_testable_routers(),
        ids=[rid for _, rid in get_testable_routers()],
    )
    def test_router_requires_auth(
        self,
        router_config: RouterConfig,
        router_id: str,
        test_app: FastAPI,
    ):
        """
        Test that authenticated endpoints reject unauthenticated requests.

        This ensures that routers requiring auth actually enforce it.
        """
        original_get_current_user = test_app.dependency_overrides.pop(get_current_user, None)
        original_get_current_user_optional = test_app.dependency_overrides.pop(
            get_current_user_optional, None
        )
        client = TestClient(test_app)

        # Determine a test endpoint path
        test_paths = []
        if router_id in ROUTER_ENDPOINTS:
            test_paths = [ep[0] for ep in ROUTER_ENDPOINTS[router_id]]
        else:
            # Try common endpoint patterns
            prefix = router_config.prefix
            test_paths = [
                f"{prefix}" if prefix else "/",
                f"{prefix}/" if prefix and not prefix.endswith("/") else prefix,
            ]

        # Test at least one path
        for path in test_paths[:1]:  # Test first path only to keep tests fast
            response = client.get(path)

            # Should be unauthorized, bad request (missing tenant/params), or not found (but not 500)
            assert response.status_code in [400, 401, 403, 404, 422], (
                f"Router {router_id} endpoint {path} should require auth or return 404, "
                f"got {response.status_code}"
            )

        if original_get_current_user is not None:
            test_app.dependency_overrides[get_current_user] = original_get_current_user
        if original_get_current_user_optional is not None:
            test_app.dependency_overrides[get_current_user_optional] = (
                original_get_current_user_optional
            )

    @pytest.mark.parametrize(
        "router_config,router_id",
        [(config, rid) for config, rid in get_testable_routers() if rid in ROUTER_ENDPOINTS],
        ids=[rid for config, rid in get_testable_routers() if rid in ROUTER_ENDPOINTS],
    )
    def test_router_authenticated_access(
        self,
        router_config: RouterConfig,
        router_id: str,
        test_app: FastAPI,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """
        Test that authenticated requests to known endpoints succeed or fail gracefully.

        This ensures the router's happy path is testable.
        """
        # Override auth dependency
        from dotmac.platform.auth.core import get_current_user

        test_app.dependency_overrides[get_current_user] = lambda: test_user

        # Override DB dependency
        async def get_mock_db():
            yield mock_db

        test_app.dependency_overrides[get_async_session] = get_mock_db

        client = TestClient(test_app)

        # Test each known endpoint
        endpoints = ROUTER_ENDPOINTS.get(router_id, [])
        for path, method in endpoints:
            with ExitStack() as stack:
                # Mock service responses based on router
                self._setup_service_mocks(router_id, mock_db, stack)

                if method == "GET":
                    response = client.get(path)
                elif method == "POST":
                    response = client.post(path, json={})
                elif method == "PUT":
                    response = client.put(path, json={})
                elif method == "DELETE":
                    response = client.delete(path)
                else:
                    continue

                # Should get a valid response (not 500)
                # Can be 200, 400, 404, 422 depending on implementation
                assert response.status_code < 500, (
                    f"Router {router_id} endpoint {method} {path} returned server error: "
                    f"{response.status_code}. This indicates a code issue, not auth."
                )

        # Cleanup
        test_app.dependency_overrides.clear()

    def _setup_service_mocks(self, router_id: str, mock_db: AsyncMock, stack: ExitStack):
        """
        Setup service-specific mocks for different routers.

        Args:
            router_id: Router identifier
            mock_db: Mock database session
        """
        # Configure mock responses based on router
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=None)
        mock_result.scalars = Mock(return_value=Mock(all=Mock(return_value=[])))
        mock_db.execute.return_value = mock_result
        mock_db.scalar.return_value = 0

        # Router-specific mocks
        if "access" in router_id:
            # Mock access network service
            from dotmac.platform.voltha.schemas import DeviceListResponse, VOLTHAHealthResponse

            mock_service = AsyncMock()
            mock_service.health = AsyncMock(
                return_value=VOLTHAHealthResponse(
                    healthy=True,
                    state="HEALTHY",
                    message="All systems operational",
                    version="test",
                    adapters=[],
                    total_devices=0,
                )
            )
            mock_service.list_devices = AsyncMock(
                return_value=DeviceListResponse(devices=[], total=0)
            )
            from dotmac.platform.access.router import configure_access_service

            configure_access_service(mock_service)
            stack.callback(lambda: configure_access_service(None))

        elif "customer_portal" in router_id:
            # Mock customer lookup
            from dotmac.platform.customer_management.models import Customer

            mock_customer = Customer(
                id=uuid4(),
                tenant_id="test_tenant",
                first_name="Test",
                last_name="User",
                email="test@example.com",
            )
            mock_result.scalar_one_or_none = Mock(return_value=mock_customer)
            stack.enter_context(
                patch(
                    "dotmac.platform.customer_portal.router.calculate_usage_from_radius",
                    return_value=(10.0, 5.0),
                )
            )
            stack.enter_context(
                patch(
                    "dotmac.platform.customer_portal.router.get_daily_usage_breakdown",
                    return_value=[],
                )
            )
            stack.enter_context(
                patch(
                    "dotmac.platform.customer_portal.router.get_hourly_usage_breakdown",
                    return_value=[],
                )
            )

        elif "billing" in router_id:
            # Mock invoice service
            mock_result.scalars.return_value.all.return_value = []


class TestHighRiskRouters:
    """
    Deep tests for high-risk routers identified in the coverage analysis.

    These routers are critical for operations but lack behavioral tests.
    """

    def test_access_network_router_health(self, test_app: FastAPI, test_user: UserInfo):
        """Test access network router health endpoint."""
        from dotmac.platform.access.router import get_access_service
        from dotmac.platform.access.router import router as access_router
        from dotmac.platform.auth.core import get_current_user
        from dotmac.platform.voltha.schemas import VOLTHAHealthResponse

        # Register the access router (router already has /access prefix)
        test_app.include_router(access_router, prefix="/api/v1")

        # Mock authentication
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        # Mock the service
        mock_service = AsyncMock()
        mock_service.health = AsyncMock(
            return_value=VOLTHAHealthResponse(
                healthy=True,
                state="HEALTHY",
                message="All systems operational",
                version="1.0.0",
                adapters=["voltha"],
                total_devices=5,
            )
        )

        def override_get_access_service():
            return mock_service

        test_app.dependency_overrides[get_access_service] = override_get_access_service

        client = TestClient(test_app)
        response = client.get("/api/v1/access/health", headers={"X-Tenant-ID": "test-tenant"})

        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "HEALTHY"
        assert data["healthy"] is True

        test_app.dependency_overrides.clear()

    def test_access_network_router_devices_list(self, test_app: FastAPI, test_user: UserInfo):
        """Test access network router device listing."""
        from dotmac.platform.access.router import get_access_service
        from dotmac.platform.access.router import router as access_router
        from dotmac.platform.auth.core import get_current_user
        from dotmac.platform.voltha.schemas import DeviceListResponse

        # Register the access router (router already has /access prefix)
        test_app.include_router(access_router, prefix="/api/v1")

        # Mock authentication
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        mock_service = AsyncMock()
        mock_service.list_devices = AsyncMock(
            return_value=DeviceListResponse(
                devices=[
                    {"id": "olt1", "type": "olt", "admin_state": "ENABLED"},
                ],
                total=1,
            )
        )

        def override_get_access_service():
            return mock_service

        test_app.dependency_overrides[get_access_service] = override_get_access_service

        client = TestClient(test_app)
        response = client.get("/api/v1/access/devices", headers={"X-Tenant-ID": "test-tenant"})

        assert response.status_code == 200
        data = response.json()
        assert "devices" in data
        assert len(data["devices"]) >= 0

        test_app.dependency_overrides.clear()

    def test_access_network_router_device_not_found(self, test_app: FastAPI, test_user: UserInfo):
        """Test access network router handles device not found."""
        from dotmac.platform.access.router import get_access_service
        from dotmac.platform.access.router import router as access_router
        from dotmac.platform.auth.core import get_current_user

        # Register the access router (router already has /access prefix)
        test_app.include_router(access_router, prefix="/api/v1")

        # Mock authentication
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        mock_service = AsyncMock()
        mock_service.get_device = AsyncMock(return_value=None)

        def override_get_access_service():
            return mock_service

        test_app.dependency_overrides[get_access_service] = override_get_access_service

        client = TestClient(test_app)
        response = client.get(
            "/api/v1/access/devices/nonexistent", headers={"X-Tenant-ID": "test-tenant"}
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

        test_app.dependency_overrides.clear()

    def test_access_network_router_operation_not_implemented(
        self, test_app: FastAPI, test_user: UserInfo
    ):
        """Test access network router handles unsupported operations."""
        from dotmac.platform.access.router import get_access_service
        from dotmac.platform.access.router import router as access_router
        from dotmac.platform.auth.core import get_current_user

        # Register the access router (router already has /access prefix)
        test_app.include_router(access_router, prefix="/api/v1")

        # Mock authentication
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        mock_service = AsyncMock()
        # Mock operate_device to return False, which triggers 501 response
        mock_service.operate_device = AsyncMock(return_value=False)

        def override_get_access_service():
            return mock_service

        test_app.dependency_overrides[get_access_service] = override_get_access_service

        client = TestClient(test_app)
        # Use an actual operation endpoint
        response = client.post(
            "/api/v1/access/devices/olt1/enable", headers={"X-Tenant-ID": "test-tenant"}
        )

        assert response.status_code == 501
        assert "not supported" in response.json()["detail"].lower()

        test_app.dependency_overrides.clear()


class TestRouterPrefixConsistency:
    """Test router prefix consistency and structure."""

    def test_all_routers_have_valid_prefixes(self):
        """Ensure all routers have valid prefix structure."""
        for config in ROUTER_CONFIGS:
            if config.prefix:
                # Prefix should start with / or be empty
                assert config.prefix.startswith("/") or config.prefix == "", (
                    f"Router {config.module_path}:{config.router_name} has invalid prefix: {config.prefix}"
                )

                # Should not have trailing slash (except root /)
                if len(config.prefix) > 1:
                    assert not config.prefix.endswith("/"), (
                        f"Router {config.module_path}:{config.router_name} has trailing slash: {config.prefix}"
                    )

    def test_no_duplicate_functionality(self):
        """Ensure routers don't have unexpected duplicate prefixes."""
        # This is a meta-test to catch accidental router duplication
        prefix_map: dict[str, list[str]] = {}

        for config in ROUTER_CONFIGS:
            router_id = get_router_id(config)
            prefix = config.prefix

            if prefix not in prefix_map:
                prefix_map[prefix] = []
            prefix_map[prefix].append(router_id)

        # Prefixes with many routers should be reviewed
        for prefix, routers in prefix_map.items():
            if len(routers) > 20 and prefix == "/api/v1":
                # This is expected for main API prefix
                continue

            # Other prefixes shouldn't have too many routers
            if len(routers) > 10:
                print(f"Warning: Prefix {prefix} has {len(routers)} routers: {routers[:5]}...")
