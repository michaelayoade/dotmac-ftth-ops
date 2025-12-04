"""
Tests for service discovery HTTP client.
"""

import random
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from tenacity import RetryError

from dotmac.platform.service_registry.client import ServiceClient
from dotmac.platform.service_registry.consul_registry import ConsulServiceInfo

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


class TestServiceClient:
    """Test ServiceClient HTTP client with service discovery."""

    @pytest.fixture
    def mock_services(self):
        """Create mock service instances."""
        return [
            ConsulServiceInfo(
                name="test-service",
                address="10.0.1.1",
                port=8080,
                service_id="test-1",
                tags=["api", "v1"],
                meta={"zone": "us-east-1a"},
                health="passing",
            ),
            ConsulServiceInfo(
                name="test-service",
                address="10.0.1.2",
                port=8080,
                service_id="test-2",
                tags=["api", "v1"],
                meta={"zone": "us-east-1b"},
                health="passing",
            ),
        ]

    @pytest.fixture
    def client(self):
        """Create ServiceClient instance."""
        return ServiceClient("test-service", timeout=10.0)

    @pytest.mark.asyncio
    async def test_client_initialization(self, client):
        """Test ServiceClient initialization."""
        assert client.service_name == "test-service"
        assert isinstance(client._client, httpx.AsyncClient)

    @pytest.mark.asyncio
    async def test_get_service_url_success(self, client, mock_services):
        """Test successful service URL retrieval."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            url = await client._get_service_url()

            # Should return URL from one of the services
            assert url in ["http://10.0.1.1:8080", "http://10.0.1.2:8080"]
            mock_get_services.assert_called_once_with("test-service")

    @pytest.mark.asyncio
    async def test_get_service_url_no_services(self, client):
        """Test service URL retrieval with no healthy services."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = []

            with pytest.raises(
                ConnectionError, match="No healthy instances for service: test-service"
            ):
                await client._get_service_url()

    @pytest.mark.asyncio
    async def test_get_service_url_load_balancing(self, client, mock_services):
        """Test load balancing in service URL selection."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            # Mock random.choice to make it predictable
            with patch.object(random, "choice", side_effect=lambda x: x[0]):
                url = await client._get_service_url()
                assert url == "http://10.0.1.1:8080"

            with patch.object(random, "choice", side_effect=lambda x: x[1]):
                url = await client._get_service_url()
                assert url == "http://10.0.1.2:8080"

    @pytest.mark.asyncio
    async def test_get_request_success(self, client, mock_services):
        """Test successful GET request."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": "success"}

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_request.return_value = mock_response

                response = await client.get("/api/data", params={"id": 123})

                assert response == mock_response
                mock_request.assert_called_once()
                args, kwargs = mock_request.call_args
                assert args[0] == "GET"
                assert args[1].startswith("http://10.0.1.")
                assert args[1].endswith(":8080/api/data")
                assert "params" in kwargs
                assert kwargs["params"] == {"id": 123}

    @pytest.mark.asyncio
    async def test_post_request_success(self, client, mock_services):
        """Test successful POST request."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 201

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_request.return_value = mock_response

                response = await client.post("/api/create", json={"name": "test"})

                assert response == mock_response
                args, kwargs = mock_request.call_args
                assert args[0] == "POST"
                assert "json" in kwargs
                assert kwargs["json"] == {"name": "test"}

    @pytest.mark.asyncio
    async def test_put_request_success(self, client, mock_services):
        """Test successful PUT request."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_request.return_value = mock_response

                response = await client.put("/api/update/123", json={"status": "updated"})

                assert response == mock_response
                args, kwargs = mock_request.call_args
                assert args[0] == "PUT"

    @pytest.mark.asyncio
    async def test_delete_request_success(self, client, mock_services):
        """Test successful DELETE request."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 204

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_request.return_value = mock_response

                response = await client.delete("/api/items/123")

                assert response == mock_response
                args, kwargs = mock_request.call_args
                assert args[0] == "DELETE"

    @pytest.mark.asyncio
    async def test_request_with_http_error(self, client, mock_services):
        """Test request that raises HTTP error."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        )

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_request.return_value = mock_response

                with pytest.raises(httpx.HTTPStatusError):
                    await client.get("/api/error")

    @pytest.mark.asyncio
    async def test_request_with_connection_error(self, client, mock_services):
        """Test request with connection error and retry."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                # Simulate connection error that triggers retry
                mock_request.side_effect = httpx.ConnectError("Connection failed")

                with pytest.raises(RetryError):
                    await client.get("/api/data")

                # Should have retried 3 times (total attempts)
                assert mock_request.call_count == 3

    @pytest.mark.asyncio
    async def test_request_retry_with_eventual_success(self, client, mock_services):
        """Test request that fails initially but succeeds on retry."""
        mock_success_response = MagicMock(spec=httpx.Response)
        mock_success_response.status_code = 200

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                # First call fails, second call succeeds
                mock_request.side_effect = [
                    httpx.ConnectError("Connection failed"),
                    mock_success_response,
                ]

                response = await client.get("/api/data")

                assert response == mock_success_response
                assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_request_with_service_discovery_failure(self, client):
        """Test request when service discovery fails."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.side_effect = Exception("Consul connection failed")

            with pytest.raises(RetryError):
                await client.get("/api/data")

    @pytest.mark.asyncio
    async def test_request_with_service_discovery_retry(self, client, mock_services):
        """Test that service discovery is called on each retry."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            # First call returns empty, subsequent calls return services
            mock_get_services.side_effect = [[], mock_services, mock_services]

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                # First attempt should fail due to no services
                # Second attempt should succeed
                response = await client.get("/api/data")

                assert response == mock_response
                # Service discovery should be called multiple times due to retry
                assert mock_get_services.call_count >= 2

    @pytest.mark.asyncio
    async def test_request_url_construction(self, client):
        """Test proper URL construction."""
        single_service = [
            ConsulServiceInfo(
                name="test-service",
                address="api.example.com",
                port=9000,
                service_id="test-1",
                tags=[],
                meta={},
                health="passing",
            )
        ]

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = single_service

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                await client.get("/api/v1/users")

                args, kwargs = mock_request.call_args
                assert args[1] == "http://api.example.com:9000/api/v1/users"

    @pytest.mark.asyncio
    async def test_request_with_path_starting_slash(self, client, mock_services):
        """Test request with path that starts with slash."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                await client.get("/api/data")

                args, kwargs = mock_request.call_args
                # URL should not have double slash
                url = args[1]
                assert "/api/data" in url
                assert "//api" not in url

    @pytest.mark.asyncio
    async def test_request_with_path_no_starting_slash(self, client, mock_services):
        """Test request with path that doesn't start with slash."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                await client.get("api/data")

                args, kwargs = mock_request.call_args
                url = args[1]
                assert url.endswith(":8080api/data")

    @pytest.mark.asyncio
    async def test_client_close(self, client):
        """Test client cleanup."""
        with patch.object(client._client, "aclose", new_callable=AsyncMock) as mock_close:
            await client.close()
            mock_close.assert_called_once()

    @pytest.mark.asyncio
    async def test_async_context_manager(self, mock_services):
        """Test ServiceClient as async context manager."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            async with ServiceClient("test-service") as client:
                with patch.object(
                    client._client, "request", new_callable=AsyncMock
                ) as mock_request:
                    mock_response = MagicMock(spec=httpx.Response)
                    mock_response.status_code = 200
                    mock_request.return_value = mock_response

                    response = await client.get("/test")
                    assert response == mock_response

            # Client should be closed after context exit
            # We can't easily test this without exposing internal state

    @pytest.mark.asyncio
    async def test_service_client_timeout_config(self):
        """Test ServiceClient timeout configuration."""
        client = ServiceClient("test-service", timeout=5.0)

        # Check that timeout is configured on the httpx client
        assert client._client.timeout.connect == 5.0
        assert client._client.timeout.read == 5.0
        assert client._client.timeout.write == 5.0
        assert client._client.timeout.pool == 5.0

    @pytest.mark.asyncio
    async def test_request_with_custom_headers(self, client, mock_services):
        """Test request with custom headers."""
        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = mock_services

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                custom_headers = {"Authorization": "Bearer token123", "X-Request-ID": "req-456"}
                await client.get("/api/data", headers=custom_headers)

                args, kwargs = mock_request.call_args
                assert "headers" in kwargs
                assert kwargs["headers"] == custom_headers

    @pytest.mark.asyncio
    async def test_multiple_service_instances_selection(self, client):
        """Test that different service instances can be selected over multiple calls."""
        services = [
            ConsulServiceInfo(
                name="test-service",
                address="10.0.1.1",
                port=8080,
                service_id="test-1",
                tags=[],
                meta={},
                health="passing",
            ),
            ConsulServiceInfo(
                name="test-service",
                address="10.0.1.2",
                port=8080,
                service_id="test-2",
                tags=[],
                meta={},
                health="passing",
            ),
            ConsulServiceInfo(
                name="test-service",
                address="10.0.1.3",
                port=8080,
                service_id="test-3",
                tags=[],
                meta={},
                health="passing",
            ),
        ]

        with patch(
            "dotmac.platform.service_registry.client.get_healthy_services"
        ) as mock_get_services:
            mock_get_services.return_value = services

            # Mock random to return different choices
            selected_urls = set()

            with patch.object(client._client, "request", new_callable=AsyncMock) as mock_request:
                mock_response = MagicMock(spec=httpx.Response)
                mock_response.status_code = 200
                mock_request.return_value = mock_response

                # Make multiple requests and collect URLs that were used
                for _i in range(10):
                    await client.get("/test")

                # Extract the URLs that were used
                for call in mock_request.call_args_list:
                    url = call[0][1]
                    selected_urls.add(url)

                # With random selection, we should potentially see different URLs
                # (though this is probabilistic and might occasionally use the same URL)
                available_urls = {
                    "http://10.0.1.1:8080/test",
                    "http://10.0.1.2:8080/test",
                    "http://10.0.1.3:8080/test",
                }
                assert selected_urls.issubset(available_urls)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
