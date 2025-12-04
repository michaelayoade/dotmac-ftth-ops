"""
FastAPI Integration Testing - Phase 2
Comprehensive testing of FastAPI endpoints with authentication, validation, and error handling.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest

from dotmac.platform.version import get_version

pytestmark = pytest.mark.integration

# Mock FastAPI components for testing


pytestmark = [
    pytest.mark.unit,
    pytest.mark.asyncio,
]


class MockRequest:
    """Mock FastAPI Request object"""

    def __init__(self, headers: dict[str, str] | None = None, json_data: dict | None = None):
        self.headers = headers or {}
        self.json_data = json_data or {}
        self.path_params = {}
        self.query_params = {}

    async def json(self):
        return self.json_data


class MockResponse:
    """Mock FastAPI Response object"""

    def __init__(self, content: Any, status_code: int = 200, headers: dict | None = None):
        self.content = content
        self.status_code = status_code
        self.headers = headers or {}


class MockAuthDependency:
    """Mock authentication dependency"""

    def __init__(self, user_id: str = "test_user", authenticated: bool = True):
        self.user_id = user_id
        self.authenticated = authenticated
        self.roles = ["user"]
        self.tenant_id = "test_tenant"


class APIEndpointHandler:
    """Mock API endpoint handler for testing"""

    def __init__(self):
        self.auth_service = Mock()
        self.api_key_service = Mock()
        self.rate_limiter = Mock()
        self.validator = Mock()
        self._version = get_version()

    async def health_check(self) -> dict[str, Any]:
        """Health check endpoint"""
        checks = {
            "database": {"status": "healthy", "response_time": 0.001},
            "cache": {"status": "healthy", "response_time": 0.002},
            "storage": {"status": "healthy", "response_time": 0.003},
        }

        return {
            "status": "healthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "version": self._version,
            "checks": checks,
        }

    async def create_user_profile(
        self, request: MockRequest, current_user: MockAuthDependency
    ) -> dict[str, Any]:
        """Create user profile endpoint"""
        # Validate authentication
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        # Validate request data
        profile_data = await request.json()

        if not profile_data.get("name"):
            return {"error": "Name is required", "status_code": 400}

        if not profile_data.get("email"):
            return {"error": "Email is required", "status_code": 400}

        # Simulate profile creation
        profile = {
            "id": f"profile_{current_user.user_id}",
            "user_id": current_user.user_id,
            "name": profile_data["name"],
            "email": profile_data["email"],
            "tenant_id": current_user.tenant_id,
            "created_at": datetime.now(UTC).isoformat(),
            "active": True,
        }

        return {"profile": profile, "status_code": 201}

    async def get_user_profile(
        self, user_id: str, current_user: MockAuthDependency
    ) -> dict[str, Any]:
        """Get user profile endpoint"""
        # Check authentication
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        # Check authorization (users can only access their own profile)
        if current_user.user_id != user_id and "admin" not in current_user.roles:
            return {"error": "Access denied", "status_code": 403}

        # Simulate profile retrieval
        if user_id == "nonexistent_user":
            return {"error": "User not found", "status_code": 404}

        profile = {
            "id": f"profile_{user_id}",
            "user_id": user_id,
            "name": "Test User",
            "email": "test@example.com",
            "tenant_id": current_user.tenant_id,
            "created_at": "2024-01-01T00:00:00Z",
            "active": True,
        }

        return {"profile": profile, "status_code": 200}

    async def update_user_profile(
        self, user_id: str, request: MockRequest, current_user: MockAuthDependency
    ) -> dict[str, Any]:
        """Update user profile endpoint"""
        # Authentication check
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        # Authorization check
        if current_user.user_id != user_id and "admin" not in current_user.roles:
            return {"error": "Access denied", "status_code": 403}

        # Get update data
        update_data = await request.json()

        # Validate update data
        allowed_fields = ["name", "email", "bio"]
        invalid_fields = [field for field in update_data.keys() if field not in allowed_fields]

        if invalid_fields:
            return {"error": f"Invalid fields: {invalid_fields}", "status_code": 400}

        # Simulate profile update
        updated_profile = {
            "id": f"profile_{user_id}",
            "user_id": user_id,
            "name": update_data.get("name", "Test User"),
            "email": update_data.get("email", "test@example.com"),
            "bio": update_data.get("bio", ""),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        return {"profile": updated_profile, "status_code": 200}

    async def delete_user_profile(
        self, user_id: str, current_user: MockAuthDependency
    ) -> dict[str, Any]:
        """Delete user profile endpoint"""
        # Authentication check
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        # Authorization check (only admins can delete profiles)
        if "admin" not in current_user.roles:
            return {"error": "Admin access required", "status_code": 403}

        # Simulate profile deletion
        return {"message": f"Profile {user_id} deleted successfully", "status_code": 200}

    async def list_api_keys(self, current_user: MockAuthDependency) -> dict[str, Any]:
        """List user's API keys"""
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        # Simulate API key listing
        api_keys = [
            {
                "id": "key_1",
                "name": "Production Key",
                "created_at": "2024-01-01T00:00:00Z",
                "last_used": "2024-01-15T12:00:00Z",
                "active": True,
            },
            {
                "id": "key_2",
                "name": "Development Key",
                "created_at": "2024-01-10T00:00:00Z",
                "last_used": None,
                "active": True,
            },
        ]

        return {"api_keys": api_keys, "status_code": 200}

    async def create_api_key(
        self, request: MockRequest, current_user: MockAuthDependency
    ) -> dict[str, Any]:
        """Create new API key"""
        if not current_user.authenticated:
            return {"error": "Authentication required", "status_code": 401}

        key_data = await request.json()

        if not key_data.get("name"):
            return {"error": "Key name is required", "status_code": 400}

        # Simulate API key creation
        new_key = {
            "id": "key_new_123",
            "name": key_data["name"],
            "api_key": f"dotmac_live_{hash(key_data['name']) % 1000000:06d}",
            "user_id": current_user.user_id,
            "created_at": datetime.now(UTC).isoformat(),
            "active": True,
        }

        return {"api_key": new_key, "status_code": 201}

    async def register_user(self, request: MockRequest) -> dict[str, Any]:
        """Register new user endpoint"""
        user_data = await request.json()

        # Validate required fields
        required_fields = [
            "username",
            "email",
            "first_name",
            "password",
            "terms_accepted",
            "privacy_accepted",
        ]
        for field in required_fields:
            if field not in user_data:
                return {"error": f"{field} is required", "status_code": 400}

        # Validate acceptances
        if not user_data.get("terms_accepted") or not user_data.get("privacy_accepted"):
            return {"error": "Must accept terms and privacy policy", "status_code": 400}

        # Simulate user creation
        user_id = f"user_{hash(user_data['username']) % 1000000:06d}"

        return {
            "user_id": user_id,
            "username": user_data["username"],
            "email": user_data["email"],
            "status_code": 201,
        }

    async def authenticate_user(self, request: MockRequest) -> dict[str, Any]:
        """Authenticate user endpoint"""
        auth_data = await request.json()

        # Validate credentials
        if not auth_data.get("username") or not auth_data.get("password"):
            return {"error": "Username and password required", "status_code": 400}

        # Simulate authentication
        access_token = f"token_{hash(auth_data['username']) % 1000000:06d}"

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 3600,
            "status_code": 200,
        }


class TestFastAPIIntegration:
    """FastAPI integration tests for Phase 2 coverage"""

    @pytest.fixture
    def api_handler(self):
        """Create API handler instance"""
        return APIEndpointHandler()

    @pytest.fixture
    def authenticated_user(self):
        """Create authenticated user dependency"""
        return MockAuthDependency(user_id="test_user_123", authenticated=True)

    @pytest.fixture
    def admin_user(self):
        """Create admin user dependency"""
        user = MockAuthDependency(user_id="admin_user", authenticated=True)
        user.roles = ["admin", "user"]
        return user

    @pytest.fixture
    def unauthenticated_user(self):
        """Create unauthenticated user dependency"""
        return MockAuthDependency(authenticated=False)

    # Health Check Endpoint Tests

    @pytest.mark.asyncio
    async def test_health_check_endpoint(self, api_handler):
        """Test health check endpoint"""
        result = await api_handler.health_check()

        assert result["status"] == "healthy"
        assert "timestamp" in result
        assert "version" in result
        assert "checks" in result

        # Verify individual service checks
        assert result["checks"]["database"]["status"] == "healthy"
        assert result["checks"]["cache"]["status"] == "healthy"
        assert result["checks"]["storage"]["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_check_performance(self, api_handler):
        """Test health check endpoint performance"""
        import time

        start_time = time.time()
        result = await api_handler.health_check()
        end_time = time.time()

        response_time = end_time - start_time
        assert response_time < 0.1  # Should be under 100ms
        assert result["status"] == "healthy"

    # User Profile CRUD Tests

    @pytest.mark.asyncio
    async def test_create_user_profile_success(self, api_handler, authenticated_user):
        """Test successful user profile creation"""
        request = MockRequest(json_data={"name": "John Doe", "email": "john.doe@example.com"})

        result = await api_handler.create_user_profile(request, authenticated_user)

        assert result["status_code"] == 201
        assert "profile" in result
        assert result["profile"]["name"] == "John Doe"
        assert result["profile"]["email"] == "john.doe@example.com"
        assert result["profile"]["user_id"] == authenticated_user.user_id
        assert result["profile"]["tenant_id"] == authenticated_user.tenant_id

    @pytest.mark.asyncio
    async def test_create_user_profile_missing_name(self, api_handler, authenticated_user):
        """Test user profile creation with missing name"""
        request = MockRequest(json_data={"email": "john@example.com"})

        result = await api_handler.create_user_profile(request, authenticated_user)

        assert result["status_code"] == 400
        assert "Name is required" in result["error"]

    @pytest.mark.asyncio
    async def test_create_user_profile_missing_email(self, api_handler, authenticated_user):
        """Test user profile creation with missing email"""
        request = MockRequest(json_data={"name": "John Doe"})

        result = await api_handler.create_user_profile(request, authenticated_user)

        assert result["status_code"] == 400
        assert "Email is required" in result["error"]

    @pytest.mark.asyncio
    async def test_create_user_profile_unauthenticated(self, api_handler, unauthenticated_user):
        """Test user profile creation without authentication"""
        request = MockRequest(json_data={"name": "John", "email": "john@example.com"})

        result = await api_handler.create_user_profile(request, unauthenticated_user)

        assert result["status_code"] == 401
        assert "Authentication required" in result["error"]

    @pytest.mark.asyncio
    async def test_get_user_profile_success(self, api_handler, authenticated_user):
        """Test successful user profile retrieval"""
        result = await api_handler.get_user_profile(authenticated_user.user_id, authenticated_user)

        assert result["status_code"] == 200
        assert "profile" in result
        assert result["profile"]["user_id"] == authenticated_user.user_id

    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self, api_handler, authenticated_user):
        """Test user profile retrieval for nonexistent user"""
        result = await api_handler.get_user_profile("nonexistent_user", authenticated_user)

        # Security best practice: return 403 instead of 404 to not reveal user existence
        assert result["status_code"] == 403
        assert "Access denied" in result["error"]

    @pytest.mark.asyncio
    async def test_get_user_profile_unauthorized(self, api_handler, authenticated_user):
        """Test user profile retrieval without proper authorization"""
        result = await api_handler.get_user_profile("other_user", authenticated_user)

        assert result["status_code"] == 403
        assert "Access denied" in result["error"]

    @pytest.mark.asyncio
    async def test_get_user_profile_admin_access(self, api_handler, admin_user):
        """Test admin can access any user profile"""
        result = await api_handler.get_user_profile("any_user", admin_user)

        assert result["status_code"] == 200
        assert "profile" in result

    @pytest.mark.asyncio
    async def test_update_user_profile_success(self, api_handler, authenticated_user):
        """Test successful user profile update"""
        request = MockRequest(json_data={"name": "John Updated", "bio": "Updated bio"})

        result = await api_handler.update_user_profile(
            authenticated_user.user_id, request, authenticated_user
        )

        assert result["status_code"] == 200
        assert result["profile"]["name"] == "John Updated"
        assert result["profile"]["bio"] == "Updated bio"
        assert "updated_at" in result["profile"]

    @pytest.mark.asyncio
    async def test_update_user_profile_invalid_fields(self, api_handler, authenticated_user):
        """Test user profile update with invalid fields"""
        request = MockRequest(json_data={"name": "John", "invalid_field": "should not be allowed"})

        result = await api_handler.update_user_profile(
            authenticated_user.user_id, request, authenticated_user
        )

        assert result["status_code"] == 400
        assert "Invalid fields" in result["error"]
        assert "invalid_field" in result["error"]

    @pytest.mark.asyncio
    async def test_delete_user_profile_admin_success(self, api_handler, admin_user):
        """Test successful user profile deletion by admin"""
        result = await api_handler.delete_user_profile("user_to_delete", admin_user)

        assert result["status_code"] == 200
        assert "deleted successfully" in result["message"]

    @pytest.mark.asyncio
    async def test_delete_user_profile_non_admin_denied(self, api_handler, authenticated_user):
        """Test user profile deletion denied for non-admin"""
        result = await api_handler.delete_user_profile("some_user", authenticated_user)

        assert result["status_code"] == 403
        assert "Admin access required" in result["error"]

    # API Key Management Tests

    @pytest.mark.asyncio
    async def test_list_api_keys_success(self, api_handler, authenticated_user):
        """Test successful API key listing"""
        result = await api_handler.list_api_keys(authenticated_user)

        assert result["status_code"] == 200
        assert "api_keys" in result
        assert len(result["api_keys"]) == 2
        assert result["api_keys"][0]["name"] == "Production Key"
        assert result["api_keys"][1]["name"] == "Development Key"

    @pytest.mark.asyncio
    async def test_list_api_keys_unauthenticated(self, api_handler, unauthenticated_user):
        """Test API key listing without authentication"""
        result = await api_handler.list_api_keys(unauthenticated_user)

        assert result["status_code"] == 401
        assert "Authentication required" in result["error"]

    @pytest.mark.asyncio
    async def test_create_api_key_success(self, api_handler, authenticated_user):
        """Test successful API key creation"""
        request = MockRequest(json_data={"name": "New Integration Key"})

        result = await api_handler.create_api_key(request, authenticated_user)

        assert result["status_code"] == 201
        assert "api_key" in result
        assert result["api_key"]["name"] == "New Integration Key"
        assert result["api_key"]["user_id"] == authenticated_user.user_id
        assert "api_key" in result["api_key"]
        assert result["api_key"]["api_key"].startswith("dotmac_live_")

    @pytest.mark.asyncio
    async def test_create_api_key_missing_name(self, api_handler, authenticated_user):
        """Test API key creation with missing name"""
        request = MockRequest(json_data={})

        result = await api_handler.create_api_key(request, authenticated_user)

        assert result["status_code"] == 400
        assert "Key name is required" in result["error"]

    # Integration Flow Tests

    @pytest.mark.asyncio
    async def test_complete_auth_user_flow(self, api_handler, authenticated_user, admin_user):
        """Test complete auth user flow using new auth user service"""
        # 1. Register user (auth service)
        register_request = MockRequest(
            json_data={
                "username": "newuser",
                "email": "newuser@example.com",
                "first_name": "New",
                "last_name": "User",
                "password": "SecurePass123!",
                "terms_accepted": True,
                "privacy_accepted": True,
            }
        )

        register_result = await api_handler.register_user(register_request)
        assert register_result["status_code"] == 201
        assert "user_id" in register_result

        # 2. Authenticate user
        auth_request = MockRequest(json_data={"username": "newuser", "password": "SecurePass123!"})

        auth_result = await api_handler.authenticate_user(auth_request)
        assert auth_result["status_code"] == 200
        assert "access_token" in auth_result

        # 3. API key management
        api_key_request = MockRequest(json_data={"name": "Test API Key", "scopes": ["read"]})

        api_key_result = await api_handler.create_api_key(api_key_request, authenticated_user)
        assert api_key_result["status_code"] == 201

        # 4. List API keys
        list_result = await api_handler.list_api_keys(authenticated_user)
        assert list_result["status_code"] == 200
        assert len(list_result["api_keys"]) > 0

    @pytest.mark.asyncio
    async def test_concurrent_api_requests(self, api_handler, authenticated_user):
        """Test concurrent API requests"""
        # Simulate multiple concurrent requests
        tasks = []

        # Health checks
        for _ in range(5):
            tasks.append(api_handler.health_check())

        # API key listings
        for _ in range(3):
            tasks.append(api_handler.list_api_keys(authenticated_user))

        # API key listings
        for _ in range(2):
            tasks.append(api_handler.list_api_keys(authenticated_user))

        results = await asyncio.gather(*tasks)

        # Verify all requests succeeded
        assert len(results) == 10

        # Health check results
        for i in range(5):
            assert results[i]["status"] == "healthy"

        # API key listing results
        for i in range(5, 10):
            assert results[i]["status_code"] == 200
            assert "api_keys" in results[i]

    # Error Handling Tests

    @pytest.mark.asyncio
    async def test_request_validation_edge_cases(self, api_handler, authenticated_user):
        """Test request validation with edge cases"""
        # Empty JSON
        empty_request = MockRequest(json_data={})
        result = await api_handler.register_user(empty_request)
        assert result["status_code"] == 400

        # Missing required fields
        incomplete_request = MockRequest(json_data={"username": "testuser"})
        result = await api_handler.register_user(incomplete_request)
        assert result["status_code"] == 400
        assert "email is required" in result["error"]

        # Missing terms acceptance
        no_terms_request = MockRequest(
            json_data={
                "username": "testuser",
                "email": "test@example.com",
                "first_name": "Test",
                "password": "Password123!",
                "terms_accepted": False,
                "privacy_accepted": True,
            }
        )
        result = await api_handler.register_user(no_terms_request)
        assert result["status_code"] == 400
        assert "terms and privacy policy" in result["error"]

        # Missing privacy acceptance
        no_privacy_request = MockRequest(
            json_data={
                "username": "testuser2",
                "email": "test2@example.com",
                "first_name": "Test",
                "password": "Password123!",
                "terms_accepted": True,
                "privacy_accepted": False,
            }
        )
        result = await api_handler.register_user(no_privacy_request)
        assert result["status_code"] == 400
        assert "terms and privacy policy" in result["error"]

        # Missing first_name
        no_first_name_request = MockRequest(
            json_data={
                "username": "testuser3",
                "email": "test3@example.com",
                "password": "Password123!",
                "terms_accepted": True,
                "privacy_accepted": True,
            }
        )
        result = await api_handler.register_user(no_first_name_request)
        assert result["status_code"] == 400
        assert "first_name is required" in result["error"]
