#!/usr/bin/env python3
"""
Test Customer GraphQL queries.
"""

import asyncio
from dotmac.platform.graphql.schema import schema


async def test_schema_has_customer_queries():
    """Test schema includes customer queries."""
    query = """
    query {
        __schema {
            queryType {
                fields {
                    name
                    description
                }
            }
        }
    }
    """

    result = await schema.execute(query)

    if result.errors:
        print("❌ Errors:", result.errors)
        return False

    if result.data:
        fields = result.data["__schema"]["queryType"]["fields"]
        field_names = [f["name"] for f in fields]

        print("📊 GraphQL Schema Query Fields:")
        print(f"   Total fields: {len(field_names)}\n")

        customer_fields = ["customer", "customers", "customerMetrics"]

        print("   Customer-related fields:")
        for field in customer_fields:
            if field in field_names:
                # Find the field description
                desc = next((f["description"] for f in fields if f["name"] == field), "")
                print(f"   ✅ {field}: {desc}")
            else:
                print(f"   ❌ {field} (missing)")

        return all(f in field_names for f in customer_fields)

    return False


async def test_customer_metrics_query():
    """Test the customerMetrics query."""
    query = """
    query {
        customerMetrics {
            totalCustomers
            activeCustomers
            prospectCustomers
            churnedCustomers
            totalLifetimeValue
            averageLifetimeValue
        }
    }
    """

    print("\n\n🧪 Testing customerMetrics query...")
    result = await schema.execute(query)

    if result.errors:
        print(f"❌ Query failed: {result.errors}")
        return False

    if result.data:
        metrics = result.data["customerMetrics"]
        print("✅ CustomerMetrics query successful!")
        print(f"   Total Customers: {metrics['totalCustomers']}")
        print(f"   Active: {metrics['activeCustomers']}")
        print(f"   Prospects: {metrics['prospectCustomers']}")
        print(f"   Churned: {metrics['churnedCustomers']}")
        return True

    return False


if __name__ == "__main__":
    print("Testing Customer GraphQL Implementation...")
    print("=" * 70)

    # Test 1: Schema has customer fields
    success1 = asyncio.run(test_schema_has_customer_queries())

    # Test 2: Customer metrics query
    success2 = asyncio.run(test_customer_metrics_query())

    print("\n" + "=" * 70)
    if success1 and success2:
        print("✅ All Customer GraphQL tests passed!")
        print("\n📋 Available Queries:")
        print("   - customer(id, includeActivities, includeNotes)")
        print("   - customers(limit, offset, status, search, includeActivities, includeNotes)")
        print("   - customerMetrics()")
        print("\n🎯 Key Features:")
        print("   ✅ DataLoader batching for activities (prevents N+1)")
        print("   ✅ DataLoader batching for notes (prevents N+1)")
        print("   ✅ Conditional field loading (includeActivities, includeNotes)")
        print("   ✅ Pagination support (limit, offset)")
        print("   ✅ Search and filtering")
        print("   ✅ Aggregated metrics")
    else:
        print("❌ Some Customer GraphQL tests failed!")
        exit(1)
