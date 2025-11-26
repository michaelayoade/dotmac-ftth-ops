"""Integration-style checks for SNMP helper functions."""

from __future__ import annotations

import asyncio
import pytest

from dotmac.platform.access import snmp


pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_collect_snmp_metrics_prefers_hook_over_pysnmp(monkeypatch):
    """Ensure injected hook is used so tests don't require pysnmp."""
    called = asyncio.Event()

    async def fake_collector(**kwargs):
        called.set()
        return {"pon_ports_total": 4, "onu_online": 3}

    # If pysnmp is invoked we want the test to fail
    monkeypatch.setattr(snmp, "_pysnmp_collect", lambda **kwargs: (_ for _ in ()).throw(AssertionError("pysnmp should not be used")), raising=True)

    result = await snmp.collect_snmp_metrics(
        host="127.0.0.1",
        community="public",
        oids={"pon_ports_total": "1.3.6.1", "onu_online": "1.3.6.2"},
        hooks={"snmp_collector": fake_collector},
    )

    assert called.is_set()
    assert result.values["pon_ports_total"] == 4
    assert result.values["onu_online"] == 3


def test_decode_maybe_base64_handles_plain_and_b64():
    plain = "hello world"
    encoded = "aGVsbG8gd29ybGQ="  # base64 for "hello world"

    assert snmp.decode_maybe_base64(plain).startswith(b"hello world")
    assert snmp.decode_maybe_base64(encoded) == b"hello world"
