"""
API Versioning Models.

Models for managing API versions and deprecation.
"""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class APIVersion(str, Enum):
    """Supported API versions."""

    V1 = "v1"
    V2 = "v2"

    @classmethod
    def from_string(cls, version: str) -> "APIVersion":
        """Parse version string to APIVersion enum."""
        version = version.lower().strip()
        if not version.startswith("v"):
            version = f"v{version}"

        for v in cls:
            if v.value == version:
                return v

        raise ValueError(f"Unsupported API version: {version}")

    @property
    def major(self) -> int:
        """Get major version number."""
        return int(self.value[1:])  # Remove 'v' prefix

    def is_deprecated(self, config: "VersionConfig | None" = None) -> bool:
        """Check if this version is deprecated."""
        if config and config.deprecated_versions:
            return self in config.deprecated_versions
        return False


@dataclass
class VersionConfig:
    """Configuration for API versioning."""

    default_version: APIVersion = APIVersion.V2
    supported_versions: list[APIVersion] = field(
        default_factory=lambda: [APIVersion.V1, APIVersion.V2]
    )
    deprecated_versions: list[APIVersion] = field(default_factory=lambda: [])
    sunset_dates: dict[APIVersion, date] = field(
        default_factory=dict
    )  # When versions will be removed

    def is_version_supported(self, version: APIVersion) -> bool:
        """Check if version is supported."""
        return version in self.supported_versions

    def get_sunset_date(self, version: APIVersion) -> date | None:
        """Get sunset date for a version."""
        return self.sunset_dates.get(version)

    def add_deprecation(self, version: APIVersion, sunset_date: date | None = None) -> None:
        """Mark a version as deprecated."""
        if version not in self.deprecated_versions:
            self.deprecated_versions.append(version)

        if sunset_date:
            self.sunset_dates[version] = sunset_date


@dataclass
class VersionedRoute:
    """Configuration for a versioned API route."""

    path: str
    versions: list[APIVersion]
    deprecated_in: list[APIVersion] | None = None
    removed_in: list[APIVersion] | None = None
    replacement: str | None = None  # Path to replacement endpoint

    def is_available_in(self, version: APIVersion) -> bool:
        """Check if route is available in specific version."""
        if self.removed_in and version in self.removed_in:
            return False
        return version in self.versions

    def is_deprecated_in(self, version: APIVersion) -> bool:
        """Check if route is deprecated in specific version."""
        if self.deprecated_in:
            return version in self.deprecated_in
        return False


class VersioningStrategy(str, Enum):
    """Version detection strategy."""

    URL_PATH = "url_path"  # /v1/customers, /v2/customers
    HEADER = "header"  # X-API-Version: v1
    QUERY_PARAM = "query_param"  # ?version=v1
    ACCEPT_HEADER = "accept_header"  # Accept: application/vnd.api+json; version=1

    @classmethod
    def get_default(cls) -> "VersioningStrategy":
        """Get default versioning strategy."""
        return cls.URL_PATH


@dataclass
class VersionContext:
    """Context information for version-specific request handling."""

    version: APIVersion
    is_deprecated: bool = False
    sunset_date: date | None = None
    deprecation_message: str | None = None
    replacement_endpoint: str | None = None

    def to_headers(self) -> dict[str, str]:
        """Convert to response headers."""
        headers = {
            "X-API-Version": self.version.value,
        }

        if self.is_deprecated:
            headers["Deprecation"] = "true"
            if self.sunset_date:
                headers["Sunset"] = self.sunset_date.isoformat()
            if self.deprecation_message:
                headers["X-Deprecation-Message"] = self.deprecation_message
            if self.replacement_endpoint:
                headers["X-Replacement-Endpoint"] = self.replacement_endpoint

        return headers
