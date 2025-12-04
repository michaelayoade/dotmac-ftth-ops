import types
from urllib.parse import urlencode

import pytest
from fastapi import Request
from starlette.datastructures import Headers

from dotmac.platform.tenant.tenant import TenantIdentityResolver

pytestmark = pytest.mark.asyncio


def make_request(headers=None, query=None, state_dict=None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "headers": Headers(headers or {}).raw,
        "query_string": urlencode(query or {}).encode("utf-8"),
    }
    req = Request(scope)
    if state_dict is not None:
        # request.state is a SimpleNamespace-like; we mimic by setting __dict__
        ns = types.SimpleNamespace()
        ns.__dict__.update(state_dict)
        object.__setattr__(req, "_state", ns)
    return req


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_prefers_header_then_query_then_state():
    """Test that resolver ONLY reads from request.state for security.

    SECURITY: The resolver now only trusts middleware-set request.state.tenant_id
    to prevent tenant ID spoofing. Headers and query params are ignored.
    Middleware is responsible for setting state based on priority: header > query > default
    """
    from dotmac.platform.tenant.config import TenantConfiguration, TenantMode

    # Create a multi-tenant config for this test
    config = TenantConfiguration(mode=TenantMode.MULTI)
    r = TenantIdentityResolver(config=config)

    # SECURITY: Only state is trusted (headers/query are ignored)
    req = make_request(
        headers={"X-Tenant-ID": "H"}, query={"tenant_id": "Q"}, state_dict={"tenant_id": "S"}
    )
    assert await r.resolve(req) == "S"  # Only state is read

    # State is used even when header/query are present
    req2 = make_request(headers={}, query={"tenant_id": "Q"}, state_dict={"tenant_id": "S"})
    assert await r.resolve(req2) == "S"  # Only state is read

    # State used (as expected)
    req3 = make_request(headers={}, query={}, state_dict={"tenant_id": "S"})
    assert await r.resolve(req3) == "S"

    # None when not present
    req4 = make_request(headers={}, query={})
    assert await r.resolve(req4) is None
