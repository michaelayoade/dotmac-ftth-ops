"""
Tests for feature flags API router.

Tests the REST API endpoints for managing feature flags including
authentication, validation, and comprehensive management operations.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.feature_flags.router import (
    BulkFlagUpdateRequest,
    FeatureFlagCheckRequest,
    FeatureFlagRequest,
    feature_flags_router,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def client():
    """Create test client with mocked authentication."""
    from fastapi import FastAPI

    # Import from core module since that's where router imports from
    from dotmac.platform.auth.core import get_current_user_optional

    app = FastAPI()

    # Override authentication dependency - router uses get_current_user_optional from core
    def override_get_current_user_optional():
        return UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            tenant_id="test-tenant",
            roles=["admin"],
            permissions=["read", "write"],
        )

    app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
    app.include_router(feature_flags_router)
    return TestClient(app)


@pytest.fixture
def regular_user_client():
    """Create test client with regular user (no admin privileges)."""
    from fastapi import FastAPI

    # Import from core module since that's where router imports from
    from dotmac.platform.auth.core import get_current_user_optional

    app = FastAPI()

    def override_get_current_user_optional():
        return UserInfo(
            user_id="regular-user",
            email="user@example.com",
            username="regularuser",
            tenant_id="test-tenant",
            roles=["user"],
            permissions=["read"],
        )

    app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
    app.include_router(feature_flags_router)
    return TestClient(app)


@pytest.fixture
def feature_flag_admin_client():
    """Create test client with feature flag admin role."""
    from fastapi import FastAPI

    # Import from core module since that's where router imports from
    from dotmac.platform.auth.core import get_current_user_optional

    app = FastAPI()

    def override_get_current_user_optional():
        return UserInfo(
            user_id="flag-admin",
            email="flagadmin@example.com",
            username="flagadmin",
            tenant_id="test-tenant",
            roles=["feature_flag_admin"],
            permissions=["read", "write"],
        )

    app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
    app.include_router(feature_flags_router)
    return TestClient(app)


class TestCreateOrUpdateFlag:
    """Test creating and updating feature flags."""

    def test_create_flag_success(self, client):
        """Test successfully creating a feature flag."""
        request_data = {
            "enabled": True,
            "context": {"env": "production"},
            "description": "Enable new feature in production",
        }

        fake_flags = {
            "new_feature": {
                "enabled": True,
                "context": {"env": "production"},
                "metadata": {"description": request_data["description"], "created_at": 1700000000},
                "updated_at": 1700000100,
            }
        }

        mock_list_flags = AsyncMock(side_effect=[{}, fake_flags])

        with (
            patch("dotmac.platform.feature_flags.router.set_flag") as mock_set_flag,
            patch("dotmac.platform.feature_flags.router.list_flags", mock_list_flags),
        ):
            response = client.post("/feature-flags/flags/new_feature", json=request_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["name"] == "new_feature"
            assert data["enabled"] is True
            assert data["description"] == "Enable new feature in production"
            assert data["context"] == {"env": "production"}
            assert data["created_at"] == 1700000000
            assert data["updated_at"] == 1700000100

            mock_set_flag.assert_called_once()
            _, _, context_arg, metadata_arg = mock_set_flag.call_args[0]
            assert context_arg == {"env": "production"}
            assert metadata_arg["description"] == "Enable new feature in production"
            assert metadata_arg["created_by"] == "test-user-123"
            assert metadata_arg["updated_by"] == "test-user-123"
            assert isinstance(metadata_arg["created_at"], int)

    def test_create_flag_feature_admin_permission(self, feature_flag_admin_client):
        """Test creating flag with feature_flag_admin role."""
        request_data = {"enabled": True, "description": "Admin flag"}

        mock_list_flags = AsyncMock(
            side_effect=[
                {},
                {"admin_flag": {"enabled": True, "context": {}, "metadata": {}, "updated_at": 170}},
            ]
        )

        with (
            patch("dotmac.platform.feature_flags.router.set_flag"),
            patch("dotmac.platform.feature_flags.router.list_flags", mock_list_flags),
        ):
            response = feature_flag_admin_client.post(
                "/feature-flags/flags/admin_flag", json=request_data
            )

            assert response.status_code == status.HTTP_200_OK

    def test_create_flag_insufficient_permissions(self, regular_user_client):
        """Test creating flag with insufficient permissions."""
        request_data = {"enabled": True, "description": "Test flag"}

        response = regular_user_client.post("/feature-flags/flags/test_flag", json=request_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient permissions" in response.json()["detail"]

    def test_create_flag_invalid_name(self, client):
        """Test creating flag with invalid name."""
        request_data = {"enabled": True}

        response = client.post("/feature-flags/flags/invalid flag name!", json=request_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "alphanumeric characters" in response.json()["detail"]

    def test_create_flag_large_context(self, client):
        """Test creating flag with context that's too large."""
        large_context = {f"key_{i}": f"value_{i}" for i in range(15)}
        request_data = {"enabled": True, "context": large_context}

        response = client.post("/feature-flags/flags/large_context", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_flag_service_error(self, client):
        """Test creating flag when service throws error."""
        request_data = {"enabled": True}

        with (
            patch(
                "dotmac.platform.feature_flags.router.set_flag",
                side_effect=Exception("Redis error"),
            ),
            patch("dotmac.platform.feature_flags.router.list_flags", AsyncMock(return_value={})),
        ):
            response = client.post("/feature-flags/flags/error_flag", json=request_data)

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Failed to create/update" in response.json()["detail"]


class TestGetFlag:
    """Test getting specific feature flags."""

    def test_get_flag_success(self, client):
        """Test successfully getting a feature flag."""
        mock_flags = {
            "existing_flag": {
                "enabled": True,
                "context": {"env": "test"},
                "metadata": {"description": "Test flag", "created_at": 1640995200},
                "updated_at": 1640995300,
            }
        }

        with patch(
            "dotmac.platform.feature_flags.router.list_flags",
            AsyncMock(return_value=mock_flags),
        ):
            response = client.get("/feature-flags/flags/existing_flag")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["name"] == "existing_flag"
            assert data["enabled"] is True
            assert data["description"] == "Test flag"
            assert data["created_at"] == 1640995200
            assert data["updated_at"] == 1640995300

    def test_get_flag_not_found(self, client):
        """Test getting non-existent flag."""
        with patch("dotmac.platform.feature_flags.router.list_flags", AsyncMock(return_value={})):
            response = client.get("/feature-flags/flags/nonexistent")

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "not found" in response.json()["detail"]

    def test_get_flag_service_error(self, client):
        """Test getting flag when service throws error."""
        with patch(
            "dotmac.platform.feature_flags.router.list_flags",
            AsyncMock(side_effect=Exception("Service error")),
        ):
            response = client.get("/feature-flags/flags/error_flag")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestListAllFlags:
    """Test listing all feature flags."""

    def test_list_all_flags(self, client):
        """Test listing all flags."""
        mock_flags = {
            "flag1": {
                "enabled": True,
                "context": {},
                "metadata": {"description": "First flag"},
                "updated_at": 1640995200,
            },
            "flag2": {
                "enabled": False,
                "context": {"env": "test"},
                "metadata": {},
                "updated_at": 1640995300,
            },
        }

        with patch(
            "dotmac.platform.feature_flags.router.list_flags",
            AsyncMock(return_value=mock_flags),
        ):
            response = client.get("/feature-flags/flags")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) == 2

            flag_names = [flag["name"] for flag in data]
            assert "flag1" in flag_names
            assert "flag2" in flag_names

    def test_list_enabled_flags_only(self, client):
        """Test listing only enabled flags."""
        mock_flags = {
            "enabled_flag": {
                "enabled": True,
                "context": {},
                "metadata": {},
                "updated_at": 1640995200,
            },
            "disabled_flag": {
                "enabled": False,
                "context": {},
                "metadata": {},
                "updated_at": 1640995300,
            },
        }

        with patch(
            "dotmac.platform.feature_flags.router.list_flags",
            AsyncMock(return_value=mock_flags),
        ):
            response = client.get("/feature-flags/flags?enabled_only=true")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "enabled_flag"

    def test_list_flags_empty(self, client):
        """Test listing flags when none exist."""
        with patch("dotmac.platform.feature_flags.router.list_flags", AsyncMock(return_value={})):
            response = client.get("/feature-flags/flags")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data == []


class TestDeleteFlag:
    """Test deleting feature flags."""

    def test_delete_flag_success(self, client):
        """Test successfully deleting a flag."""
        with patch("dotmac.platform.feature_flags.router.delete_flag", return_value=True):
            response = client.delete("/feature-flags/flags/delete_me")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "deleted successfully" in data["message"]

    def test_delete_flag_not_found(self, client):
        """Test deleting non-existent flag."""
        with patch("dotmac.platform.feature_flags.router.delete_flag", return_value=False):
            response = client.delete("/feature-flags/flags/nonexistent")

            assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_flag_insufficient_permissions(self, regular_user_client):
        """Test deleting flag with insufficient permissions."""
        response = regular_user_client.delete("/feature-flags/flags/test_flag")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_flag_service_error(self, client):
        """Test deleting flag when service throws error."""
        with patch(
            "dotmac.platform.feature_flags.router.delete_flag",
            side_effect=Exception("Service error"),
        ):
            response = client.delete("/feature-flags/flags/error_flag")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestCheckFlag:
    """Test checking feature flags."""

    def test_check_flag_enabled(self, client):
        """Test checking enabled flag."""
        request_data = {"flag_name": "test_flag", "context": {"user_id": "123", "env": "test"}}

        with patch("dotmac.platform.feature_flags.router.is_enabled", return_value=True):
            with patch(
                "dotmac.platform.feature_flags.router.get_variant", return_value="variant_a"
            ):
                response = client.post("/feature-flags/flags/check", json=request_data)

                if response.status_code != status.HTTP_200_OK:
                    print(f"Error response: {response.json()}")
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["flag_name"] == "test_flag"
                assert data["enabled"] is True
                assert data["variant"] == "variant_a"
                assert "checked_at" in data

    def test_check_flag_disabled(self, client):
        """Test checking disabled flag."""
        request_data = {"flag_name": "disabled_flag"}

        with patch("dotmac.platform.feature_flags.router.is_enabled", return_value=False):
            with patch("dotmac.platform.feature_flags.router.get_variant", return_value="control"):
                response = client.post("/feature-flags/flags/check", json=request_data)

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["enabled"] is False
                assert data["variant"] == "control"

    def test_check_flag_with_user_context(self, client):
        """Test that user context is automatically added."""
        request_data = {"flag_name": "user_flag", "context": {"extra": "data"}}

        async def mock_is_enabled(flag_name, context):
            # Verify user context was added
            assert context["user_id"] == "test-user-123"
            assert context["user_roles"] == ["admin"]
            assert context["extra"] == "data"
            return True

        with patch("dotmac.platform.feature_flags.router.is_enabled", side_effect=mock_is_enabled):
            with patch("dotmac.platform.feature_flags.router.get_variant", return_value="control"):
                response = client.post("/feature-flags/flags/check", json=request_data)

                assert response.status_code == status.HTTP_200_OK

    def test_check_flag_service_error(self, client):
        """Test checking flag when service throws error."""
        request_data = {"flag_name": "error_flag"}

        with patch(
            "dotmac.platform.feature_flags.router.is_enabled",
            side_effect=Exception("Service error"),
        ):
            response = client.post("/feature-flags/flags/check", json=request_data)

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestGetStatus:
    """Test getting feature flag system status."""

    def test_get_status_success(self, client):
        """Test getting system status."""
        mock_status = {
            "redis_available": True,
            "redis_url": "redis://user:pass@localhost:6379/0",
            "cache_size": 10,
            "cache_maxsize": 1000,
            "cache_ttl": 60,
            "redis_flags": 15,
            "total_flags": 15,
        }

        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status", return_value=mock_status
        ):
            response = client.get("/feature-flags/status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["redis_available"] is True
            assert data["cache_size"] == 10
            assert data["healthy"] is True
            # Redis URL should be masked
            assert "user:pass" not in data["redis_url"]
            assert "localhost:6379" in data["redis_url"]

    def test_get_status_redis_unavailable(self, client):
        """Test getting status when Redis is unavailable."""
        mock_status = {
            "redis_available": False,
            "redis_url": None,
            "cache_size": 5,
            "cache_maxsize": 1000,
            "cache_ttl": 60,
            "total_flags": 5,
        }

        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status", return_value=mock_status
        ):
            response = client.get("/feature-flags/status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["redis_available"] is False
            assert data["redis_url"] is None
            assert data["healthy"] is True  # Still healthy with cache

    def test_get_status_service_error(self, client):
        """Test getting status when service throws error."""
        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status",
            side_effect=Exception("Service error"),
        ):
            response = client.get("/feature-flags/status")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestAdminEndpoints:
    """Test admin-only endpoints."""

    def test_clear_cache_success(self, client):
        """Test clearing cache as admin."""
        with patch("dotmac.platform.feature_flags.router.clear_cache"):
            response = client.post("/feature-flags/admin/clear-cache")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "cleared successfully" in data["message"]

    def test_clear_cache_non_admin(self, regular_user_client):
        """Test clearing cache as non-admin user."""
        response = regular_user_client.post("/feature-flags/admin/clear-cache")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_sync_redis_success(self, client):
        """Test syncing from Redis as admin."""
        with patch("dotmac.platform.feature_flags.router.sync_from_redis", return_value=5):
            response = client.post("/feature-flags/admin/sync-redis")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["synced_count"] == 5
            assert "5 flags" in data["message"]

    def test_sync_redis_non_admin(self, feature_flag_admin_client):
        """Test syncing from Redis as feature flag admin (should fail)."""
        response = feature_flag_admin_client.post("/feature-flags/admin/sync-redis")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestBulkOperations:
    """Test bulk flag operations."""

    def test_bulk_update_success(self, client):
        """Test successful bulk update."""
        request_data = {
            "flags": {
                "flag1": {"enabled": True, "description": "First flag"},
                "flag2": {"enabled": False, "description": "Second flag"},
                "flag3": {"enabled": True, "context": {"env": "prod"}},
            }
        }

        mock_set_flag = AsyncMock()
        mock_list_flags = AsyncMock(return_value={})

        with (
            patch("dotmac.platform.feature_flags.router.set_flag", mock_set_flag),
            patch("dotmac.platform.feature_flags.router.list_flags", mock_list_flags),
        ):
            response = client.post("/feature-flags/flags/bulk", json=request_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success_count"] == 3
            assert data["failed_count"] == 0
            assert len(data["failed_flags"]) == 0
            assert mock_set_flag.await_count == 3

    def test_bulk_update_partial_failure(self, client):
        """Test bulk update with some failures."""
        request_data = {
            "flags": {
                "valid_flag": {"enabled": True, "description": "Valid flag"},
                "invalid flag name!": {"enabled": False, "description": "Invalid name"},
            }
        }

        mock_set_flag = AsyncMock()
        mock_list_flags = AsyncMock(return_value={})

        with (
            patch("dotmac.platform.feature_flags.router.set_flag", mock_set_flag),
            patch("dotmac.platform.feature_flags.router.list_flags", mock_list_flags),
        ):
            response = client.post("/feature-flags/flags/bulk", json=request_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success_count"] == 1
            assert data["failed_count"] == 1
            assert len(data["failed_flags"]) == 1

    def test_bulk_update_too_many_flags(self, client):
        """Test bulk update with too many flags."""
        request_data = {"flags": {f"flag_{i}": {"enabled": True} for i in range(101)}}

        response = client.post("/feature-flags/flags/bulk", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_bulk_update_insufficient_permissions(self, regular_user_client):
        """Test bulk update with insufficient permissions."""
        request_data = {"flags": {"test_flag": {"enabled": True}}}

        response = regular_user_client.post("/feature-flags/flags/bulk", json=request_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestValidation:
    """Test request validation."""

    def test_feature_flag_request_validation(self):
        """Test FeatureFlagRequest validation."""
        # Valid request
        valid_request = FeatureFlagRequest(
            enabled=True, context={"env": "test"}, description="Test flag"
        )
        assert valid_request.enabled is True

        # Invalid context (too many keys)
        with pytest.raises(ValueError, match="more than 10 keys"):
            large_context = {f"key_{i}": f"value_{i}" for i in range(15)}
            FeatureFlagRequest(enabled=True, context=large_context)

    def test_bulk_flag_update_validation(self):
        """Test BulkFlagUpdateRequest validation."""
        # Valid request
        flags = {f"flag_{i}": FeatureFlagRequest(enabled=True) for i in range(5)}
        valid_request = BulkFlagUpdateRequest(flags=flags)
        assert len(valid_request.flags) == 5

        # Too many flags
        with pytest.raises(ValueError, match="more than 100 flags"):
            large_flags = {f"flag_{i}": FeatureFlagRequest(enabled=True) for i in range(101)}
            BulkFlagUpdateRequest(flags=large_flags)

    def test_feature_flag_check_request(self):
        """Test FeatureFlagCheckRequest validation."""
        # Valid request
        request = FeatureFlagCheckRequest(flag_name="test_flag", context={"user_id": "123"})
        assert request.flag_name == "test_flag"

        # Minimal request
        minimal_request = FeatureFlagCheckRequest(flag_name="minimal")
        assert minimal_request.context is None


class TestResponseModels:
    """Test response model functionality."""

    def test_feature_flag_response_model(self, client):
        """Test FeatureFlagResponse model in actual response."""
        mock_flags = {
            "test_flag": {
                "enabled": True,
                "context": {"env": "test"},
                "metadata": {"description": "Test description", "created_at": 1640995200},
                "updated_at": 1640995300,
            }
        }

        with patch(
            "dotmac.platform.feature_flags.router.list_flags",
            AsyncMock(return_value=mock_flags),
        ):
            response = client.get("/feature-flags/flags/test_flag")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Check all expected fields are present
            expected_fields = [
                "name",
                "enabled",
                "context",
                "description",
                "updated_at",
                "created_at",
            ]
            for field in expected_fields:
                assert field in data

            # Check field values
            assert data["name"] == "test_flag"
            assert data["enabled"] is True
            assert data["description"] == "Test description"
            assert data["updated_at"] == 1640995300
            assert data["created_at"] == 1640995200

    def test_flag_status_response_health_calculation(self, client):
        """Test that health status is calculated correctly."""
        # Healthy: Redis available
        mock_status_healthy_redis = {
            "redis_available": True,
            "cache_size": 10,
            "cache_maxsize": 1000,
            "cache_ttl": 60,
            "redis_flags": 15,
            "total_flags": 15,
            "redis_url": "redis://localhost:6379/0",
        }

        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status",
            return_value=mock_status_healthy_redis,
        ):
            response = client.get("/feature-flags/status")
            data = response.json()
            assert data["healthy"] is True

        # Healthy: Redis unavailable but has cached flags
        mock_status_healthy_cache = {
            "redis_available": False,
            "cache_size": 5,
            "cache_maxsize": 1000,
            "cache_ttl": 60,
            "total_flags": 5,
            "redis_url": None,
        }

        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status",
            return_value=mock_status_healthy_cache,
        ):
            response = client.get("/feature-flags/status")
            data = response.json()
            assert data["healthy"] is True

        # Unhealthy: No Redis and no cached flags
        mock_status_unhealthy = {
            "redis_available": False,
            "cache_size": 0,
            "cache_maxsize": 1000,
            "cache_ttl": 60,
            "total_flags": 0,
            "redis_url": None,
        }

        with patch(
            "dotmac.platform.feature_flags.router.get_flag_status",
            return_value=mock_status_unhealthy,
        ):
            response = client.get("/feature-flags/status")
            data = response.json()
            assert data["healthy"] is False
