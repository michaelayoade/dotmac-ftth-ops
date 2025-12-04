"""
API Versioning.

Support for multiple API versions with deprecation management.
"""

from .middleware import APIVersionMiddleware
from .models import (
    APIVersion,
    VersionConfig,
    VersionContext,
    VersionedRoute,
    VersioningStrategy,
)
from .router import VersionedAPIRouter
from .utils import get_api_version, parse_version

__all__ = [
    "APIVersion",
    "VersionConfig",
    "VersionedRoute",
    "VersioningStrategy",
    "VersionContext",
    "APIVersionMiddleware",
    "VersionedAPIRouter",
    "get_api_version",
    "parse_version",
]
