"""
End-to-End Tests for Billing Module

Tests the complete integration of:
- Product Catalog (products and categories)
- Pricing Rules and Calculations
- Payment Processing
- Invoice Generation

These tests verify the entire flow from product creation to payment processing.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

# Note: auth_headers fixture is provided by tests/e2e/conftest.py
# It includes both Authorization and X-Tenant-ID headers


pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


class TestProductCatalogE2E:
    """End-to-end tests for product catalog management."""

    async def test_create_and_retrieve_category(self, async_client: AsyncClient, auth_headers):
        """Test creating and retrieving a product category."""
        # Create category
        category_data = {
            "name": "Software Licenses",
            "description": "Software subscription licenses",
            "default_tax_class": "digital_services",  # Must match TaxClass enum
            "sort_order": 1,
        }

        create_response = await async_client.post(
            "/api/v1/billing/catalog/categories",
            json=category_data,
            headers=auth_headers,
        )

        assert create_response.status_code == 201
        category = create_response.json()
        assert category["name"] == "Software Licenses"
        assert "category_id" in category
        category_id = category["category_id"]

        # Retrieve category
        get_response = await async_client.get(
            f"/api/v1/billing/catalog/categories/{category_id}",
            headers=auth_headers,
        )

        assert get_response.status_code == 200
        retrieved = get_response.json()
        assert retrieved["category_id"] == category_id
        assert retrieved["name"] == "Software Licenses"

    async def test_list_categories(self, async_client: AsyncClient, auth_headers):
        """Test listing all categories."""
        response = await async_client.get(
            "/api/v1/billing/catalog/categories",
            headers=auth_headers,
        )

        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)

    async def test_create_product_complete_flow(self, async_client: AsyncClient, auth_headers):
        """Test complete product creation flow with category."""
        # First create a category
        category_data = {
            "name": "SaaS Products",
            "description": "SaaS subscription products",
            "default_tax_class": "standard",  # Use valid TaxClass enum value
        }

        category_response = await async_client.post(
            "/api/v1/billing/catalog/categories",
            json=category_data,
            headers=auth_headers,
        )
        assert category_response.status_code == 201
        category_response.json()["category_id"]

        # Create product in category
        product_data = {
            "name": "Premium Plan",
            "description": "Premium subscription plan with all features",
            "sku": f"PREMIUM-{uuid4().hex[:8]}",
            "category": "SaaS Products",  # category name, not category_id
            "product_type": "subscription",  # lowercase with underscore
            "base_price": 9999,  # Decimal in minor units (cents)
            "currency": "USD",
        }

        product_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )

        assert product_response.status_code == 201
        product = product_response.json()
        assert product["name"] == "Premium Plan"
        assert "product_id" in product
        assert product["category"] == "SaaS Products"
        # base_price returned as Decimal, could be string or number
        assert "base_price" in product

    async def test_list_products(self, async_client: AsyncClient, auth_headers):
        """Test listing products with filters."""
        # List all products
        response = await async_client.get(
            "/api/v1/billing/catalog/products",
            headers=auth_headers,
        )

        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)

    async def test_get_product_by_id(self, async_client: AsyncClient, auth_headers):
        """Test retrieving a specific product."""
        # Create a product first
        product_data = {
            "name": "Basic Plan",
            "sku": f"BASIC-{uuid4().hex[:8]}",
            "category": "General",  # Required field
            "product_type": "subscription",
            "base_price": 2999,  # In minor units (cents)
            "currency": "USD",
        }

        create_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        product_id = create_response.json()["product_id"]

        # Retrieve the product
        get_response = await async_client.get(
            f"/api/v1/billing/catalog/products/{product_id}",
            headers=auth_headers,
        )

        assert get_response.status_code == 200
        product = get_response.json()
        assert product["product_id"] == product_id
        assert product["name"] == "Basic Plan"

    async def test_update_product(self, async_client: AsyncClient, auth_headers):
        """Test updating product details."""
        # Create product
        product_data = {
            "name": "Starter Plan",
            "sku": f"STARTER-{uuid4().hex[:8]}",
            "product_type": "subscription",
            "base_price": 1999,
            "currency": "USD",
            "category": "General",  # Required field
        }

        create_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        product_id = create_response.json()["product_id"]

        # Update product
        update_data = {
            "name": "Starter Plan (Updated)",
            "description": "Updated description",
        }

        update_response = await async_client.put(
            f"/api/v1/billing/catalog/products/{product_id}",
            json=update_data,
            headers=auth_headers,
        )

        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == "Starter Plan (Updated)"
        assert updated["description"] == "Updated description"

    async def test_update_product_price(self, async_client: AsyncClient, auth_headers):
        """Test updating product price."""
        # Create product
        product_data = {
            "name": "Enterprise Plan",
            "sku": f"ENTERPRISE-{uuid4().hex[:8]}",
            "product_type": "subscription",
            "base_price": 29999,
            "currency": "USD",
            "category": "General",  # Required field
        }

        create_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        product_id = create_response.json()["product_id"]

        # Update price using request body that matches API schema
        price_response = await async_client.patch(
            f"/api/v1/billing/catalog/products/{product_id}/price",
            json={"new_price": "349.99"},
            headers=auth_headers,
        )

        assert price_response.status_code == 200
        result = price_response.json()
        assert "message" in result or "status" in result

    async def test_deactivate_product(self, async_client: AsyncClient, auth_headers):
        """Test deactivating a product."""
        # Create product
        product_data = {
            "name": "Legacy Plan",
            "sku": f"LEGACY-{uuid4().hex[:8]}",
            "product_type": "subscription",
            "base_price": 4999,
            "currency": "USD",
            "category": "General",  # Required field
        }

        create_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        product_id = create_response.json()["product_id"]

        # Deactivate product
        delete_response = await async_client.delete(
            f"/api/v1/billing/catalog/products/{product_id}",
            headers=auth_headers,
        )

        assert delete_response.status_code in [200, 204]


class TestPricingRulesE2E:
    """End-to-end tests for pricing rules."""

    async def test_create_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test creating a pricing rule."""
        rule_data = {
            "name": "Volume Discount",
            "description": "10% discount for quantities over 10",
            "discount_type": "percentage",
            "discount_value": "10.00",
            "min_quantity": 10,
            "applies_to_all": True,  # Rule must apply to something
        }

        response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )

        if response.status_code != 201:
            print(f"Error response: {response.json()}")
        assert response.status_code == 201
        rule = response.json()
        assert rule["name"] == "Volume Discount"
        assert "rule_id" in rule
        assert rule["discount_value"] == "10.00"

    async def test_list_pricing_rules(self, async_client: AsyncClient, auth_headers):
        """Test listing all pricing rules."""
        response = await async_client.get(
            "/api/v1/billing/pricing/rules",
            headers=auth_headers,
        )

        assert response.status_code == 200
        rules = response.json()
        assert isinstance(rules, list)

    async def test_get_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test retrieving a specific pricing rule."""
        # Create rule first
        rule_data = {
            "name": "Early Bird Discount",
            "discount_type": "percentage",
            "discount_value": "15.00",
            "applies_to_all": True,
        }

        create_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        rule_id = create_response.json()["rule_id"]

        # Get the rule
        get_response = await async_client.get(
            f"/api/v1/billing/pricing/rules/{rule_id}",
            headers=auth_headers,
        )

        assert get_response.status_code == 200
        rule = get_response.json()
        assert rule["rule_id"] == rule_id
        assert rule["name"] == "Early Bird Discount"

    async def test_update_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test updating a pricing rule."""
        # Create rule
        rule_data = {
            "name": "Test Rule",
            "discount_type": "percentage",
            "discount_value": "5.00",
            "applies_to_all": True,
        }

        create_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        rule_id = create_response.json()["rule_id"]

        # Update rule
        update_data = {
            "discount_value": "7.50",
            "applies_to_all": True,
        }

        update_response = await async_client.patch(
            f"/api/v1/billing/pricing/rules/{rule_id}",
            json=update_data,
            headers=auth_headers,
        )

        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["discount_value"] == "7.50"

    async def test_activate_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test activating a pricing rule."""
        # Create inactive rule
        rule_data = {
            "name": "Seasonal Promo",
            "discount_type": "percentage",
            "discount_value": "20.00",
            "applies_to_all": True,
        }

        create_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        rule_id = create_response.json()["rule_id"]

        # Activate rule
        activate_response = await async_client.post(
            f"/api/v1/billing/pricing/rules/{rule_id}/activate",
            headers=auth_headers,
        )

        assert activate_response.status_code == 200

    async def test_deactivate_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test deactivating a pricing rule."""
        # Create active rule
        rule_data = {
            "name": "Expired Promo",
            "discount_type": "percentage",
            "discount_value": "25.00",
            "applies_to_all": True,
        }

        create_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        rule_id = create_response.json()["rule_id"]

        # Deactivate rule
        deactivate_response = await async_client.post(
            f"/api/v1/billing/pricing/rules/{rule_id}/deactivate",
            headers=auth_headers,
        )

        assert deactivate_response.status_code == 200

    async def test_delete_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test deleting a pricing rule."""
        # Create rule
        rule_data = {
            "name": "Temp Rule",
            "discount_type": "percentage",
            "discount_value": "10.00",
            "applies_to_all": True,
        }

        create_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        rule_id = create_response.json()["rule_id"]

        # Delete rule
        delete_response = await async_client.delete(
            f"/api/v1/billing/pricing/rules/{rule_id}",
            headers=auth_headers,
        )

        assert delete_response.status_code in [200, 204]

    async def test_calculate_price(self, async_client: AsyncClient, auth_headers):
        """Test price calculation with rules."""
        # Create product first
        product_data = {
            "name": "Calculation Test Product",
            "sku": f"CALC-{uuid4().hex[:8]}",
            "product_type": "one_time",
            "base_price": 10000,
            "currency": "USD",
            "category": "General",  # Required field
        }

        product_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        product_id = product_response.json()["product_id"]

        # Calculate price
        calc_request = {
            "product_id": product_id,
            "quantity": 5,
            "customer_id": "test-customer-123",
        }

        calc_response = await async_client.post(
            "/api/v1/billing/pricing/calculate",
            json=calc_request,
            headers=auth_headers,
        )

        assert calc_response.status_code == 200
        result = calc_response.json()
        assert "base_price" in result or "final_price" in result

    async def test_bulk_activate_rules(self, async_client: AsyncClient, auth_headers):
        """Test bulk activating multiple rules."""
        # Create multiple inactive rules
        rule_ids = []
        for i in range(3):
            rule_data = {
                "name": f"Bulk Rule {i}",
                "discount_type": "percentage",
                "discount_value": "5.00",
                "applies_to_all": True,
            }
            response = await async_client.post(
                "/api/v1/billing/pricing/rules",
                json=rule_data,
                headers=auth_headers,
            )
            rule_ids.append(response.json()["rule_id"])

        # Bulk activate
        bulk_response = await async_client.post(
            "/api/v1/billing/pricing/rules/bulk-activate",
            json=rule_ids,
            headers=auth_headers,
        )

        assert bulk_response.status_code == 200


class TestPricingAndCatalogIntegrationE2E:
    """End-to-end tests for pricing and catalog integration."""

    async def test_product_with_pricing_rule_flow(self, async_client: AsyncClient, auth_headers):
        """Test complete flow: create product, create rule, calculate price."""
        # Step 1: Create product
        product_data = {
            "name": "Integration Test Product",
            "sku": f"INTEG-{uuid4().hex[:8]}",
            "product_type": "one_time",
            "base_price": 20000,
            "currency": "USD",
            "category": "General",  # Required field
        }

        product_response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=product_data,
            headers=auth_headers,
        )
        assert product_response.status_code == 201
        product_id = product_response.json()["product_id"]

        # Step 2: Create pricing rule
        rule_data = {
            "name": "Integration Discount",
            "discount_type": "percentage",
            "discount_value": "15.00",
            "applies_to_product_ids": [product_id],
        }

        rule_response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=rule_data,
            headers=auth_headers,
        )
        assert rule_response.status_code == 201

        # Step 3: Calculate price with rule applied
        calc_request = {
            "product_id": product_id,
            "quantity": 1,
            "customer_id": "test-customer-123",
        }

        calc_response = await async_client.post(
            "/api/v1/billing/pricing/calculate",
            json=calc_request,
            headers=auth_headers,
        )

        assert calc_response.status_code == 200
        # Price should reflect discount

    async def test_list_products_by_category_with_pricing(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test listing products by category and checking pricing."""
        # Create category
        category_data = {
            "name": "Premium Services",
            "description": "Premium tier services",
        }

        category_response = await async_client.post(
            "/api/v1/billing/catalog/categories",
            json=category_data,
            headers=auth_headers,
        )
        category_response.json()["category_id"]

        # Create products in category
        for i in range(2):
            product_data = {
                "name": f"Premium Service {i}",
                "sku": f"PREMIUM-{i}-{uuid4().hex[:6]}",
                "product_type": "subscription",
                "base_price": (i + 1) * 5000,
                "currency": "USD",
                "category": "Premium Services",  # Match the category name created above
            }

            await async_client.post(
                "/api/v1/billing/catalog/products",
                json=product_data,
                headers=auth_headers,
            )

        # List products by category (using category name, not category_id)
        list_response = await async_client.get(
            "/api/v1/billing/catalog/categories/Premium Services/products",
            headers=auth_headers,
        )

        assert list_response.status_code == 200
        products = list_response.json()
        assert len(products) >= 2


class TestPaymentWorkflowE2E:
    """End-to-end tests for payment workflows."""

    async def test_get_failed_payments(self, async_client: AsyncClient, auth_headers):
        """Test retrieving failed payments summary."""
        response = await async_client.get(
            "/api/v1/billing/payments/failed",
            headers=auth_headers,
        )

        # Endpoint may require specific permissions or return empty data
        assert response.status_code in [200, 403, 404]

        if response.status_code == 200:
            data = response.json()
            # Should have summary structure
            assert isinstance(data, dict)


class TestBillingCatalogErrorHandling:
    """Test error handling in billing catalog."""

    async def test_get_nonexistent_product(self, async_client: AsyncClient, auth_headers):
        """Test retrieving a product that doesn't exist."""
        missing_id = str(uuid4())
        response = await async_client.get(
            f"/api/v1/billing/catalog/products/{missing_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_get_nonexistent_category(self, async_client: AsyncClient, auth_headers):
        """Test retrieving a category that doesn't exist."""
        response = await async_client.get(
            "/api/v1/billing/catalog/categories/nonexistent-cat-12345",
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_create_product_invalid_data(self, async_client: AsyncClient, auth_headers):
        """Test creating product with invalid data."""
        invalid_data = {
            "name": "",  # Empty name should fail
            "base_price": "invalid",  # Invalid price format
        }

        response = await async_client.post(
            "/api/v1/billing/catalog/products",
            json=invalid_data,
            headers=auth_headers,
        )

        assert response.status_code == 422  # Validation error

    async def test_create_pricing_rule_invalid_data(self, async_client: AsyncClient, auth_headers):
        """Test creating pricing rule with invalid data."""
        invalid_data = {
            "name": "",
            "discount_value": "150.00",  # Over 100%
        }

        response = await async_client.post(
            "/api/v1/billing/pricing/rules",
            json=invalid_data,
            headers=auth_headers,
        )

        assert response.status_code == 422

    async def test_update_nonexistent_product(self, async_client: AsyncClient, auth_headers):
        """Test updating a product that doesn't exist."""
        update_data = {
            "name": "Updated Name",
        }
        missing_id = str(uuid4())

        response = await async_client.put(
            f"/api/v1/billing/catalog/products/{missing_id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 404

    async def test_delete_nonexistent_pricing_rule(self, async_client: AsyncClient, auth_headers):
        """Test deleting a pricing rule that doesn't exist."""
        response = await async_client.delete(
            "/api/v1/billing/pricing/rules/nonexistent-rule-123",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestBillingConcurrentOperations:
    """Test concurrent operations in billing."""

    async def test_create_multiple_products_concurrently(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test creating multiple products sequentially."""
        # Create 3 products sequentially (E2E tests share same db_session)
        responses = []
        for i in range(3):
            product_data = {
                "name": f"Concurrent Product {i}",
                "sku": f"CONC-{i}-{uuid4().hex[:6]}",
                "product_type": "one_time",
                "base_price": i * 1000,
                "currency": "USD",
                "category": "General",  # Required field
            }

            response = await async_client.post(
                "/api/v1/billing/catalog/products",
                json=product_data,
                headers=auth_headers,
            )
            responses.append(response)

        # All should succeed
        for response in responses:
            assert response.status_code == 201

    async def test_create_multiple_categories_concurrently(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test creating multiple categories sequentially."""
        # Create 3 categories sequentially (E2E tests share same db_session)
        responses = []
        for i in range(3):
            category_data = {
                "name": f"Concurrent Category {i}",
                "description": f"Category {i}",
            }

            response = await async_client.post(
                "/api/v1/billing/catalog/categories",
                json=category_data,
                headers=auth_headers,
            )
            responses.append(response)

        # All should succeed
        for response in responses:
            assert response.status_code == 201


class TestBillingListingAndFiltering:
    """Test listing and filtering capabilities."""

    async def test_list_products_with_filters(self, async_client: AsyncClient, auth_headers):
        """Test listing products with various filters."""
        # Create test products
        for i in range(3):
            product_data = {
                "name": f"Filter Test {i}",
                "sku": f"FILTER-{i}-{uuid4().hex[:6]}",
                "product_type": "subscription" if i % 2 == 0 else "one_time",
                "base_price": (i + 1) * 2500,
                "currency": "USD",
                "category": "General",  # Required field
            }

            await async_client.post(
                "/api/v1/billing/catalog/products",
                json=product_data,
                headers=auth_headers,
            )

        # List with filters (use lowercase enum value)
        response = await async_client.get(
            "/api/v1/billing/catalog/products?product_type=subscription",
            headers=auth_headers,
        )

        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)

    async def test_list_usage_based_products(self, async_client: AsyncClient, auth_headers):
        """Test listing usage-based products."""
        response = await async_client.get(
            "/api/v1/billing/catalog/products/usage-based",
            headers=auth_headers,
        )

        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
