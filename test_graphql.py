#!/usr/bin/env python3
"""
Test GraphQL endpoint is working.
"""

import asyncio
from dotmac.platform.graphql.schema import schema


async def test_version_query():
    """Test the version query works."""
    query = "query { version }"

    result = await schema.execute(query)

    if result.errors:
        print("❌ Errors:", result.errors)
        return False

    if result.data:
        print("✅ GraphQL endpoint works!")
        print(f"   Version: {result.data['version']}")
        return True

    return False


async def test_schema_fields():
    """Test schema has the expected fields."""
    # Get the schema definition
    schema_str = str(schema)

    print(f"\n📊 GraphQL Schema loaded successfully")

    expected_fields = ["version", "subscribers", "sessions", "subscriberMetrics"]

    print(f"\n   Checking for expected fields:")
    for field in expected_fields:
        if field in schema_str:
            print(f"   ✅ {field}")
        else:
            print(f"   ❌ {field} (missing)")


if __name__ == "__main__":
    print("Testing GraphQL Schema...")
    print("=" * 60)

    asyncio.run(test_schema_fields())
    print()
    success = asyncio.run(test_version_query())

    print("=" * 60)
    if success:
        print("✅ GraphQL tests passed!")
    else:
        print("❌ GraphQL tests failed!")
