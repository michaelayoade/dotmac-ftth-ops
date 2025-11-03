"""
Reusable async database mocking fixtures and utilities.

This module provides standardized patterns for mocking SQLAlchemy async sessions
and query results, solving the common "coroutine was never awaited" issues.

Usage:
    from tests.fixtures.async_db import create_mock_async_result, create_mock_async_session

    # Mock a query result
    mock_result = create_mock_async_result([entity1, entity2])

    # Mock a session with specific query behavior
    mock_session = create_mock_async_session(execute_return=mock_result)
"""

import hashlib
from collections.abc import Callable, Iterable
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


def create_mock_async_result(data: list[Any] | None = None) -> MagicMock:
    """
    Create a properly mocked async SQLAlchemy Result object.

    This solves the "coroutine was never awaited" error by properly
    setting up the mock chain for .scalars().all() pattern.

    Args:
        data: List of entities to return from .scalars().all()

    Returns:
        MagicMock: Configured async result mock

    Example:
        >>> entities = [PaymentEntity(...), PaymentEntity(...)]
        >>> mock_result = create_mock_async_result(entities)
        >>> result = await session.execute(select(Payment))
        >>> payments = result.scalars().all()  # Returns entities
    """
    mock_result = MagicMock()

    # Create scalars mock that returns synchronous data
    mock_scalars = MagicMock()
    mock_scalars.all = MagicMock(return_value=data or [])
    mock_scalars.first = MagicMock(return_value=data[0] if data else None)
    mock_scalars.one = MagicMock(return_value=data[0] if data else None)
    mock_scalars.one_or_none = MagicMock(return_value=data[0] if data else None)

    # Result.scalars() returns the mock_scalars synchronously
    mock_result.scalars = MagicMock(return_value=mock_scalars)

    # Result.scalar() returns single value directly
    mock_result.scalar = MagicMock(return_value=data[0] if data else None)
    mock_result.scalar_one = MagicMock(return_value=data[0] if data else None)
    mock_result.scalar_one_or_none = MagicMock(return_value=data[0] if data else None)

    return mock_result


def create_mock_async_session(
    execute_return: Any = None,
    commit_side_effect: Exception | None = None,
    rollback_side_effect: Exception | None = None,
) -> AsyncMock:
    """
    Create a properly mocked async SQLAlchemy session.

    Args:
        execute_return: What session.execute() should return (use create_mock_async_result)
        commit_side_effect: Exception to raise on commit, if any
        rollback_side_effect: Exception to raise on rollback, if any

    Returns:
        AsyncMock: Configured async session mock

    Example:
        >>> mock_result = create_mock_async_result([payment_entity])
        >>> mock_session = create_mock_async_session(execute_return=mock_result)
        >>> result = await mock_session.execute(select(Payment))
        >>> payment = result.scalars().first()
    """
    mock_session = AsyncMock()

    # Configure execute to return the provided result
    if execute_return is not None:
        mock_session.execute = AsyncMock(return_value=execute_return)
    else:
        # Default: return empty result
        mock_session.execute = AsyncMock(return_value=create_mock_async_result([]))

    # Configure commit
    if commit_side_effect:
        mock_session.commit = AsyncMock(side_effect=commit_side_effect)
    else:
        mock_session.commit = AsyncMock()

    # Configure rollback
    if rollback_side_effect:
        mock_session.rollback = AsyncMock(side_effect=rollback_side_effect)
    else:
        mock_session.rollback = AsyncMock()

    # Configure other common session methods
    mock_session.add = MagicMock()  # Synchronous
    mock_session.delete = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.close = AsyncMock()

    # Configure transaction context
    mock_session.begin = AsyncMock()
    mock_session.begin_nested = AsyncMock()

    return mock_session


def create_mock_scalar_result(value: Any = None) -> MagicMock:
    """
    Create a mock result that returns a scalar value (count, sum, etc).

    Args:
        value: The scalar value to return

    Returns:
        MagicMock: Result mock that returns scalar value

    Example:
        >>> mock_result = create_mock_scalar_result(42)
        >>> count = await session.execute(select(func.count(Payment.id)))
        >>> assert count.scalar() == 42
    """
    mock_result = MagicMock()
    mock_result.scalar = MagicMock(return_value=value)
    mock_result.scalar_one = MagicMock(return_value=value)
    mock_result.scalar_one_or_none = MagicMock(return_value=value)
    return mock_result


QueryMatcher = Callable[[Any], bool]
SchemaValidator = Callable[[Any], None]


class MockAsyncSessionFactory:
    """
    Factory for creating mock sessions with pre-configured query responses.

    This is useful when you need different responses for different queries
    in the same test.

    Example:
        >>> factory = MockAsyncSessionFactory()
        >>> factory.add_query_result(
        ...     select(Payment).where(Payment.id == "pay_123"),
        ...     [payment_entity]
        ... )
        >>> factory.add_query_result(
        ...     select(func.count(Payment.id)),
        ...     5
        ... )
        >>> mock_session = factory.create_session()
    """

    def __init__(self):
        self.query_responses: dict[str, tuple[Any, SchemaValidator | None]] = {}
        self.matcher_responses: list[tuple[QueryMatcher, Any, SchemaValidator | None]] = []
        self.default_response = create_mock_async_result([])

    def add_query_result(
        self,
        query_matcher: Any,
        result_data: Any,
        *,
        model: type[Any] | None = None,
        validator: SchemaValidator | None = None,
    ) -> None:
        """
        Add a query response mapping.

        Args:
            query_matcher: Query object or callable used to match execute() calls.
            result_data: Data to feed into mocked results.
            model: Optional SQLAlchemy model to validate the mocked data against.
            validator: Optional custom callable to validate mocked data.
        """
        schema_validator = _resolve_validator(model, validator)
        _run_validator(result_data, schema_validator)

        if callable(query_matcher) and not isinstance(query_matcher, str):
            self.matcher_responses.append((query_matcher, result_data, schema_validator))
            return

        signature = _signature_for_query(query_matcher)
        self.query_responses[signature] = (result_data, schema_validator)

    def create_session(self) -> AsyncMock:
        """Create a session with configured responses."""
        mock_session = AsyncMock()

        async def execute_side_effect(query):
            for matcher, data, validator in self.matcher_responses:
                if matcher(query):
                    _run_validator(data, validator)
                    return _coerce_result(data)

            signature = _signature_for_query(query)
            if signature in self.query_responses:
                data, validator = self.query_responses[signature]
                _run_validator(data, validator)
                return _coerce_result(data)

            return self.default_response

        mock_session.execute = AsyncMock(side_effect=execute_side_effect)
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.add = MagicMock()
        mock_session.delete = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.close = AsyncMock()

        return mock_session


@pytest.fixture
def mock_async_session():
    """Fixture providing a basic mock async session."""
    return create_mock_async_session()


@pytest.fixture
def mock_empty_result():
    """Fixture providing an empty query result."""
    return create_mock_async_result([])


@pytest.fixture
def async_session_factory():
    """Fixture providing a session factory for complex mocking."""
    return MockAsyncSessionFactory()


def _signature_for_query(query: Any) -> str:
    """
    Generate a stable hash for a SQLAlchemy query-like object or string matcher.
    Falls back to the string representation when cache_key is unavailable.
    """
    if isinstance(query, str):
        raw = query
    else:
        cache_key = getattr(query, "cache_key", None)
        if cache_key:
            raw = repr(cache_key)
        else:
            raw = str(query)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _coerce_result(data: Any) -> MagicMock:
    if isinstance(data, (int, float, str)):
        return create_mock_scalar_result(data)

    if isinstance(data, MagicMock):
        return data

    return create_mock_async_result(data)


def _resolve_validator(
    model: type[Any] | None, validator: SchemaValidator | None
) -> SchemaValidator | None:
    if model and validator:
        raise ValueError("Provide either model or validator, not both.")

    if validator:
        return validator

    if model:
        return lambda data: validate_result_against_model(data, model)

    return None


def _run_validator(data: Any, validator: SchemaValidator | None) -> None:
    if validator is None:
        return
    validator(data)


def validate_result_against_model(result_data: Any, model: type[Any]) -> None:
    """
    Ensure mocked result data satisfies the given SQLAlchemy model schema.

    Args:
        result_data: List or single entity returned by the mock.
        model: SQLAlchemy declarative model class.

    Raises:
        ValueError: If required attributes are missing from provided data.
    """
    try:
        from sqlalchemy.inspection import inspect as sa_inspect
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "SQLAlchemy must be installed to validate mocked data against a model."
        ) from exc

    mapper = sa_inspect(model)
    expected_columns = {column.key for column in mapper.column_attrs}

    items: Iterable[Any]
    if isinstance(result_data, Iterable) and not isinstance(result_data, (str, bytes)):
        items = result_data
    else:
        items = [result_data]

    for item in items:
        if item is None:
            continue
        if isinstance(item, dict):
            missing = expected_columns - set(item.keys())
        else:
            missing = {column for column in expected_columns if not hasattr(item, column)}

        if missing:
            raise ValueError(
                f"Mocked data is missing attributes {sorted(missing)} required by {model.__name__}"
            )
