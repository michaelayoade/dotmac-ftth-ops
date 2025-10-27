from __future__ import annotations

from collections.abc import Iterable

import pytest

from dotmac.platform.auth.rbac_dependencies import PermissionChecker
from dotmac.platform.wireless.router import router


def _get_route(path: str, method: str):
    """Retrieve the router entry for a given path/method combination."""
    for route in router.routes:
        if route.path == path and method.upper() in route.methods:
            return route
    raise AssertionError(f"Route {method} {path} not found")


def _extract_permission_tokens(route) -> Iterable[list[str]]:
    """Yield the permission token lists attached to the route."""
    for dependency in route.dependant.dependencies:
        if isinstance(dependency.call, PermissionChecker):
            yield dependency.call.permissions


@pytest.mark.parametrize(
    ("path", "method", "expected"),
    [
        ("/wireless/devices", "GET", ["isp.network.wireless.read"]),
        ("/wireless/devices", "POST", ["isp.network.wireless.write"]),
        ("/wireless/devices/{device_id}", "PATCH", ["isp.network.wireless.write"]),
        ("/wireless/devices/{device_id}/health", "GET", ["isp.network.wireless.read"]),
        ("/wireless/radios", "POST", ["isp.network.wireless.write"]),
        ("/wireless/radios/{radio_id}", "GET", ["isp.network.wireless.read"]),
        ("/wireless/coverage-zones/{zone_id}", "DELETE", ["isp.network.wireless.write"]),
        ("/wireless/signal-measurements", "GET", ["isp.network.wireless.read"]),
        ("/wireless/clients", "GET", ["isp.network.wireless.read"]),
        ("/wireless/statistics", "GET", ["isp.network.wireless.read"]),
    ],
)
def test_wireless_routes_require_permissions(path: str, method: str, expected: list[str]):
    """Routes should enforce the expected wireless permissions."""
    route = _get_route(path, method)
    permission_lists = list(_extract_permission_tokens(route))
    assert expected in permission_lists, f"{method} {path} missing permission {expected}"
