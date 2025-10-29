"""
Reusable subscriber fixtures for tests.

Provides a factory for creating persisted `Subscriber` instances
and a convenience fixture that yields a ready-made subscriber.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio

from dotmac.platform.services.lifecycle.models import ServiceType
from dotmac.platform.subscribers.models import (
    PasswordHashingMethod,
    Subscriber,
    SubscriberStatus,
    hash_radius_password,
)
from tests.helpers.fixture_factories import ModelFactory


class SubscriberFactory(ModelFactory):
    """Factory for creating subscriber records with sensible defaults."""

    model_class = Subscriber
    id_prefix = "sub_test"

    def get_defaults(self) -> dict[str, Any]:
        """Build default subscriber field values."""
        unique_suffix = uuid4().hex[:8]
        hashed_password = hash_radius_password(
            "TempP@ss123", PasswordHashingMethod.SHA256
        )

        return {
            "tenant_id": "tenant-test",
            "username": f"subscriber_{unique_suffix}@example.com",
            "password": hashed_password,
            "password_hash_method": PasswordHashingMethod.SHA256.value,
            "subscriber_number": f"SUB-{unique_suffix.upper()}",
            "status": SubscriberStatus.PENDING,
            "service_type": ServiceType.FIBER_INTERNET,
            "device_metadata": {},
            "service_coordinates": {},
            "metadata_": {},
        }

    async def create_active(self, **kwargs: Any) -> Subscriber:
        """Create an active subscriber with activation metadata."""
        base = {
            "status": SubscriberStatus.ACTIVE,
            "activation_date": datetime.now(timezone.utc),
        }
        base.update(kwargs)
        return await self.create(**base)

    async def create_with_bandwidth_profile(
        self,
        profile_id: str | None = None,
        download_kbps: int = 100_000,
        upload_kbps: int = 50_000,
        **kwargs: Any,
    ) -> Subscriber:
        """Create a subscriber with bandwidth settings.

        NOTE: If profile_id is provided, caller must ensure a matching
        RadiusBandwidthProfile record exists to satisfy FK constraint.
        By default (profile_id=None), no FK constraint is created.
        """
        base = {
            "download_speed_kbps": download_kbps,
            "upload_speed_kbps": upload_kbps,
        }
        if profile_id is not None:
            base["bandwidth_profile_id"] = profile_id
        base.update(kwargs)
        return await self.create(**base)


@pytest_asyncio.fixture
async def subscriber_factory(async_db_session):
    """Yield a subscriber factory with automatic cleanup."""
    factory = SubscriberFactory(async_db_session)
    yield factory
    await factory.cleanup_all()


@pytest_asyncio.fixture
async def subscriber(subscriber_factory):
    """Return a persisted subscriber using the default factory settings."""
    return await subscriber_factory.create()


@pytest_asyncio.fixture
async def active_subscriber(subscriber_factory):
    """Provide an active subscriber ready for service validations."""
    return await subscriber_factory.create_active()


@pytest_asyncio.fixture
async def subscriber_with_bandwidth(subscriber_factory):
    """Provide a subscriber with an attached bandwidth profile."""
    return await subscriber_factory.create_with_bandwidth_profile()


@pytest.fixture
def subscriber_payload() -> dict[str, Any]:
    """
    Provide a basic subscriber payload dictionary for API tests.

    This payload is not persisted; use `subscriber_factory` for database records.
    """
    unique_suffix = uuid4().hex[:8]
    return {
        "tenant_id": "tenant-test",
        "username": f"subscriber_{unique_suffix}@example.com",
        "password": "TempP@ss123",
        "subscriber_number": f"SUB-{unique_suffix.upper()}",
        "service_type": ServiceType.FIBER_INTERNET.value,
    }
