"""
Contact Management API Router

FastAPI endpoints for contact operations.
"""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, ensure_uuid
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.contacts.schemas import (
    ContactActivityCreate,
    ContactActivityResponse,
    ContactBulkDelete,
    ContactBulkUpdate,
    ContactCreate,
    ContactFieldDefinitionCreate,
    ContactFieldDefinitionResponse,
    ContactLabelDefinitionCreate,
    ContactLabelDefinitionResponse,
    ContactListResponse,
    ContactMethodCreate,
    ContactMethodResponse,
    ContactMethodType,
    ContactMethodUpdate,
    ContactResponse,
    ContactSearchRequest,
    ContactUpdate,
)
from dotmac.platform.contacts.service import (
    ContactFieldService,
    ContactLabelService,
    ContactService,
)
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

logger = structlog.get_logger(__name__)


router = APIRouter(prefix="/contacts", tags=["Contacts"])


class ContactMethodCreatePayload(ContactMethodCreate):
    """Payload for contact method creation with contact_id."""

    contact_id: UUID
    type: ContactMethodType = Field(..., alias="method_type")


class ContactActivityCreatePayload(ContactActivityCreate):
    """Payload for activity creation with contact_id."""

    contact_id: UUID


# Contact endpoints
@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_data: ContactCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.create")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactResponse:
    """Create a new contact."""
    service = ContactService(db)
    contact = await service.create_contact(
        contact_data=contact_data, tenant_id=tenant_id, owner_id=ensure_uuid(current_user.user_id)
    )
    return ContactResponse.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    include_methods: bool = Query(True, description="Include contact methods"),
    include_labels: bool = Query(True, description="Include labels"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.read")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactResponse:
    """Get a contact by ID."""
    service = ContactService(db)
    contact = await service.get_contact(
        contact_id=contact_id,
        tenant_id=tenant_id,
        include_methods=include_methods,
        include_labels=include_labels,
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactResponse.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    contact_data: ContactUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactResponse:
    """Update a contact."""
    service = ContactService(db)
    contact = await service.update_contact(
        contact_id=contact_id, contact_data=contact_data, tenant_id=tenant_id
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete the contact"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.delete")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> None:
    """Delete a contact."""
    service = ContactService(db)
    success = await service.delete_contact(
        contact_id=contact_id,
        tenant_id=tenant_id,
        hard_delete=hard_delete,
        deleted_by=ensure_uuid(current_user.user_id),
    )
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")


@router.post("/search", response_model=ContactListResponse)
async def search_contacts(
    search_request: ContactSearchRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.read")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactListResponse:
    """Search contacts with filtering."""
    service = ContactService(db)

    # Calculate pagination
    limit = search_request.page_size
    offset = (search_request.page - 1) * search_request.page_size

    contacts, total = await service.search_contacts(
        tenant_id=tenant_id,
        query=search_request.query,
        customer_id=search_request.customer_id,
        status=search_request.status,
        stage=search_request.stage,
        owner_id=search_request.owner_id,
        tags=search_request.tags,
        label_ids=search_request.label_ids,
        limit=limit,
        offset=offset,
        include_deleted=search_request.include_deleted,
    )

    # Calculate pagination info
    has_next = (search_request.page * search_request.page_size) < total
    has_prev = search_request.page > 1

    # Convert Contact models to ContactResponse
    contact_responses = [ContactResponse.model_validate(contact) for contact in contacts]

    return ContactListResponse(
        contacts=contact_responses,
        total=total,
        page=search_request.page,
        page_size=search_request.page_size,
        has_next=has_next,
        has_prev=has_prev,
    )


# Contact method endpoints
@router.post(
    "/{contact_id}/methods",
    response_model=ContactMethodResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact_method(
    contact_id: UUID,
    method_data: ContactMethodCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactMethodResponse:
    """Add a contact method to a contact."""
    service = ContactService(db)
    method = await service.add_contact_method(
        contact_id=contact_id, method_data=method_data, tenant_id=tenant_id
    )
    if not method:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactMethodResponse.model_validate(method)


@router.patch("/methods/{method_id}", response_model=ContactMethodResponse)
async def update_contact_method(
    method_id: UUID,
    method_data: ContactMethodUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactMethodResponse:
    """Update a contact method."""
    service = ContactService(db)
    method = await service.update_contact_method(
        method_id=method_id, method_data=method_data, tenant_id=tenant_id
    )
    if not method:
        raise HTTPException(status_code=404, detail="Contact method not found")
    return ContactMethodResponse.model_validate(method)


@router.post(
    "/methods",
    response_model=ContactMethodResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact_method_global(
    method_data: ContactMethodCreatePayload,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactMethodResponse:
    """Add a contact method using payload-provided contact ID."""
    service = ContactService(db)
    method = await service.add_contact_method(
        contact_id=method_data.contact_id,
        method_data=method_data,
        tenant_id=tenant_id,
    )
    if not method:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactMethodResponse.model_validate(method)


@router.delete("/methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_method(
    method_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> None:
    """Delete a contact method."""
    service = ContactService(db)
    success = await service.delete_contact_method(method_id=method_id, tenant_id=tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact method not found")


# Activity endpoints
@router.post(
    "/{contact_id}/activities",
    response_model=ContactActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact_activity(
    contact_id: UUID,
    activity_data: ContactActivityCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactActivityResponse:
    """Add an activity to a contact."""
    service = ContactService(db)
    activity = await service.add_contact_activity(
        contact_id=contact_id,
        activity_data=activity_data,
        tenant_id=tenant_id,
        performed_by=ensure_uuid(current_user.user_id),
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactActivityResponse.model_validate(activity)


@router.post(
    "/activities",
    response_model=ContactActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact_activity_global(
    activity_data: ContactActivityCreatePayload,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.manage")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactActivityResponse:
    """Add contact activity with contact ID in payload."""
    service = ContactService(db)
    activity = await service.add_contact_activity(
        contact_id=activity_data.contact_id,
        activity_data=activity_data,
        tenant_id=tenant_id,
        performed_by=ensure_uuid(current_user.user_id),
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactActivityResponse.model_validate(activity)


@router.get("/{contact_id}/activities", response_model=list[ContactActivityResponse])
async def get_contact_activities(
    contact_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.read")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> list[ContactActivityResponse]:
    """Get activities for a contact."""
    service = ContactService(db)
    activities = await service.get_contact_activities(
        contact_id=contact_id, tenant_id=tenant_id, limit=limit, offset=offset
    )
    return [ContactActivityResponse.model_validate(activity) for activity in activities]


# Label definition endpoints
@router.post(
    "/labels/definitions",
    response_model=ContactLabelDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_label_definition(
    label_data: ContactLabelDefinitionCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.manage")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactLabelDefinitionResponse:
    """Create a new label definition."""
    service = ContactLabelService(db)
    label = await service.create_label_definition(
        label_data=label_data, tenant_id=tenant_id, created_by=ensure_uuid(current_user.user_id)
    )
    return ContactLabelDefinitionResponse.model_validate(label)


@router.get("/labels/definitions", response_model=list[ContactLabelDefinitionResponse])
async def get_label_definitions(
    category: str | None = Query(None, description="Filter by category"),
    include_hidden: bool = Query(False, description="Include hidden labels"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.read")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> list[ContactLabelDefinitionResponse]:
    """Get label definitions for the tenant."""
    service = ContactLabelService(db)
    labels = await service.get_label_definitions(
        tenant_id=tenant_id, category=category, include_hidden=include_hidden
    )
    return [ContactLabelDefinitionResponse.model_validate(label) for label in labels]


# Field definition endpoints
@router.post(
    "/fields/definitions",
    response_model=ContactFieldDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_field_definition(
    field_data: ContactFieldDefinitionCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.manage")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> ContactFieldDefinitionResponse:
    """Create a new custom field definition."""
    service = ContactFieldService(db)
    field = await service.create_field_definition(
        field_data=field_data, tenant_id=tenant_id, created_by=ensure_uuid(current_user.user_id)
    )
    return ContactFieldDefinitionResponse.model_validate(field)


@router.get("/fields/definitions", response_model=list[ContactFieldDefinitionResponse])
async def get_field_definitions(
    field_group: str | None = Query(None, description="Filter by field group"),
    include_hidden: bool = Query(False, description="Include hidden fields"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.read")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> list[ContactFieldDefinitionResponse]:
    """Get field definitions for the tenant."""
    service = ContactFieldService(db)
    fields = await service.get_field_definitions(
        tenant_id=tenant_id, field_group=field_group, include_hidden=include_hidden
    )
    return [ContactFieldDefinitionResponse.model_validate(field) for field in fields]


# Bulk operations
@router.post("/bulk/update", status_code=status.HTTP_200_OK)
async def bulk_update_contacts(
    bulk_update: ContactBulkUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.update")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Bulk update multiple contacts."""
    service = ContactService(db)
    updated_count = 0
    errors: list[dict[str, str]] = []

    for contact_id in bulk_update.contact_ids:
        try:
            contact = await service.update_contact(
                contact_id=contact_id, contact_data=bulk_update.update_data, tenant_id=tenant_id
            )
            if contact:
                updated_count += 1
            else:
                errors.append({"contact_id": str(contact_id), "error": "Not found"})
        except (SQLAlchemyError, ValueError) as exc:
            errors.append({"contact_id": str(contact_id), "error": str(exc)})
            logger.error("Error updating contact", contact_id=str(contact_id), error=str(exc))
        except Exception as exc:
            # Catch any other unexpected errors
            errors.append({"contact_id": str(contact_id), "error": str(exc)})
            logger.error(
                "Unexpected error updating contact", contact_id=str(contact_id), error=str(exc)
            )

    return {"updated": updated_count, "errors": errors}


@router.post("/bulk/delete", status_code=status.HTTP_200_OK)
async def bulk_delete_contacts(
    bulk_delete: ContactBulkDelete,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("contacts.delete")),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Bulk delete multiple contacts."""
    service = ContactService(db)
    deleted_count = 0
    errors: list[dict[str, str]] = []

    for contact_id in bulk_delete.contact_ids:
        try:
            success = await service.delete_contact(
                contact_id=contact_id,
                tenant_id=tenant_id,
                hard_delete=bulk_delete.hard_delete,
                deleted_by=ensure_uuid(current_user.user_id),
            )
            if success:
                deleted_count += 1
            else:
                errors.append({"contact_id": str(contact_id), "error": "Not found"})
        except (SQLAlchemyError, ValueError) as exc:
            errors.append({"contact_id": str(contact_id), "error": str(exc)})
            logger.error("Error deleting contact", contact_id=str(contact_id), error=str(exc))
        except Exception as exc:
            # Catch any other unexpected errors
            errors.append({"contact_id": str(contact_id), "error": str(exc)})
            logger.error(
                "Unexpected error deleting contact", contact_id=str(contact_id), error=str(exc)
            )

    return {"deleted": deleted_count, "errors": errors}
