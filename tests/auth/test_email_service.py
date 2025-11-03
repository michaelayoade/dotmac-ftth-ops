"""Tests for the simplified auth email helpers."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.auth.email_service import (
    send_password_reset_email,
    send_password_reset_success_email,
    send_welcome_email,
    verify_reset_token,
)

pytestmark = pytest.mark.unit


class InMemoryRedis:
    """Very small in-memory stand-in for redis client."""

    def __init__(self):
        self.store = {}

    def setex(self, key, ttl, value):  # pragma: no cover - trivial setter
        expires_at = datetime.now(UTC) + timedelta(seconds=ttl)
        self.store[key] = (value, expires_at)

    def get(self, key):
        record = self.store.get(key)
        if not record:
            return None
        value, expires_at = record
        if expires_at < datetime.now(UTC):
            del self.store[key]
            return None
        return value

    def delete(self, key):  # pragma: no cover - trivial deleter
        return bool(self.store.pop(key, None))


@pytest.fixture(autouse=True)
def patch_redis(monkeypatch):
    """Use in-memory redis replacement for all tests."""

    fake = InMemoryRedis()
    monkeypatch.setattr("dotmac.platform.auth.email_service.get_redis", lambda: fake)
    return fake


def make_fake_email_service(status: str = "sent"):
    """Create a fake EmailService with configurable response status."""

    fake_service = MagicMock()
    response = MagicMock(status=status)
    fake_service.send_email = AsyncMock(return_value=response)
    return fake_service


@pytest.mark.asyncio
async def test_send_welcome_email_success():
    fake_service = make_fake_email_service("sent")

    with patch(
        "dotmac.platform.communications.email_service.get_email_service", return_value=fake_service
    ):
        result = await send_welcome_email("user@example.com", "User")

    assert result is True
    fake_service.send_email.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_welcome_email_failure():
    fake_service = make_fake_email_service("failed")

    with patch(
        "dotmac.platform.communications.email_service.get_email_service", return_value=fake_service
    ):
        result = await send_welcome_email("user@example.com", "User")

    assert result is False


@pytest.mark.asyncio
async def test_send_password_reset_email_success(patch_redis):
    fake_service = make_fake_email_service("sent")

    with patch(
        "dotmac.platform.communications.email_service.get_email_service", return_value=fake_service
    ):
        success, token = await send_password_reset_email("user@example.com", "Tester")

    assert success is True
    assert token is not None
    stored = patch_redis.get(f"password_reset:{token}")
    assert stored == "user@example.com"


@pytest.mark.asyncio
async def test_send_password_reset_email_failure(patch_redis):
    fake_service = make_fake_email_service("failed")

    with patch(
        "dotmac.platform.communications.email_service.get_email_service", return_value=fake_service
    ):
        success, token = await send_password_reset_email("user@example.com", "Tester")

    assert success is False
    assert token is None
    # Token is stored in Redis even if email fails (cleanup would happen on expiry)
    assert len(patch_redis.store) == 1


def test_verify_reset_token_round_trip(patch_redis):
    # Manually store token as the async helper would do
    token = "reset-token"
    patch_redis.setex(f"password_reset:{token}", 3600, "user@example.com")

    email = verify_reset_token(token)
    assert email == "user@example.com"

    # Token should be removed after use
    assert patch_redis.get(f"password_reset:{token}") is None


def test_verify_reset_token_invalid(patch_redis):
    assert verify_reset_token("missing") is None


@pytest.mark.asyncio
async def test_send_password_reset_success_email():
    fake_service = make_fake_email_service("sent")

    with patch(
        "dotmac.platform.communications.email_service.get_email_service", return_value=fake_service
    ):
        success = await send_password_reset_success_email("user@example.com", "Tester")

    assert success is True
    fake_service.send_email.assert_awaited_once()
