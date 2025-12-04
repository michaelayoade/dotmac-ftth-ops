"""
Comprehensive tests for webhook subscription service.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.webhooks.models import (
    WebhookSubscriptionCreate,
    generate_webhook_secret,
)
from dotmac.platform.webhooks.service import WebhookSubscriptionService


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def webhook_service(mock_db_session):
    return WebhookSubscriptionService(mock_db_session)


@pytest.fixture
def tenant_id():
    return "tenant-123"


@pytest.mark.integration
class TestGenerateWebhookSecret:
    def test_generate_secret(self):
        secret = generate_webhook_secret()
        assert isinstance(secret, str)
        assert len(secret) > 20

    def test_generate_unique_secrets(self):
        secrets = {generate_webhook_secret() for _ in range(100)}
        assert len(secrets) == 100


@pytest.mark.integration
class TestCreateSubscription:
    @pytest.mark.asyncio
    async def test_create_subscription_basic(self, webhook_service, tenant_id):
        subscription_data = WebhookSubscriptionCreate(
            url="https://api.example.com/webhooks",
            description="Test webhook",
            events=["user.registered", "user.updated"],
        )

        subscription = await webhook_service.create_subscription(tenant_id, subscription_data)

        assert subscription.url == "https://api.example.com/webhooks"
        assert subscription.tenant_id == tenant_id
        assert "user.registered" in subscription.events
        webhook_service.db.add.assert_called_once()
