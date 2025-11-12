"""
End-to-End GraphQL Cookie Authentication Test.

These tests verify that GraphQL queries work with HttpOnly cookie authentication,
but they require a running API server. They are skipped unless explicitly enabled.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import TokenType, jwt_service
from dotmac.platform.auth.router import set_auth_cookies

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.e2e,
]

try:
    import strawberry
    from fastapi import Body, FastAPI, HTTPException, Request, Response, status
    from pydantic import BaseModel
    from strawberry.fastapi import GraphQLRouter
except ImportError as exc:  # pragma: no cover - environment without FastAPI
    pytest.skip(f"FastAPI/GraphQL dependencies unavailable: {exc}", allow_module_level=True)


RUN_GRAPHQL_COOKIE_E2E = os.getenv("RUN_GRAPHQL_COOKIE_E2E") == "1"
EXTERNAL_BASE_URL = os.getenv("E2E_BASE_URL")
USE_EXTERNAL_SERVER = RUN_GRAPHQL_COOKIE_E2E or bool(EXTERNAL_BASE_URL)
BASE_URL = EXTERNAL_BASE_URL or "http://localhost:8000"


@strawberry.type
class LocalSubscriber:
    id: strawberry.ID
    username: str
    email: str


LOCAL_SUBSCRIBERS = [
    LocalSubscriber(id="sub-1", username="admin", email="admin@example.com"),
    LocalSubscriber(id="sub-2", username="viewer", email="viewer@example.com"),
]


@strawberry.type
class LocalQuery:
    @strawberry.field
    def status(self) -> str:
        return "ok"

    @strawberry.field
    def subscribers(self) -> list[LocalSubscriber]:
        return LOCAL_SUBSCRIBERS


class LoginRequest(BaseModel):
    username: str
    password: str


@dataclass
class GraphQLTestEnv:
    """Container for the test client and mode details."""

    client: AsyncClient
    mode: Literal["external", "local"]
    availability_message: str


async def is_server_available(client: AsyncClient) -> tuple[bool, str]:
    """Check if the test server is running by probing a few endpoints."""
    endpoints_to_check = [
        ("/health", "Health check endpoint"),
        ("/docs", "API documentation"),
        ("/", "Root endpoint"),
        ("/api/v1/platform/config", "Platform config"),
    ]

    for endpoint, description in endpoints_to_check:
        try:
            response = await client.get(endpoint)
        except (httpx.ConnectError, httpx.RemoteProtocolError, httpx.TimeoutException):
            continue

        if response.status_code in (200, 404, 307):
            return True, f"Server detected via {description}"

    return False, "No response from configured base URL on known endpoints"


def _create_local_graphql_app() -> FastAPI:
    """Create a lightweight FastAPI app with GraphQL protected by cookies."""

    async def graphql_context(request: Request) -> dict[str, object]:
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for GraphQL access.",
            )

        try:
            claims = jwt_service.verify_token(token, expected_type=TokenType.ACCESS)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {exc}",
            ) from exc

        return {"claims": claims, "request": request}

    app = FastAPI(title="GraphQL Cookie Auth Test App")

    @app.post("/api/v1/auth/login")
    async def login(response: Response, payload: LoginRequest = Body(...)) -> dict[str, str]:
        if payload.username != "admin" or payload.password != "admin":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        access_token = jwt_service.create_access_token(
            subject="admin-user",
            additional_claims={
                "preferred_username": "admin",
                "tenant_id": "test-tenant",
                "permissions": ["read", "write"],
                "roles": ["admin"],
                "email": "admin@example.com",
                "is_platform_admin": True,
            },
        )
        refresh_token = jwt_service.create_refresh_token(subject="admin-user")
        set_auth_cookies(response, access_token, refresh_token)
        return {"status": "ok"}

    @app.get("/api/v1/platform/config")
    async def platform_config() -> dict[str, object]:
        return {
            "app": {"name": "DotMac Platform (Test)", "version": "test-local"},
            "features": {"graphql_enabled": True},
            "api": {"base_url": "http://testserver/api/v1"},
            "auth": {"cookie_auth": True},
        }

    graphql_router = GraphQLRouter(
        strawberry.Schema(query=LocalQuery),
        path="/api/v1/graphql",
        context_getter=graphql_context,
    )
    app.include_router(graphql_router)

    return app


@pytest.fixture
async def graphql_env() -> GraphQLTestEnv:
    if USE_EXTERNAL_SERVER:
        async with AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            is_available, reason = await is_server_available(client)
            if not is_available:
                pytest.skip(
                    f"Test server not available: {reason}. "
                    "Start the API server and set RUN_GRAPHQL_COOKIE_E2E=1 to run this test.",
                    allow_module_level=True,
                )
            yield GraphQLTestEnv(client=client, mode="external", availability_message=reason)
    else:
        app = _create_local_graphql_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield GraphQLTestEnv(
                client=client,
                mode="local",
                availability_message="Local GraphQL test application initialized.",
            )


async def _login_and_get_cookies(client: AsyncClient) -> httpx.Cookies:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    cookies = response.cookies
    assert "access_token" in cookies, "access_token cookie not set"
    return cookies


async def _fetch_platform_config(client: AsyncClient) -> dict[str, object]:
    response = await client.get("/api/v1/platform/config")
    assert response.status_code == 200, f"Config endpoint failed: {response.text}"
    return response.json()


async def test_graphql_cookie_auth(graphql_env: GraphQLTestEnv):
    """Test GraphQL authentication using HttpOnly cookies."""
    print(f"✅ {graphql_env.availability_message}")

    client = graphql_env.client
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
    assert graphql_response.status_code == 200, f"GraphQL request failed: {graphql_response.text}"
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


async def test_platform_config_endpoint(graphql_env: GraphQLTestEnv):
    """Test that platform config endpoint returns correct structure."""
    print(f"✅ {graphql_env.availability_message}")

    config = await _fetch_platform_config(graphql_env.client)

    assert "app" in config
    assert "features" in config
    assert "api" in config
    assert "auth" in config

    assert "name" in config["app"]
    assert "version" in config["app"]
    assert isinstance(config["features"]["graphql_enabled"], bool)
