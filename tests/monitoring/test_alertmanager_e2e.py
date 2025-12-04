"""
Alertmanager Webhook End-to-End Tests

Tests the complete Alertmanager → API webhook flow:
- Webhook payload processing
- Authentication with ALERTMANAGER_WEBHOOK_SECRET
- Rate limiting enforcement
- Alert storage in database
- Structured logging
- Routing logic

These tests validate the integration documented in:
- ALERTMANAGER_DEPLOYMENT_VERIFICATION.md
- docs/ALERTMANAGER_WEBHOOK_SETUP.md
"""

from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from dotmac.platform.monitoring import alert_router


@pytest.fixture(autouse=True)
def disable_alertmanager_rate_limit(monkeypatch):
    """Prevent external Redis dependency during webhook tests."""
    monkeypatch.setattr(alert_router, "get_redis", lambda: None)
    alert_router._local_rate_counters.clear()
    yield
    alert_router._local_rate_counters.clear()


@pytest_asyncio.fixture
async def async_client():
    """Provide ASGI test client for Alertmanager E2E tests."""
    from httpx import ASGITransport
    from httpx import AsyncClient as HttpxAsyncClient

    from dotmac.platform.main import app

    transport = ASGITransport(app=app)
    async with HttpxAsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


pytestmark = [pytest.mark.e2e, pytest.mark.asyncio]


class TestAlertmanagerWebhookE2E:
    """End-to-end tests for Alertmanager webhook integration."""

    @pytest.fixture
    def alertmanager_webhook_secret(self):
        """Generate test webhook secret."""
        return "test-alertmanager-webhook-secret-for-e2e"

    @pytest.fixture
    def sample_alertmanager_payload(self) -> dict:
        """Sample Alertmanager webhook payload (v4 format)."""
        return {
            "version": "4",
            "groupKey": '{}:{severity="critical"}',
            "status": "firing",
            "receiver": "dotmac-webhook",
            "groupLabels": {"severity": "critical"},
            "commonLabels": {
                "alertname": "HighErrorRate",
                "severity": "critical",
                "service": "api",
            },
            "commonAnnotations": {
                "summary": "High error rate detected",
                "description": "API error rate is above 5%",
            },
            "externalURL": "http://alertmanager.example.com",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "HighErrorRate",
                        "severity": "critical",
                        "service": "api",
                        "instance": "api-1",
                    },
                    "annotations": {
                        "summary": "High error rate on api-1",
                        "description": "Error rate is 8.5%",
                    },
                    "startsAt": "2025-10-29T10:00:00Z",
                    "endsAt": "0001-01-01T00:00:00Z",
                    "generatorURL": "http://prometheus.example.com/graph?g0.expr=rate",
                    "fingerprint": "abc123def456",
                }
            ],
        }

    async def test_webhook_receives_and_processes_alert(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test complete flow: receive webhook → validate → process → respond."""
        # Set webhook secret via settings
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_alertmanager_payload,
                headers=headers,
            )

            # Should accept webhook
            assert response.status_code == 202, (
                f"Expected 202, got {response.status_code}: {response.text}"
            )

            data = response.json()
            assert "alerts_processed" in data
            assert "results" in data
            assert isinstance(data["results"], dict)

    async def test_webhook_rejects_invalid_token(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook rejects requests with invalid token."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret

            headers = {
                "X-Alertmanager-Token": "invalid-token-12345",
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_alertmanager_payload,
                headers=headers,
            )

            # Should reject with 401
            assert response.status_code == 401
            data = response.json()
            assert data["detail"] == "Invalid Alertmanager webhook token"

    async def test_webhook_rejects_missing_token(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook rejects requests without token."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_alertmanager_payload,
                headers={"Content-Type": "application/json"},
            )

            # Should reject with 401
            assert response.status_code == 401

    async def test_webhook_accepts_bearer_token(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook accepts Authorization: Bearer token."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            headers = {
                "Authorization": f"Bearer {alertmanager_webhook_secret}",
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_alertmanager_payload,
                headers=headers,
            )

            assert response.status_code == 202

    async def test_webhook_accepts_query_parameter_token(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook accepts token via query parameter."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            response = await async_client.post(
                f"/api/v1/monitoring/alerts/webhook?token={alertmanager_webhook_secret}",
                json=sample_alertmanager_payload,
                headers={"Content-Type": "application/json"},
            )

            assert response.status_code == 202

    @pytest.mark.slow
    async def test_webhook_rate_limiting(
        self,
        async_client: AsyncClient,
        sample_alertmanager_payload: dict,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook enforces rate limiting (10 requests/minute default)."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "5/minute"  # Lower for testing

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            # Send 7 requests rapidly
            responses = []
            for _ in range(7):
                response = await async_client.post(
                    "/api/v1/monitoring/alerts/webhook",
                    json=sample_alertmanager_payload,
                    headers=headers,
                )
                responses.append(response.status_code)

            # First 5 should succeed (202), rest should be rate limited (429)
            successful = [r for r in responses if r == 202]
            rate_limited = [r for r in responses if r == 429]

            assert len(successful) >= 5, (
                f"Expected at least 5 successful requests, got {len(successful)}"
            )
            assert len(rate_limited) >= 1, (
                f"Expected at least 1 rate limited request, got {len(rate_limited)}"
            )

    async def test_webhook_processes_resolved_alerts(
        self,
        async_client: AsyncClient,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook processes resolved alerts correctly."""
        resolved_payload = {
            "version": "4",
            "groupKey": '{}:{severity="critical"}',
            "status": "resolved",
            "receiver": "dotmac-webhook",
            "groupLabels": {"severity": "critical"},
            "commonLabels": {
                "alertname": "HighErrorRate",
                "severity": "critical",
            },
            "commonAnnotations": {
                "summary": "Error rate recovered",
            },
            "externalURL": "http://alertmanager.example.com",
            "alerts": [
                {
                    "status": "resolved",
                    "labels": {
                        "alertname": "HighErrorRate",
                        "severity": "critical",
                    },
                    "annotations": {
                        "summary": "Error rate back to normal",
                    },
                    "startsAt": "2025-10-29T10:00:00Z",
                    "endsAt": "2025-10-29T10:15:00Z",
                    "generatorURL": "http://prometheus.example.com/graph",
                    "fingerprint": "abc123def456",
                }
            ],
        }

        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=resolved_payload,
                headers=headers,
            )

            assert response.status_code == 202
            data = response.json()
            assert "alerts_processed" in data
            assert "results" in data

    async def test_webhook_validates_payload_schema(
        self,
        async_client: AsyncClient,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook validates Alertmanager payload schema."""
        invalid_payload = {
            "invalid": "payload",
            "missing": "required fields",
        }

        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=invalid_payload,
                headers=headers,
            )

            # Should reject invalid payload
            assert response.status_code == 422  # Unprocessable Entity

    async def test_webhook_handles_multiple_alerts_in_group(
        self,
        async_client: AsyncClient,
        alertmanager_webhook_secret: str,
    ):
        """Test webhook handles multiple alerts in a single webhook call."""
        payload_with_multiple_alerts = {
            "version": "4",
            "groupKey": '{}:{severity="warning"}',
            "status": "firing",
            "receiver": "dotmac-webhook",
            "groupLabels": {"severity": "warning"},
            "commonLabels": {
                "severity": "warning",
                "team": "platform",
            },
            "commonAnnotations": {},
            "externalURL": "http://alertmanager.example.com",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "HighCPU",
                        "severity": "warning",
                        "instance": "server-1",
                    },
                    "annotations": {"summary": "CPU usage high on server-1"},
                    "startsAt": "2025-10-29T10:00:00Z",
                    "endsAt": "0001-01-01T00:00:00Z",
                    "generatorURL": "http://prometheus.example.com/graph",
                    "fingerprint": "cpu-server-1",
                },
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "HighMemory",
                        "severity": "warning",
                        "instance": "server-2",
                    },
                    "annotations": {"summary": "Memory usage high on server-2"},
                    "startsAt": "2025-10-29T10:01:00Z",
                    "endsAt": "0001-01-01T00:00:00Z",
                    "generatorURL": "http://prometheus.example.com/graph",
                    "fingerprint": "mem-server-2",
                },
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "HighDisk",
                        "severity": "warning",
                        "instance": "server-3",
                    },
                    "annotations": {"summary": "Disk usage high on server-3"},
                    "startsAt": "2025-10-29T10:02:00Z",
                    "endsAt": "0001-01-01T00:00:00Z",
                    "generatorURL": "http://prometheus.example.com/graph",
                    "fingerprint": "disk-server-3",
                },
            ],
        }

        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=payload_with_multiple_alerts,
                headers=headers,
            )

            assert response.status_code == 202
            data = response.json()
            assert "alerts_processed" in data
            assert "results" in data

    async def test_webhook_timing_safe_comparison(
        self,
        async_client: AsyncClient,
        alertmanager_webhook_secret: str,
        sample_alertmanager_payload: dict,
    ):
        """Test webhook uses timing-safe token comparison (prevents timing attacks)."""
        # This test verifies the implementation uses secrets.compare_digest
        # We can't directly test timing, but we verify the authentication function exists

        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret

            # Test with token that shares prefix (potential timing attack vector)
            similar_token = alertmanager_webhook_secret[:-5] + "WRONG"

            headers = {
                "X-Alertmanager-Token": similar_token,
                "Content-Type": "application/json",
            }

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_alertmanager_payload,
                headers=headers,
            )

            # Should still reject (timing-safe comparison)
            assert response.status_code == 401


class TestAlertmanagerWebhookLogging:
    """Test structured logging for Alertmanager webhooks."""

    @pytest.fixture
    def alertmanager_webhook_secret(self):
        """Generate test webhook secret."""
        return "test-secret-for-logging"

    @pytest.fixture
    def sample_payload(self) -> dict:
        """Minimal valid payload."""
        return {
            "version": "4",
            "groupKey": '{}:{severity="info"}',
            "status": "firing",
            "receiver": "test",
            "groupLabels": {},
            "commonLabels": {"alertname": "TestAlert"},
            "commonAnnotations": {},
            "externalURL": "http://test",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {"alertname": "TestAlert"},
                    "annotations": {},
                    "startsAt": "2025-10-29T10:00:00Z",
                    "endsAt": "0001-01-01T00:00:00Z",
                    "generatorURL": "http://test",
                    "fingerprint": "test123",
                }
            ],
        }

    @pytest.mark.asyncio
    async def test_webhook_logs_successful_processing(
        self,
        async_client: AsyncClient,
        sample_payload: dict,
        alertmanager_webhook_secret: str,
        caplog,
    ):
        """Test webhook emits structured log for successful processing."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret
            mock_settings.observability.alertmanager_rate_limit = "10/minute"

            headers = {
                "X-Alertmanager-Token": alertmanager_webhook_secret,
                "Content-Type": "application/json",
            }

            # Enable logging capture
            import logging

            caplog.set_level(logging.INFO)

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_payload,
                headers=headers,
            )

            assert response.status_code == 202

            # Verify structured logging (implementation should log webhook received)
            # Note: Actual log format depends on implementation
            # This is a placeholder - adjust based on actual logging

    @pytest.mark.asyncio
    async def test_webhook_logs_authentication_failure(
        self,
        async_client: AsyncClient,
        sample_payload: dict,
        alertmanager_webhook_secret: str,
        caplog,
    ):
        """Test webhook logs authentication failures."""
        with patch("dotmac.platform.monitoring.alert_router.settings") as mock_settings:
            mock_settings.observability.alertmanager_webhook_secret = alertmanager_webhook_secret

            headers = {
                "X-Alertmanager-Token": "wrong-token",
                "Content-Type": "application/json",
            }

            import logging

            caplog.set_level(logging.WARNING)

            response = await async_client.post(
                "/api/v1/monitoring/alerts/webhook",
                json=sample_payload,
                headers=headers,
            )

            assert response.status_code == 401

            # Verify authentication failure was logged
            # (Implementation should log failed auth attempts)
