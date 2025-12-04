"""
Versioned API Router.

Router wrapper for creating version-specific API routes.
"""

from collections.abc import Callable
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request, status

from dotmac.platform.versioning.models import (
    APIVersion,
    VersionConfig,
    VersionedRoute,
)

logger = structlog.get_logger(__name__)


class VersionedAPIRouter(APIRouter):
    """
    API Router with version support.

    Extends FastAPI's APIRouter to support version-specific routes
    with automatic deprecation warnings and removal enforcement.

    Usage:
        router = VersionedAPIRouter(
            prefix="/api",
            config=VersionConfig(
                default_version=APIVersion.V2,
                deprecated_versions=[APIVersion.V1],
            )
        )

        # Register route for specific versions
        @router.get("/customers"), versions=[APIVersion.V1, APIVersion.V2])  # type: ignore[misc]
        async def list_customers():
            return customers

        # Register route with deprecation
        @router.get(
            "/old-endpoint",
            versions=[APIVersion.V1],
            deprecated_in=[APIVersion.V1],
            replacement="/new-endpoint"
        )
        async def old_endpoint():
            return data
    """

    def __init__(
        self,
        *args: Any,
        config: VersionConfig | None = None,
        **kwargs: Any,
    ):
        """
        Initialize versioned router.

        Args:
            config: Version configuration
            *args: APIRouter positional arguments
            **kwargs: APIRouter keyword arguments
        """
        super().__init__(*args, **kwargs)
        self.config = config or VersionConfig()
        self.versioned_routes: dict[str, VersionedRoute] = {}

        logger.info(
            "versioned_router.initialized",
            prefix=kwargs.get("prefix", ""),
            default_version=self.config.default_version.value,
        )

    def add_api_route(
        self,
        path: str,
        endpoint: Callable[..., Any],
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> None:
        """
        Add versioned API route.

        Args:
            path: Route path
            endpoint: Route handler function
            versions: Versions where route is available (defaults to all)
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional APIRouter.add_api_route arguments
        """
        # Default to all supported versions if not specified
        if versions is None:
            versions = self.config.supported_versions

        # Store versioned route configuration
        route_config = VersionedRoute(
            path=path,
            versions=versions,
            deprecated_in=deprecated_in,
            removed_in=removed_in,
            replacement=replacement,
        )
        self.versioned_routes[path] = route_config

        # Wrap endpoint with version check
        wrapped_endpoint = self._wrap_endpoint(endpoint, route_config)

        # Add route using parent class
        super().add_api_route(path, wrapped_endpoint, **kwargs)

        logger.debug(
            "versioned_route.registered",
            path=path,
            versions=[v.value for v in versions],
            deprecated_in=[v.value for v in (deprecated_in or [])],
        )

    def get(
        self,
        path: str,
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> Callable[..., Any]:
        """
        Decorator for GET routes with version support.

        Args:
            path: Route path
            versions: Versions where route is available
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional route arguments

        Returns:
            Decorator function
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self.add_api_route(
                path,
                func,
                methods=["GET"],
                versions=versions,
                deprecated_in=deprecated_in,
                removed_in=removed_in,
                replacement=replacement,
                **kwargs,
            )
            return func

        return decorator

    def post(
        self,
        path: str,
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> Callable[..., Any]:
        """
        Decorator for POST routes with version support.

        Args:
            path: Route path
            versions: Versions where route is available
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional route arguments

        Returns:
            Decorator function
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self.add_api_route(
                path,
                func,
                methods=["POST"],
                versions=versions,
                deprecated_in=deprecated_in,
                removed_in=removed_in,
                replacement=replacement,
                **kwargs,
            )
            return func

        return decorator

    def put(
        self,
        path: str,
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> Callable[..., Any]:
        """
        Decorator for PUT routes with version support.

        Args:
            path: Route path
            versions: Versions where route is available
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional route arguments

        Returns:
            Decorator function
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self.add_api_route(
                path,
                func,
                methods=["PUT"],
                versions=versions,
                deprecated_in=deprecated_in,
                removed_in=removed_in,
                replacement=replacement,
                **kwargs,
            )
            return func

        return decorator

    def patch(
        self,
        path: str,
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> Callable[..., Any]:
        """
        Decorator for PATCH routes with version support.

        Args:
            path: Route path
            versions: Versions where route is available
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional route arguments

        Returns:
            Decorator function
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self.add_api_route(
                path,
                func,
                methods=["PATCH"],
                versions=versions,
                deprecated_in=deprecated_in,
                removed_in=removed_in,
                replacement=replacement,
                **kwargs,
            )
            return func

        return decorator

    def delete(
        self,
        path: str,
        versions: list[APIVersion] | None = None,
        deprecated_in: list[APIVersion] | None = None,
        removed_in: list[APIVersion] | None = None,
        replacement: str | None = None,
        **kwargs: Any,
    ) -> Callable[..., Any]:
        """
        Decorator for DELETE routes with version support.

        Args:
            path: Route path
            versions: Versions where route is available
            deprecated_in: Versions where route is deprecated
            removed_in: Versions where route is removed
            replacement: Path to replacement endpoint
            **kwargs: Additional route arguments

        Returns:
            Decorator function
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            self.add_api_route(
                path,
                func,
                methods=["DELETE"],
                versions=versions,
                deprecated_in=deprecated_in,
                removed_in=removed_in,
                replacement=replacement,
                **kwargs,
            )
            return func

        return decorator

    def _wrap_endpoint(
        self, endpoint: Callable[..., Any], route_config: VersionedRoute
    ) -> Callable[..., Any]:
        """
        Wrap endpoint with version checking logic.

        Args:
            endpoint: Original endpoint function
            route_config: Route version configuration

        Returns:
            Wrapped endpoint function
        """
        import functools

        @functools.wraps(endpoint)
        async def wrapped_endpoint(*args: Any, **kwargs: Any) -> Any:
            # Try to get request from kwargs or args
            request = kwargs.get("request")
            if request is None:
                # Try to find Request in args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            # If we still don't have a request, we can't check version
            if request is None:
                logger.warning(
                    "versioned_route.no_request",
                    path=route_config.path,
                )
                # Execute endpoint without version check
                return await endpoint(*args, **kwargs)

            # Get version from request state (set by middleware)
            version = getattr(request.state, "api_version", self.config.default_version)

            # Check if route is available in this version
            if not route_config.is_available_in(version):
                error_detail = f"Endpoint not available in API version {version.value}"

                if route_config.replacement:
                    error_detail += f". Use {route_config.replacement} instead"

                logger.warning(
                    "versioned_route.not_available",
                    path=route_config.path,
                    version=version.value,
                    replacement=route_config.replacement,
                )

                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_detail,
                )

            # Check if route is deprecated in this version
            if route_config.is_deprecated_in(version):
                logger.info(
                    "versioned_route.deprecated_access",
                    path=route_config.path,
                    version=version.value,
                    replacement=route_config.replacement,
                )

            # Execute endpoint
            return await endpoint(*args, **kwargs)

        return wrapped_endpoint
