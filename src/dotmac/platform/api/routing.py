"""
Route management for API Gateway.

Provides dynamic route registration and request routing.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from re import Pattern
from typing import Any

import structlog
from fastapi import HTTPException

logger = structlog.get_logger(__name__)


class RouteMethod(str, Enum):
    """HTTP methods."""

    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class RouteType(str, Enum):
    """Route types for different handling strategies."""

    DIRECT = "direct"  # Direct pass-through to service
    AGGREGATE = "aggregate"  # Aggregate multiple services
    TRANSFORM = "transform"  # Transform request/response
    CACHE = "cache"  # Cache response


@dataclass
class Route:
    """Route configuration."""

    pattern: str
    method: RouteMethod
    service: str
    handler: Callable[..., Any]
    route_type: RouteType = RouteType.DIRECT
    timeout: int = 30
    cache_ttl: int | None = None
    requires_auth: bool = True
    rate_limit: str | None = None
    description: str = ""

    def __post_init__(self) -> None:
        """Compile pattern after initialization."""
        self._compiled_pattern: Pattern[Any] = re.compile(self.pattern)

    def matches(self, path: str, method: str) -> bool:
        """
        Check if route matches request.

        Args:
            path: Request path
            method: HTTP method

        Returns:
            True if route matches
        """
        return (
            self.method.value == method.upper() and self._compiled_pattern.match(path) is not None
        )

    def extract_params(self, path: str) -> dict[str, str]:
        """
        Extract path parameters from request.

        Args:
            path: Request path

        Returns:
            Dictionary of extracted parameters
        """
        match = self._compiled_pattern.match(path)
        if match:
            return match.groupdict()
        return {}


class RouteRegistry:
    """
    Registry for API Gateway routes.

    Manages route registration and lookup.
    """

    def __init__(self) -> None:
        """Initialize route registry."""
        self.routes: list[Route] = []
        self._route_cache: dict[str, Route] = {}

    def register(self, route: Route) -> None:
        """
        Register a route.

        Args:
            route: Route configuration

        Raises:
            ValueError: If route conflicts with existing route
        """
        # Check for conflicts
        for existing in self.routes:
            if existing.pattern == route.pattern and existing.method == route.method:
                raise ValueError(
                    f"Route conflict: {route.method} {route.pattern} already registered"
                )

        self.routes.append(route)
        logger.info(
            "route.registered",
            pattern=route.pattern,
            method=route.method,
            service=route.service,
        )

    def unregister(self, pattern: str, method: RouteMethod) -> bool:
        """
        Unregister a route.

        Args:
            pattern: Route pattern
            method: HTTP method

        Returns:
            True if route was removed
        """
        original_count = len(self.routes)
        self.routes = [r for r in self.routes if not (r.pattern == pattern and r.method == method)]

        removed = len(self.routes) < original_count
        if removed:
            # Clear cache
            self._route_cache.clear()
            logger.info("route.unregistered", pattern=pattern, method=method)

        return removed

    def find_route(self, path: str, method: str) -> Route | None:
        """
        Find matching route for request.

        Args:
            path: Request path
            method: HTTP method

        Returns:
            Matching Route or None
        """
        # Check cache first
        cache_key = f"{method}:{path}"
        if cache_key in self._route_cache:
            return self._route_cache[cache_key]

        # Find matching route
        for route in self.routes:
            if route.matches(path, method):
                self._route_cache[cache_key] = route
                return route

        return None

    def get_routes_for_service(self, service: str) -> list[Route]:
        """
        Get all routes for a service.

        Args:
            service: Service name

        Returns:
            List of routes
        """
        return [r for r in self.routes if r.service == service]

    def list_routes(self) -> list[dict[str, Any]]:
        """
        List all registered routes.

        Returns:
            List of route information
        """
        return [
            {
                "pattern": route.pattern,
                "method": route.method.value,
                "service": route.service,
                "type": route.route_type.value,
                "requires_auth": route.requires_auth,
                "description": route.description,
            }
            for route in self.routes
        ]


# Global route registry
route_registry = RouteRegistry()


def register_route(
    pattern: str,
    method: RouteMethod,
    service: str,
    handler: Callable[..., Any],
    **kwargs: Any,
) -> None:
    """
    Convenience function to register a route.

    Args:
        pattern: URL pattern (regex)
        method: HTTP method
        service: Service name
        handler: Handler function
        **kwargs: Additional route configuration
    """
    route = Route(
        pattern=pattern,
        method=method,
        service=service,
        handler=handler,
        **kwargs,
    )
    route_registry.register(route)


def get_route(path: str, method: str) -> Route:
    """
    Get route for request.

    Args:
        path: Request path
        method: HTTP method

    Returns:
        Matching Route

    Raises:
        HTTPException: If no route found
    """
    route = route_registry.find_route(path, method)
    if not route:
        raise HTTPException(
            status_code=404,
            detail=f"No route found for {method} {path}",
        )
    return route
