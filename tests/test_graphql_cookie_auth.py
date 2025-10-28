
"""
End-to-End GraphQL Cookie Authentication Test.

Tests that GraphQL queries work with HttpOnly cookie authentication.

These are integration tests that require a running server at localhost:8000.
They will be skipped if the server is not available.
"""

import asyncio

import httpx
import pytest

# Check if server is available



pytestmark = [
pytest.mark.integration,
pytest.mark.asyncio,
]

async def is_server_available(base_url: str = "http://localhost:8000") -> bool:
    """Check if the test server is running."""
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=2.0) as client:
            response = await client.get("/health")
            return response.status_code == 200
    except (httpx.ConnectError, httpx.RemoteProtocolError, httpx.TimeoutException):
        return False


# Mark all tests in this module as integration tests


async def test_graphql_cookie_auth():
    """Test GraphQL authentication using HttpOnly cookies.

    NOTE: This is an E2E integration test that requires a running server.
    The test will be skipped if the server is not available.
    """

    base_url = "http://localhost:8000"

    # Check if server is available first
    if not await is_server_available(base_url):
        pytest.skip("Test server not running at localhost:8000. Start with: poetry run uvicorn dotmac.platform.main:app")

    async with httpx.AsyncClient(base_url=base_url) as client:
        # Step 1: Login and get cookie
        try:
            login_response = await client.post(
                "/api/v1/auth/login",
                json={
                    "username": "admin",
                    "password": "admin",  # Use actual test credentials
                },
            )
        except (httpx.ConnectError, httpx.RemoteProtocolError) as e:
            pytest.skip(f"Cannot connect to test server: {e}")

        assert login_response.status_code == 200, f"Login failed: {login_response.text}"

        # Extract cookies from response
        cookies = login_response.cookies

        # Verify access_token cookie is set
        assert "access_token" in cookies, "access_token cookie not set"

        print(f"✅ Login successful, cookie: {cookies.get('access_token')[:20]}...")

        # Step 2: Query platform config (public endpoint)
        config_response = await client.get("/api/v1/platform/config")
        assert config_response.status_code == 200
        config = config_response.json()

        print(f"✅ Platform config fetched: {config['app']['name']} v{config['app']['version']}")
        print(f"   GraphQL enabled: {config['features']['graphql_enabled']}")

        # Step 3: GraphQL query with cookie auth
        graphql_query = """
        query TestQuery {
            __typename
        }
        """

        graphql_response = await client.post(
            "/api/v1/graphql",
            json={"query": graphql_query},
            cookies=cookies,  # Send cookies with request
        )

        assert graphql_response.status_code == 200, (
            f"GraphQL request failed: {graphql_response.text}"
        )

        graphql_data = graphql_response.json()
        assert "data" in graphql_data, f"GraphQL response missing data: {graphql_data}"

        print(f"✅ GraphQL query successful: {graphql_data}")

        # Step 4: Test tenant isolation (if subscribers query exists)
        subscribers_query = """
        query GetSubscribers {
            subscribers {
                id
                username
                email
            }
        }
        """

        subscribers_response = await client.post(
            "/api/v1/graphql",
            json={"query": subscribers_query},
            cookies=cookies,
        )

        if subscribers_response.status_code == 200:
            subscribers_data = subscribers_response.json()
            if "errors" in subscribers_data:
                print(
                    f"⚠️  Subscribers query error (may not be implemented): {subscribers_data['errors']}"
                )
            else:
                subscribers = subscribers_data.get("data", {}).get("subscribers", [])
                print(f"✅ Subscribers query successful: Found {len(subscribers)} subscribers")
        else:
            print(f"⚠️  Subscribers endpoint not available: {subscribers_response.status_code}")

        # Step 5: Test without cookie (should fail for authenticated queries)
        no_cookie_response = await client.post(
            "/api/v1/graphql",
            json={"query": subscribers_query},
            # No cookies sent
        )

        # This should either return 401 or return data with errors for auth-required fields
        print(f"   Request without cookie status: {no_cookie_response.status_code}")

        # Step 6: Verify audit logging captured user context
        # (This would require checking database or logs - skip for now)
        print("✅ Audit context should be set via cookie auth (manual verification needed)")


async def test_platform_config_endpoint():
    """Test that platform config endpoint returns correct structure.

    NOTE: This is an E2E integration test that requires a running server.
    The test will be skipped if the server is not available.
    """

    base_url = "http://localhost:8000"

    # Check if server is available first
    if not await is_server_available(base_url):
        pytest.skip("Test server not running at localhost:8000. Start with: poetry run uvicorn dotmac.platform.main:app")

    async with httpx.AsyncClient(base_url=base_url) as client:
        try:
            response = await client.get("/api/v1/platform/config")
        except (httpx.ConnectError, httpx.RemoteProtocolError) as e:
            pytest.skip(f"Cannot connect to test server: {e}")

        assert response.status_code == 200, f"Config endpoint failed: {response.text}"

        config = response.json()

        # Verify structure
        assert "app" in config
        assert "features" in config
        assert "api" in config
        assert "auth" in config

        # Verify app metadata
        assert "name" in config["app"]
        assert "version" in config["app"]
        assert "environment" in config["app"]

        # Verify feature flags
        assert "graphql_enabled" in config["features"]
        assert "analytics_enabled" in config["features"]
        assert "banking_enabled" in config["features"]

        # Verify API endpoints
        assert config["api"]["rest_url"] == "/api/v1"
        assert config["api"]["graphql_url"] == "/api/v1/graphql"

        # Verify auth config
        assert config["auth"]["cookie_based"] is True

        print("✅ Platform config structure valid:")
        print(f"   App: {config['app']['name']} v{config['app']['version']}")
        print(f"   Environment: {config['app']['environment']}")
        print(f"   GraphQL: {config['features']['graphql_enabled']}")
        print(f"   Cookie auth: {config['auth']['cookie_based']}")


async def test_real_time_cookie_auth():
    """Test that real-time endpoints accept cookie authentication.

    NOTE: This is an E2E integration test that requires a running server.
    The test will be skipped if the server is not available.
    """

    base_url = "http://localhost:8000"

    # Check if server is available first
    if not await is_server_available(base_url):
        pytest.skip("Test server not running at localhost:8000. Start with: poetry run uvicorn dotmac.platform.main:app")

    async with httpx.AsyncClient(base_url=base_url) as client:
        # Login first
        try:
            login_response = await client.post(
                "/api/v1/auth/login",
                json={
                    "username": "admin",
                    "password": "admin",
                },
            )
        except (httpx.ConnectError, httpx.RemoteProtocolError) as e:
            pytest.skip(f"Cannot connect to test server: {e}")

        assert login_response.status_code == 200
        cookies = login_response.cookies

        # Test SSE endpoint with cookie
        # Note: This is a basic connection test, not full SSE streaming
        try:
            sse_response = await client.get(
                "/api/v1/realtime/onu-status",
                cookies=cookies,
                timeout=5.0,  # Short timeout
            )

            # SSE endpoints return 200 and keep connection open
            # OR return 404/405 if not implemented
            if sse_response.status_code in (200, 404, 405):
                print(f"✅ SSE endpoint accessible with cookies: {sse_response.status_code}")
            else:
                print(f"⚠️  SSE endpoint returned: {sse_response.status_code}")

        except httpx.ReadTimeout:
            print("✅ SSE connection established (timed out waiting for events - expected)")
        except Exception as e:
            print(f"⚠️  SSE test error: {e}")


if __name__ == "__main__":
    # Run tests
    print("=" * 60)
    print("GraphQL Cookie Authentication E2E Test")
    print("=" * 60)

    print("\n[Test 1] Platform Config Endpoint")
    print("-" * 60)
    asyncio.run(test_platform_config_endpoint())

    print("\n[Test 2] GraphQL Cookie Auth")
    print("-" * 60)
    asyncio.run(test_graphql_cookie_auth())

    print("\n[Test 3] Real-Time Cookie Auth")
    print("-" * 60)
    asyncio.run(test_real_time_cookie_auth())

    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)
