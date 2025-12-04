"""Tests for the alert management router to ensure persistence and tenant scoping."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, status
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_session

os.environ.setdefault("DOTMAC_MONITORING_SKIP_IMPORTS", "1")

from dotmac.platform.monitoring.alert_router import (
    _channel_to_response,
    _ensure_channel_state,
    _parse_rate_limit_config,
    _refresh_channel_state,
)
from dotmac.platform.monitoring.alert_router import (
    router as alert_router,
)
from dotmac.platform.monitoring.alert_webhook_router import (
    AlertChannel,
    AlertSeverity,
    ChannelType,
    cache_channels,
    get_alert_router,
)
from dotmac.platform.monitoring.models import MonitoringAlertChannel
from dotmac.platform.settings import settings

pytestmark = pytest.mark.integration


def _make_admin() -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username="platform-admin",
        email="admin@example.com",
        roles=["platform_admin"],
        permissions=["*"],
        tenant_id=None,
        is_platform_admin=True,
    )


def _make_tenant_user(tenant_id: str) -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        username=f"user-{tenant_id}",
        email=f"{tenant_id}@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id=tenant_id,
        is_platform_admin=False,
    )


@pytest_asyncio.fixture(autouse=True)
async def _reset_alert_state(async_db_session: AsyncSession):
    """Clear alert channel state between tests."""
    await async_db_session.execute(delete(MonitoringAlertChannel))
    await async_db_session.commit()
    cache_channels([])
    get_alert_router().replace_channels([])


def _alert_channel(
    *,
    channel_id: str = "chan-test",
    channel_type: ChannelType = ChannelType.WEBHOOK,
    tenant_id: str | None = "tenant-alpha",
) -> AlertChannel:
    """Convenience helper to build AlertChannel objects."""
    return AlertChannel(
        id=channel_id,
        name=f"Channel {channel_id}",
        channel_type=channel_type,
        webhook_url="https://example.com/webhook",
        tenant_id=tenant_id,
        severities=[AlertSeverity.CRITICAL],
        alert_names=["TestAlert"],
        alert_categories=["infra"],
    )


def _fake_request(client_ip: str = "203.0.113.5") -> Request:
    """Create a Starlette request object with the supplied client IP."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/alerts",
        "headers": [],
        "query_string": b"",
        "client": (client_ip, 443),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


class _FakeRedis:
    """Simple redis-like stub for rate limit tests."""

    def __init__(self):
        self._counts: dict[str, int] = {}
        self.expirations: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]

    def expire(self, key: str, seconds: int) -> None:
        self.expirations[key] = seconds


@pytest.mark.parametrize(
    ("config", "expected_count", "expected_window"),
    [
        ("5/second", 5, 1),
        ("10/minute", 10, 60),
        ("100/hour", 100, 3600),
        ("200/day", 200, 86400),
        ("15 per minute", 15, 60),
    ],
)
def test_parse_rate_limit_config_variants(config, expected_count, expected_window):
    count, window = _parse_rate_limit_config(config)
    assert (count, window) == (expected_count, expected_window)


def test_parse_rate_limit_config_defaults_on_error():
    count, window = _parse_rate_limit_config("invalid-value")
    assert (count, window) == (120, 60)


def test_enforce_alertmanager_rate_limit_uses_redis(monkeypatch):
    from dotmac.platform.monitoring import alert_router as module

    fake_redis = _FakeRedis()
    monkeypatch.setattr(module, "_local_rate_counters", {})
    monkeypatch.setattr(module, "get_redis", lambda: fake_redis)
    monkeypatch.setattr(module.settings.observability, "alertmanager_rate_limit", "2/minute")

    request = _fake_request("198.51.100.10")

    module._enforce_alertmanager_rate_limit(request)
    module._enforce_alertmanager_rate_limit(request)

    with pytest.raises(HTTPException):
        module._enforce_alertmanager_rate_limit(request)

    cache_key = "alertmanager:webhook:198.51.100.10"
    assert fake_redis.expirations[cache_key] == 60


def test_enforce_alertmanager_rate_limit_local_fallback(monkeypatch):
    from dotmac.platform.monitoring import alert_router as module

    def _raise():
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(module, "_local_rate_counters", {})
    monkeypatch.setattr(module, "get_redis", _raise)
    monkeypatch.setattr(module.settings.observability, "alertmanager_rate_limit", "2/minute")

    request = _fake_request("192.0.2.33")

    module._enforce_alertmanager_rate_limit(request)
    module._enforce_alertmanager_rate_limit(request)

    with pytest.raises(HTTPException):
        module._enforce_alertmanager_rate_limit(request)

    cache_key = "alertmanager:webhook:192.0.2.33"
    assert cache_key in module._local_rate_counters


def test_channel_to_response_serializes_enums():
    channel = _alert_channel(channel_type=ChannelType.SLACK)
    response = _channel_to_response(channel)

    assert response.channel_type == ChannelType.SLACK
    assert response.severities == ["critical"]
    assert response.alert_names == ["TestAlert"]


@pytest.mark.asyncio
async def test_refresh_channel_state_populates_cache(async_db_session, monkeypatch):
    from dotmac.platform.monitoring import alert_router as module

    record: dict[str, list[AlertChannel]] = {}

    async_db_session.add(
        MonitoringAlertChannel(
            id="chan-refresh",
            name="Channel Refresh",
            channel_type="webhook",
            enabled=True,
            tenant_id="tenant-alpha",
            config={"webhook_url": "https://example.com/hook"},
        )
    )
    await async_db_session.commit()

    module.get_alert_router().replace_channels([])
    monkeypatch.setattr(
        module, "cache_channels", lambda channels: record.setdefault("channels", channels)
    )

    await _refresh_channel_state(async_db_session)

    router = module.get_alert_router()
    assert "chan-refresh" in router.channels
    assert "channels" in record
    assert record["channels"][0].id == "chan-refresh"


@pytest.mark.asyncio
async def test_ensure_channel_state_loads_when_empty(async_db_session, monkeypatch):
    from dotmac.platform.monitoring import alert_router as module

    record: dict[str, list[AlertChannel]] = {}
    module.get_alert_router().replace_channels([])

    async_db_session.add(
        MonitoringAlertChannel(
            id="chan-ensure",
            name="Channel Ensure",
            channel_type="webhook",
            enabled=True,
            tenant_id="tenant-beta",
            config={"webhook_url": "https://example.com/hook"},
        )
    )
    await async_db_session.commit()

    monkeypatch.setattr(
        module, "cache_channels", lambda channels: record.setdefault("channels", channels)
    )

    await _ensure_channel_state(async_db_session)

    router = module.get_alert_router()
    assert "chan-ensure" in router.channels
    assert "channels" in record
    assert record["channels"][0].id == "chan-ensure"


@pytest.mark.asyncio
async def test_ensure_channel_state_skips_when_cache_populated(monkeypatch):
    from dotmac.platform.monitoring import alert_router as module

    router = module.get_alert_router()
    router.replace_channels([_alert_channel(channel_id="existing")])

    called = False

    async def fake_fetch(_session):
        nonlocal called
        called = True
        return []

    monkeypatch.setattr(module, "_fetch_all_channels", fake_fetch)

    await _ensure_channel_state(None)  # type: ignore[arg-type]

    assert called is False


def _webhook_payload() -> dict[str, object]:
    timestamp = datetime(2024, 1, 1, tzinfo=UTC).isoformat().replace("+00:00", "Z")
    return {
        "version": "4",
        "groupKey": '{}:{severity="critical"}',
        "status": "firing",
        "receiver": "default",
        "groupLabels": {"severity": "critical"},
        "commonLabels": {"alertname": "TestAlert", "severity": "critical"},
        "commonAnnotations": {"summary": "Test alert"},
        "externalURL": "http://alertmanager.local",
        "truncatedAlerts": 0,
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "TestAlert",
                    "severity": "critical",
                },
                "annotations": {
                    "summary": "Critical issue",
                    "description": "Something broke",
                },
                "startsAt": timestamp,
                "endsAt": None,
                "generatorURL": "http://prometheus.example.com/graph",
                "fingerprint": "1234567890",
            }
        ],
    }


@pytest.fixture
def app(async_db_session: AsyncSession) -> FastAPI:
    """FastAPI application with alert router and dependency overrides."""
    application = FastAPI()

    async def override_session():
        yield async_db_session

    application.include_router(alert_router, prefix="/api/v1")
    application.dependency_overrides[get_async_session] = override_session

    previous_secret = settings.observability.alertmanager_webhook_secret
    previous_limit = settings.observability.alertmanager_rate_limit
    settings.observability.alertmanager_webhook_secret = "test-secret"
    settings.observability.alertmanager_rate_limit = "100/second"

    try:
        yield application
    finally:
        settings.observability.alertmanager_webhook_secret = previous_secret
        settings.observability.alertmanager_rate_limit = previous_limit


async def _request(
    app: FastAPI,
    user: UserInfo,
    method: str,
    path: str,
    **kwargs,
) -> AsyncClient:
    """Utility to perform a request with a specific user context."""

    async def override_user():
        return user

    app.dependency_overrides[get_current_user] = override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.request(method, path, **kwargs)
    return response


@pytest.mark.asyncio
async def test_create_alert_channel_persists_and_populates_cache(
    app: FastAPI,
    async_db_session: AsyncSession,
):
    """Creating a channel stores it in the database and primes the router cache."""
    admin = _make_admin()

    payload = {
        "id": "chan-test",
        "name": "Test Channel",
        "channel_type": "slack",
        "webhook_url": "https://hooks.slack.com/services/test",
        "enabled": True,
        "tenant_id": "tenant-alpha",
        "severities": ["critical", "warning"],
    }

    response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/channels",
        json=payload,
    )
    assert response.status_code == 201, response.text

    stored = await async_db_session.get(MonitoringAlertChannel, "chan-test")
    assert stored is not None
    assert stored.tenant_id == "tenant-alpha"
    assert stored.config["webhook_url"] == payload["webhook_url"]

    router_channels = get_alert_router().channels
    assert "chan-test" in router_channels
    assert router_channels["chan-test"].webhook_url == payload["webhook_url"]


@pytest.mark.asyncio
async def test_list_alert_channels_respects_tenant_boundaries(
    app: FastAPI,
    async_db_session: AsyncSession,
):
    """Non-admin users should only see channels for their tenant."""
    admin = _make_admin()

    for channel_id, tenant_id in (("chan-alpha", "tenant-alpha"), ("chan-beta", "tenant-beta")):
        payload = {
            "id": channel_id,
            "name": f"Channel {tenant_id}",
            "channel_type": "webhook",
            "webhook_url": f"https://example.com/{channel_id}",
            "enabled": True,
            "tenant_id": tenant_id,
        }
        response = await _request(
            app,
            admin,
            "POST",
            "/api/v1/alerts/channels",
            json=payload,
        )
        assert response.status_code == 201

    user_alpha = _make_tenant_user("tenant-alpha")
    response_alpha = await _request(
        app,
        user_alpha,
        "GET",
        "/api/v1/alerts/channels",
    )
    assert response_alpha.status_code == 200
    data_alpha = response_alpha.json()
    assert len(data_alpha) == 1
    assert data_alpha[0]["id"] == "chan-alpha"

    user_beta = _make_tenant_user("tenant-beta")
    response_beta = await _request(
        app,
        user_beta,
        "GET",
        "/api/v1/alerts/channels",
    )
    assert response_beta.status_code == 200
    data_beta = response_beta.json()
    assert len(data_beta) == 1
    assert data_beta[0]["id"] == "chan-beta"


@pytest.mark.asyncio
async def test_alertmanager_webhook_requires_shared_secret(app: FastAPI):
    admin = _make_admin()

    response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/webhook",
        json=_webhook_payload(),
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_alertmanager_webhook_accepts_valid_secret(app: FastAPI):
    admin = _make_admin()

    response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/webhook",
        json=_webhook_payload(),
        headers={"X-Alertmanager-Token": "test-secret"},
    )
    assert response.status_code == status.HTTP_202_ACCEPTED, response.text


@pytest.mark.asyncio
async def test_send_test_alert_requires_admin(app: FastAPI):
    """Regular users must not trigger outbound test notifications."""
    admin = _make_admin()
    payload = {
        "id": "chan-test",
        "name": "Test",
        "channel_type": "slack",
        "webhook_url": "https://hooks.slack.com/services/test",
        "enabled": True,
        "tenant_id": "tenant-alpha",
    }
    create_response = await _request(
        app,
        admin,
        "POST",
        "/api/v1/alerts/channels",
        json=payload,
    )
    assert create_response.status_code == 201

    tenant_user = _make_tenant_user("tenant-alpha")
    response = await _request(
        app,
        tenant_user,
        "POST",
        "/api/v1/alerts/test",
        json={"channel_id": "chan-test", "message": "hello"},
    )
    assert response.status_code == 403
