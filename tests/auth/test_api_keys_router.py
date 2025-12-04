"""
Comprehensive tests for API Keys Router.

Tests all API key management endpoints including create, list, get, update, delete.
"""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.auth.api_keys_router import (
    APIKeyCreateRequest,
    APIKeyUpdateRequest,
    _enhanced_create_api_key,
    _get_api_key_by_id,
    _list_user_api_keys,
    _mask_api_key,
    _revoke_api_key_by_id,
    _update_api_key_metadata,
    create_api_key,
    get_api_key,
    get_available_scopes,
    list_api_keys,
    revoke_api_key,
    update_api_key,
)
from dotmac.platform.auth.core import UserInfo

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_user():
    """Create mock user."""
    return UserInfo(
        user_id="test_user_123",
        username="testuser",
        email="test@example.com",
        roles=["user"],
        permissions=["read", "write"],
    )


@pytest.fixture
def mock_api_key_data():
    """Mock API key data."""
    return {
        "id": "key_123",
        "user_id": "test_user_123",
        "name": "Test API Key",
        "scopes": ["read", "write"],
        "created_at": datetime.now(UTC).isoformat(),
        "expires_at": None,
        "description": "Test description",
        "last_used_at": None,
        "is_active": True,
    }


class TestAPIKeyRouterFunctions:
    """Test API key router functions directly."""

    @pytest.mark.asyncio
    async def test_create_api_key_success(self, mock_user):
        """Test successful API key creation."""
        with patch("dotmac.platform.auth.api_keys_router._enhanced_create_api_key") as mock_create:
            mock_create.return_value = ("sk_test123456789", "key_123")

            request = APIKeyCreateRequest(
                name="Test API Key", scopes=["read", "write"], description="Test description"
            )

            result = await create_api_key(request, mock_user)

            assert result.name == "Test API Key"
            assert result.scopes == ["read", "write"]
            assert result.description == "Test description"
            assert result.api_key == "sk_test123456789"
            assert result.id == "key_123"
            assert "sk_" in result.key_preview

    @pytest.mark.asyncio
    async def test_create_api_key_exception(self, mock_user):
        """Test API key creation with exception."""
        with patch("dotmac.platform.auth.api_keys_router._enhanced_create_api_key") as mock_create:
            mock_create.side_effect = Exception("Redis error")

            request = APIKeyCreateRequest(name="Test API Key", scopes=["read"])

            with pytest.raises(Exception) as exc_info:
                await create_api_key(request, mock_user)

            assert "Failed to create API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_api_keys_success(self, mock_user, mock_api_key_data):
        """Test successful API key listing."""
        mock_keys = [mock_api_key_data.copy()]

        with patch(
            "dotmac.platform.auth.api_keys_router._list_user_api_keys", return_value=mock_keys
        ):
            result = await list_api_keys(page=1, limit=50, current_user=mock_user)

            assert result.total == 1
            assert len(result.api_keys) == 1
            assert result.api_keys[0].name == "Test API Key"
            assert result.page == 1
            assert result.limit == 50

    @pytest.mark.asyncio
    async def test_list_api_keys_pagination(self, mock_user):
        """Test API key listing with pagination."""
        # Create 10 mock keys
        mock_keys = []
        for i in range(10):
            key_data = {
                "id": f"key_{i}",
                "user_id": "test_user_123",
                "name": f"Test Key {i}",
                "scopes": ["read"],
                "created_at": datetime.now(UTC).isoformat(),
                "is_active": True,
            }
            mock_keys.append(key_data)

        with patch(
            "dotmac.platform.auth.api_keys_router._list_user_api_keys", return_value=mock_keys
        ):
            result = await list_api_keys(page=2, limit=3, current_user=mock_user)

            assert result.total == 10
            assert len(result.api_keys) == 3  # Pagination limit
            assert result.page == 2
            assert result.limit == 3

    @pytest.mark.asyncio
    async def test_list_api_keys_exception(self, mock_user):
        """Test API key listing with exception."""
        with patch("dotmac.platform.auth.api_keys_router._list_user_api_keys") as mock_list:
            mock_list.side_effect = Exception("Redis error")

            with pytest.raises(Exception) as exc_info:
                await list_api_keys(current_user=mock_user)

            assert "Failed to list API keys" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_api_key_success(self, mock_user, mock_api_key_data):
        """Test successful API key retrieval."""
        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            return_value=mock_api_key_data,
        ):
            result = await get_api_key(key_id="key_123", current_user=mock_user)

            assert result.id == "key_123"
            assert result.name == "Test API Key"
            assert result.scopes == ["read", "write"]

    @pytest.mark.asyncio
    async def test_get_api_key_not_found(self, mock_user):
        """Test API key retrieval when key not found."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id", return_value=None):
            with pytest.raises(Exception) as exc_info:
                await get_api_key(key_id="nonexistent", current_user=mock_user)

            assert "API key not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_api_key_wrong_user(self, mock_user, mock_api_key_data):
        """Test API key retrieval for wrong user."""
        wrong_key_data = mock_api_key_data.copy()
        wrong_key_data["user_id"] = "other_user"

        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id", return_value=wrong_key_data
        ):
            with pytest.raises(Exception) as exc_info:
                await get_api_key(key_id="key_123", current_user=mock_user)

            assert "API key not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_api_key_success(self, mock_user, mock_api_key_data):
        """Test successful API key update."""
        updated_data = mock_api_key_data.copy()
        updated_data["name"] = "Updated Name"

        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            side_effect=[mock_api_key_data, updated_data],
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._update_api_key_metadata", return_value=True
            ):
                request = APIKeyUpdateRequest(name="Updated Name")
                result = await update_api_key(
                    key_id="key_123", request=request, current_user=mock_user
                )

                assert result.name == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_api_key_not_found(self, mock_user):
        """Test API key update when key not found."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id", return_value=None):
            request = APIKeyUpdateRequest(name="Updated Name")

            with pytest.raises(Exception) as exc_info:
                await update_api_key(key_id="nonexistent", request=request, current_user=mock_user)

            assert "API key not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_api_key_failed(self, mock_user, mock_api_key_data):
        """Test API key update when update fails."""
        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            return_value=mock_api_key_data,
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._update_api_key_metadata", return_value=False
            ):
                request = APIKeyUpdateRequest(name="Updated Name")

                with pytest.raises(Exception) as exc_info:
                    await update_api_key(key_id="key_123", request=request, current_user=mock_user)

                assert "Failed to update API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_revoke_api_key_success(self, mock_user, mock_api_key_data):
        """Test successful API key revocation."""
        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            return_value=mock_api_key_data,
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._revoke_api_key_by_id", return_value=True
            ):
                # Should not raise exception
                await revoke_api_key(key_id="key_123", current_user=mock_user)

    @pytest.mark.asyncio
    async def test_revoke_api_key_not_found(self, mock_user):
        """Test API key revocation when key not found."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id", return_value=None):
            with pytest.raises(Exception) as exc_info:
                await revoke_api_key(key_id="nonexistent", current_user=mock_user)

            assert "API key not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_revoke_api_key_failed(self, mock_user, mock_api_key_data):
        """Test API key revocation when revocation fails."""
        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            return_value=mock_api_key_data,
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._revoke_api_key_by_id", return_value=False
            ):
                with pytest.raises(Exception) as exc_info:
                    await revoke_api_key(key_id="key_123", current_user=mock_user)

                assert "Failed to revoke API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_available_scopes(self, mock_user):
        """Test getting available scopes."""
        result = await get_available_scopes(current_user=mock_user)

        assert "scopes" in result
        assert "read" in result["scopes"]
        assert "write" in result["scopes"]


class TestAPIKeyServiceFunctions:
    """Test internal API key service functions."""

    @pytest.mark.asyncio
    async def test_enhanced_create_api_key_redis(self):
        """Test enhanced API key creation with Redis."""
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock()

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service.create_api_key = AsyncMock(return_value="sk_test123")
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service._serialize = lambda x: json.dumps(x)

            api_key, key_id = await _enhanced_create_api_key(
                user_id="user123", name="Test Key", scopes=["read"], description="Test"
            )

            assert api_key == "sk_test123"
            assert key_id is not None
            mock_redis.set.assert_called()

    @pytest.mark.asyncio
    async def test_enhanced_create_api_key_memory_fallback(self):
        """Test enhanced API key creation with memory fallback."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service.create_api_key = AsyncMock(return_value="sk_test123")
            mock_service._get_redis = AsyncMock(return_value=None)

            api_key, key_id = await _enhanced_create_api_key(
                user_id="user123", name="Test Key", scopes=["read"]
            )

            assert api_key == "sk_test123"
            assert key_id is not None
            assert hasattr(mock_service, "_memory_meta")
            assert hasattr(mock_service, "_memory_lookup")

    @pytest.mark.asyncio
    async def test_list_user_api_keys_memory_fallback(self):
        """Test listing user API keys with memory fallback."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_meta = {
                "key1": {"user_id": "user123", "name": "Key 1"},
                "key2": {"user_id": "user456", "name": "Key 2"},
                "key3": {"user_id": "user123", "name": "Key 3"},
            }

            keys = await _list_user_api_keys("user123")

            assert len(keys) == 2
            assert all(key["user_id"] == "user123" for key in keys)

    @pytest.mark.asyncio
    async def test_get_api_key_by_id_redis(self):
        """Test getting API key by ID with Redis."""
        mock_redis = AsyncMock()
        key_data = {"id": "key123", "name": "Test Key"}
        mock_redis.get.return_value = json.dumps(key_data)

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service._deserialize = json.loads

            result = await _get_api_key_by_id("key123")

            assert result == key_data
            mock_redis.get.assert_called_with("api_key_meta:key123")

    @pytest.mark.asyncio
    async def test_get_api_key_by_id_memory_fallback(self):
        """Test getting API key by ID with memory fallback."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            key_data = {"id": "key123", "name": "Test Key"}
            mock_service._memory_meta = {"key123": key_data}

            result = await _get_api_key_by_id("key123")

            assert result == key_data

    @pytest.mark.asyncio
    async def test_update_api_key_metadata_redis(self):
        """Test updating API key metadata with Redis."""
        mock_redis = AsyncMock()
        existing_data = {"name": "Old Name", "scopes": ["read"]}
        mock_redis.get.return_value = json.dumps(existing_data)
        mock_redis.set = AsyncMock()

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service._deserialize = json.loads
            mock_service._serialize = json.dumps

            result = await _update_api_key_metadata("key123", {"name": "New Name"})

            assert result is True
            mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_api_key_metadata_not_found(self):
        """Test updating API key metadata when key not found."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)

            result = await _update_api_key_metadata("nonexistent", {"name": "New Name"})

            assert result is False

    @pytest.mark.asyncio
    async def test_update_api_key_metadata_memory_fallback(self):
        """Test updating API key metadata with memory fallback."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_meta = {"key123": {"name": "Old Name"}}

            result = await _update_api_key_metadata("key123", {"name": "New Name"})

            assert result is True
            assert mock_service._memory_meta["key123"]["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_memory_fallback(self):
        """Test revoking API key by ID with memory fallback."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_lookup = {"sk_testkey": "key123"}
            mock_service._memory_meta = {"key123": {"name": "Test Key"}}
            mock_service.revoke_api_key = AsyncMock(return_value=True)

            result = await _revoke_api_key_by_id("key123")

            assert result is True
            mock_service.revoke_api_key.assert_called_with("sk_testkey")
            assert "sk_testkey" not in mock_service._memory_lookup
            assert "key123" not in mock_service._memory_meta

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_not_found(self):
        """Test revoking API key by ID when key not found."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_lookup = {}

            result = await _revoke_api_key_by_id("nonexistent")

            assert result is False

    def test_mask_api_key_long(self):
        """Test API key masking for long keys."""
        long_key = "sk_1234567890abcdefghij"
        masked = _mask_api_key(long_key)
        assert masked == "sk_1234...ghij"

    def test_mask_api_key_short(self):
        """Test API key masking for short keys."""
        short_key = "sk_12345"
        masked = _mask_api_key(short_key)
        assert masked == "sk_1****"

    def test_mask_api_key_very_short(self):
        """Test API key masking for very short keys."""
        very_short_key = "sk_1"
        masked = _mask_api_key(very_short_key)
        assert masked == "sk_1****"


class TestAPIKeyDataModels:
    """Test API key data models."""

    def test_api_key_create_request_validation(self):
        """Test API key create request validation."""
        # Valid request
        request = APIKeyCreateRequest(
            name="Test Key", scopes=["read", "write"], description="Test description"
        )
        assert request.name == "Test Key"
        assert request.scopes == ["read", "write"]
        assert request.description == "Test description"

        # Request with defaults
        minimal_request = APIKeyCreateRequest(name="Minimal Key")
        assert minimal_request.name == "Minimal Key"
        assert minimal_request.scopes == []
        assert minimal_request.expires_at is None
        assert minimal_request.description is None

    def test_api_key_update_request_validation(self):
        """Test API key update request validation."""
        # Partial update
        request = APIKeyUpdateRequest(name="New Name")
        assert request.name == "New Name"
        assert request.scopes is None
        assert request.description is None
        assert request.is_active is None

        # Full update
        full_request = APIKeyUpdateRequest(
            name="Updated Name", scopes=["read"], description="Updated description", is_active=False
        )
        assert full_request.name == "Updated Name"
        assert full_request.scopes == ["read"]
        assert full_request.description == "Updated description"
        assert full_request.is_active is False


class TestAPIKeyServiceCoverage:
    """Test additional coverage for API key service functions."""

    @pytest.mark.asyncio
    async def test_enhanced_create_api_key_memory_initialization(self):
        """Test enhanced API key creation when memory attributes don't exist."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service.create_api_key = AsyncMock(return_value="sk_test123")
            mock_service._get_redis = AsyncMock(return_value=None)
            # Ensure memory attributes don't exist initially
            if hasattr(mock_service, "_memory_meta"):
                delattr(mock_service, "_memory_meta")
            if hasattr(mock_service, "_memory_lookup"):
                delattr(mock_service, "_memory_lookup")

            api_key, key_id = await _enhanced_create_api_key(
                user_id="user123", name="Test Key", scopes=["read"]
            )

            # Should create memory attributes
            assert hasattr(mock_service, "_memory_meta")
            assert hasattr(mock_service, "_memory_lookup")
            assert api_key == "sk_test123"

    @pytest.mark.asyncio
    async def test_list_user_api_keys_redis_with_scan(self):
        """Test listing user API keys with Redis scan_iter."""
        mock_redis = AsyncMock()

        # Create a proper async generator for scan_iter
        async def mock_scan_iter(**kwargs):
            keys = ["api_key_meta:key1", "api_key_meta:key2"]
            for key in keys:
                yield key

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get.side_effect = [
            json.dumps({"user_id": "user123", "name": "Key 1"}),
            json.dumps({"user_id": "user456", "name": "Key 2"}),
        ]

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service._deserialize = json.loads

            keys = await _list_user_api_keys("user123")

            # Should only return keys for the specified user
            assert len(keys) == 1
            assert keys[0]["user_id"] == "user123"

    @pytest.mark.asyncio
    async def test_list_user_api_keys_redis_with_none_data(self):
        """Test listing user API keys when Redis returns None."""
        mock_redis = AsyncMock()

        async def mock_scan_iter(**kwargs):
            yield "api_key_meta:key1"

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get.return_value = None

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)

            keys = await _list_user_api_keys("user123")

            assert keys == []

    @pytest.mark.asyncio
    async def test_get_api_key_by_id_redis_not_found(self):
        """Test getting API key by ID when not found in Redis."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)

            result = await _get_api_key_by_id("nonexistent")

            assert result is None

    @pytest.mark.asyncio
    async def test_get_api_key_by_id_memory_not_found(self):
        """Test getting API key by ID when not found in memory."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_meta = {}

            result = await _get_api_key_by_id("nonexistent")

            assert result is None

    @pytest.mark.asyncio
    async def test_update_api_key_metadata_memory_not_found(self):
        """Test updating API key metadata when not found in memory."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_meta = {}

            result = await _update_api_key_metadata("nonexistent", {"name": "New Name"})

            assert result is False

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_redis_with_scan(self):
        """Test revoking API key by ID with Redis scan_iter."""
        mock_redis = AsyncMock()

        # Create proper async generator
        async def mock_scan_iter(**kwargs):
            yield "api_key_lookup:sk_testkey"

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get.return_value = "key123"
        mock_redis.delete = AsyncMock()

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service.revoke_api_key = AsyncMock(return_value=True)

            result = await _revoke_api_key_by_id("key123")

            assert result is True
            mock_service.revoke_api_key.assert_called_with("sk_testkey")

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_redis_scan_not_found(self):
        """Test revoking API key by ID when scan doesn't find the key."""
        mock_redis = AsyncMock()

        # Empty scan result
        async def mock_scan_iter(**kwargs):
            return
            yield  # Never reached

        mock_redis.scan_iter = mock_scan_iter

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)

            result = await _revoke_api_key_by_id("nonexistent")

            assert result is False

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_revoke_failed(self):
        """Test revoking API key when the actual revocation fails."""
        mock_redis = AsyncMock()

        async def mock_scan_iter(**kwargs):
            yield "api_key_lookup:sk_testkey"

        mock_redis.scan_iter = mock_scan_iter
        mock_redis.get.return_value = "key123"

        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=mock_redis)
            mock_service.revoke_api_key = AsyncMock(return_value=False)

            result = await _revoke_api_key_by_id("key123")

            assert result is False
            # Should not clean up metadata if revocation failed
            mock_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_revoke_api_key_by_id_memory_revoke_failed(self):
        """Test revoking API key with memory fallback when revocation fails."""
        with patch("dotmac.platform.auth.api_keys_router.api_key_service") as mock_service:
            mock_service._get_redis = AsyncMock(return_value=None)
            mock_service._memory_lookup = {"sk_testkey": "key123"}
            mock_service._memory_meta = {"key123": {"name": "Test Key"}}
            mock_service.revoke_api_key = AsyncMock(return_value=False)

            result = await _revoke_api_key_by_id("key123")

            assert result is False
            # Should not clean up memory if revocation failed
            assert "sk_testkey" in mock_service._memory_lookup
            assert "key123" in mock_service._memory_meta


class TestAPIKeyRouterExceptionCoverage:
    """Test exception handling in router functions."""

    @pytest.mark.asyncio
    async def test_get_api_key_generic_exception(self, mock_user):
        """Test get API key with generic exception (not HTTPException)."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id") as mock_get:
            mock_get.side_effect = Exception("Database error")

            with pytest.raises(Exception) as exc_info:
                await get_api_key(key_id="key123", current_user=mock_user)

            assert "Failed to get API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_api_key_generic_exception(self, mock_user):
        """Test update API key with generic exception (not HTTPException)."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id") as mock_get:
            mock_get.side_effect = Exception("Database error")

            request = APIKeyUpdateRequest(name="Updated Name")

            with pytest.raises(Exception) as exc_info:
                await update_api_key(key_id="key123", request=request, current_user=mock_user)

            assert "Failed to update API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_revoke_api_key_generic_exception(self, mock_user):
        """Test revoke API key with generic exception (not HTTPException)."""
        with patch("dotmac.platform.auth.api_keys_router._get_api_key_by_id") as mock_get:
            mock_get.side_effect = Exception("Database error")

            with pytest.raises(Exception) as exc_info:
                await revoke_api_key(key_id="key123", current_user=mock_user)

            assert "Failed to revoke API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_api_key_no_updates(self, mock_user):
        """Test update API key when no updates are provided."""
        mock_api_key_data = {
            "id": "key_123",
            "user_id": "test_user_123",
            "name": "Test API Key",
            "scopes": ["read", "write"],
            "created_at": datetime.now(UTC).isoformat(),
            "is_active": True,
        }

        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            return_value=mock_api_key_data,
        ):
            # Request with no actual updates (all None)
            request = APIKeyUpdateRequest()
            result = await update_api_key(key_id="key_123", request=request, current_user=mock_user)

            # Should still return the key data
            assert result.id == "key_123"
            assert result.name == "Test API Key"

    @pytest.mark.asyncio
    async def test_update_api_key_partial_updates(self, mock_user):
        """Test update API key with partial updates (only some fields)."""
        mock_api_key_data = {
            "id": "key_123",
            "user_id": "test_user_123",
            "name": "Test API Key",
            "scopes": ["read", "write"],
            "created_at": datetime.now(UTC).isoformat(),
            "is_active": True,
        }

        updated_data = mock_api_key_data.copy()
        updated_data["description"] = "New description"

        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            side_effect=[mock_api_key_data, updated_data],
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._update_api_key_metadata", return_value=True
            ) as mock_update:
                # Only update description
                request = APIKeyUpdateRequest(description="New description")
                result = await update_api_key(
                    key_id="key_123", request=request, current_user=mock_user
                )

                # Should have called update with only description
                mock_update.assert_called_with("key_123", {"description": "New description"})
                assert result.description == "New description"

    @pytest.mark.asyncio
    async def test_update_api_key_all_fields(self, mock_user):
        """Test update API key with all possible fields."""
        mock_api_key_data = {
            "id": "key_123",
            "user_id": "test_user_123",
            "name": "Test API Key",
            "scopes": ["read", "write"],
            "created_at": datetime.now(UTC).isoformat(),
            "is_active": True,
        }

        updated_data = mock_api_key_data.copy()
        updated_data.update(
            {
                "name": "Updated Name",
                "scopes": ["read"],
                "description": "Updated description",
                "is_active": False,
            }
        )

        with patch(
            "dotmac.platform.auth.api_keys_router._get_api_key_by_id",
            side_effect=[mock_api_key_data, updated_data],
        ):
            with patch(
                "dotmac.platform.auth.api_keys_router._update_api_key_metadata", return_value=True
            ) as mock_update:
                # Update all fields
                request = APIKeyUpdateRequest(
                    name="Updated Name",
                    scopes=["read"],
                    description="Updated description",
                    is_active=False,
                )
                result = await update_api_key(
                    key_id="key_123", request=request, current_user=mock_user
                )

                # Should have called update with all fields
                expected_updates = {
                    "name": "Updated Name",
                    "scopes": ["read"],
                    "description": "Updated description",
                    "is_active": False,
                }
                mock_update.assert_called_with("key_123", expected_updates)
                assert result.name == "Updated Name"
                assert result.is_active is False
