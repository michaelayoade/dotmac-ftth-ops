"""
Mock object builders for test setup.

Provides utilities to quickly build common mock objects and database
results, reducing boilerplate in test fixtures.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock

from sqlalchemy.ext.asyncio import AsyncSession


def build_mock_db_session() -> AsyncMock:
    """
    Build a fully configured mock database session.

    Returns:
        AsyncMock configured with common database methods

    Example:
        mock_db = build_mock_db_session()
        service = MyService(mock_db)
    """
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()

    # Mock bind and dialect for database-specific code
    mock_dialect = Mock()
    mock_dialect.name = "postgresql"
    mock_bind = Mock()
    mock_bind.dialect = mock_dialect
    session.bind = mock_bind

    return session


def build_mock_result(
    scalar_result: Any = None,
    scalars_all_result: list | None = None,
    scalar_one_or_none_result: Any = None,
) -> Mock:
    """
    Build a mock SQLAlchemy result object.

    Args:
        scalar_result: Value to return from .scalar()
        scalars_all_result: List to return from .scalars().all()
        scalar_one_or_none_result: Value to return from .scalar_one_or_none()

    Returns:
        Mock result object

    Example:
        mock_result = build_mock_result(
            scalar_one_or_none_result=sample_contact
        )
        mock_db.execute.return_value = mock_result
    """
    result = Mock()

    # Always set scalar_one_or_none return value (even if None)
    # This prevents the mock from returning a Mock object when None is expected
    result.scalar_one_or_none.return_value = scalar_one_or_none_result

    if scalar_result is not None:
        result.scalar.return_value = scalar_result

    if scalars_all_result is not None:
        result.scalars.return_value.all.return_value = scalars_all_result

    return result


def build_success_result(entity: Any) -> Mock:
    """
    Build a mock result for successful entity retrieval.

    Args:
        entity: The entity to return

    Returns:
        Mock result configured for successful retrieval

    Example:
        mock_result = build_success_result(sample_contact)
        mock_db.execute.return_value = mock_result
    """
    return build_mock_result(scalar_one_or_none_result=entity)


def build_not_found_result() -> Mock:
    """
    Build a mock result for entity not found.

    Returns:
        Mock result configured for not found (None)

    Example:
        mock_result = build_not_found_result()
        mock_db.execute.return_value = mock_result
        entity = await service.get_entity(uuid4())
        assert entity is None
    """
    return build_mock_result(scalar_one_or_none_result=None)


def build_list_result(entities: list[Any], total_count: int) -> tuple[Mock, int]:
    """
    Build mock results for list/search operations.

    Args:
        entities: List of entities to return
        total_count: Total count for pagination

    Returns:
        Tuple of (mock_result, total_count)

    Example:
        mock_result, total = build_list_result([contact1, contact2], 100)
        mock_db.execute.return_value = mock_result
        mock_db.scalar.return_value = total
    """
    result = build_mock_result(scalars_all_result=entities)
    return result, total_count


def build_mock_entity(entity_class: type, **attributes) -> Mock:
    """
    Build a mock entity with specified attributes.

    Args:
        entity_class: The entity class to mock
        **attributes: Attribute name-value pairs

    Returns:
        Mock entity with attributes set

    Example:
        mock_contact = build_mock_entity(
            Contact,
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            tenant_id=tenant_id
        )
    """
    entity = Mock(spec=entity_class)
    for attr, value in attributes.items():
        setattr(entity, attr, value)
    return entity


def build_mock_service(service_class: type, **method_returns) -> AsyncMock:
    """
    Build a mock service with configured method return values.

    Args:
        service_class: The service class to mock
        **method_returns: Method name -> return value mapping

    Returns:
        AsyncMock service with configured methods

    Example:
        mock_payment_service = build_mock_service(
            PaymentService,
            create_payment=mock_payment,
            process_refund=mock_refund
        )
    """
    service = AsyncMock(spec=service_class)

    for method_name, return_value in method_returns.items():
        method = AsyncMock(return_value=return_value)
        setattr(service, method_name, method)

    return service


def build_mock_provider(provider_class: type, **method_returns) -> AsyncMock:
    """
    Build a mock payment/external provider.

    Args:
        provider_class: The provider class to mock
        **method_returns: Method name -> return value mapping

    Returns:
        AsyncMock provider with configured methods

    Example:
        from dotmac.platform.billing.payments.providers import PaymentResult

        mock_provider = build_mock_provider(
            PaymentProvider,
            charge_payment_method=PaymentResult(
                success=True,
                provider_payment_id="ch_123"
            )
        )
    """
    provider = AsyncMock(spec=provider_class)

    for method_name, return_value in method_returns.items():
        method = AsyncMock(return_value=return_value)
        setattr(provider, method_name, method)

    return provider


class MockContextManager:
    """
    Mock async context manager for testing.

    Example:
        mock_session = MockContextManager(build_mock_db_session())
        async with mock_session as session:
            # session is the mock_db_session
    """

    def __init__(self, return_value: Any):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


def build_mock_cache(
    get_return: Any = None,
    set_return: bool = True,
) -> tuple[AsyncMock, AsyncMock, AsyncMock]:
    """
    Build mock cache functions (get, set, delete).

    Args:
        get_return: Value to return from cache_get
        set_return: Value to return from cache_set

    Returns:
        Tuple of (cache_get, cache_set, cache_delete) mocks

    Example:
        mock_get, mock_set, mock_del = build_mock_cache(get_return=None)

        with patch("module.cache_get", mock_get):
            with patch("module.cache_set", mock_set):
                with patch("module.cache_delete", mock_del):
                    # ... test code
    """
    cache_get = AsyncMock(return_value=get_return)
    cache_set = AsyncMock(return_value=set_return)
    cache_delete = AsyncMock(return_value=True)

    return cache_get, cache_set, cache_delete
