"""
Shared assertion utilities for test validation.

Provides reusable assertion helpers for common test scenarios,
reducing boilerplate and improving test readability.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock


def assert_entity_created(
    mock_db_session: AsyncMock,
    entity_type: type | None = None,
    expected_attributes: dict[str, Any] | None = None,
    allow_multiple_adds: bool = False,
) -> None:
    """
    Assert that an entity was created successfully.

    Args:
        mock_db_session: Mocked database session
        entity_type: Expected entity type (optional)
        expected_attributes: Dict of expected attribute values (optional)
        allow_multiple_adds: Allow multiple db.add() calls (e.g., for related entities)

    Example:
        assert_entity_created(
            mock_db_session,
            Contact,
            {"first_name": "John", "last_name": "Doe"}
        )

        # For entities with related objects (e.g., contact with methods)
        assert_entity_created(
            mock_db_session,
            Contact,
            {"first_name": "John"},
            allow_multiple_adds=True
        )
    """
    if allow_multiple_adds:
        mock_db_session.add.assert_called()
    else:
        mock_db_session.add.assert_called_once()

    mock_db_session.commit.assert_called_once()

    if entity_type or expected_attributes:
        # Get the first call (should be the main entity)
        added_entity = mock_db_session.add.call_args_list[0][0][0]

        if entity_type:
            assert isinstance(added_entity, entity_type), (
                f"Expected entity type {entity_type.__name__}, got {type(added_entity).__name__}"
            )

        if expected_attributes:
            for attr, expected_value in expected_attributes.items():
                actual_value = getattr(added_entity, attr)
                assert actual_value == expected_value, (
                    f"Expected {attr}={expected_value}, got {actual_value}"
                )


def assert_entity_updated(
    mock_db_session: AsyncMock,
    entity: Any,
    updated_attributes: dict[str, Any] | None = None,
) -> None:
    """
    Assert that an entity was updated successfully.

    Args:
        mock_db_session: Mocked database session
        entity: The entity that should have been updated
        updated_attributes: Dict of expected updated values (optional)

    Example:
        assert_entity_updated(
            mock_db_session,
            contact,
            {"first_name": "Jane"}
        )
    """
    mock_db_session.commit.assert_called_once()
    mock_db_session.refresh.assert_called_once_with(entity)

    if updated_attributes:
        for attr, expected_value in updated_attributes.items():
            actual_value = getattr(entity, attr)
            assert actual_value == expected_value, (
                f"Expected {attr}={expected_value}, got {actual_value}"
            )


def assert_entity_deleted(
    mock_db_session: AsyncMock,
    entity: Any,
    soft_delete: bool = False,
) -> None:
    """
    Assert that an entity was deleted successfully.

    Args:
        mock_db_session: Mocked database session
        entity: The entity that should have been deleted
        soft_delete: Whether to expect soft delete (deleted_at set) or hard delete

    Example:
        assert_entity_deleted(mock_db_session, contact, soft_delete=True)
    """
    if soft_delete:
        assert hasattr(entity, "deleted_at"), "Entity must have deleted_at for soft delete"
        assert entity.deleted_at is not None, "deleted_at should be set"
        mock_db_session.commit.assert_called_once()
    else:
        mock_db_session.delete.assert_called_once_with(entity)
        mock_db_session.commit.assert_called_once()


def assert_entity_retrieved(
    result: Any,
    expected_entity: Any,
    expected_type: type | None = None,
) -> None:
    """
    Assert that an entity was retrieved successfully.

    Args:
        result: The retrieved entity
        expected_entity: The expected entity (for comparison)
        expected_type: Expected entity type (optional)

    Example:
        assert_entity_retrieved(result, sample_contact, Contact)
    """
    assert result is not None, "Entity should not be None"
    assert result == expected_entity, f"Expected entity {expected_entity}, got {result}"

    if expected_type:
        assert isinstance(result, expected_type), (
            f"Expected type {expected_type.__name__}, got {type(result).__name__}"
        )


def assert_db_committed(
    mock_db_session: AsyncMock,
    times: int = 1,
) -> None:
    """
    Assert that database commit was called expected number of times.

    Args:
        mock_db_session: Mocked database session
        times: Expected number of commit calls

    Example:
        assert_db_committed(mock_db_session, times=2)
    """
    assert mock_db_session.commit.call_count == times, (
        f"Expected {times} commit(s), got {mock_db_session.commit.call_count}"
    )


def assert_cache_invalidated(
    mock_cache_delete: MagicMock,
    expected_key: str | None = None,
) -> None:
    """
    Assert that cache was invalidated.

    Args:
        mock_cache_delete: Mocked cache delete function
        expected_key: Expected cache key (optional)

    Example:
        with patch("dotmac.platform.contacts.service.cache_delete") as mock:
            # ... perform operation
            assert_cache_invalidated(mock, "contact:123")
    """
    mock_cache_delete.assert_called()

    if expected_key:
        call_args = mock_cache_delete.call_args[0]
        assert expected_key in str(call_args), (
            f"Expected cache key containing '{expected_key}', got {call_args}"
        )


def assert_not_found(result: Any) -> None:
    """
    Assert that entity was not found (returns None).

    Args:
        result: The result to check

    Example:
        assert_not_found(await service.get_contact(uuid4()))
    """
    assert result is None, f"Expected None for not found, got {result}"


def assert_service_called_with(
    mock_service: AsyncMock,
    method_name: str,
    expected_args: tuple | None = None,
    expected_kwargs: dict | None = None,
) -> None:
    """
    Assert that a service method was called with expected arguments.

    Args:
        mock_service: Mocked service instance
        method_name: Name of the method that should have been called
        expected_args: Expected positional arguments (optional)
        expected_kwargs: Expected keyword arguments (optional)

    Example:
        assert_service_called_with(
            mock_payment_provider,
            "charge_payment_method",
            expected_kwargs={"amount": 1000, "currency": "USD"}
        )
    """
    method = getattr(mock_service, method_name)
    method.assert_called()

    if expected_args:
        actual_args = method.call_args[0]
        assert actual_args == expected_args, f"Expected args {expected_args}, got {actual_args}"

    if expected_kwargs:
        actual_kwargs = method.call_args[1]
        for key, expected_value in expected_kwargs.items():
            assert key in actual_kwargs, f"Expected kwarg '{key}' not found"
            assert actual_kwargs[key] == expected_value, (
                f"Expected {key}={expected_value}, got {actual_kwargs[key]}"
            )
