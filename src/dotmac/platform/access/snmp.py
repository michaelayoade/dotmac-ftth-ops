"""
Utility helpers for SNMP-based metric collection used by access drivers.

The helpers in this module keep SNMP handling optional by first looking for
an injected collector (typically supplied through ``DriverContext.hooks``) and
falling back to a lightweight ``pysnmp`` implementation when available.
"""

from __future__ import annotations

import asyncio
import base64
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any

DEFAULT_HUAWEI_SNMP_OIDS: dict[str, str] = {
    # These OIDs align with common Huawei MA5800/MA5600 series counters.
    "pon_ports_total": "1.3.6.1.4.1.2011.2.82.1.13.1.1.1.0",
    "pon_ports_up": "1.3.6.1.4.1.2011.2.82.1.13.1.1.2.0",
    "onu_total": "1.3.6.1.4.1.2011.2.82.1.13.1.1.3.0",
    "onu_online": "1.3.6.1.4.1.2011.2.82.1.13.1.1.4.0",
    "upstream_rate_kbps": "1.3.6.1.4.1.2011.2.82.1.13.1.1.10.0",
    "downstream_rate_kbps": "1.3.6.1.4.1.2011.2.82.1.13.1.1.11.0",
}

# OpenOLT exposes vendor-neutral counters that VOLTHA surfaces via SNMP.
DEFAULT_VOLTHA_SNMP_OIDS: dict[str, str] = {
    "pon_ports_total": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.2.0",
    "pon_ports_up": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.3.0",
    "onu_total": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.4.0",
    "onu_online": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.5.0",
    "upstream_rate_bps": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.6.0",
    "downstream_rate_bps": "1.3.6.1.4.1.4413.1.1.1.1.2.1.1.7.0",
}


class SNMPCollectionError(RuntimeError):
    """Raised when SNMP metric collection fails."""


CollectorCallable = Callable[..., Awaitable[Mapping[str, Any]]]


@dataclass(slots=True)
class SNMPCollectionResult:
    """Normalized SNMP collection output."""

    values: dict[str, Any]
    oids: dict[str, str]


async def collect_snmp_metrics(
    *,
    host: str,
    community: str,
    oids: Mapping[str, str],
    port: int = 161,
    timeout: float | None = None,
    hooks: Mapping[str, Any] | None = None,
) -> SNMPCollectionResult:
    """
    Collect SNMP metrics using either an injected hook or the pysnmp backend.

    Args:
        host: Target host or IP address.
        community: SNMP community string.
        oids: Mapping of logical metric name to SNMP OID.
        port: SNMP UDP port (defaults to 161).
        timeout: Optional timeout passed to pysnmp transport target.
        hooks: Optional hook mapping (typically ``DriverContext.hooks``).

    Returns:
        SNMPCollectionResult with raw values mapped by metric name.
    """

    collector = _hooked_collector(hooks)
    if collector is not None:
        values = await collector(
            host=host,
            community=community,
            oids=dict(oids),
            port=port,
            timeout=timeout,
        )
        return SNMPCollectionResult(values=dict(values), oids=dict(oids))

    values = await _pysnmp_collect(
        host=host,
        community=community,
        oids=oids,
        port=port,
        timeout=timeout,
    )
    return SNMPCollectionResult(values=values, oids=dict(oids))


def decode_maybe_base64(payload: str | bytes) -> bytes:
    """
    Decode a payload that might be base64 encoded.

    The VOLTHA REST API frequently returns configuration backups encoded in
    base64. This helper gracefully falls back to UTF-8 encoding when decoding
    fails so that callers always receive ``bytes``.
    """

    if isinstance(payload, bytes):
        return payload

    strip_payload = payload.strip()
    try:
        # Base64 inputs should be divisible by 4; pad if required.
        padding = len(strip_payload) % 4
        if padding:
            strip_payload += "=" * (4 - padding)
        decoded = base64.b64decode(strip_payload, validate=True)
        return decoded
    except Exception:
        return strip_payload.encode("utf-8", errors="ignore")


def _hooked_collector(hooks: Mapping[str, Any] | None) -> CollectorCallable | None:
    if not hooks:
        return None

    for key in ("snmp_collector", "snmp_client", "snmp_fetcher"):
        candidate = hooks.get(key)
        if candidate is None:
            continue
        if asyncio.iscoroutinefunction(candidate):
            return candidate  # type: ignore[return-value]
        if callable(candidate):

            async def _async_wrapper(
                _candidate: Any = candidate, **kwargs: Any
            ) -> Mapping[str, Any]:
                return await asyncio.to_thread(_candidate, **kwargs)

            return _async_wrapper
    return None


async def _pysnmp_collect(
    *,
    host: str,
    community: str,
    oids: Mapping[str, str],
    port: int,
    timeout: float | None,
) -> dict[str, Any]:
    try:
        from pysnmp.hlapi.asyncio import (  # type: ignore[import]
            CommunityData,
            ContextData,
            ObjectIdentity,
            ObjectType,
            SnmpEngine,
            UdpTransportTarget,
            getCmd,
        )
    except ImportError as exc:  # pragma: no cover - optional dependency path
        raise SNMPCollectionError(
            "pysnmp is required for SNMP metric collection. Install with 'pip install pysnmp'."
        ) from exc

    if not oids:
        return {}

    engine = SnmpEngine()
    try:
        request_args = [ObjectType(ObjectIdentity(oid)) for oid in oids.values()]
        error_indication, error_status, error_index, var_binds = await getCmd(
            engine,
            CommunityData(community),
            UdpTransportTarget((host, port), timeout=timeout or 2.0, retries=1),
            ContextData(),
            *request_args,
        )
        if error_indication:
            raise SNMPCollectionError(str(error_indication))
        if error_status:
            error_loc = (
                request_args[int(error_index) - 1][0] if error_index else '?'
            )
            raise SNMPCollectionError(
                f"{error_status.prettyPrint()} at {error_loc}"
            )

        values: dict[str, Any] = {}
        for (_name, value), metric_key in zip(var_binds, oids.keys(), strict=False):
            values[metric_key] = _normalize_snmp_value(value)
        return values
    finally:  # pragma: no branch - ensure dispatcher is closed
        transport = engine.transportDispatcher
        try:
            transport.closeDispatcher()
        except Exception:
            pass


def _normalize_snmp_value(value: Any) -> Any:
    pretty = value.prettyPrint() if hasattr(value, "prettyPrint") else str(value)
    for caster in (int, float):
        try:
            return caster(pretty)
        except (TypeError, ValueError):
            continue
    return pretty
