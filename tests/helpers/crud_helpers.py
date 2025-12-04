"""
CRUD operation test helpers.

Provides reusable test execution patterns for common CRUD operations,
reducing duplicate code across service tests.
"""

from typing import Any
from unittest.mock import AsyncMock, Mock, patch
from uuid import UUID

from pydantic import BaseModel

from tests.helpers.assertions import (
    assert_entity_created,
    assert_entity_deleted,
    assert_entity_retrieved,
    assert_entity_updated,
)
from tests.helpers.mock_builders import build_success_result

EXCLUDED_DATA_PARAM_NAMES = {
    "tenant_id",
    "owner_id",
    "created_by",
    "updated_by",
    "performed_by",
    "user_id",
}


def _get_method_param_names(method: Any) -> list[str]:
    """Return positional parameter names for a method excluding `self`."""

    code = method.__code__
    total = code.co_argcount
    return list(code.co_varnames[1:total])


def _select_id_param(param_names: list[str], explicit_name: str | None = None) -> str:
    """Pick the parameter name that represents an entity identifier."""

    if explicit_name:
        return explicit_name

    if "entity_id" in param_names:
        return "entity_id"

    for name in param_names:
        if name.endswith("_id") or name == "id":
            return name

    return param_names[0] if param_names else "entity_id"


def _select_data_param(
    param_names: list[str],
    id_param: str | None = None,
    explicit_name: str | None = None,
) -> str | None:
    """Select the parameter name used for data payloads."""

    if explicit_name:
        return explicit_name

    for name in param_names:
        if name == id_param:
            continue
        if name in EXCLUDED_DATA_PARAM_NAMES:
            continue
        if name.endswith("_id"):
            continue
        return name

    return None


async def create_entity_test_helper(
    service: Any,
    method_name: str,
    create_data: BaseModel,
    mock_db_session: AsyncMock,
    expected_entity_type: type | None = None,
    expected_attributes: dict[str, Any] | None = None,
    tenant_id: str | None = None,
    allow_multiple_adds: bool = False,
    data_param_name: str | None = None,
    **extra_kwargs,
) -> Any:
    """
    Generic helper for testing successful entity creation.

    Args:
        service: Service instance
        method_name: Name of the creation method (e.g., "create_contact")
        create_data: Pydantic model with creation data
        mock_db_session: Mocked database session
        expected_entity_type: Expected entity type for validation
        expected_attributes: Dict of expected attribute values
        tenant_id: Tenant ID (if required)
        **extra_kwargs: Additional keyword arguments for the method

    Returns:
        Created entity

    Example:
        contact = await create_entity_test_helper(
            contact_service,
            "create_contact",
            ContactCreate(first_name="John", last_name="Doe"),
            mock_db_session,
            expected_entity_type=Contact,
            expected_attributes={"first_name": "John"},
            tenant_id=tenant_id,
            created_by=user_id
        )
    """
    # Setup mock
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # Call the method
    method = getattr(service, method_name)
    kwargs = extra_kwargs.copy()
    if tenant_id:
        kwargs["tenant_id"] = tenant_id

    param_names = _get_method_param_names(method)
    data_param = _select_data_param(param_names, explicit_name=data_param_name)

    if data_param:
        kwargs[data_param] = create_data
        result = await method(**kwargs)
    else:
        result = await method(create_data, **kwargs)

    # Assert entity was created
    assert_entity_created(
        mock_db_session,
        entity_type=expected_entity_type,
        expected_attributes=expected_attributes,
        allow_multiple_adds=allow_multiple_adds,
    )

    return result


async def update_entity_test_helper(
    service: Any,
    method_name: str,
    entity_id: UUID,
    update_data: BaseModel,
    mock_db_session: AsyncMock,
    sample_entity: Any,
    expected_attributes: dict[str, Any] | None = None,
    tenant_id: str | None = None,
    id_param_name: str | None = None,
    data_param_name: str | None = None,
    **extra_kwargs,
) -> Any:
    """
    Generic helper for testing successful entity update.

    Args:
        service: Service instance
        method_name: Name of the update method
        entity_id: ID of entity to update
        update_data: Pydantic model with update data
        mock_db_session: Mocked database session
        sample_entity: Sample entity to return from DB
        expected_attributes: Dict of expected updated values
        tenant_id: Tenant ID (if required)
        **extra_kwargs: Additional keyword arguments

    Returns:
        Updated entity

    Example:
        contact = await update_entity_test_helper(
            contact_service,
            "update_contact",
            contact_id,
            ContactUpdate(first_name="Jane"),
            mock_db_session,
            sample_contact,
            expected_attributes={"first_name": "Jane"},
            tenant_id=tenant_id
        )
    """
    # Mock entity retrieval
    mock_result = build_success_result(sample_entity)
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # Call the method
    method = getattr(service, method_name)
    kwargs = extra_kwargs.copy()
    if tenant_id:
        kwargs["tenant_id"] = tenant_id

    param_names = _get_method_param_names(method)
    entity_param = _select_id_param(param_names, explicit_name=id_param_name)
    kwargs[entity_param] = entity_id

    data_param = _select_data_param(
        param_names,
        id_param=entity_param,
        explicit_name=data_param_name or ("update_data" if "update_data" in param_names else None),
    )

    if data_param:
        kwargs[data_param] = update_data
        result = await method(**kwargs)
    else:
        result = await method(update_data, **kwargs)

    # Assert entity was updated
    assert_entity_updated(mock_db_session, sample_entity, updated_attributes=expected_attributes)

    return result


async def delete_entity_test_helper(
    service: Any,
    method_name: str,
    entity_id: UUID,
    mock_db_session: AsyncMock,
    sample_entity: Any,
    soft_delete: bool = False,
    tenant_id: str | None = None,
    id_param_name: str | None = None,
    **extra_kwargs,
) -> bool:
    """
    Generic helper for testing successful entity deletion.

    Args:
        service: Service instance
        method_name: Name of the delete method
        entity_id: ID of entity to delete
        mock_db_session: Mocked database session
        sample_entity: Sample entity to delete
        soft_delete: Whether to expect soft delete
        tenant_id: Tenant ID (if required)
        **extra_kwargs: Additional keyword arguments

    Returns:
        Deletion result (usually True)

    Example:
        result = await delete_entity_test_helper(
            contact_service,
            "delete_contact",
            contact_id,
            mock_db_session,
            sample_contact,
            soft_delete=True,
            tenant_id=tenant_id
        )
    """
    # Mock entity retrieval
    mock_result = build_success_result(sample_entity)
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    # Call the method
    method = getattr(service, method_name)
    kwargs = extra_kwargs.copy()
    if tenant_id:
        kwargs["tenant_id"] = tenant_id

    param_names = _get_method_param_names(method)
    entity_param = _select_id_param(param_names, explicit_name=id_param_name)
    kwargs[entity_param] = entity_id

    result = await method(**kwargs)

    # Assert entity was deleted
    assert_entity_deleted(mock_db_session, sample_entity, soft_delete=soft_delete)

    return result


async def retrieve_entity_test_helper(
    service: Any,
    method_name: str,
    entity_id: UUID,
    mock_db_session: AsyncMock,
    sample_entity: Any,
    expected_entity_type: type | None = None,
    use_cache: bool = True,
    tenant_id: str | None = None,
    id_param_name: str | None = None,
    **extra_kwargs,
) -> Any:
    """
    Generic helper for testing successful entity retrieval.

    Args:
        service: Service instance
        method_name: Name of the retrieval method
        entity_id: ID of entity to retrieve
        mock_db_session: Mocked database session
        sample_entity: Sample entity to return
        expected_entity_type: Expected entity type
        use_cache: Whether to mock cache
        tenant_id: Tenant ID (if required)
        **extra_kwargs: Additional keyword arguments

    Returns:
        Retrieved entity

    Example:
        contact = await retrieve_entity_test_helper(
            contact_service,
            "get_contact",
            contact_id,
            mock_db_session,
            sample_contact,
            expected_entity_type=Contact,
            tenant_id=tenant_id
        )
    """
    # Mock entity retrieval
    mock_result = build_success_result(sample_entity)
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    # Call the method with cache mock if requested
    method = getattr(service, method_name)
    kwargs = extra_kwargs.copy()
    if tenant_id:
        kwargs["tenant_id"] = tenant_id

    param_names = _get_method_param_names(method)
    entity_param = _select_id_param(param_names, explicit_name=id_param_name)
    kwargs[entity_param] = entity_id

    if use_cache:
        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            result = await method(**kwargs)
    else:
        result = await method(**kwargs)

    # Assert entity was retrieved
    assert_entity_retrieved(result, sample_entity, expected_entity_type)

    return result


async def list_entities_test_helper(
    service: Any,
    method_name: str,
    mock_db_session: AsyncMock,
    sample_entities: list[Any],
    expected_total: int,
    filters: dict[str, Any] | None = None,
    tenant_id: str | None = None,
    **extra_kwargs,
) -> tuple[list[Any], int]:
    """
    Generic helper for testing entity list/search operations.

    Args:
        service: Service instance
        method_name: Name of the list method
        mock_db_session: Mocked database session
        sample_entities: List of sample entities to return
        expected_total: Expected total count
        filters: Optional filter parameters
        tenant_id: Tenant ID (if required)
        **extra_kwargs: Additional keyword arguments

    Returns:
        Tuple of (entities list, total count)

    Example:
        contacts, total = await list_entities_test_helper(
            contact_service,
            "list_contacts",
            mock_db_session,
            [contact1, contact2],
            expected_total=2,
            tenant_id=tenant_id,
            limit=10,
            offset=0
        )
    """
    # Mock list query
    mock_result = Mock()
    mock_result.scalars.return_value.all.return_value = sample_entities
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=expected_total)

    # Call the method
    method = getattr(service, method_name)
    kwargs = extra_kwargs.copy()
    if tenant_id:
        kwargs["tenant_id"] = tenant_id
    if filters:
        kwargs.update(filters)

    entities, total = await method(**kwargs)

    # Assertions
    assert len(entities) == len(sample_entities), (
        f"Expected {len(sample_entities)} entities, got {len(entities)}"
    )
    assert total == expected_total, f"Expected total {expected_total}, got {total}"

    return entities, total
