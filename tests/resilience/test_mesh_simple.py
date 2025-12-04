"""Simple focused tests to boost service mesh coverage."""

import pytest

from dotmac.platform.resilience.service_mesh import (
    LoadBalancer,
    ServiceEndpoint,
    ServiceRegistry,
)

pytestmark = pytest.mark.unit


class TestLoadBalancerAdditional:
    """Additional load balancer tests."""

    def test_weighted_zero_weight(self):
        """Test weighted selection with zero weights."""
        registry = ServiceRegistry()
        ep1 = ServiceEndpoint("svc", "host1.com", 8000, weight=0)
        ep2 = ServiceEndpoint("svc", "host2.com", 8001, weight=0)
        registry.register_endpoint(ep1)
        registry.register_endpoint(ep2)

        lb = LoadBalancer(registry)
        result = lb._select_weighted([ep1, ep2])
        assert result == ep1

    def test_consistent_hash(self):
        """Test consistent hash selection."""
        registry = ServiceRegistry()
        ep1 = ServiceEndpoint("svc", "host1.com", 8000)
        ep2 = ServiceEndpoint("svc", "host2.com", 8001)
        registry.register_endpoint(ep1)
        registry.register_endpoint(ep2)

        lb = LoadBalancer(registry)
        result = lb._select_consistent_hash([ep1, ep2], {"user": "123"})
        assert result in [ep1, ep2]

    def test_least_connections(self):
        """Test least connections selection."""
        registry = ServiceRegistry()
        ep1 = ServiceEndpoint("svc", "host1.com", 8000)
        ep2 = ServiceEndpoint("svc", "host2.com", 8001)
        registry.register_endpoint(ep1)
        registry.register_endpoint(ep2)

        registry.connection_counts["host1.com:8000"] = 5
        registry.connection_counts["host2.com:8001"] = 2

        lb = LoadBalancer(registry)
        result = lb._select_least_connections([ep1, ep2])
        assert result == ep2
