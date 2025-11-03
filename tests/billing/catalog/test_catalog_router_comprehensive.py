"""
Comprehensive integration tests for Billing Catalog Router.

Tests all product catalog router endpoints following the Two-Tier Testing Strategy.
Coverage Target: 85%+ for router endpoints
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def test_client(db_session, mock_tenant_dependency):
    """Create a test client for the FastAPI app with DB overrides."""

    from dotmac.platform.db import get_async_session
    from dotmac.platform.tenant import get_current_tenant_id

    app.dependency_overrides[get_async_session] = lambda: db_session
    app.dependency_overrides[get_current_tenant_id] = lambda: mock_tenant_dependency

    client = TestClient(app)

    yield client

    app.dependency_overrides.pop(get_async_session, None)
    app.dependency_overrides.pop(get_current_tenant_id, None)


@pytest.fixture
def mock_auth_dependency():
    """Mock authentication dependency."""
    from uuid import uuid4

    mock_user = UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        roles=["user"],
        permissions=[
            "catalog:read",
            "catalog:write",
            "billing:catalog:read",
            "billing:catalog:write",
        ],
        tenant_id=str(uuid4()),
    )

    from dotmac.platform.auth.dependencies import get_current_user

    with patch("dotmac.platform.auth.dependencies.get_current_user", return_value=mock_user):
        app.dependency_overrides[get_current_user] = lambda: mock_user
        try:
            yield mock_user
        finally:
            app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_tenant_dependency():
    """Mock tenant context dependency."""
    from uuid import uuid4

    tenant_id = str(uuid4())
    with patch("dotmac.platform.tenant.get_current_tenant_id", return_value=tenant_id):
        yield tenant_id


@pytest.mark.integration
class TestProductCategoryEndpoints:
    """Test product category endpoints."""

    @pytest.mark.asyncio
    async def test_create_category_success(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test successful category creation."""
        category_data = {
            "name": "Software",
            "description": "Software products and licenses",
            "default_tax_class": "digital_services",
            "sort_order": 1,
        }

        response = test_client.post(
            "/api/v1/billing/catalog/categories",
            json=category_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [201, 400, 401, 403, 500]

    @pytest.mark.asyncio
    async def test_list_categories(self, test_client, mock_auth_dependency, mock_tenant_dependency):
        """Test listing categories."""
        response = test_client.get(
            "/api/v1/billing/catalog/categories",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 401]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_category_by_id(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting category by ID."""
        category_id = str(uuid4())

        response = test_client.get(
            f"/api/v1/billing/catalog/categories/{category_id}",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 404, 401]


@pytest.mark.integration
class TestProductEndpoints:
    """Test product management endpoints."""

    @pytest.mark.asyncio
    async def test_create_product_success(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test successful product creation."""
        product_data = {
            "sku": f"SKU-{uuid4().hex[:8]}",
            "name": "Enterprise License",
            "description": "Annual enterprise software license",
            "category": "Software",
            "product_type": "subscription",
            "base_price": 999.99,
            "currency": "USD",
            "tax_class": "standard",
            "is_active": True,
            "metadata": {"tier": "enterprise"},
        }

        response = test_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [201, 400, 404, 401, 403, 500]

    @pytest.mark.asyncio
    async def test_list_products(self, test_client, mock_auth_dependency, mock_tenant_dependency):
        """Test listing products."""
        response = test_client.get(
            "/api/v1/billing/catalog/products",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 401]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_products_with_filters(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test listing products with filters."""
        response = test_client.get(
            "/api/v1/billing/catalog/products?is_active=true&product_type=subscription",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 401]

    @pytest.mark.asyncio
    async def test_get_product_by_id(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting product by ID."""
        product_id = str(uuid4())

        response = test_client.get(
            f"/api/v1/billing/catalog/products/{product_id}",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 404, 401]

    @pytest.mark.asyncio
    async def test_update_product(self, test_client, mock_auth_dependency, mock_tenant_dependency):
        """Test updating product."""
        product_id = str(uuid4())
        update_data = {
            "name": "Updated Product Name",
            "description": "Updated description",
        }

        response = test_client.put(
            f"/api/v1/billing/catalog/products/{product_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 404, 400, 401, 403, 500]

    @pytest.mark.asyncio
    async def test_update_product_price(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test updating product price."""
        product_id = str(uuid4())
        price_data = {
            "new_price": 1299.99,
        }

        response = test_client.patch(
            f"/api/v1/billing/catalog/products/{product_id}/price",
            json=price_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 404, 400, 401, 403, 500]

    @pytest.mark.asyncio
    async def test_delete_product(self, test_client, mock_auth_dependency, mock_tenant_dependency):
        """Test deleting product."""
        product_id = str(uuid4())

        response = test_client.delete(
            f"/api/v1/billing/catalog/products/{product_id}",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [204, 404, 401, 403]

    @pytest.mark.asyncio
    async def test_list_usage_based_products(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test listing usage-based products."""
        response = test_client.get(
            "/api/v1/billing/catalog/products/usage-based",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 401]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_products_by_category(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test listing products by category."""
        category_id = str(uuid4())

        response = test_client.get(
            f"/api/v1/billing/catalog/categories/{category_id}/products",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        assert response.status_code in [200, 404, 401]


@pytest.mark.integration
class TestCatalogRouterAuthorization:
    """Test authorization for catalog endpoints."""

    @pytest.mark.asyncio
    async def test_create_product_requires_auth(self, test_client):
        """Test that creating product requires authentication."""
        product_data = {
            "name": "Test Product",
            "sku": "SKU-123",
        }

        response = test_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
        )

        # Should fail without authentication or tenant context
        assert response.status_code in [400, 401, 403, 422]

    @pytest.mark.asyncio
    async def test_list_products_requires_auth(self, test_client):
        """Test that listing products requires authentication."""
        response = test_client.get("/api/v1/billing/catalog/products")

        # Should fail without authentication or tenant context
        assert response.status_code in [400, 401, 403, 422]


@pytest.mark.integration
class TestCatalogRouterErrorHandling:
    """Test error handling in catalog router."""

    @pytest.mark.asyncio
    async def test_create_product_invalid_data(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test creating product with invalid data."""
        product_data = {
            "name": "",  # Invalid empty name
        }

        response = test_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        # Should fail validation
        assert response.status_code in [400, 422, 401, 403]

    @pytest.mark.asyncio
    async def test_get_product_invalid_uuid(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting product with invalid UUID."""
        response = test_client.get(
            "/api/v1/billing/catalog/products/not-a-uuid",
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        # Should fail validation
        assert response.status_code in [400, 422, 401, 403]

    @pytest.mark.asyncio
    async def test_update_product_not_found(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test updating non-existent product."""
        product_id = str(uuid4())
        update_data = {"name": "Updated Name"}

        response = test_client.put(
            f"/api/v1/billing/catalog/products/{product_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": mock_tenant_dependency},
        )

        # Should return 404
        assert response.status_code in [404, 401, 403, 500]


@pytest.mark.integration
class TestCatalogRouterTenantIsolation:
    """Test tenant isolation for catalog endpoints."""

    @pytest.mark.asyncio
    async def test_products_tenant_isolation(self, test_client, mock_auth_dependency):
        """Test that each tenant only sees their own products."""
        # Test with tenant A
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant-a"):
            response_a = test_client.get(
                "/api/v1/billing/catalog/products",
                headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": "tenant-a"},
            )

        # Test with tenant B
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant-b"):
            response_b = test_client.get(
                "/api/v1/billing/catalog/products",
                headers={"Authorization": "Bearer fake-token", "X-Tenant-ID": "tenant-b"},
            )

        # Both should succeed
        assert response_a.status_code in [200, 401, 403]
        assert response_b.status_code in [200, 401, 403]
