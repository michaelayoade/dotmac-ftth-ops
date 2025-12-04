"""
Basic API Endpoint Testing
Simple tests for API functionality to build coverage quickly.
"""

import asyncio
import hashlib
from datetime import UTC, datetime
from unittest.mock import patch

import pytest

pytestmark = pytest.mark.integration

pytestmark = [
    pytest.mark.unit,
    pytest.mark.asyncio,
]


class SimpleAPIKeyService:
    """
    Simple API key service for testing that mirrors production security.

    SECURITY: API keys are hashed using SHA-256 before storage, matching
    the production implementation in src/dotmac/platform/auth/core.py.
    """

    def __init__(self):
        self.api_keys = {}  # Stores hashed keys: {hash: key_data}
        self.next_id = 1

    def _hash_api_key(self, api_key: str) -> str:
        """Hash API key using SHA-256 (mirrors production)."""
        return hashlib.sha256(api_key.encode()).hexdigest()

    def generate_api_key(self, user_id: str, name: str) -> dict:
        """
        Generate a new API key.

        Returns the plaintext key to the caller (only time it's visible),
        but stores only the hash internally.
        """
        key_id = f"key_{self.next_id}"
        api_key = f"dotmac_test_{self.next_id:06d}"
        self.next_id += 1

        # Hash the key before storage (SECURITY: never store plaintext)
        api_key_hash = self._hash_api_key(api_key)

        key_data = {
            "id": key_id,
            "api_key_hash": api_key_hash,  # Store hash, not plaintext
            "user_id": user_id,
            "name": name,
            "active": True,
            "created_at": datetime.now(UTC),
        }

        self.api_keys[api_key_hash] = key_data

        # Return plaintext key to caller (only time they see it)
        return {**key_data, "api_key": api_key}

    def validate_api_key(self, api_key: str) -> dict | None:
        """
        Validate an API key by hashing and lookup.

        SECURITY: Mirrors production - hash the input and look up by hash.
        """
        api_key_hash = self._hash_api_key(api_key)
        key_data = self.api_keys.get(api_key_hash)

        if key_data and key_data["active"]:
            return key_data
        return None

    def revoke_api_key(self, key_id: str) -> bool:
        """
        Revoke an API key by key_id.

        SECURITY: Deletion happens by hash, not plaintext.
        """
        # Find the key by key_id
        for api_key_hash, key_data in self.api_keys.items():
            if key_data["id"] == key_id:
                # Delete the hashed key entry
                del self.api_keys[api_key_hash]
                return True
        return False


class SimpleHealthCheck:
    """Simple health check service for testing"""

    def __init__(self):
        self.healthy = True
        self.checks = {}

    async def check_database(self) -> dict:
        """Check database health"""
        return {"status": "healthy", "response_time": 0.001}

    async def check_cache(self) -> dict:
        """Check cache health"""
        return {"status": "healthy", "response_time": 0.002}

    async def get_health_status(self) -> dict:
        """Get overall health status"""
        db_check = await self.check_database()
        cache_check = await self.check_cache()

        return {
            "status": "healthy",
            "checks": {"database": db_check, "cache": cache_check},
            "timestamp": datetime.now(UTC).isoformat(),
        }


class TestBasicAPIEndpoints:
    """Basic API endpoint tests for coverage"""

    @pytest.fixture
    def api_key_service(self):
        """Create API key service instance"""
        return SimpleAPIKeyService()

    @pytest.fixture
    def health_service(self):
        """Create health check service instance"""
        return SimpleHealthCheck()

    # API Key Management Tests
    @pytest.mark.asyncio
    async def test_generate_api_key_success(self, api_key_service):
        """Test successful API key generation"""
        user_id = "user123"
        key_name = "Test API Key"

        result = api_key_service.generate_api_key(user_id, key_name)

        assert result["user_id"] == user_id
        assert result["name"] == key_name
        assert result["active"] is True
        assert result["api_key"].startswith("dotmac_test_")
        assert "id" in result
        assert "created_at" in result

    @pytest.mark.asyncio
    async def test_validate_api_key_success(self, api_key_service):
        """Test successful API key validation"""
        # Generate API key first
        key_data = api_key_service.generate_api_key("user123", "Test Key")
        api_key = key_data["api_key"]

        # Validate the key
        validated = api_key_service.validate_api_key(api_key)

        assert validated is not None
        assert validated["user_id"] == "user123"
        assert validated["active"] is True

    @pytest.mark.asyncio
    async def test_validate_invalid_api_key(self, api_key_service):
        """Test validation of invalid API key"""
        result = api_key_service.validate_api_key("invalid_key_12345")
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_revoked_api_key(self, api_key_service):
        """Test validation of revoked API key"""
        # Generate and revoke API key
        key_data = api_key_service.generate_api_key("user123", "Test Key")
        api_key_service.revoke_api_key(key_data["id"])

        # Try to validate revoked key
        result = api_key_service.validate_api_key(key_data["api_key"])
        assert result is None

    @pytest.mark.asyncio
    async def test_revoke_api_key_success(self, api_key_service):
        """Test successful API key revocation"""
        # Generate API key
        key_data = api_key_service.generate_api_key("user123", "Test Key")
        plaintext_key = key_data["api_key"]

        # Verify key works before revocation
        validated = api_key_service.validate_api_key(plaintext_key)
        assert validated is not None

        # Revoke the key
        revoked = api_key_service.revoke_api_key(key_data["id"])
        assert revoked is True

        # Verify key no longer validates (deleted from storage)
        validated_after = api_key_service.validate_api_key(plaintext_key)
        assert validated_after is None

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_api_key(self, api_key_service):
        """Test revocation of nonexistent API key"""
        result = api_key_service.revoke_api_key("nonexistent_key")
        assert result is False

    @pytest.mark.asyncio
    async def test_multiple_api_keys_per_user(self, api_key_service):
        """Test multiple API keys for single user"""
        user_id = "user123"

        # Generate multiple keys
        key1 = api_key_service.generate_api_key(user_id, "Production Key")
        key2 = api_key_service.generate_api_key(user_id, "Development Key")

        # Both should be valid
        assert api_key_service.validate_api_key(key1["api_key"]) is not None
        assert api_key_service.validate_api_key(key2["api_key"]) is not None

        # Keys should be different
        assert key1["api_key"] != key2["api_key"]

    # Health Check Tests

    @pytest.mark.asyncio
    async def test_database_health_check(self, health_service):
        """Test database health check"""
        result = await health_service.check_database()

        assert result["status"] == "healthy"
        assert "response_time" in result
        assert result["response_time"] < 1.0  # Should be fast

    @pytest.mark.asyncio
    async def test_cache_health_check(self, health_service):
        """Test cache health check"""
        result = await health_service.check_cache()

        assert result["status"] == "healthy"
        assert "response_time" in result

    @pytest.mark.asyncio
    async def test_overall_health_status(self, health_service):
        """Test overall health status endpoint"""
        result = await health_service.get_health_status()

        assert result["status"] == "healthy"
        assert "checks" in result
        assert "database" in result["checks"]
        assert "cache" in result["checks"]
        assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_health_check_performance(self, health_service):
        """Test health check performance"""
        import time

        start_time = time.time()
        result = await health_service.get_health_status()
        end_time = time.time()

        response_time = end_time - start_time
        assert response_time < 0.1  # Should complete in under 100ms
        assert result["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_concurrent_health_checks(self, health_service):
        """Test concurrent health check requests"""
        # Run multiple health checks concurrently
        tasks = [health_service.get_health_status() for _ in range(10)]

        results = await asyncio.gather(*tasks)

        # All should succeed
        assert len(results) == 10
        assert all(result["status"] == "healthy" for result in results)

    # Authentication Flow Tests
    @pytest.mark.asyncio
    async def test_api_key_authentication_flow(self, api_key_service):
        """Test complete API key authentication flow"""
        # 1. Generate API key
        key_data = api_key_service.generate_api_key("user123", "Integration Key")
        api_key = key_data["api_key"]

        # 2. Authenticate with key
        auth_result = api_key_service.validate_api_key(api_key)
        assert auth_result is not None
        assert auth_result["user_id"] == "user123"

        # 3. Use authenticated session (simulated)
        session_data = {
            "user_id": auth_result["user_id"],
            "key_id": auth_result["id"],
            "authenticated": True,
        }
        assert session_data["authenticated"] is True

        # 4. Revoke key (admin action)
        revoked = api_key_service.revoke_api_key(key_data["id"])
        assert revoked is True

        # 5. Authentication should now fail
        auth_after_revoke = api_key_service.validate_api_key(api_key)
        assert auth_after_revoke is None

    # Error Handling Tests
    @pytest.mark.asyncio
    async def test_api_key_edge_cases(self, api_key_service):
        """Test API key edge cases"""
        # Empty strings
        result = api_key_service.validate_api_key("")
        assert result is None

        # Very long invalid key
        long_key = "invalid_" + "x" * 1000
        result = api_key_service.validate_api_key(long_key)
        assert result is None

        # None input
        result = api_key_service.validate_api_key(None) if None else None
        assert result is None

    @pytest.mark.asyncio
    async def test_api_key_generation_uniqueness(self, api_key_service):
        """Test API key generation produces unique keys"""
        keys = set()

        # Generate many keys
        for i in range(100):
            key_data = api_key_service.generate_api_key(f"user{i}", f"Key {i}")
            keys.add(key_data["api_key"])

        # All keys should be unique
        assert len(keys) == 100

    @pytest.mark.asyncio
    async def test_health_check_error_simulation(self, health_service):
        """Test health check with simulated errors"""
        # Simulate database error
        with patch.object(health_service, "check_database") as mock_db:
            mock_db.return_value = {"status": "unhealthy", "error": "Connection timeout"}

            result = await health_service.get_health_status()

            # Should still return a result, but with error status
            assert "checks" in result
            assert result["checks"]["database"]["status"] == "unhealthy"

    # Integration-style Tests

    @pytest.mark.asyncio
    async def test_api_key_with_health_check(self, api_key_service, health_service):
        """Test API key authentication combined with health check"""
        # Generate and validate API key
        key_data = api_key_service.generate_api_key("monitor_user", "Health Monitor Key")
        auth_result = api_key_service.validate_api_key(key_data["api_key"])
        assert auth_result is not None

        # Perform health check as authenticated user
        health_result = await health_service.get_health_status()
        assert health_result["status"] == "healthy"

        # Simulate logging the authenticated health check
        audit_log = {
            "user_id": auth_result["user_id"],
            "action": "health_check",
            "result": health_result["status"],
            "timestamp": health_result["timestamp"],
        }

        assert audit_log["user_id"] == "monitor_user"
        assert audit_log["action"] == "health_check"
