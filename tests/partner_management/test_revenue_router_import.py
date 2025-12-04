"""Test partner revenue router import and dependency injection (regression tests)."""

import pytest

pytestmark = pytest.mark.integration


def test_revenue_router_imports_successfully():
    """Test that revenue router can be imported without NameError.

    Regression test for: get_current_partner dependency was used but not imported,
    causing NameError at import time and preventing router registration.
    """

    try:
        from dotmac.platform.partner_management.revenue_router import router

        assert router is not None
        assert hasattr(router, "routes")
    except NameError as e:
        pytest.fail(f"Revenue router failed to import due to NameError: {e}")
    except ImportError as e:
        pytest.fail(f"Revenue router failed to import: {e}")


def test_revenue_router_has_all_expected_routes():
    """Test that revenue router has all expected endpoints registered."""
    from dotmac.platform.partner_management.revenue_router import router

    # Get all route paths
    route_paths = [route.path for route in router.routes]

    # Expected endpoints
    expected_paths = [
        "/revenue/metrics",
        "/revenue/commissions",
        "/revenue/commissions/{commission_id}",
        "/revenue/payouts",
        "/revenue/payouts/{payout_id}",
    ]

    for expected_path in expected_paths:
        assert expected_path in route_paths, f"Missing expected route: {expected_path}"

    # Verify we have exactly 5 routes
    assert len(router.routes) == 5


def test_revenue_router_dependencies_are_defined():
    """Test that all dependency functions used in routes are properly imported and defined.

    Regression test for: Dependencies referenced in Depends() must be imported.
    """
    from dotmac.platform.partner_management.revenue_router import (
        get_portal_partner,
        get_revenue_service,
        router,
    )

    # Verify dependency functions exist
    assert callable(get_portal_partner)
    assert callable(get_revenue_service)

    # Verify routes use the correct dependencies
    for route in router.routes:
        # Check that dependencies are callable (not None or undefined)
        for dependency in route.dependencies:
            assert callable(dependency.dependency), (
                f"Route {route.path} has non-callable dependency"
            )


def test_commission_details_endpoint_uses_correct_dependency():
    """Test that get_commission_details endpoint uses get_portal_partner (not get_current_partner).

    Regression test for: endpoint was using undefined get_current_partner instead of
    get_portal_partner, causing NameError.
    """
    from dotmac.platform.partner_management.revenue_router import router

    # Find the commission details endpoint
    commission_details_route = None
    for route in router.routes:
        if route.path == "/revenue/commissions/{commission_id}":
            commission_details_route = route
            break

    assert commission_details_route is not None, "Commission details endpoint not found"

    # Get the endpoint function
    endpoint_func = commission_details_route.endpoint

    # Check that get_portal_partner is in the function's signature dependencies
    # (This is a bit indirect, but verifies the dependency is used)
    import inspect

    sig = inspect.signature(endpoint_func)
    params = sig.parameters

    # The 'partner' parameter should use get_portal_partner
    assert "partner" in params
    partner_param = params["partner"]

    # With Annotated, the dependency is in the annotation metadata, not the default
    # Get the annotation
    import typing

    annotation = partner_param.annotation

    # For Annotated types, get the metadata
    if hasattr(typing, "get_args"):
        # Python 3.8+
        annotation_args = typing.get_args(annotation)
        if annotation_args and len(annotation_args) > 1:
            # Second arg should be the Depends() call
            dependency_metadata = annotation_args[1]
            if hasattr(dependency_metadata, "dependency"):
                dependency_func = dependency_metadata.dependency
                # Verify it's get_portal_partner (by name or callable)
                assert dependency_func.__name__ == "get_portal_partner", (
                    f"Expected get_portal_partner, got {dependency_func.__name__}"
                )
            else:
                # If we got here without Depends, fail the test
                raise AssertionError(
                    f"Expected Depends() in annotation, got {type(dependency_metadata)}"
                )


def test_all_partner_management_routers_import():
    """Test that all partner management routers can be imported successfully."""
    router_modules = [
        "dotmac.platform.partner_management.router",
        "dotmac.platform.partner_management.revenue_router",
        "dotmac.platform.partner_management.portal_router",
    ]

    for module_name in router_modules:
        try:
            module = __import__(module_name, fromlist=["router"])
            assert hasattr(module, "router"), f"{module_name} missing 'router' attribute"
        except NameError as e:
            pytest.fail(f"{module_name} failed to import due to NameError: {e}")
        except ImportError as e:
            pytest.fail(f"{module_name} failed to import: {e}")
