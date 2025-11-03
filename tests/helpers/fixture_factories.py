"""
Fixture Factory Utilities

Provides helper functions and base classes for creating fixture factories.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable, Iterator
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class FixtureFactory:
    """Base class for fixture factories.

    Provides automatic tracking and cleanup of created instances.

    Example:
        class InvoiceFactory(FixtureFactory):
            def __init__(self, db_session):
                super().__init__()
                self.db = db_session

            async def create(self, amount=100, status="pending", **kwargs):
                invoice = Invoice(
                    id=self.generate_id("inv"),
                    amount=amount,
                    status=status,
                    **kwargs
                )
                await self.db.add(invoice)
                await self.db.commit()
                self.track(invoice)  # Auto-cleanup
                return invoice

            async def cleanup_instance(self, instance):
                await self.db.delete(instance)

        # Usage in conftest.py
        @pytest.fixture
        async def invoice_factory(async_db_session):
            factory = InvoiceFactory(async_db_session)
            yield factory
            await factory.cleanup_all()
    """

    def __init__(self):
        """Initialize factory with empty tracking list."""
        self._created_instances: list[Any] = []
        self._id_counter = 0

    def track(self, instance: Any) -> None:
        """Track an instance for automatic cleanup.

        Args:
            instance: Instance to track for cleanup
        """
        self._created_instances.append(instance)
        logger.debug(
            "Tracked instance for cleanup: %s (total: %d)",
            type(instance).__name__,
            len(self._created_instances),
        )

    def generate_id(self, prefix: str = "test") -> str:
        """Generate unique ID for test instances.

        Args:
            prefix: ID prefix (e.g., "inv", "sub", "cust")

        Returns:
            Unique ID like "inv_0", "inv_1", etc.
        """
        self._id_counter += 1
        return f"{prefix}_{self._id_counter - 1}"

    async def cleanup_instance(self, instance: Any) -> None:
        """Clean up a single instance.

        Override this method to implement cleanup logic.

        Args:
            instance: Instance to clean up
        """
        # Default: no-op (override in subclass)
        pass

    async def cleanup_all(self) -> None:
        """Clean up all tracked instances.

        Calls cleanup_instance() for each tracked instance in reverse order.
        Continues cleanup even if individual cleanups fail.
        """
        if not self._created_instances:
            return

        logger.debug("Cleaning up %d instances from factory", len(self._created_instances))

        # Clean up in reverse order (LIFO)
        for instance in reversed(self._created_instances):
            try:
                await self.cleanup_instance(instance)
            except Exception as e:
                logger.error(
                    "Error cleaning up instance %s: %s",
                    type(instance).__name__,
                    str(e),
                    exc_info=True,
                )

        self._created_instances.clear()
        logger.debug("Factory cleanup complete")


class SyncFixtureFactory:
    """Synchronous version of FixtureFactory.

    Use for non-async fixtures.

    Example:
        class ConfigFactory(SyncFixtureFactory):
            def create(self, key, value):
                config = Config(key=key, value=value)
                self.track(config)
                return config

            def cleanup_instance(self, instance):
                # Cleanup logic
                instance.delete()
    """

    def __init__(self):
        """Initialize factory with empty tracking list."""
        self._created_instances: list[Any] = []
        self._id_counter = 0

    def track(self, instance: Any) -> None:
        """Track an instance for automatic cleanup."""
        self._created_instances.append(instance)

    def generate_id(self, prefix: str = "test") -> str:
        """Generate unique ID for test instances."""
        self._id_counter += 1
        return f"{prefix}_{self._id_counter - 1}"

    def cleanup_instance(self, instance: Any) -> None:
        """Clean up a single instance (override in subclass)."""
        pass

    def cleanup_all(self) -> None:
        """Clean up all tracked instances."""
        for instance in reversed(self._created_instances):
            try:
                self.cleanup_instance(instance)
            except Exception as e:
                logger.error("Error cleaning up instance: %s", str(e), exc_info=True)

        self._created_instances.clear()


def create_factory_fixture(
    create_func: Callable[..., T],
    cleanup_func: Callable[[T], None] | None = None,
) -> Callable[[], Iterator[Callable[..., T]]]:
    """Create a factory fixture from functions.

    This is a simpler alternative to creating a FixtureFactory subclass.

    Args:
        create_func: Function that creates instances
        cleanup_func: Optional function to clean up instances

    Returns:
        Factory fixture function

    Example:
        # Define creation function
        def create_invoice(db, amount=100, status="pending"):
            invoice = Invoice(id=f"inv_{id(db)}", amount=amount, status=status)
            db.add(invoice)
            return invoice

        # Define cleanup function
        def cleanup_invoice(invoice):
            db.delete(invoice)

        # Create fixture
        invoice_factory_fixture = create_factory_fixture(
            create_invoice,
            cleanup_invoice
        )

        # Use in conftest.py
        invoice_factory = pytest.fixture(invoice_factory_fixture)
    """
    created_instances = []

    def factory(**kwargs):
        instance = create_func(**kwargs)
        created_instances.append(instance)
        return instance

    def fixture():
        yield factory

        # Cleanup
        if cleanup_func:
            for instance in reversed(created_instances):
                try:
                    cleanup_func(instance)
                except Exception as e:
                    logger.error("Cleanup error: %s", str(e))

        created_instances.clear()

    return fixture


def create_async_factory_fixture(
    create_func: Callable[..., T],
    cleanup_func: Callable[[T], None] | None = None,
) -> Callable[[], AsyncIterator[Callable[..., T]]]:
    """Create an async factory fixture from functions.

    Args:
        create_func: Async function that creates instances
        cleanup_func: Optional async function to clean up instances

    Returns:
        Async factory fixture function

    Example:
        # Define creation function
        async def create_invoice(db, amount=100, status="pending"):
            invoice = Invoice(id=f"inv_{id(db)}", amount=amount, status=status)
            db.add(invoice)
            await db.commit()
            return invoice

        # Define cleanup function
        async def cleanup_invoice(db, invoice):
            await db.delete(invoice)
            await db.commit()

        # Create fixture
        invoice_factory_fixture = create_async_factory_fixture(
            create_invoice,
            cleanup_invoice
        )

        # Use in conftest.py
        invoice_factory = pytest_asyncio.fixture(invoice_factory_fixture)
    """
    created_instances = []

    async def factory(**kwargs):
        instance = await create_func(**kwargs)
        created_instances.append(instance)
        return instance

    async def fixture():
        yield factory

        # Cleanup
        if cleanup_func:
            for instance in reversed(created_instances):
                try:
                    await cleanup_func(instance)
                except Exception as e:
                    logger.error("Cleanup error: %s", str(e))

        created_instances.clear()

    return fixture


class ModelFactory(FixtureFactory):
    """Factory for creating database models.

    Provides common patterns for model creation and cleanup.

    Example:
        class InvoiceFactory(ModelFactory):
            model_class = Invoice
            id_prefix = "inv"

            def __init__(self, db_session):
                super().__init__(db_session)

            def get_defaults(self):
                return {
                    "amount": Decimal("100.00"),
                    "status": "pending",
                    "customer_id": "cust_test",
                }

        # Usage
        @pytest.fixture
        async def invoice_factory(async_db_session):
            factory = InvoiceFactory(async_db_session)
            yield factory
            await factory.cleanup_all()
    """

    model_class: type | None = None
    id_prefix: str = "test"

    def __init__(self, db_session):
        """Initialize model factory.

        Args:
            db_session: Database session for creating/deleting models
        """
        super().__init__()
        self.db = db_session

    def get_defaults(self) -> dict[str, Any]:
        """Get default values for model creation.

        Override this method to provide default values.

        Returns:
            Dict of default field values
        """
        return {}

    async def create(self, **kwargs) -> Any:
        """Create a model instance.

        Args:
            **kwargs: Model field values (merged with defaults)

        Returns:
            Created model instance
        """
        if self.model_class is None:
            raise ValueError("model_class must be set")

        # Merge defaults with provided kwargs
        data = {**self.get_defaults(), **kwargs}

        # Generate ID if not provided
        if "id" not in data:
            data["id"] = self.generate_id(self.id_prefix)

        # Create instance
        instance = self.model_class(**data)
        self.db.add(instance)
        await self.db.commit()
        await self.db.refresh(instance)

        # Track for cleanup
        self.track(instance)

        return instance

    async def cleanup_instance(self, instance: Any) -> None:
        """Delete model instance from database.

        Args:
            instance: Model instance to delete
        """
        await self.db.delete(instance)
        await self.db.commit()


# Example factories (can be used as templates)


class DictFactory(SyncFixtureFactory):
    """Factory for creating test dictionaries.

    Example:
        @pytest.fixture
        def invoice_dict_factory():
            factory = DictFactory(defaults={
                "id": "inv_test",
                "amount": 100,
                "status": "pending",
            })
            yield factory.create
            factory.cleanup_all()
    """

    def __init__(self, defaults: dict[str, Any] | None = None):
        """Initialize dict factory.

        Args:
            defaults: Default values for created dicts
        """
        super().__init__()
        self.defaults = defaults or {}

    def create(self, **kwargs) -> dict[str, Any]:
        """Create a dict with merged defaults and kwargs.

        Args:
            **kwargs: Override default values

        Returns:
            Created dict
        """
        data = {**self.defaults, **kwargs}

        # Generate ID if not provided
        if "id" not in data:
            data["id"] = self.generate_id("test")

        self.track(data)
        return data

    def cleanup_instance(self, instance: dict) -> None:
        """Clear dict (no-op for dicts)."""
        instance.clear()
