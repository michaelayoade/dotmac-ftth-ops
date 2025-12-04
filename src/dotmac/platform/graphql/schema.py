"""
GraphQL schema for DotMac Platform Services.

Combines all GraphQL queries and mutations into a single schema.
"""

import strawberry

from dotmac.platform.graphql.mutations.orchestration import OrchestrationMutations
from dotmac.platform.graphql.queries.analytics import AnalyticsQueries
from dotmac.platform.graphql.queries.customer import CustomerQueries
from dotmac.platform.graphql.queries.fiber import FiberQueries
from dotmac.platform.graphql.queries.field_service import FieldServiceQueries
from dotmac.platform.graphql.queries.ip_management import (
    IPManagementMutations,
    IPManagementQueries,
)
from dotmac.platform.graphql.queries.ipv4_lifecycle import (
    IPv4LifecycleMutations,
    IPv4LifecycleQueries,
)
from dotmac.platform.graphql.queries.network import NetworkQueries
from dotmac.platform.graphql.queries.network_profile import (
    NetworkProfileMutations,
    NetworkProfileQueries,
)
from dotmac.platform.graphql.queries.orchestration import OrchestrationQueries
from dotmac.platform.graphql.queries.payment import PaymentQueries
from dotmac.platform.graphql.queries.radius import RadiusQueries
from dotmac.platform.graphql.queries.subscription import SubscriptionQueries
from dotmac.platform.graphql.queries.tenant import TenantQueries
from dotmac.platform.graphql.queries.user import UserQueries
from dotmac.platform.graphql.queries.wireless import WirelessQueries
from dotmac.platform.graphql.subscriptions.customer import CustomerSubscriptions
from dotmac.platform.graphql.subscriptions.network import NetworkSubscriptions
from dotmac.platform.version import get_version


@strawberry.type
class Query(
    AnalyticsQueries,  # type: ignore[misc]
    RadiusQueries,  # type: ignore[misc]
    CustomerQueries,  # type: ignore[misc]
    PaymentQueries,  # type: ignore[misc]
    SubscriptionQueries,  # type: ignore[misc]
    TenantQueries,  # type: ignore[misc]
    UserQueries,  # type: ignore[misc]
    NetworkQueries,  # type: ignore[misc]
    NetworkProfileQueries,  # type: ignore[misc]
    IPManagementQueries,  # type: ignore[misc]
    IPv4LifecycleQueries,  # type: ignore[misc]
    OrchestrationQueries,  # type: ignore[misc]
    WirelessQueries,  # type: ignore[misc]
    FiberQueries,  # type: ignore[misc]
    FieldServiceQueries,  # type: ignore[misc]
):
    """
    Root GraphQL query type.

    Combines all query types into a single root.
    Currently includes:
    - Analytics and metrics queries for dashboards
    - RADIUS subscriber and session queries for ISP management
    - Customer management queries with batched activities and notes
    - Payment and billing queries with batched customer and invoice data
    - Subscription management queries with customer/plan/invoice batching
    - Tenant management queries with conditional field loading
    - User management queries with role/permission batching
    - Network monitoring queries with device/traffic/alert batching
    - Network profile queries for subscriber VLAN/IP configuration
    - IP management queries for pool and reservation management with conflict detection
    - IPv4 lifecycle queries for address state management and tracking
    - Orchestration workflow queries for multi-system operations
    - Wireless infrastructure queries (access points, clients, coverage, RF analytics)
    - Field service management queries for technicians, scheduling, time tracking, and resources

    Note: Fiber infrastructure queries temporarily disabled pending database model implementation
    """

    @strawberry.field(description="API version and info")  # type: ignore[misc]
    def version(self) -> str:
        """Get GraphQL API version."""
        return get_version()


@strawberry.type
class Mutation(
    OrchestrationMutations,  # type: ignore[misc]
    NetworkProfileMutations,  # type: ignore[misc]
    IPManagementMutations,  # type: ignore[misc]
    IPv4LifecycleMutations,  # type: ignore[misc]
):
    """
    Root GraphQL mutation type.

    Includes:
    - Orchestration mutations for atomic multi-system operations
    - Subscriber provisioning with automatic rollback
    - Workflow management (retry, cancel)
    - Network profile management (create, update, delete)
    - IP management mutations (create/update pools, reserve/release IPs, auto-assign)
    - IPv4 lifecycle mutations (allocate, activate, suspend, reactivate, revoke)

    Note: Most CRUD operations should use REST endpoints.
    GraphQL mutations are primarily for complex orchestrated operations.
    """

    @strawberry.field(description="Health check mutation")  # type: ignore[misc]
    def ping(self) -> str:
        """Simple ping mutation for testing."""
        return "pong"


@strawberry.type
class RealtimeSubscription(
    CustomerSubscriptions,  # type: ignore[misc]
    NetworkSubscriptions,  # type: ignore[misc]
):
    """
    Root GraphQL subscription type for real-time updates.

    Provides real-time updates via WebSocket for:
    - Customer network status (connection, signal, performance)
    - Device health monitoring (status, temperature, firmware)
    - Support ticket updates (created, assigned, resolved)
    - Customer activities (timeline updates)
    - Customer notes (create, update, delete)
    - Network device updates (status, metrics, health)
    - Network alert notifications (triggered, acknowledged, resolved)

    WebSocket endpoint: ws://host/graphql
    Uses Redis pub/sub for event broadcasting.
    """

    pass


# Create the GraphQL schema
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=RealtimeSubscription,
)
