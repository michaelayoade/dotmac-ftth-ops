"""
Unit tests for AWX Client

Tests AWX client functionality with RobustHTTPClient architecture.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from dotmac.platform.ansible.client import AWXClient


@pytest.fixture(autouse=True)
def reset_circuit_breaker():
    """Reset circuit breaker state before each test to prevent pollution"""
    from dotmac.platform.core.http_client import RobustHTTPClient

    RobustHTTPClient._circuit_breakers.clear()
    yield
    RobustHTTPClient._circuit_breakers.clear()


class TestAWXClientInitialization:
    """Test client initialization"""

    def test_client_initialization_with_explicit_params(self):
        """Test client initialization with explicit parameters"""
        client = AWXClient(
            base_url="http://awx.local",
            username="admin",
            password="secret",
        )

        assert client.base_url == "http://awx.local/"
        assert client.service_name == "awx"
        assert "api/v2/" in client.api_base
        # username/password are internal to RobustHTTPClient, test via auth
        assert client.auth == ("admin", "secret")

    def test_client_initialization_with_token(self):
        """Test client initialization with token"""
        client = AWXClient(
            base_url="http://awx.local",
            token="test-token-123",
        )

        assert client.base_url == "http://awx.local/"
        assert client.service_name == "awx"
        # Token is stored internally, verify it's set via headers
        assert "Authorization" in client.headers
        assert "Bearer test-token-123" in client.headers["Authorization"]

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
            with patch.dict(
                "os.environ",
                {
                    "AWX_URL": "http://awx:80",
                    "AWX_USERNAME": "admin",
                    "AWX_PASSWORD": "pass",
                },
            ):
                client = AWXClient()
                assert client.base_url == "http://awx:80/"
                assert client.auth == ("admin", "pass")

    def test_client_initialization_defaults_to_localhost(self):
        """Test client initialization defaults to localhost"""
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
            with patch.dict("os.environ", {}, clear=True):
                client = AWXClient()
                assert client.base_url == "http://localhost:80/"


class TestAWXJobTemplateOperations:
    """Test job template operations"""

    @pytest.mark.asyncio
    async def test_get_job_templates(self):
        """Test getting all job templates"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "results": [
                    {"id": 1, "name": "Provision Fiber"},
                    {"id": 2, "name": "Configure Router"},
                ]
            }

            result = await client.get_job_templates()

            assert len(result) == 2
            assert result[0]["name"] == "Provision Fiber"
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_job_template(self):
        """Test getting single job template by ID"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "id": 1,
                "name": "Provision Fiber",
                "description": "Provision fiber service",
            }

            result = await client.get_job_template(1)

            assert result is not None
            assert result["id"] == 1
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_job_template_not_found(self):
        """Test getting non-existent job template returns None"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = httpx.HTTPStatusError(
                "Not found", request=MagicMock(), response=MagicMock(status_code=404)
            )

            result = await client.get_job_template(999)

            assert result is None

    @pytest.mark.asyncio
    async def test_launch_job_template(self):
        """Test launching job template"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": 123, "status": "pending", "name": "Test Job"}

            extra_vars = {"vlan_id": 100, "speed_mbps": 1000}
            result = await client.launch_job_template(1, extra_vars)

            assert result["id"] == 123
            assert result["status"] == "pending"
            mock_req.assert_called_once()


class TestAWXJobOperations:
    """Test job operations"""

    @pytest.mark.asyncio
    async def test_get_jobs(self):
        """Test getting all jobs"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "results": [
                    {"id": 1, "status": "successful"},
                    {"id": 2, "status": "running"},
                ]
            }

            result = await client.get_jobs(limit=10)

            assert len(result) == 2
            assert result[0]["status"] == "successful"

    @pytest.mark.asyncio
    async def test_get_job(self):
        """Test getting single job by ID"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": 1, "status": "successful", "elapsed": 45.5}

            result = await client.get_job(1)

            assert result is not None
            assert result["status"] == "successful"

    @pytest.mark.asyncio
    async def test_cancel_job(self):
        """Test canceling job"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": 1, "status": "canceled"}

            result = await client.cancel_job(1)

            assert result["status"] == "canceled"
            mock_req.assert_called_once()


class TestAWXInventoryOperations:
    """Test inventory operations"""

    @pytest.mark.asyncio
    async def test_get_inventories(self):
        """Test getting all inventories"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "results": [
                    {"id": 1, "name": "OLT Inventory"},
                    {"id": 2, "name": "Router Inventory"},
                ]
            }

            result = await client.get_inventories()

            assert len(result) == 2
            assert result[0]["name"] == "OLT Inventory"


class TestAWXHealthChecks:
    """Test health check operations"""

    @pytest.mark.asyncio
    async def test_ping_success(self):
        """Test successful ping"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"ping": "pong"}

            result = await client.ping()

            assert result is True

    @pytest.mark.asyncio
    async def test_ping_failure(self):
        """Test failed ping"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("Connection failed")

            result = await client.ping()

            assert result is False


class TestAWXErrorHandling:
    """Test error handling"""

    @pytest.mark.asyncio
    async def test_request_with_timeout(self):
        """Test request timeout handling"""
        import asyncio

        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = TimeoutError()

            with pytest.raises(asyncio.TimeoutError):
                await client.get_jobs()

    @pytest.mark.asyncio
    async def test_request_with_network_error(self):
        """Test network error handling"""
        client = AWXClient(base_url="http://awx:80")

        with patch.object(client, "_awx_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("Connection refused")

            with pytest.raises(Exception) as exc_info:
                await client.get_jobs()

            assert "Connection refused" in str(exc_info.value)

    def test_retry_configuration(self):
        """Test retry configuration is passed to RobustHTTPClient"""
        client = AWXClient(base_url="http://awx:80", max_retries=3)

        # Verify retry configuration is set (stored in parent class)
        assert client.max_retries == 3

        client_no_retry = AWXClient(base_url="http://awx:80", max_retries=0)
        assert client_no_retry.max_retries == 0


class TestAWXAuthentication:
    """Test authentication methods"""

    def test_basic_auth(self):
        """Test basic authentication setup"""
        client = AWXClient(base_url="http://awx:80", username="admin", password="secret")

        assert client.auth == ("admin", "secret")
        assert "Authorization" not in client.headers or "Bearer" not in client.headers.get(
            "Authorization", ""
        )

    def test_token_auth(self):
        """Test token authentication setup"""
        client = AWXClient(base_url="http://awx:80", token="test-token")

        assert client.auth is None
        assert client.headers["Authorization"] == "Bearer test-token"

    def test_token_takes_precedence(self):
        """Test that token takes precedence over username/password"""
        client = AWXClient(
            base_url="http://awx:80", username="admin", password="secret", token="test-token"
        )

        # Token should be used
        assert client.headers["Authorization"] == "Bearer test-token"
        # Basic auth should not be set when token is present
        assert client.auth is None
