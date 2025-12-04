"""
Tests for API Versioning System.

Tests version detection, routing, deprecation, and utilities.
"""

from datetime import date

import pytest
from fastapi import APIRouter, FastAPI, Request
from fastapi.testclient import TestClient

from dotmac.platform.versioning import (
    APIVersion,
    APIVersionMiddleware,
    VersionConfig,
    VersionedAPIRouter,
    VersioningStrategy,
    get_api_version,
    parse_version,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def version_config():
    """Create version configuration for testing."""
    return VersionConfig(
        default_version=APIVersion.V2,
        supported_versions=[APIVersion.V1, APIVersion.V2],
        deprecated_versions=[APIVersion.V1],
        sunset_dates={
            APIVersion.V1: date(2026, 12, 31),
        },
    )


@pytest.fixture
def app_with_url_versioning(version_config):
    """Create FastAPI app with URL path versioning."""
    app = FastAPI()

    # Add middleware
    app.add_middleware(
        APIVersionMiddleware,
        config=version_config,
        strategy=VersioningStrategy.URL_PATH,
    )

    # Create v1 router
    router_v1 = VersionedAPIRouter(
        prefix="/api/v1",
        config=version_config,
    )

    # Create v2 router
    router_v2 = VersionedAPIRouter(
        prefix="/api/v2",
        config=version_config,
    )

    # Route available in both versions
    @router_v1.get("/customers", versions=[APIVersion.V1])
    @router_v2.get("/customers", versions=[APIVersion.V2])
    async def list_customers(request: Request):
        version = get_api_version(request)
        return {"customers": [], "version": version.value}

    # Route only in V2
    @router_v2.get("/advanced", versions=[APIVersion.V2])
    async def advanced_feature(request: Request):
        return {"feature": "advanced"}

    # Deprecated route in V1
    @router_v1.get(
        "/legacy",
        versions=[APIVersion.V1],
        deprecated_in=[APIVersion.V1],
        replacement="/api/v2/new-endpoint",
    )
    async def legacy_endpoint(request: Request):
        return {"data": "legacy"}

    app.include_router(router_v1)
    app.include_router(router_v2)

    return app


@pytest.fixture
def app_with_header_versioning(version_config):
    """Create FastAPI app with header versioning."""
    app = FastAPI()

    app.add_middleware(
        APIVersionMiddleware,
        config=version_config,
        strategy=VersioningStrategy.HEADER,
    )

    router = APIRouter(prefix="/api")

    @router.get("/customers")
    async def list_customers(request: Request):
        version = get_api_version(request)
        return {"version": version.value}

    app.include_router(router)

    return app


@pytest.fixture
def app_with_query_versioning(version_config):
    """Create FastAPI app with query parameter versioning."""
    app = FastAPI()

    app.add_middleware(
        APIVersionMiddleware,
        config=version_config,
        strategy=VersioningStrategy.QUERY_PARAM,
    )

    router = APIRouter(prefix="/api")

    @router.get("/customers")
    async def list_customers(request: Request):
        version = get_api_version(request)
        return {"version": version.value}

    app.include_router(router)

    return app


class TestAPIVersionEnum:
    """Test APIVersion enum functionality."""

    def test_from_string_with_v_prefix(self):
        """Test parsing version string with 'v' prefix."""
        version = APIVersion.from_string("v1")
        assert version == APIVersion.V1

        version = APIVersion.from_string("v2")
        assert version == APIVersion.V2

    def test_from_string_without_v_prefix(self):
        """Test parsing version string without 'v' prefix."""
        version = APIVersion.from_string("1")
        assert version == APIVersion.V1

        version = APIVersion.from_string("2")
        assert version == APIVersion.V2

    def test_from_string_case_insensitive(self):
        """Test parsing is case insensitive."""
        version = APIVersion.from_string("V1")
        assert version == APIVersion.V1

        version = APIVersion.from_string("V2")
        assert version == APIVersion.V2

    def test_from_string_invalid_version(self):
        """Test parsing invalid version raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported API version"):
            APIVersion.from_string("v99")

    def test_major_version_property(self):
        """Test major version property."""
        assert APIVersion.V1.major == 1
        assert APIVersion.V2.major == 2

    def test_is_deprecated(self, version_config):
        """Test deprecation checking."""
        assert APIVersion.V1.is_deprecated(version_config) is True
        assert APIVersion.V2.is_deprecated(version_config) is False


class TestVersionConfig:
    """Test VersionConfig functionality."""

    def test_default_initialization(self):
        """Test default version config initialization."""
        config = VersionConfig()
        assert config.default_version == APIVersion.V2
        assert APIVersion.V1 in config.supported_versions
        assert APIVersion.V2 in config.supported_versions
        assert len(config.deprecated_versions) == 0
        assert len(config.sunset_dates) == 0

    def test_custom_configuration(self):
        """Test custom version configuration."""
        config = VersionConfig(
            default_version=APIVersion.V1,
            supported_versions=[APIVersion.V1],
            deprecated_versions=[APIVersion.V1],
            sunset_dates={APIVersion.V1: date(2025, 12, 31)},
        )
        assert config.default_version == APIVersion.V1
        assert config.supported_versions == [APIVersion.V1]
        assert APIVersion.V1 in config.deprecated_versions
        assert config.sunset_dates[APIVersion.V1] == date(2025, 12, 31)

    def test_is_version_supported(self, version_config):
        """Test version support checking."""
        assert version_config.is_version_supported(APIVersion.V1) is True
        assert version_config.is_version_supported(APIVersion.V2) is True

    def test_get_sunset_date(self, version_config):
        """Test getting sunset date for version."""
        sunset_date = version_config.get_sunset_date(APIVersion.V1)
        assert sunset_date == date(2026, 12, 31)

        sunset_date = version_config.get_sunset_date(APIVersion.V2)
        assert sunset_date is None

    def test_add_deprecation(self):
        """Test adding version deprecation."""
        config = VersionConfig()
        config.add_deprecation(APIVersion.V1, date(2026, 1, 1))

        assert APIVersion.V1 in config.deprecated_versions
        assert config.sunset_dates[APIVersion.V1] == date(2026, 1, 1)


class TestURLPathVersioning:
    """Test URL path version detection."""

    def test_v1_detection(self, app_with_url_versioning):
        """Test V1 version detection from URL."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v1/customers")

        assert response.status_code == 200
        assert response.json()["version"] == "v1"
        assert response.headers["X-API-Version"] == "v1"

    def test_v2_detection(self, app_with_url_versioning):
        """Test V2 version detection from URL."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v2/customers")

        assert response.status_code == 200
        assert response.json()["version"] == "v2"
        assert response.headers["X-API-Version"] == "v2"

    def test_deprecation_headers_v1(self, app_with_url_versioning):
        """Test deprecation headers for V1."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v1/customers")

        assert response.headers["Deprecation"] == "true"
        assert response.headers["Sunset"] == "2026-12-31"
        assert "X-Deprecation-Message" in response.headers

    def test_no_deprecation_headers_v2(self, app_with_url_versioning):
        """Test no deprecation headers for V2."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v2/customers")

        assert "Deprecation" not in response.headers
        assert "Sunset" not in response.headers

    def test_v2_only_endpoint_blocked_in_v1(self, app_with_url_versioning):
        """Test V2-only endpoint is blocked in V1."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v1/advanced")

        # V1 route doesn't exist, FastAPI returns 404
        assert response.status_code == 404

    def test_v2_only_endpoint_allowed_in_v2(self, app_with_url_versioning):
        """Test V2-only endpoint is allowed in V2."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v2/advanced")

        assert response.status_code == 200
        assert response.json()["feature"] == "advanced"


class TestHeaderVersioning:
    """Test header-based version detection."""

    def test_v1_header_detection(self, app_with_header_versioning):
        """Test V1 version detection from header."""
        client = TestClient(app_with_header_versioning)
        response = client.get(
            "/api/customers",
            headers={"X-API-Version": "v1"},
        )

        assert response.status_code == 200
        assert response.json()["version"] == "v1"
        assert response.headers["X-API-Version"] == "v1"

    def test_v2_header_detection(self, app_with_header_versioning):
        """Test V2 version detection from header."""
        client = TestClient(app_with_header_versioning)
        response = client.get(
            "/api/customers",
            headers={"X-API-Version": "v2"},
        )

        assert response.status_code == 200
        assert response.json()["version"] == "v2"
        assert response.headers["X-API-Version"] == "v2"

    def test_missing_header_uses_default(self, app_with_header_versioning):
        """Test missing header falls back to default version."""
        client = TestClient(app_with_header_versioning)
        response = client.get("/api/customers")

        assert response.status_code == 200
        assert response.json()["version"] == "v2"  # Default version


class TestQueryParameterVersioning:
    """Test query parameter version detection."""

    def test_v1_query_detection(self, app_with_query_versioning):
        """Test V1 version detection from query parameter."""
        client = TestClient(app_with_query_versioning)
        response = client.get("/api/customers?version=v1")

        assert response.status_code == 200
        assert response.json()["version"] == "v1"
        assert response.headers["X-API-Version"] == "v1"

    def test_v2_query_detection(self, app_with_query_versioning):
        """Test V2 version detection from query parameter."""
        client = TestClient(app_with_query_versioning)
        response = client.get("/api/customers?version=v2")

        assert response.status_code == 200
        assert response.json()["version"] == "v2"
        assert response.headers["X-API-Version"] == "v2"

    def test_missing_query_uses_default(self, app_with_query_versioning):
        """Test missing query parameter falls back to default."""
        client = TestClient(app_with_query_versioning)
        response = client.get("/api/customers")

        assert response.status_code == 200
        assert response.json()["version"] == "v2"  # Default version


class TestVersionUtilities:
    """Test versioning utility functions."""

    def test_parse_version(self):
        """Test parse_version utility function."""
        version = parse_version("v1")
        assert version == APIVersion.V1

        version = parse_version("2")
        assert version == APIVersion.V2

    def test_get_api_version_from_request(self, app_with_url_versioning):
        """Test get_api_version utility function."""
        from dotmac.platform.versioning.utils import get_api_version

        app = app_with_url_versioning

        @app.get("/api/v1/test-utils")
        async def test_endpoint(request: Request):
            version = get_api_version(request)
            return {"version": version.value}

        client = TestClient(app)
        response = client.get("/api/v1/test-utils")

        # Version should be detected by middleware
        assert response.status_code == 200
        assert response.json()["version"] == "v1"


class TestVersionedRoutes:
    """Test versioned route configuration."""

    def test_deprecated_route_access(self, app_with_url_versioning):
        """Test accessing deprecated route."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v1/legacy")

        assert response.status_code == 200
        assert response.json()["data"] == "legacy"
        assert response.headers["Deprecation"] == "true"

    def test_removed_route_blocked(self, app_with_url_versioning):
        """Test accessing removed route is blocked."""
        client = TestClient(app_with_url_versioning)
        response = client.get("/api/v2/legacy")

        # V2 route doesn't exist (only in V1), FastAPI returns 404
        assert response.status_code == 404


class TestVersionComparison:
    """Test version comparison utilities."""

    def test_compare_versions(self):
        """Test version comparison."""
        from dotmac.platform.versioning.utils import compare_versions

        # V1 < V2
        assert compare_versions(APIVersion.V1, APIVersion.V2) == -1

        # V2 > V1
        assert compare_versions(APIVersion.V2, APIVersion.V1) == 1

        # V1 == V1
        assert compare_versions(APIVersion.V1, APIVersion.V1) == 0

    def test_get_latest_version(self):
        """Test getting latest version."""
        from dotmac.platform.versioning.utils import get_latest_version

        versions = [APIVersion.V1, APIVersion.V2]
        latest = get_latest_version(versions)
        assert latest == APIVersion.V2

    def test_get_latest_version_empty_list(self):
        """Test getting latest version from empty list."""
        from dotmac.platform.versioning.utils import get_latest_version

        latest = get_latest_version([])
        assert latest is None


class TestVersionDecorators:
    """Test version requirement decorators."""

    def test_version_requires_decorator(self, version_config):
        """Test @version_requires decorator."""
        from dotmac.platform.versioning.utils import version_requires

        app = FastAPI()
        app.add_middleware(
            APIVersionMiddleware,
            config=version_config,
            strategy=VersioningStrategy.URL_PATH,
        )

        @app.get("/api/v1/v2-only")
        @version_requires(APIVersion.V2)
        async def v2_only_endpoint_v1(request: Request):
            return {"feature": "v2_only"}

        @app.get("/api/v2/v2-only")
        @version_requires(APIVersion.V2)
        async def v2_only_endpoint_v2(request: Request):
            return {"feature": "v2_only"}

        client = TestClient(app)

        # V1 should be rejected
        response = client.get("/api/v1/v2-only")
        assert response.status_code == 400

        # V2 should succeed
        response = client.get("/api/v2/v2-only")
        assert response.status_code == 200


class TestDeprecationMessages:
    """Test deprecation message formatting."""

    def test_format_deprecation_warning(self):
        """Test deprecation warning formatting."""
        from dotmac.platform.versioning.utils import format_deprecation_warning

        # Basic deprecation
        message = format_deprecation_warning(APIVersion.V1)
        assert "v1 is deprecated" in message

        # With sunset date
        message = format_deprecation_warning(
            APIVersion.V1,
            sunset_date=date(2026, 12, 31),
        )
        assert "2026-12-31" in message

        # With replacement
        message = format_deprecation_warning(
            APIVersion.V1,
            replacement="v2",
        )
        assert "migrate to v2" in message
