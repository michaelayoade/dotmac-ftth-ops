"""
Core utilities and shared functionality for the DotMac platform.

This module contains infrastructure components used across the platform:
- Rate limiting
- Distributed locks
- Caching and cache decorators
- Task queue utilities
- Core exceptions and models
- Domain-Driven Design (DDD) components:
  - Domain events
  - Aggregate roots
  - Value objects
  - Domain event dispatcher
"""

# Re-export for backwards compatibility and convenience
from dotmac.platform.core.aggregate_root import (
    AggregateRoot,
    EmailAddress,
    Entity,
    Money,
    PhoneNumber,
    ValueObject,
)
from dotmac.platform.core.cache_decorators import CacheTier, cached_result
from dotmac.platform.core.caching import get_redis, redis_client
from dotmac.platform.core.distributed_locks import DistributedLock
from dotmac.platform.core.domain_event_dispatcher import (
    DomainEventDispatcher,
    get_domain_event_dispatcher,
    reset_domain_event_dispatcher,
)
from dotmac.platform.core.domain_event_integration import (
    DomainEventPublisher,
    get_domain_event_publisher,
    reset_domain_event_publisher,
)

# Domain-Driven Design components
from dotmac.platform.core.events import (  # Customer events; Billing events; Payment events; Subscription events
    CustomerCreatedEvent,
    CustomerDeletedEvent,
    CustomerUpdatedEvent,
    DomainEvent,
    DomainEventMetadata,
    InvoiceCreatedEvent,
    InvoiceOverdueEvent,
    InvoicePaymentReceivedEvent,
    InvoiceVoidedEvent,
    PaymentFailedEvent,
    PaymentProcessedEvent,
    PaymentRefundedEvent,
    SubscriptionCancelledEvent,
    SubscriptionCreatedEvent,
    SubscriptionRenewedEvent,
    SubscriptionUpgradedEvent,
)
from dotmac.platform.core.exceptions import (
    AuthorizationError,
    BusinessRuleError,
    ConfigurationError,
    DotMacError,
    DuplicateEntityError,
    EntityNotFoundError,
    NotFoundError,
    RepositoryError,
    ValidationError,
)
from dotmac.platform.core.models import BaseModel, TenantContext
from dotmac.platform.core.rate_limiting import get_limiter, limiter
from dotmac.platform.core.tasks import app as celery_app
from dotmac.platform.core.tasks import idempotent_task


def ensure_pydantic_v2() -> None:
    """Ensure Pydantic v2 is being used.

    Raises:
        ImportError: If Pydantic v1 is detected
    """
    try:
        import pydantic
    except ImportError as exc:  # pragma: no cover - defensive guard
        raise ImportError("Pydantic is required but is not installed.") from exc

    version_str = getattr(pydantic, "__version__", None)
    if version_str is None:
        raise ImportError("Unable to determine installed Pydantic version.")

    try:
        major_version = int(version_str.split(".")[0])
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive guard
        raise ImportError(f"Failed to parse Pydantic version '{version_str}'.") from exc

    if major_version < 2:
        raise ImportError(
            f"Pydantic v2 is required, but v{version_str} is installed. "
            "Please upgrade: pip install 'pydantic>=2.0'"
        )


__all__ = [
    # Pydantic version check
    "ensure_pydantic_v2",
    # Rate limiting
    "get_limiter",
    "limiter",
    # Distributed locks
    "DistributedLock",
    # Caching
    "redis_client",
    "get_redis",
    "CacheTier",
    "cached_result",
    # Tasks
    "celery_app",
    "idempotent_task",
    # Exceptions
    "DotMacError",
    "ValidationError",
    "AuthorizationError",
    "ConfigurationError",
    "BusinessRuleError",
    "RepositoryError",
    "EntityNotFoundError",
    "NotFoundError",
    "DuplicateEntityError",
    # Models
    "BaseModel",
    "TenantContext",
    # Domain Events
    "DomainEvent",
    "DomainEventMetadata",
    # Billing Domain Events
    "InvoiceCreatedEvent",
    "InvoicePaymentReceivedEvent",
    "InvoiceVoidedEvent",
    "InvoiceOverdueEvent",
    # Subscription Domain Events
    "SubscriptionCreatedEvent",
    "SubscriptionRenewedEvent",
    "SubscriptionCancelledEvent",
    "SubscriptionUpgradedEvent",
    # Customer Domain Events
    "CustomerCreatedEvent",
    "CustomerUpdatedEvent",
    "CustomerDeletedEvent",
    # Payment Domain Events
    "PaymentProcessedEvent",
    "PaymentFailedEvent",
    "PaymentRefundedEvent",
    # DDD Building Blocks
    "AggregateRoot",
    "Entity",
    "ValueObject",
    "Money",
    "EmailAddress",
    "PhoneNumber",
    # Domain Event Infrastructure
    "DomainEventDispatcher",
    "get_domain_event_dispatcher",
    "reset_domain_event_dispatcher",
    "DomainEventPublisher",
    "get_domain_event_publisher",
    "reset_domain_event_publisher",
]
