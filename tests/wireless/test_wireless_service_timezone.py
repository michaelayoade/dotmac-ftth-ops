from __future__ import annotations

import uuid
from datetime import UTC
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from dotmac.platform.wireless.schemas import SignalMeasurementCreate
from dotmac.platform.wireless.service import WirelessService

pytestmark = pytest.mark.integration


class DummySession:
    """Minimal synchronous session stub to capture interactions."""

    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        pass

    def refresh(self, obj):
        pass

    def query(self, *args, **kwargs):  # pragma: no cover - not used in this test
        raise NotImplementedError


def test_create_signal_measurement_assigns_timezone():
    """Ensure measurements default to timezone-aware timestamps."""
    session = DummySession()
    service = WirelessService(db=session, tenant_id="tenant-1")
    service.get_device = MagicMock(return_value=SimpleNamespace(id=uuid.uuid4()))

    payload = SignalMeasurementCreate(
        device_id=uuid.uuid4(),
        rssi_dbm=-45,
    )

    measurement = service.create_signal_measurement(payload)

    assert measurement.measured_at.tzinfo is UTC
    assert session.added and session.added[0] is measurement
