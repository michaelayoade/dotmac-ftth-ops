"""
API Versioning Utilities.

Helper functions for working with API versions.
"""

from typing import Any

import structlog
from fastapi import Request

from dotmac.platform.versioning.models import APIVersion, VersionContext

logger = structlog.get_logger(__name__)


def get_api_version(request: Request, default: APIVersion = APIVersion.V2) -> APIVersion:
    """
    Get API version from request state.

    Args:
        request: FastAPI request object
        default: Default version if not found in request state

    Returns:
        API version for the request
    """
    version = getattr(request.state, "api_version", None)
    if version is None:
        logger.warning(
            "api_version.not_found_in_request",
            path=request.url.path,
            default=default.value,
        )
        return default

    return version


def get_version_context(request: Request) -> VersionContext | None:
    """
    Get version context from request state.

    Args:
        request: FastAPI request object

    Returns:
        Version context if available, None otherwise
    """
    return getattr(request.state, "version_context", None)


def parse_version(version_str: str) -> APIVersion:
    """
    Parse version string to APIVersion enum.

    Wrapper around APIVersion.from_string() for convenience.

    Args:
        version_str: Version string (e.g., "v1", "1", "V2")

    Returns:
        APIVersion enum value

    Raises:
        ValueError: If version string is invalid
    """
    return APIVersion.from_string(version_str)


def is_version_supported(version: APIVersion, supported_versions: list[APIVersion]) -> bool:
    """
    Check if a version is in the supported versions list.

    Args:
        version: Version to check
        supported_versions: List of supported versions

    Returns:
        True if version is supported, False otherwise
    """
    return version in supported_versions


def is_version_deprecated(version: APIVersion, deprecated_versions: list[APIVersion]) -> bool:
    """
    Check if a version is deprecated.

    Args:
        version: Version to check
        deprecated_versions: List of deprecated versions

    Returns:
        True if version is deprecated, False otherwise
    """
    return version in deprecated_versions


def compare_versions(version1: APIVersion, version2: APIVersion) -> int:
    """
    Compare two API versions.

    Args:
        version1: First version
        version2: Second version

    Returns:
        -1 if version1 < version2
         0 if version1 == version2
         1 if version1 > version2
    """
    major1 = version1.major
    major2 = version2.major

    if major1 < major2:
        return -1
    elif major1 > major2:
        return 1
    else:
        return 0


def get_latest_version(versions: list[APIVersion]) -> APIVersion | None:
    """
    Get the latest (highest) version from a list.

    Args:
        versions: List of API versions

    Returns:
        Latest version, or None if list is empty
    """
    if not versions:
        return None

    return max(versions, key=lambda v: v.major)


def format_deprecation_warning(
    version: APIVersion,
    sunset_date: Any | None = None,
    replacement: str | None = None,
) -> str:
    """
    Format a deprecation warning message.

    Args:
        version: Deprecated version
        sunset_date: Date when version will be removed (optional)
        replacement: Replacement version or endpoint (optional)

    Returns:
        Formatted deprecation warning message
    """
    message = f"API version {version.value} is deprecated"

    if sunset_date:
        message += f" and will be removed on {sunset_date}"

    if replacement:
        message += f". Please migrate to {replacement}"

    return message


def version_requires(min_version: APIVersion) -> Any:
    """
    Decorator to enforce minimum API version requirement.

    Usage:
        @version_requires(APIVersion.V2)
        async def new_feature(request: Request):
            # Only available in V2+
            pass

    Args:
        min_version: Minimum required API version

    Returns:
        Decorator function
    """
    import functools

    def decorator(func: Any) -> Any:
        @functools.wraps(func)
        async def wrapper(request: Request, *args: Any, **kwargs: Any) -> Any:
            current_version = get_api_version(request)

            if compare_versions(current_version, min_version) < 0:
                from fastapi import HTTPException, status

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This endpoint requires API version {min_version.value} or higher. "
                    f"Current version: {current_version.value}",
                )

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def version_deprecated(
    deprecated_version: APIVersion,
    replacement: str | None = None,
) -> Any:
    """
    Decorator to mark an endpoint as deprecated in a specific version.

    Usage:
        @version_deprecated(APIVersion.V1, replacement="/v2/new-endpoint")
        async def old_feature(request: Request):
            # Deprecated in V1
            pass

    Args:
        deprecated_version: Version where endpoint is deprecated
        replacement: Replacement endpoint path (optional)

    Returns:
        Decorator function
    """

    def decorator(func: Any) -> Any:
        async def wrapper(request: Request, *args: Any, **kwargs: Any) -> Any:
            current_version = get_api_version(request)

            if current_version == deprecated_version:
                logger.warning(
                    "endpoint.deprecated_access",
                    version=current_version.value,
                    endpoint=str(request.url.path),
                    replacement=replacement,
                )

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator
