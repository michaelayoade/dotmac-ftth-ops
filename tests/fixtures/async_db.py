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

from typing import Any
from unittest.mock import AsyncMock, MagicMock


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
        self.query_responses: dict[str, Any] = {}
        self.default_response = create_mock_async_result([])

    def add_query_result(self, query_matcher: str, result_data: Any) -> None:
        """Add a query response mapping."""
        self.query_responses[str(query_matcher)] = result_data

    def create_session(self) -> AsyncMock:
        """Create a session with configured responses."""
        mock_session = AsyncMock()

        async def execute_side_effect(query):
            query_str = str(query)
            for matcher, data in self.query_responses.items():
                if matcher in query_str:
                    if isinstance(data, (int, float, str)):
                        return create_mock_scalar_result(data)
                    return create_mock_async_result(data)
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


# Pytest fixtures for common use
import pytest  # noqa: E402


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
