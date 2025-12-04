"""
Contact Management Service Layer

Provides business logic for contact operations with caching and validation.
"""

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

import structlog
from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.contacts.models import (
    Contact,
    ContactActivity,
    ContactFieldDefinition,
    ContactLabelDefinition,
    ContactMethod,
    ContactMethodType,
    ContactStage,
    ContactStatus,
)
from dotmac.platform.contacts.schemas import (
    ContactActivityCreate,
    ContactCreate,
    ContactFieldDefinitionCreate,
    ContactLabelDefinitionCreate,
    ContactMethodCreate,
    ContactMethodUpdate,
    ContactResponse,
    ContactUpdate,
)
from dotmac.platform.core.caching import cache_delete, cache_get, cache_set

logger = structlog.get_logger(__name__)


class ContactService:
    """Service for managing contacts and related entities."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_contact(
        self, contact_data: ContactCreate, tenant_id: UUID, owner_id: UUID | None = None
    ) -> Contact:
        """Create a new contact."""
        # Generate display name if not provided
        display_name = contact_data.display_name
        if not display_name:
            parts = []
            if contact_data.first_name:
                parts.append(contact_data.first_name)
            if contact_data.last_name:
                parts.append(contact_data.last_name)
            if not parts and contact_data.company:
                parts.append(contact_data.company)
            display_name = " ".join(parts) or "Unnamed Contact"

        # Create contact
        contact = Contact(
            tenant_id=tenant_id,
            customer_id=contact_data.customer_id,
            first_name=contact_data.first_name,
            middle_name=contact_data.middle_name,
            last_name=contact_data.last_name,
            display_name=display_name,
            prefix=contact_data.prefix,
            suffix=contact_data.suffix,
            company=contact_data.company,
            job_title=contact_data.job_title,
            department=contact_data.department,
            status=contact_data.status or ContactStatus.ACTIVE,
            stage=contact_data.stage or ContactStage.PROSPECT,
            owner_id=owner_id or contact_data.owner_id,
            notes=contact_data.notes,
            tags=contact_data.tags or [],
            custom_fields=contact_data.custom_fields or {},
            metadata_=contact_data.metadata or {},
            birthday=contact_data.birthday,
            anniversary=contact_data.anniversary,
            is_primary=contact_data.is_primary,
            is_decision_maker=contact_data.is_decision_maker,
            is_billing_contact=contact_data.is_billing_contact,
            is_technical_contact=contact_data.is_technical_contact,
            preferred_contact_method=contact_data.preferred_contact_method,
            preferred_language=contact_data.preferred_language,
            timezone=contact_data.timezone,
        )

        self.db.add(contact)
        await self.db.flush()

        # Add contact methods if provided
        if contact_data.contact_methods:
            for method_data in contact_data.contact_methods:
                method = ContactMethod(
                    contact_id=contact.id,
                    type=method_data.type,
                    value=method_data.value,
                    label=method_data.label,
                    is_primary=method_data.is_primary,
                    is_verified=method_data.is_verified,
                    is_public=method_data.is_public,
                    display_order=method_data.display_order,
                    metadata_=method_data.metadata,
                )

                # Add address fields if it's an address type
                if method_data.type == ContactMethodType.ADDRESS:
                    method.address_line1 = method_data.address_line1
                    method.address_line2 = method_data.address_line2
                    method.city = method_data.city
                    method.state_province = method_data.state_province
                    method.postal_code = method_data.postal_code
                    method.country = method_data.country

                self.db.add(method)

        # Add labels if provided
        if contact_data.label_ids:
            labels = await self.db.execute(
                select(ContactLabelDefinition).where(
                    and_(
                        ContactLabelDefinition.id.in_(contact_data.label_ids),
                        ContactLabelDefinition.tenant_id == tenant_id,
                    )
                )
            )
            contact.labels.extend(labels.scalars().all())

        await self.db.commit()
        await self.db.refresh(contact)

        # Clear cache
        self._clear_contact_cache(tenant_id)

        logger.info(f"Created contact {contact.id} for tenant {tenant_id}")
        return contact

    async def get_contact(
        self,
        contact_id: UUID,
        tenant_id: UUID,
        include_methods: bool = True,
        include_labels: bool = True,
        *,
        use_cache: bool = True,
    ) -> Contact | ContactResponse | None:
        """Get a contact by ID."""
        cache_key = f"contact:{tenant_id}:{contact_id}"

        # Check cache
        if use_cache and not include_methods and not include_labels:
            cached = cache_get(cache_key)
            if cached:
                # If the cached payload is already a model or ORM instance, return as-is
                if isinstance(cached, (Contact, ContactResponse)):
                    return cached
                if isinstance(cached, dict):
                    try:
                        return ContactResponse.model_validate(cached)
                    except ValidationError:
                        cache_delete(cache_key)
                else:
                    # Unexpected payload type – return it directly for backward compatibility
                    return cached

        # Build query
        query = select(Contact).where(
            and_(
                Contact.id == contact_id,
                Contact.tenant_id == tenant_id,
                Contact.deleted_at.is_(None),
            )
        )

        # Add eager loading if requested
        if include_methods:
            query = query.options(selectinload(Contact.contact_methods))
        if include_labels:
            query = query.options(selectinload(Contact.labels))

        result = await self.db.execute(query)
        contact = result.scalar_one_or_none()

        # Cache if not including relationships
        if contact and use_cache and not include_methods and not include_labels:
            try:
                serialized = ContactResponse.model_validate(contact).model_dump(mode="json")
                cache_set(cache_key, serialized, ttl=300)
            except (ValidationError, TypeError, ValueError):
                # Ignore serialization issues; cache is best-effort
                pass

        return contact

    async def update_contact(
        self, contact_id: UUID, contact_data: ContactUpdate, tenant_id: UUID
    ) -> Contact | None:
        """Update a contact."""
        contact = await self.get_contact(
            contact_id,
            tenant_id,
            include_methods=False,
            include_labels=False,
            use_cache=False,
        )
        if not contact:
            return None

        contact = cast(Contact, contact)

        # Update fields if provided
        update_fields = contact_data.model_dump(exclude_unset=True)

        # Map schema field names to ORM column names
        field_mapping = {
            "metadata": "metadata_",  # Schema uses 'metadata', ORM uses 'metadata_'
        }

        for field, value in update_fields.items():
            # Use mapped field name if it exists, otherwise use original
            orm_field = field_mapping.get(field, field)
            if hasattr(contact, orm_field):
                setattr(contact, orm_field, value)

        contact.updated_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(contact)

        # Clear cache
        self._clear_contact_cache(tenant_id, contact_id)

        logger.info(f"Updated contact {contact_id} for tenant {tenant_id}")
        return contact

    async def delete_contact(
        self,
        contact_id: UUID,
        tenant_id: UUID,
        hard_delete: bool = False,
        deleted_by: UUID | None = None,
    ) -> bool:
        """Delete a contact (soft or hard)."""
        contact = await self.get_contact(
            contact_id,
            tenant_id,
            include_methods=False,
            include_labels=False,
            use_cache=False,
        )
        if not contact:
            return False

        contact = cast(Contact, contact)

        if hard_delete:
            await self.db.delete(contact)
        else:
            contact.deleted_at = datetime.now(UTC)
            contact.deleted_by = deleted_by

        await self.db.commit()

        # Clear cache
        self._clear_contact_cache(tenant_id, contact_id)

        logger.info(
            f"{'Hard' if hard_delete else 'Soft'} deleted contact {contact_id} for tenant {tenant_id}"
        )
        return True

    def _build_base_conditions(self, tenant_id: UUID, include_deleted: bool) -> list[Any]:
        """Build base tenant and deletion filter conditions."""
        conditions = [Contact.tenant_id == tenant_id]
        if not include_deleted:
            conditions.append(Contact.deleted_at.is_(None))
        return conditions

    def _build_text_search_condition(self, query: str) -> Any:
        """Build text search condition across multiple fields."""
        return or_(
            Contact.display_name.ilike(f"%{query}%"),
            Contact.first_name.ilike(f"%{query}%"),
            Contact.last_name.ilike(f"%{query}%"),
            Contact.company.ilike(f"%{query}%"),
            Contact.notes.ilike(f"%{query}%"),
        )

    def _build_attribute_conditions(
        self,
        customer_id: UUID | None,
        status: ContactStatus | None,
        stage: ContactStage | None,
        owner_id: UUID | None,
    ) -> list[Any]:
        """Build attribute filter conditions."""
        conditions = []

        if customer_id:
            conditions.append(Contact.customer_id == customer_id)
        if status:
            conditions.append(Contact.status == status)
        if stage:
            conditions.append(Contact.stage == stage)
        if owner_id:
            conditions.append(Contact.owner_id == owner_id)

        return conditions

    def _build_tag_conditions(self, tags: list[str]) -> Any:
        """Build tag filter conditions."""
        tag_conditions = []
        for tag in tags:
            tag_conditions.append(Contact.tags.contains([tag]))
        if tag_conditions:
            return or_(*tag_conditions)
        return None

    async def search_contacts(
        self,
        tenant_id: UUID,
        query: str | None = None,
        customer_id: UUID | None = None,
        status: ContactStatus | None = None,
        stage: ContactStage | None = None,
        owner_id: UUID | None = None,
        tags: list[str] | None = None,
        label_ids: list[UUID] | None = None,
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[Contact], int]:
        """Search contacts with filtering."""
        # Build base conditions
        conditions = self._build_base_conditions(tenant_id, include_deleted)

        # Add text search
        if query:
            conditions.append(self._build_text_search_condition(query))

        # Add attribute filters
        conditions.extend(self._build_attribute_conditions(customer_id, status, stage, owner_id))

        # Add tag filters
        if tags:
            tag_condition = self._build_tag_conditions(tags)
            if tag_condition is not None:
                conditions.append(tag_condition)

        # Build main query
        stmt = select(Contact).where(and_(*conditions))

        # Add label filtering if specified
        if label_ids:
            stmt = stmt.join(Contact.labels).where(ContactLabelDefinition.id.in_(label_ids))
            # Use distinct to avoid duplicates when contacts have multiple matching labels
            stmt = stmt.distinct(Contact.id)

        # Get total count (use distinct subquery if labels were filtered)
        if label_ids:
            # Count distinct contacts from the filtered query
            # Build subquery that selects only distinct contact IDs
            subq = (
                select(Contact.id)
                .where(and_(*conditions))
                .join(Contact.labels)
                .where(ContactLabelDefinition.id.in_(label_ids))
                .distinct()
                .subquery()
            )
            # Count rows in the subquery (each row is a unique contact)
            count_stmt = select(func.count()).select_from(subq)
        else:
            count_stmt = select(func.count()).select_from(stmt.subquery())
        raw_total = await self.db.scalar(count_stmt)
        total = int(raw_total or 0)

        # Add ordering and pagination
        if label_ids:
            stmt = stmt.order_by(Contact.id, Contact.display_name)
        else:
            stmt = stmt.order_by(Contact.display_name)
        stmt = stmt.limit(limit).offset(offset)

        # Execute query
        result = await self.db.execute(stmt)
        contacts = list(result.scalars().all())

        return contacts, total

    async def add_contact_method(
        self, contact_id: UUID, method_data: ContactMethodCreate, tenant_id: UUID
    ) -> ContactMethod | None:
        """Add a contact method to a contact."""
        contact = await self.get_contact(
            contact_id,
            tenant_id,
            include_methods=False,
            include_labels=False,
            use_cache=False,
        )
        if not contact:
            return None

        method = ContactMethod(
            contact_id=contact_id,
            type=method_data.type,
            value=method_data.value,
            label=method_data.label,
            is_primary=method_data.is_primary,
            is_verified=method_data.is_verified,
            is_public=method_data.is_public,
            display_order=method_data.display_order,
            metadata_=method_data.metadata,
        )

        # Add address fields if applicable
        if method_data.type == ContactMethodType.ADDRESS:
            method.address_line1 = method_data.address_line1
            method.address_line2 = method_data.address_line2
            method.city = method_data.city
            method.state_province = method_data.state_province
            method.postal_code = method_data.postal_code
            method.country = method_data.country

        self.db.add(method)
        await self.db.commit()
        await self.db.refresh(method)

        # Clear cache
        self._clear_contact_cache(tenant_id, contact_id)

        logger.info(f"Added contact method {method.id} to contact {contact_id}")
        return method

    async def update_contact_method(
        self, method_id: UUID, method_data: ContactMethodUpdate, tenant_id: UUID
    ) -> ContactMethod | None:
        """Update a contact method."""
        # Get the method with contact check
        stmt = (
            select(ContactMethod)
            .join(Contact)
            .where(
                and_(
                    ContactMethod.id == method_id,
                    Contact.tenant_id == tenant_id,
                    Contact.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        method = result.scalar_one_or_none()

        if not method:
            return None

        # Update fields
        update_fields = method_data.model_dump(exclude_unset=True)

        # Map schema field names to ORM column names
        field_mapping = {
            "metadata": "metadata_",  # Schema uses 'metadata', ORM uses 'metadata_'
        }

        for field, value in update_fields.items():
            # Use mapped field name if it exists, otherwise use original
            orm_field = field_mapping.get(field, field)
            if hasattr(method, orm_field):
                setattr(method, orm_field, value)

        method.updated_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(method)

        # Clear cache
        self._clear_contact_cache(tenant_id, method.contact_id)

        logger.info(f"Updated contact method {method_id}")
        return method

    async def delete_contact_method(self, method_id: UUID, tenant_id: UUID) -> bool:
        """Delete a contact method."""
        # Get the method with contact check
        stmt = (
            select(ContactMethod)
            .join(Contact)
            .where(
                and_(
                    ContactMethod.id == method_id,
                    Contact.tenant_id == tenant_id,
                    Contact.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        method = result.scalar_one_or_none()

        if not method:
            return False

        contact_id = method.contact_id
        await self.db.delete(method)
        await self.db.commit()

        # Clear cache
        self._clear_contact_cache(tenant_id, contact_id)

        logger.info(f"Deleted contact method {method_id}")
        return True

    async def add_contact_activity(
        self,
        contact_id: UUID,
        activity_data: ContactActivityCreate,
        tenant_id: UUID,
        performed_by: UUID,
    ) -> ContactActivity | None:
        """Add an activity to a contact."""
        contact = await self.get_contact(
            contact_id,
            tenant_id,
            include_methods=False,
            include_labels=False,
            use_cache=False,
        )
        if not contact:
            return None

        activity = ContactActivity(
            contact_id=contact_id,
            activity_type=activity_data.activity_type,
            subject=activity_data.subject,
            description=activity_data.description,
            activity_date=activity_data.activity_date or datetime.now(UTC),
            duration_minutes=activity_data.duration_minutes,
            status=activity_data.status,
            outcome=activity_data.outcome,
            performed_by=performed_by,
            metadata_=activity_data.metadata,
        )

        self.db.add(activity)

        # Update last contacted date
        contact.last_contacted_at = activity.activity_date

        await self.db.commit()
        await self.db.refresh(activity)

        logger.info(f"Added activity {activity.id} to contact {contact_id}")
        return activity

    async def get_contact_activities(
        self, contact_id: UUID, tenant_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[ContactActivity]:
        """Get activities for a contact."""
        # Verify contact belongs to tenant
        contact = await self.get_contact(
            contact_id, tenant_id, include_methods=False, include_labels=False
        )
        if not contact:
            return []

        stmt = (
            select(ContactActivity)
            .where(ContactActivity.contact_id == contact_id)
            .order_by(ContactActivity.activity_date.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def _clear_contact_cache(self, tenant_id: UUID, contact_id: UUID | None = None) -> None:
        """Clear contact-related cache entries."""
        if contact_id:
            cache_delete(f"contact:{tenant_id}:{contact_id}")
        # Clear tenant-level caches
        # Note: Redis pattern deletion would require additional logic
        # For now, just clear the specific contact cache


class ContactLabelService:
    """Service for managing contact labels."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_label_definition(
        self,
        label_data: ContactLabelDefinitionCreate,
        tenant_id: UUID,
        created_by: UUID | None = None,
    ) -> ContactLabelDefinition:
        """Create a new label definition."""
        # Generate slug if not provided
        slug = label_data.slug
        if not slug:
            slug = label_data.name.lower().replace(" ", "-").replace("_", "-")

        label = ContactLabelDefinition(
            tenant_id=tenant_id,
            name=label_data.name,
            slug=slug,
            description=label_data.description,
            color=label_data.color,
            icon=label_data.icon,
            category=label_data.category,
            display_order=label_data.display_order,
            is_visible=label_data.is_visible,
            is_system=label_data.is_system,
            is_default=label_data.is_default,
            metadata_=label_data.metadata,
            created_by=created_by,
        )

        self.db.add(label)
        await self.db.commit()
        await self.db.refresh(label)

        logger.info(f"Created label definition {label.id} for tenant {tenant_id}")
        return label

    async def get_label_definitions(
        self, tenant_id: UUID, category: str | None = None, include_hidden: bool = False
    ) -> list[ContactLabelDefinition]:
        """Get label definitions for a tenant."""
        conditions = [ContactLabelDefinition.tenant_id == tenant_id]

        if not include_hidden:
            conditions.append(ContactLabelDefinition.is_visible.is_(True))

        if category:
            conditions.append(ContactLabelDefinition.category == category)

        stmt = (
            select(ContactLabelDefinition)
            .where(and_(*conditions))
            .order_by(ContactLabelDefinition.display_order, ContactLabelDefinition.name)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class ContactFieldService:
    """Service for managing custom contact fields."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_field_definition(
        self,
        field_data: ContactFieldDefinitionCreate,
        tenant_id: UUID,
        created_by: UUID | None = None,
    ) -> ContactFieldDefinition:
        """Create a new field definition."""
        # Generate field key if not provided
        field_key = field_data.field_key
        if not field_key:
            field_key = field_data.name.lower().replace(" ", "_").replace("-", "_")

        field = ContactFieldDefinition(
            tenant_id=tenant_id,
            name=field_data.name,
            field_key=field_key,
            description=field_data.description,
            field_type=field_data.field_type,
            is_required=field_data.is_required,
            is_unique=field_data.is_unique,
            is_searchable=field_data.is_searchable,
            default_value=field_data.default_value,
            validation_rules=field_data.validation_rules,
            options=field_data.options,
            display_order=field_data.display_order,
            placeholder=field_data.placeholder,
            help_text=field_data.help_text,
            field_group=field_data.field_group,
            is_visible=field_data.is_visible,
            is_editable=field_data.is_editable,
            required_permission=field_data.required_permission,
            is_system=field_data.is_system,
            is_encrypted=field_data.is_encrypted,
            metadata_=field_data.metadata,
            created_by=created_by,
        )

        self.db.add(field)
        await self.db.commit()
        await self.db.refresh(field)

        logger.info(f"Created field definition {field.id} for tenant {tenant_id}")
        return field

    async def get_field_definitions(
        self, tenant_id: UUID, field_group: str | None = None, include_hidden: bool = False
    ) -> list[ContactFieldDefinition]:
        """Get field definitions for a tenant."""
        conditions = [ContactFieldDefinition.tenant_id == tenant_id]

        if not include_hidden:
            conditions.append(ContactFieldDefinition.is_visible.is_(True))

        if field_group:
            conditions.append(ContactFieldDefinition.field_group == field_group)

        stmt = (
            select(ContactFieldDefinition)
            .where(and_(*conditions))
            .order_by(ContactFieldDefinition.display_order, ContactFieldDefinition.name)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def validate_custom_fields(
        self, custom_fields: dict[str, Any], tenant_id: UUID
    ) -> tuple[bool, list[str]]:
        """Validate custom fields against field definitions."""
        errors = []

        # Get all field definitions for the tenant
        field_defs = await self.get_field_definitions(tenant_id, include_hidden=True)
        field_map = {fd.field_key: fd for fd in field_defs}

        # Check required fields
        for field_def in field_defs:
            if field_def.is_required and field_def.field_key not in custom_fields:
                errors.append(f"Required field '{field_def.name}' is missing")

        # Validate provided fields
        for field_key, value in custom_fields.items():
            if field_key not in field_map:
                # Unknown field - could be allowed depending on policy
                continue

            field_def = field_map[field_key]

            # Type validation would go here based on field_def.field_type
            # For now, just check if it's not None when required
            if field_def.is_required and value is None:
                errors.append(f"Field '{field_def.name}' cannot be null")

        return len(errors) == 0, errors
