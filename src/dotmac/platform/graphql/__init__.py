"""
GraphQL API module for DotMac Platform Services.

Provides GraphQL endpoints optimized for analytics, metrics, and dashboard data.
GraphQL is used for read-heavy operations while REST handles CRUD operations.
"""

from dotmac.platform.graphql.schema import schema

__all__ = ["schema"]
