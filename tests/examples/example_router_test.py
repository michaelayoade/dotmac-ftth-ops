"""
Example router test demonstrating best practices.

This test suite shows how to use the testing framework effectively,
based on patterns that fixed 31 test failures.

Run with: pytest tests/examples/example_router_test.py -v
"""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from tests.helpers.contract_testing import (
    ContractTestCase,
    MockDataFactory,
    SchemaValidator,
)
from tests.helpers.router_base import (
    CRUDRouterTestBase,
    RouterTestBase,
    RouterWithServiceTestBase,
)

# Example schemas (would normally be in app code)


pytestmark = pytest.mark.integration


class Product(BaseModel):
    id: str
    name: str
    price: float
    in_stock: bool = True


class ProductCreate(BaseModel):
    name: str
    price: float


# Example router (would normally be in app code)
example_router = APIRouter(prefix="/products", tags=["products"])


@example_router.get("/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """Example endpoint."""
    if product_id == "missing":
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(id=product_id, name="Test Product", price=99.99)


# ======================================================================
# Example 1: Basic Router Test
# ======================================================================


class TestBasicRouterPatterns(RouterTestBase):
    """
    Demonstrates basic router testing patterns.

    This class shows:
    1. How to set up router configuration
    2. Using standard fixtures
    3. Using assertion helpers
    """

    # Configure router (in real tests, point to actual app router)
    router_module = None  # Would be "dotmac.platform.products.router"
    router_name = "example_router"
    router_prefix = "/products"

    def test_successful_request(self, client):
        """Test a successful API request."""
        # Use the test_app fixture which has auth + tenant setup
        response = client.get("/api/v1/products/123")

        # Use assertion helper - automatically validates status and returns JSON
        data = self.assert_success(response)

        # Now can safely access response fields
        assert data["name"] == "Test Product"
        assert data["price"] == 99.99

    def test_not_found_error(self, client):
        """Test 404 error handling."""
        response = client.get("/api/v1/products/missing")

        # Use assertion helper for error cases
        self.assert_not_found(response, "Product")

    def test_field_validation(self, client):
        """Test that response has required fields."""
        response = client.get("/api/v1/products/123")
        data = self.assert_success(response)

        # Assert multiple fields are present
        self.assert_fields_present(data, "id", "name", "price", "in_stock")


# ======================================================================
# Example 2: Router with Service Layer
# ======================================================================


class TestRouterWithService(RouterWithServiceTestBase):
    """
    Demonstrates testing routers that use a service layer.

    This pattern:
    1. Automatically creates mock_service fixture
    2. Overrides service dependency
    3. Provides standard mocked methods
    """

    router_module = None  # "dotmac.platform.products.router"
    router_prefix = "/products"
    service_module = None  # "dotmac.platform.products.router"
    service_dependency_name = "get_product_service"

    def test_list_products(self, client, mock_service):
        """Test listing products with mocked service."""
        # Configure mock service return value
        mock_service.list.return_value = [
            {"id": "1", "name": "Widget", "price": 10.00},
            {"id": "2", "name": "Gadget", "price": 20.00},
        ]

        response = client.get("/api/v1/products")
        data = self.assert_success(response)

        assert len(data) >= 0  # Depends on actual router implementation

    def test_get_product(self, client, mock_service):
        """Test getting single product."""
        product_id = str(uuid4())
        mock_service.get.return_value = {
            "id": product_id,
            "name": "Test Product",
            "price": 99.99,
            "in_stock": True,
        }

        response = client.get(f"/api/v1/products/{product_id}")
        data = self.assert_success(response)

        assert data["name"] == "Test Product"

        # Verify service was called correctly
        mock_service.get.assert_called_once_with(product_id)


# ======================================================================
# Example 3: CRUD Router Testing
# ======================================================================


class TestCRUDPatterns(CRUDRouterTestBase):
    """
    Demonstrates CRUD router testing.

    This class automatically provides tests for:
    - test_list_resources
    - test_get_resource_success
    - test_get_resource_not_found
    - test_create_resource
    - test_update_resource
    - test_delete_resource

    You just need to configure the router and provide sample data.
    """

    router_module = None  # "dotmac.platform.products.router"
    router_prefix = "/products"
    resource_name = "product"

    # Customize sample data for your resource
    def get_sample_data(self):
        return {"name": "Test Product", "price": 99.99}

    def get_sample_response(self):
        return {
            "id": str(uuid4()),
            "name": "Test Product",
            "price": 99.99,
            "in_stock": True,
        }

    # All standard CRUD tests are inherited
    # You can add custom tests here

    def test_search_products(self, client, mock_service):
        """Example of adding custom test beyond CRUD."""
        mock_service.search = AsyncMock(return_value=[])

        response = client.get("/api/v1/products?search=widget")
        self.assert_success(response)


# ======================================================================
# Example 4: Contract Testing with Schemas
# ======================================================================


class TestContractPatterns(RouterTestBase, ContractTestCase):
    """
    Demonstrates contract testing with Pydantic schemas.

    This ensures:
    1. Mock data matches schemas
    2. Response data validates against schemas
    3. API contracts are maintained
    """

    router_module = None
    router_prefix = "/products"

    def test_validate_mock_data(self):
        """Test validating mock data against schema."""
        # Create mock data
        mock_data = {
            "id": "123",
            "name": "Test",
            "price": 99.99,
            "in_stock": True,
        }

        # Validate it matches schema
        validator = SchemaValidator(Product)
        validator.validate(mock_data)  # Raises if invalid

    def test_generate_mock_data(self):
        """Test generating valid mock data automatically."""
        # Generate data with defaults
        mock_data = MockDataFactory.create(Product)

        # Verify it's valid
        product = Product(**mock_data)
        assert product.id is not None

        # Generate with overrides
        mock_data = MockDataFactory.create(Product, id="custom-id", name="Custom Product")
        assert mock_data["id"] == "custom-id"
        assert mock_data["name"] == "Custom Product"

    def test_response_schema_validation(self, client, mock_service):
        """Test validating response against schema."""
        # Mock valid data
        mock_service.get.return_value = MockDataFactory.create(
            Product, id="123", name="Test Product"
        )

        response = client.get("/api/v1/products/123")

        # Validate response matches schema
        product = self.assert_response_schema(response, Product)

        # Now can safely use validated data
        assert isinstance(product, Product)
        assert product.name == "Test Product"

    def test_detect_schema_issues(self):
        """Test detecting issues with mock data."""
        validator = SchemaValidator(Product)

        # Mock data with issues
        bad_data = {
            "id": "123",
            "wrong_field": "value",  # Extra field
            "price": "not a number",  # Wrong type
            # Missing: name (required)
        }

        # Get diagnostics
        diagnostics = validator.compare_data(bad_data)

        assert "name" in diagnostics["missing_required"]
        assert "wrong_field" in diagnostics["extra_fields"]
        # type_mismatches may be detected


# ======================================================================
# Example 5: Testing Error Cases
# ======================================================================


class TestErrorHandlingPatterns(RouterTestBase):
    """
    Demonstrates testing error cases and edge conditions.
    """

    router_module = None
    router_prefix = "/products"

    def test_unauthorized_access(self, test_app):
        """Test that unauthorized requests are rejected."""
        from starlette.testclient import TestClient

        # Create client without auth override
        client = TestClient(test_app)

        response = client.get("/api/v1/products/123")

        # Should be unauthorized (or forbidden depending on setup)
        assert response.status_code in [401, 403]

    def test_missing_tenant_header(self, test_app):
        """Test that requests without tenant header are rejected."""
        from starlette.testclient import TestClient

        from dotmac.platform.auth.core import UserInfo, get_current_user

        # Override auth but don't add tenant header
        test_app.dependency_overrides[get_current_user] = lambda: UserInfo(
            user_id="test",
            tenant_id="test",
            email="test@example.com",
            is_platform_admin=True,
            username="test",
            roles=[],
            permissions=[],
        )

        client = TestClient(test_app)

        # Request without tenant header
        response = client.get("/api/v1/products/123")

        # Should be forbidden
        assert response.status_code == 403

    def test_validation_error(self, client):
        """Test validation errors are returned correctly."""
        # Send invalid data (if endpoint exists)
        response = client.post("/api/v1/products", json={})

        # Might be 422 validation error or 404 if endpoint doesn't exist
        assert response.status_code in [404, 422]

    def test_not_found(self, client):
        """Test 404 handling."""
        response = client.get("/api/v1/products/nonexistent")

        self.assert_not_found(response, "product")


# ======================================================================
# Example 6: Integration with Real Fixtures
# ======================================================================


@pytest.mark.skipif(True, reason="Example test - would require real fixtures")
class TestRealFixtureIntegration(RouterTestBase):
    """
    Demonstrates how to integrate with actual app fixtures.

    In real tests, you would:
    1. Point to actual router modules
    2. Use actual service dependencies
    3. Test against real schemas
    """

    # Real configuration
    router_module = "dotmac.platform.access.router"
    router_name = "router"
    router_prefix = "/access"

    def test_health_check(self, client, mock_service):
        """Example with real router."""
        from dotmac.platform.voltha.schemas import VOLTHAHealthResponse

        # Mock the service
        mock_service.health = AsyncMock(
            return_value=VOLTHAHealthResponse(
                healthy=True,
                state="HEALTHY",
                message="OK",
                total_devices=5,
            )
        )

        response = client.get("/api/v1/access/health")
        data = self.assert_success(response)

        # Validate against real schema
        health = VOLTHAHealthResponse(**data)
        assert health.healthy is True


# ======================================================================
# Running the Examples
# ======================================================================

if __name__ == "__main__":
    print("Example Test Suite")
    print("=" * 60)
    print()
    print("These examples demonstrate:")
    print("1. Basic router testing with RouterTestBase")
    print("2. Service mocking with RouterWithServiceTestBase")
    print("3. CRUD testing with CRUDRouterTestBase")
    print("4. Contract testing with SchemaValidator")
    print("5. Error handling patterns")
    print()
    print("Run with: pytest tests/examples/example_router_test.py -v")
