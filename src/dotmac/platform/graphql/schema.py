"""
GraphQL schema for DotMac Platform Services.

Combines all GraphQL queries and mutations into a single schema.
"""

import strawberry

from dotmac.platform.graphql.queries.analytics import AnalyticsQueries


@strawberry.type
class Query(AnalyticsQueries):  # type: ignore[misc]
    """
    Root GraphQL query type.

    Combines all query types into a single root.
    Currently includes:
    - Analytics and metrics queries for dashboards
    """

    @strawberry.field(description="API version and info")  # type: ignore[misc]
    def version(self) -> str:
        """Get GraphQL API version."""
        return "1.0.0"


@strawberry.type
class Mutation:
    """
    Root GraphQL mutation type.

    Placeholder for future mutations.
    CRUD operations should remain in REST endpoints.
    """

    @strawberry.field(description="Health check mutation")  # type: ignore[misc]
    def ping(self) -> str:
        """Simple ping mutation for testing."""
        return "pong"


# Create the GraphQL schema
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)
