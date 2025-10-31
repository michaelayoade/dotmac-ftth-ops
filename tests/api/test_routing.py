"""Tests for API Gateway routing functionality."""

import re

import pytest
from fastapi import HTTPException

from dotmac.platform.api.routing import (
    Route,
    RouteMethod,
    RouteRegistry,
    RouteType,
    get_route,
    register_route,
    route_registry,
)


@pytest.mark.unit
class TestRoute:
    """Test Route model and matching logic."""

    def test_route_initialization(self):
        """Test Route initializes with required fields."""

        async def handler():
            pass

        route = Route(
            pattern=r"/api/v1/billing/invoices/(?P<invoice_id>\d+)",
            method=RouteMethod.GET,
            service="billing",
            handler=handler,
        )

        assert route.pattern == r"/api/v1/billing/invoices/(?P<invoice_id>\d+)"
        assert route.method == RouteMethod.GET
        assert route.service == "billing"
        assert route.handler == handler
        assert route.route_type == RouteType.DIRECT  # Default
        assert route.timeout == 30  # Default
        assert route.requires_auth is True  # Default

    def test_route_compiles_pattern_on_init(self):
        """Test Route compiles regex pattern during initialization."""

        async def handler():
            pass

        route = Route(
            pattern=r"/api/v1/test",
            method=RouteMethod.GET,
            service="test",
            handler=handler,
        )

        assert hasattr(route, "_compiled_pattern")
        assert isinstance(route._compiled_pattern, re.Pattern)

    def test_route_matches_exact_path(self):
        """Test Route matches exact path."""

        async def handler():
            pass

        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=handler,
        )

        assert route.matches("/api/v1/test", "GET") is True
        assert route.matches("/api/v1/test", "POST") is False
        assert route.matches("/api/v1/other", "GET") is False

    def test_route_matches_with_parameters(self):
        """Test Route matches path with parameters."""

        async def handler():
            pass

        route = Route(
            pattern=r"^/api/v1/users/(?P<user_id>\d+)$",
            method=RouteMethod.GET,
            service="users",
            handler=handler,
        )

        assert route.matches("/api/v1/users/123", "GET") is True
        assert route.matches("/api/v1/users/abc", "GET") is False
        assert route.matches("/api/v1/users/123/profile", "GET") is False

    def test_route_extracts_path_parameters(self):
        """Test Route extracts path parameters."""

        async def handler():
            pass

        route = Route(
            pattern=r"^/api/v1/users/(?P<user_id>\d+)/posts/(?P<post_id>\d+)$",
            method=RouteMethod.GET,
            service="users",
            handler=handler,
        )

        params = route.extract_params("/api/v1/users/123/posts/456")

        assert params == {"user_id": "123", "post_id": "456"}

    def test_route_extracts_empty_dict_when_no_match(self):
        """Test Route returns empty dict for non-matching paths."""

        async def handler():
            pass

        route = Route(
            pattern=r"^/api/v1/users/(?P<user_id>\d+)$",
            method=RouteMethod.GET,
            service="users",
            handler=handler,
        )

        params = route.extract_params("/api/v1/different/path")

        assert params == {}

    def test_route_custom_configuration(self):
        """Test Route with custom configuration."""

        async def handler():
            pass

        route = Route(
            pattern=r"^/api/v1/cache$",
            method=RouteMethod.GET,
            service="cache",
            handler=handler,
            route_type=RouteType.CACHE,
            timeout=60,
            cache_ttl=300,
            requires_auth=False,
            rate_limit="100/hour",
            description="Cached endpoint",
        )

        assert route.route_type == RouteType.CACHE
        assert route.timeout == 60
        assert route.cache_ttl == 300
        assert route.requires_auth is False
        assert route.rate_limit == "100/hour"
        assert route.description == "Cached endpoint"


@pytest.mark.unit
class TestRouteRegistry:
    """Test RouteRegistry functionality."""

    @pytest.fixture
    def registry(self):
        """Create fresh RouteRegistry for each test."""
        return RouteRegistry()

    @pytest.fixture
    def sample_handler(self):
        """Create sample async handler."""

        async def handler():
            return {"status": "ok"}

        return handler

    def test_registry_initialization(self, registry):
        """Test RouteRegistry initializes empty."""
        assert len(registry.routes) == 0
        assert len(registry._route_cache) == 0

    def test_registry_registers_route(self, registry, sample_handler):
        """Test RouteRegistry registers routes."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)

        assert len(registry.routes) == 1
        assert registry.routes[0] == route

    def test_registry_prevents_duplicate_routes(self, registry, sample_handler):
        """Test RouteRegistry prevents duplicate route registration."""
        route1 = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        route2 = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test2",
            handler=sample_handler,
        )

        registry.register(route1)

        with pytest.raises(ValueError, match="Route conflict"):
            registry.register(route2)

    def test_registry_allows_same_path_different_methods(self, registry, sample_handler):
        """Test RouteRegistry allows same path with different HTTP methods."""
        route1 = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        route2 = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.POST,
            service="test",
            handler=sample_handler,
        )

        registry.register(route1)
        registry.register(route2)

        assert len(registry.routes) == 2

    def test_registry_finds_matching_route(self, registry, sample_handler):
        """Test RouteRegistry finds matching route."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)

        found = registry.find_route("/api/v1/test", "GET")

        assert found == route

    def test_registry_returns_none_for_no_match(self, registry, sample_handler):
        """Test RouteRegistry returns None when no route matches."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)

        found = registry.find_route("/api/v1/other", "GET")

        assert found is None

    def test_registry_caches_route_lookups(self, registry, sample_handler):
        """Test RouteRegistry caches route lookups."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)

        # First lookup
        found1 = registry.find_route("/api/v1/test", "GET")
        assert len(registry._route_cache) == 1

        # Second lookup (from cache)
        found2 = registry.find_route("/api/v1/test", "GET")
        assert found1 == found2
        assert len(registry._route_cache) == 1

    def test_registry_unregisters_route(self, registry, sample_handler):
        """Test RouteRegistry unregisters routes."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)
        assert len(registry.routes) == 1

        removed = registry.unregister(r"^/api/v1/test$", RouteMethod.GET)

        assert removed is True
        assert len(registry.routes) == 0

    def test_registry_unregister_returns_false_if_not_found(self, registry):
        """Test unregister returns False if route not found."""
        removed = registry.unregister(r"^/api/v1/nonexistent$", RouteMethod.GET)

        assert removed is False

    def test_registry_unregister_clears_cache(self, registry, sample_handler):
        """Test unregister clears route cache."""
        route = Route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=sample_handler,
        )

        registry.register(route)
        registry.find_route("/api/v1/test", "GET")  # Cache the lookup

        assert len(registry._route_cache) > 0

        registry.unregister(r"^/api/v1/test$", RouteMethod.GET)

        assert len(registry._route_cache) == 0

    def test_registry_gets_routes_for_service(self, registry, sample_handler):
        """Test RouteRegistry filters routes by service."""
        route1 = Route(
            pattern=r"^/api/v1/billing/invoices$",
            method=RouteMethod.GET,
            service="billing",
            handler=sample_handler,
        )

        route2 = Route(
            pattern=r"^/api/v1/billing/payments$",
            method=RouteMethod.GET,
            service="billing",
            handler=sample_handler,
        )

        route3 = Route(
            pattern=r"^/api/v1/users$",
            method=RouteMethod.GET,
            service="users",
            handler=sample_handler,
        )

        registry.register(route1)
        registry.register(route2)
        registry.register(route3)

        billing_routes = registry.get_routes_for_service("billing")

        assert len(billing_routes) == 2
        assert all(r.service == "billing" for r in billing_routes)

    def test_registry_lists_all_routes(self, registry, sample_handler):
        """Test RouteRegistry lists all registered routes."""
        route1 = Route(
            pattern=r"^/api/v1/test1$",
            method=RouteMethod.GET,
            service="service1",
            handler=sample_handler,
            description="Test route 1",
        )

        route2 = Route(
            pattern=r"^/api/v1/test2$",
            method=RouteMethod.POST,
            service="service2",
            handler=sample_handler,
            requires_auth=False,
            description="Test route 2",
        )

        registry.register(route1)
        registry.register(route2)

        routes_list = registry.list_routes()

        assert len(routes_list) == 2
        assert routes_list[0]["pattern"] == r"^/api/v1/test1$"
        assert routes_list[0]["method"] == "GET"
        assert routes_list[0]["service"] == "service1"
        assert routes_list[0]["requires_auth"] is True
        assert routes_list[1]["requires_auth"] is False


@pytest.mark.unit
class TestConvenienceFunctions:
    """Test convenience functions for route management."""

    def test_register_route_function(self):
        """Test register_route convenience function."""

        async def handler():
            return {"status": "ok"}

        # Clear global registry
        route_registry.routes.clear()
        route_registry._route_cache.clear()

        register_route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=handler,
            description="Test endpoint",
        )

        assert len(route_registry.routes) == 1
        registered_route = route_registry.routes[0]
        assert registered_route.pattern == r"^/api/v1/test$"
        assert registered_route.method == RouteMethod.GET
        assert registered_route.description == "Test endpoint"

    def test_get_route_function_success(self):
        """Test get_route convenience function finds route."""

        async def handler():
            return {"status": "ok"}

        # Clear and setup
        route_registry.routes.clear()
        route_registry._route_cache.clear()

        register_route(
            pattern=r"^/api/v1/test$",
            method=RouteMethod.GET,
            service="test",
            handler=handler,
        )

        route = get_route("/api/v1/test", "GET")

        assert route is not None
        assert route.pattern == r"^/api/v1/test$"

    def test_get_route_function_raises_404(self):
        """Test get_route raises HTTPException for non-existent routes."""
        # Clear registry
        route_registry.routes.clear()
        route_registry._route_cache.clear()

        with pytest.raises(HTTPException) as exc_info:
            get_route("/api/v1/nonexistent", "GET")

        assert exc_info.value.status_code == 404
        assert "No route found" in exc_info.value.detail


@pytest.mark.unit
class TestRouteEnums:
    """Test Route enums."""

    def test_route_method_enum_values(self):
        """Test RouteMethod enum has all HTTP methods."""
        assert RouteMethod.GET.value == "GET"
        assert RouteMethod.POST.value == "POST"
        assert RouteMethod.PUT.value == "PUT"
        assert RouteMethod.PATCH.value == "PATCH"
        assert RouteMethod.DELETE.value == "DELETE"
        assert RouteMethod.HEAD.value == "HEAD"
        assert RouteMethod.OPTIONS.value == "OPTIONS"

    def test_route_type_enum_values(self):
        """Test RouteType enum has all types."""
        assert RouteType.DIRECT.value == "direct"
        assert RouteType.AGGREGATE.value == "aggregate"
        assert RouteType.TRANSFORM.value == "transform"
        assert RouteType.CACHE.value == "cache"
