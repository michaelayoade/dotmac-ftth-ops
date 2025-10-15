"""
API Version Detection Middleware.

Middleware for detecting and validating API versions from requests.
"""

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from dotmac.platform.versioning.models import (
    APIVersion,
    VersionConfig,
    VersionContext,
    VersioningStrategy,
)

logger = structlog.get_logger(__name__)


class APIVersionMiddleware(BaseHTTPMiddleware):
    """
    Middleware for API version detection and validation.

    Detects API version from various sources based on configured strategy:
    - URL path: /v1/customers, /v2/customers
    - Header: X-API-Version: v1
    - Query parameter: ?version=v1
    - Accept header: Accept: application/vnd.api+json; version=1

    Adds version context to request state and response headers.
    """

    def __init__(
        self,
        app: ASGIApp,
        config: VersionConfig | None = None,
        strategy: VersioningStrategy = VersioningStrategy.URL_PATH,
    ) -> None:
        """
        Initialize middleware.

        Args:
            app: FastAPI application
            config: Version configuration
            strategy: Version detection strategy
        """
        super().__init__(app)
        self.config = config or VersionConfig()
        self.strategy = strategy
        logger.info(
            "api_version_middleware.initialized",
            default_version=self.config.default_version.value,
            strategy=strategy.value,
        )

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process request and detect API version.

        Args:
            request: Incoming request
            call_next: Next middleware/endpoint

        Returns:
            Response with version headers
        """
        # Detect version
        try:
            version = self._detect_version(request)
        except ValueError as e:
            logger.warning(
                "api_version.detection_failed",
                error=str(e),
                path=request.url.path,
            )
            version = self.config.default_version

        # Validate version
        if not self.config.is_version_supported(version):
            logger.warning(
                "api_version.unsupported",
                version=version.value,
                path=request.url.path,
            )
            version = self.config.default_version

        # Create version context
        context = self._create_version_context(version)

        # Store in request state
        request.state.api_version = version
        request.state.version_context = context

        # Log version detection
        logger.debug(
            "api_version.detected",
            version=version.value,
            is_deprecated=context.is_deprecated,
            path=request.url.path,
        )

        # Process request
        response = await call_next(request)

        # Add version headers to response
        version_headers = context.to_headers()
        for header_name, header_value in version_headers.items():
            response.headers[header_name] = header_value

        return response

    def _detect_version(self, request: Request) -> APIVersion:
        """
        Detect API version from request.

        Args:
            request: Incoming request

        Returns:
            Detected API version

        Raises:
            ValueError: If version cannot be detected or parsed
        """
        if self.strategy == VersioningStrategy.URL_PATH:
            return self._detect_from_url(request)
        elif self.strategy == VersioningStrategy.HEADER:
            return self._detect_from_header(request)
        elif self.strategy == VersioningStrategy.QUERY_PARAM:
            return self._detect_from_query(request)
        elif self.strategy == VersioningStrategy.ACCEPT_HEADER:
            return self._detect_from_accept(request)
        else:
            return self.config.default_version

    def _detect_from_url(self, request: Request) -> APIVersion:
        """
        Detect version from URL path (/v1/..., /v2/...).

        Args:
            request: Incoming request

        Returns:
            API version from URL

        Raises:
            ValueError: If version not found in URL
        """
        path = request.url.path
        parts = path.split("/")

        for part in parts:
            if part.startswith("v") and part[1:].isdigit():
                try:
                    return APIVersion.from_string(part)
                except ValueError:
                    pass

        raise ValueError("No version found in URL path")

    def _detect_from_header(self, request: Request) -> APIVersion:
        """
        Detect version from X-API-Version header.

        Args:
            request: Incoming request

        Returns:
            API version from header

        Raises:
            ValueError: If header not present or invalid
        """
        version_header = request.headers.get("X-API-Version")
        if not version_header:
            raise ValueError("X-API-Version header not found")

        return APIVersion.from_string(version_header)

    def _detect_from_query(self, request: Request) -> APIVersion:
        """
        Detect version from query parameter (?version=v1).

        Args:
            request: Incoming request

        Returns:
            API version from query

        Raises:
            ValueError: If query parameter not present or invalid
        """
        version_param = request.query_params.get("version")
        if not version_param:
            raise ValueError("version query parameter not found")

        return APIVersion.from_string(version_param)

    def _detect_from_accept(self, request: Request) -> APIVersion:
        """
        Detect version from Accept header.

        Format: Accept: application/vnd.api+json; version=1

        Args:
            request: Incoming request

        Returns:
            API version from Accept header

        Raises:
            ValueError: If Accept header not present or no version found
        """
        accept_header = request.headers.get("Accept")
        if not accept_header:
            raise ValueError("Accept header not found")

        # Parse version parameter from Accept header
        # Format: application/vnd.api+json; version=1
        parts = accept_header.split(";")
        for part in parts:
            part = part.strip()
            if part.startswith("version="):
                version_str = part.split("=")[1].strip()
                return APIVersion.from_string(version_str)

        raise ValueError("No version found in Accept header")

    def _create_version_context(self, version: APIVersion) -> VersionContext:
        """
        Create version context with deprecation info.

        Args:
            version: API version

        Returns:
            Version context with deprecation information
        """
        is_deprecated = version.is_deprecated(self.config)
        sunset_date = self.config.get_sunset_date(version)

        deprecation_message = None
        if is_deprecated:
            if sunset_date:
                deprecation_message = (
                    f"API version {version.value} is deprecated and will be "
                    f"removed on {sunset_date.isoformat()}"
                )
            else:
                deprecation_message = f"API version {version.value} is deprecated"

        return VersionContext(
            version=version,
            is_deprecated=is_deprecated,
            sunset_date=sunset_date,
            deprecation_message=deprecation_message,
        )
