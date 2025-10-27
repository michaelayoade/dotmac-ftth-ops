"""Tests for core module __init__ exports."""

import pytest

import dotmac.platform.core as core


@pytest.mark.unit
class TestCoreModuleExports:
    """Test that core module exports all expected symbols."""

    def test_exception_exports(self):
        """Test that all exception classes are exported."""
        # Test base exception
        assert hasattr(core, "DotMacError")
        assert core.DotMacError is not None

        # Test domain exceptions
        assert hasattr(core, "ValidationError")
        assert hasattr(core, "AuthorizationError")
        assert hasattr(core, "ConfigurationError")
        assert hasattr(core, "BusinessRuleError")

        # Test repository exceptions
        assert hasattr(core, "RepositoryError")
        assert hasattr(core, "EntityNotFoundError")
        assert hasattr(core, "DuplicateEntityError")

    def test_model_exports(self):
        """Test that all model classes are exported."""
        assert hasattr(core, "BaseModel")
        assert hasattr(core, "TenantContext")

    def test_all_contains_exceptions(self):
        """Test that __all__ contains all exception names."""
        assert "DotMacError" in core.__all__
        assert "ValidationError" in core.__all__
        assert "AuthorizationError" in core.__all__
        assert "ConfigurationError" in core.__all__
        assert "BusinessRuleError" in core.__all__
        assert "RepositoryError" in core.__all__
        assert "EntityNotFoundError" in core.__all__
        assert "DuplicateEntityError" in core.__all__

    def test_all_contains_models(self):
        """Test that __all__ contains all model names."""
        assert "BaseModel" in core.__all__
        assert "TenantContext" in core.__all__

    def test_all_length(self):
        """Test that __all__ contains exactly the expected number of exports."""
        # 9 exceptions + 2 models + 10 infrastructure + 28 domain events components = 49 total
        # Exceptions: DotMacError, ValidationError, AuthorizationError, ConfigurationError,
        #             BusinessRuleError, RepositoryError, EntityNotFoundError, NotFoundError,
        #             DuplicateEntityError
        # Models: BaseModel, TenantContext
        # Infrastructure: ensure_pydantic_v2, get_limiter, limiter, DistributedLock,
        #                 redis_client, get_redis, CacheTier, cached_result, celery_app,
        #                 idempotent_task
        # Domain events components:
        # - DomainEvent, DomainEventMetadata, DomainEventDispatcher, DomainEventPublisher
        # - AggregateRoot, Entity, ValueObject
        # - Value objects: Money, EmailAddress, PhoneNumber
        # - 13 predefined domain events (Invoice, Subscription, Customer, Payment)
        # - 4 factory/helper functions (get/reset for dispatcher and publisher)
        assert len(core.__all__) == 49

    def test_import_from_core(self):
        """Test that symbols can be imported from core."""
        from dotmac.platform.core import (
            AuthorizationError,
            BaseModel,
            BusinessRuleError,
            ConfigurationError,
            DotMacError,
            DuplicateEntityError,
            EntityNotFoundError,
            RepositoryError,
            TenantContext,
            ValidationError,
        )

        # Verify all imports are not None
        assert DotMacError is not None
        assert ValidationError is not None
        assert AuthorizationError is not None
        assert ConfigurationError is not None
        assert BusinessRuleError is not None
        assert RepositoryError is not None
        assert EntityNotFoundError is not None
        assert DuplicateEntityError is not None
        assert BaseModel is not None
        assert TenantContext is not None

    def test_exception_classes_are_exception_types(self):
        """Test that all exported exception classes are actually Exception types."""
        exception_names = [
            "DotMacError",
            "ValidationError",
            "AuthorizationError",
            "ConfigurationError",
            "BusinessRuleError",
            "RepositoryError",
            "EntityNotFoundError",
            "DuplicateEntityError",
        ]

        for exc_name in exception_names:
            exc_class = getattr(core, exc_name)
            assert issubclass(exc_class, Exception)

    def test_base_model_is_pydantic_model(self):
        """Test that BaseModel is a Pydantic model."""
        from pydantic import BaseModel as PydanticBaseModel

        assert issubclass(core.BaseModel, PydanticBaseModel)

    def test_tenant_context_is_base_model(self):
        """Test that TenantContext inherits from BaseModel."""
        assert issubclass(core.TenantContext, core.BaseModel)

    def test_domain_events_exports(self):
        """Test that all domain events components are exported."""
        # Core domain events classes
        assert hasattr(core, "DomainEvent")
        assert hasattr(core, "DomainEventMetadata")
        assert hasattr(core, "DomainEventDispatcher")
        assert hasattr(core, "DomainEventPublisher")

        # Aggregate and entity classes
        assert hasattr(core, "AggregateRoot")
        assert hasattr(core, "Entity")
        assert hasattr(core, "ValueObject")

        # Value objects
        assert hasattr(core, "Money")
        assert hasattr(core, "EmailAddress")
        assert hasattr(core, "PhoneNumber")

        # Predefined domain events - Invoice
        assert hasattr(core, "InvoiceCreatedEvent")
        assert hasattr(core, "InvoicePaymentReceivedEvent")
        assert hasattr(core, "InvoiceVoidedEvent")
        assert hasattr(core, "InvoiceOverdueEvent")

        # Predefined domain events - Subscription
        assert hasattr(core, "SubscriptionCreatedEvent")
        assert hasattr(core, "SubscriptionRenewedEvent")
        assert hasattr(core, "SubscriptionCancelledEvent")
        assert hasattr(core, "SubscriptionUpgradedEvent")

        # Predefined domain events - Customer
        assert hasattr(core, "CustomerCreatedEvent")
        assert hasattr(core, "CustomerUpdatedEvent")
        assert hasattr(core, "CustomerDeletedEvent")

        # Predefined domain events - Payment
        assert hasattr(core, "PaymentProcessedEvent")
        assert hasattr(core, "PaymentFailedEvent")
        assert hasattr(core, "PaymentRefundedEvent")

        # Factory and helper functions
        assert hasattr(core, "get_domain_event_dispatcher")
        assert hasattr(core, "reset_domain_event_dispatcher")
        assert hasattr(core, "get_domain_event_publisher")
        assert hasattr(core, "reset_domain_event_publisher")

    def test_domain_events_in_all(self):
        """Test that domain events components are in __all__."""
        domain_events_exports = [
            "DomainEvent",
            "DomainEventMetadata",
            "DomainEventDispatcher",
            "DomainEventPublisher",
            "AggregateRoot",
            "Entity",
            "ValueObject",
            "Money",
            "EmailAddress",
            "PhoneNumber",
            "InvoiceCreatedEvent",
            "InvoicePaymentReceivedEvent",
            "InvoiceVoidedEvent",
            "InvoiceOverdueEvent",
            "SubscriptionCreatedEvent",
            "SubscriptionRenewedEvent",
            "SubscriptionCancelledEvent",
            "SubscriptionUpgradedEvent",
            "CustomerCreatedEvent",
            "CustomerUpdatedEvent",
            "CustomerDeletedEvent",
            "PaymentProcessedEvent",
            "PaymentFailedEvent",
            "PaymentRefundedEvent",
            "get_domain_event_dispatcher",
            "reset_domain_event_dispatcher",
            "get_domain_event_publisher",
            "reset_domain_event_publisher",
        ]

        for export in domain_events_exports:
            assert export in core.__all__, f"{export} not in core.__all__"

    def test_no_private_exports(self):
        """Test that __all__ doesn't contain private symbols."""
        for name in core.__all__:
            assert not name.startswith("_")

    def test_wildcard_import(self):
        """Test that wildcard import only imports __all__ symbols."""
        # Create a namespace and execute wildcard import
        namespace = {}
        exec("from dotmac.platform.core import *", namespace)

        # Check that all expected symbols are imported
        for name in core.__all__:
            assert name in namespace

        # Check that no unexpected symbols are imported (excluding builtins)
        imported_names = [name for name in namespace if not name.startswith("__")]
        assert len(imported_names) == len(core.__all__)
