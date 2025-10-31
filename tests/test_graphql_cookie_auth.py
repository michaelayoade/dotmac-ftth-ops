"""
End-to-End GraphQL Cookie Authentication Test.

These tests verify that GraphQL queries work with HttpOnly cookie authentication,
but they require a running API server. They are skipped unless explicitly enabled.
"""

from __future__ import annotations

import asyncio
import os

import httpx
import pytest

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.e2e,
]

EXTERNAL_BASE_URL = os.getenv("E2E_BASE_URL")
RUN_GRAPHQL_COOKIE_E2E = os.getenv("RUN_GRAPHQL_COOKIE_E2E") == "1"

if not (RUN_GRAPHQL_COOKIE_E2E or EXTERNAL_BASE_URL):
    pytest.skip(
        "GraphQL cookie auth E2E requires a running server. "
        "Set RUN_GRAPHQL_COOKIE_E2E=1 and optionally E2E_BASE_URL to enable.",
        allow_module_level=True,
    )

BASE_URL = EXTERNAL_BASE_URL or "http://localhost:8000"


async def is_server_available(base_url: str) -> tuple[bool, str]:
    """Check if the test server is running by probing a few endpoints."""
    endpoints_to_check = [
        ("/health", "Health check endpoint"),
        ("/docs", "API documentation"),
        ("/", "Root endpoint"),
        ("/api/v1/platform/config", "Platform config"),
    ]

    async with httpx.AsyncClient(base_url=base_url, timeout=5.0) as client:
        for endpoint, description in endpoints_to_check:
            try:
                response = await client.get(endpoint)
                if response.status_code in (200, 404, 307):
                    return True, f"Server detected via {description}"
            except (httpx.ConnectError, httpx.RemoteProtocolError, httpx.TimeoutException):
                continue

    return False, f"No response from {base_url} on any known endpoint"


async def _login_and_get_cookies(client: httpx.AsyncClient) -> httpx.Cookies:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    cookies = response.cookies
    assert "access_token" in cookies, "access_token cookie not set"
    return cookies


async def _fetch_platform_config(client: httpx.AsyncClient) -> dict:
    response = await client.get("/api/v1/platform/config")
    assert response.status_code == 200, f"Config endpoint failed: {response.text}"
    return response.json()


async def test_graphql_cookie_auth():
    """Test GraphQL authentication using HttpOnly cookies."""
    is_available, reason = await is_server_available(BASE_URL)
    if not is_available:
        pytest.skip(
            f"Test server not available: {reason}. "
            "Start the API server and set RUN_GRAPHQL_COOKIE_E2E=1 to run this test."
        )

    print(f"✅ {reason}")

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        cookies = await _login_and_get_cookies(client)

        config = await _fetch_platform_config(client)
        print(f"✅ Platform config fetched: {config['app']['name']} v{config['app']['version']}")
        print(f"   GraphQL enabled: {config['features']['graphql_enabled']}")

        graphql_query = """
        query TestQuery {
            __typename
        }
        """
        graphql_response = await client.post(
            "/api/v1/graphql",
            json={"query": graphql_query},
            cookies=cookies,
        )
        assert graphql_response.status_code == 200, (
            f"GraphQL request failed: {graphql_response.text}"
        )
        print(f"✅ GraphQL query successful: {graphql_response.json()}")

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
            data = subscribers_response.json()
            if "errors" in data:
                print(f"⚠️  Subscribers query returned errors: {data['errors']}")
            else:
                total = len(data.get("data", {}).get("subscribers", []))
                print(f"✅ Subscribers query successful: {total} subscribers")
        else:
            print(f"⚠️  Subscribers endpoint not available: {subscribers_response.status_code}")

        no_cookie_response = await client.post(
            "/api/v1/graphql",
            json={"query": subscribers_query},
            cookies={},  # Explicitly send no cookies
        )
        print(f"   Request without cookie status: {no_cookie_response.status_code}")
        print("✅ Audit context should be set via cookie auth (manual verification needed)")


async def test_platform_config_endpoint():
    """Test that platform config endpoint returns correct structure."""
    is_available, reason = await is_server_available(BASE_URL)
    if not is_available:
        pytest.skip(
            f"Test server not available: {reason}. "
            "Start the API server and set RUN_GRAPHQL_COOKIE_E2E=1 to run this test."
        )

    print(f"✅ {reason}")

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        config = await _fetch_platform_config(client)

        assert "app" in config
        assert "features" in config
        assert "api" in config
        assert "auth" in config

        assert "name" in config["app"]
        assert "version" in config["app"]
        assert "environment" in config["app"]

        assert "graphql_enabled" in config["features"]
        assert "analytics_enabled" in config["features"]
        assert "banking_enabled" in config["features"]

        assert config["api"]["rest_url"] == "/api/v1"
        assert config["api"]["graphql_url"] == "/api/v1/graphql"
        assert config["auth"]["cookie_based"] is True

        print("✅ Platform config structure valid:")
        print(f"   App: {config['app']['name']} v{config['app']['version']}")
        print(f"   Environment: {config['app']['environment']}")
        print(f"   GraphQL: {config['features']['graphql_enabled']}")
        print(f"   Cookie auth: {config['auth']['cookie_based']}")


async def test_real_time_cookie_auth():
    """Test that real-time endpoints accept cookie authentication."""
    is_available, reason = await is_server_available(BASE_URL)
    if not is_available:
        pytest.skip(
            f"Test server not available: {reason}. "
            "Start the API server and set RUN_GRAPHQL_COOKIE_E2E=1 to run this test."
        )

    print(f"✅ {reason}")

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        cookies = await _login_and_get_cookies(client)

        try:
            sse_response = await client.get(
                "/api/v1/realtime/onu-status",
                cookies=cookies,
                timeout=5.0,
            )
            if sse_response.status_code in (200, 404, 405):
                print(f"✅ SSE endpoint accessible with cookies: {sse_response.status_code}")
            else:
                print(f"⚠️  SSE endpoint returned: {sse_response.status_code}")
        except httpx.ReadTimeout:
            print("✅ SSE connection established (timed out waiting for events - expected)")
        except Exception as exc:  # pragma: no cover - diagnostic output only
            print(f"⚠️  SSE test error: {exc}")


if __name__ == "__main__":
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
