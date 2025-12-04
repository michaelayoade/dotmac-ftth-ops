"""
Core Customer Management Service.

Simplified service using standard libraries for essential CRUD operations only.
Advanced features moved to optional extensions.
"""

import collections
import itertools
import json
import operator
import secrets
from collections.abc import Callable, Iterable, Iterator
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, TypeVar
from uuid import UUID

import sqlalchemy as sa
import structlog
from sqlalchemy import Select, and_, func, literal, or_, select, text, update
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import (
    ActivityType,
    Customer,
    CustomerActivity,
    CustomerNote,
    CustomerSegment,
    CustomerStatus,
    CustomerTag,
)
from dotmac.platform.customer_management.schemas import (
    CustomerActivityCreate,
    CustomerCreate,
    CustomerNoteCreate,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerUpdate,
)
from dotmac.platform.geo.auto_geocode import geocode_customer_address
from dotmac.platform.tenant import get_current_tenant_id
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

_T = TypeVar("_T")

logger = structlog.get_logger(__name__)


def validate_uuid(value: UUID | str, field_name: str = "id") -> UUID:
    """Validate and convert string to UUID with standard library validation."""
    if value is None:
        raise ValueError(f"Invalid UUID for {field_name}: {value}")
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid UUID for {field_name}: {value}") from e
    raise ValueError(f"Invalid UUID for {field_name}: {value}")


logger = structlog.get_logger(__name__)


class CustomerService:
    """Core customer management service using standard library patterns."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize customer service.

        Args:
            session: Async SQLAlchemy session for database operations
        """
        self.session = session
        # Initialize collections for efficient analytics
        self._customer_stats_cache: collections.defaultdict[str, int] = collections.defaultdict(int)

    def _get_customer_cache_key(
        self, customer_id: str, include_activities: bool = False, include_notes: bool = False
    ) -> str:
        """Generate cache key for customer data using standard library."""
        return f"customer:{customer_id}:activities:{include_activities}:notes:{include_notes}"

    def _customer_to_dict(self, customer: Customer) -> dict[str, Any]:
        """Convert customer model to dict with proper field mapping.

        Maps metadata_ to metadata for Pydantic compatibility.
        """
        data = {
            "id": customer.id,
            "customer_number": customer.customer_number,
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "middle_name": customer.middle_name,
            "display_name": customer.display_name,
            "company_name": customer.company_name,
            "status": customer.status,
            "customer_type": customer.customer_type,
            "tier": customer.tier,
            "email": customer.email,
            "email_verified": customer.email_verified,
            "phone": customer.phone,
            "phone_verified": customer.phone_verified,
            "mobile": customer.mobile,
            "address_line1": customer.address_line1,
            "address_line2": customer.address_line2,
            "city": customer.city,
            "state_province": customer.state_province,
            "postal_code": customer.postal_code,
            "country": customer.country,
            "tax_id": customer.tax_id,
            "vat_number": customer.vat_number,
            "industry": customer.industry,
            "employee_count": customer.employee_count,
            "annual_revenue": customer.annual_revenue,
            "preferred_channel": customer.preferred_channel,
            "preferred_language": customer.preferred_language,
            "timezone": customer.timezone,
            "opt_in_marketing": customer.opt_in_marketing,
            "opt_in_updates": customer.opt_in_updates,
            "user_id": customer.user_id,
            "assigned_to": customer.assigned_to,
            "segment_id": customer.segment_id,
            "lifetime_value": customer.lifetime_value,
            "total_purchases": customer.total_purchases,
            "last_purchase_date": customer.last_purchase_date,
            "first_purchase_date": customer.first_purchase_date,
            "average_order_value": customer.average_order_value,
            "credit_score": customer.credit_score,
            "risk_score": customer.risk_score,
            "satisfaction_score": customer.satisfaction_score,
            "net_promoter_score": customer.net_promoter_score,
            "acquisition_date": customer.acquisition_date,
            "last_contact_date": customer.last_contact_date,
            "birthday": customer.birthday,
            "metadata": customer.metadata_,  # Map metadata_ to metadata
            "custom_fields": customer.custom_fields,
            "tags": customer.tags,
            "external_id": customer.external_id,
            "source_system": customer.source_system,
            "created_at": customer.created_at,
            "updated_at": customer.updated_at,
        }
        return data

    def _resolve_tenant_id(self) -> str:
        """Resolve the current tenant ID from context or use default.

        Returns:
            str: The resolved tenant ID, never None
        """
        tenant_id_value = get_current_tenant_id()
        if not tenant_id_value:
            # Fall back to default tenant for backwards compatibility
            tenant_id = "default-tenant"
            logger.debug("No tenant context found, using default tenant")
        elif isinstance(tenant_id_value, str):
            tenant_id = tenant_id_value
        else:
            tenant_id = str(tenant_id_value)
        return tenant_id

    def _validate_and_get_tenant(self, customer_id: UUID | str) -> tuple[UUID, str]:
        """Validate customer ID and get current tenant (consolidated pattern)."""
        validated_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()
        return validated_id, tenant_id

    def _get_base_customer_query(self, tenant_id: str) -> Select[tuple[Customer]]:
        """Get base customer query with tenant filtering (consolidated pattern)."""
        return select(Customer).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

    # CORE CRUD OPERATIONS

    async def create_customer(
        self,
        data: CustomerCreate,
        created_by: str | None = None,
    ) -> Customer:
        """Create a new customer using Pydantic validation."""
        # Generate customer number
        customer_number = await self._generate_customer_number()

        # Get current tenant
        tenant_id = self._resolve_tenant_id()

        # Create customer using Pydantic validation (built-in)
        customer = Customer(
            customer_number=customer_number,
            tenant_id=tenant_id,
            created_by=created_by,
            **data.model_dump(exclude={"tags", "metadata", "custom_fields"}),
        )

        # Set JSON fields
        customer.tags = data.tags or []
        customer.metadata_ = data.metadata or {}
        customer.custom_fields = data.custom_fields or {}

        self.session.add(customer)
        await self.session.flush()  # Get ID before creating related records

        # Create initial activity
        activity = CustomerActivity(
            customer_id=customer.id,
            tenant_id=tenant_id,
            activity_type=ActivityType.CREATED,
            title="Customer created",
            description=f"Customer {customer.full_name} was created",
            metadata_={"customer_number": customer_number},
        )
        self.session.add(activity)

        # Add tags using standard SQLAlchemy
        for tag_name in data.tags or []:
            tag = CustomerTag(
                customer_id=customer.id,
                tenant_id=tenant_id,
                tag_name=tag_name,
            )
            self.session.add(tag)

        # Auto-geocode service address if provided
        try:
            customer_data = {
                "service_address_line1": customer.service_address_line1,
                "service_address_line2": customer.service_address_line2,
                "service_city": customer.service_city,
                "service_state_province": customer.service_state_province,
                "service_postal_code": customer.service_postal_code,
                "service_country": customer.service_country,
                "service_coordinates": customer.service_coordinates,
            }
            coords = await geocode_customer_address(customer_data, force=False)
            if coords:
                customer.service_coordinates = coords
                logger.info(
                    "Auto-geocoded customer service address",
                    customer_id=str(customer.id),
                    coordinates=coords,
                )
        except Exception as e:
            logger.warning("Failed to auto-geocode customer address", error=str(e))

        await self.session.commit()
        await self.session.refresh(customer)

        logger.info(
            "Customer created",
            customer_id=str(customer.id),
            customer_number=customer_number,
            email=customer.email,
        )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CUSTOMER_CREATED.value,
                event_data={
                    "customer_id": str(customer.id),
                    "customer_number": customer.customer_number,
                    "email": customer.email,
                    "first_name": customer.first_name,
                    "last_name": customer.last_name,
                    "company_name": customer.company_name,
                    "status": customer.status.value if customer.status else None,
                    "customer_type": customer.customer_type,
                    "phone": customer.phone,
                    "created_at": customer.created_at.isoformat() if customer.created_at else None,
                },
                tenant_id=tenant_id,
                db=self.session,
            )
        except Exception as e:
            logger.warning("Failed to publish customer.created event", error=str(e))

        return customer

    async def get_customer(
        self,
        customer_id: UUID | str,
        include_activities: bool = False,
        include_notes: bool = False,
    ) -> Customer | None:
        """Get customer by ID using standard SQLAlchemy queries.

        Note: include_activities and include_notes parameters are kept for API compatibility
        but are not used because activities and notes use lazy="dynamic" relationships.
        Use get_customer_activities() and get_customer_notes() to fetch these separately.
        """
        customer_id, tenant_id = self._validate_and_get_tenant(customer_id)

        # Build base query (selectinload is incompatible with lazy="dynamic" relationships)
        query = self._get_base_customer_query(tenant_id).where(Customer.id == customer_id)

        result: Result[tuple[Customer]] = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_customer_by_number(
        self, customer_number: str, include_activities: bool = False
    ) -> Customer | None:
        """Get customer by customer number using standard filtering.

        Note: include_activities parameter is kept for API compatibility but is not used
        because activities use lazy="dynamic" relationships. Use get_customer_activities()
        to fetch activities separately.
        """
        tenant_id = self._resolve_tenant_id()

        query = select(Customer).where(
            and_(
                Customer.customer_number == customer_number,
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

        result: Result[tuple[Customer]] = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_customer_by_email(
        self, email: str, include_activities: bool = False
    ) -> Customer | None:
        """Get customer by email using standard filtering.

        Note: include_activities parameter is kept for API compatibility but is not used
        because activities use lazy="dynamic" relationships. Use get_customer_activities()
        to fetch activities separately.
        """
        tenant_id = self._resolve_tenant_id()

        query = select(Customer).where(
            and_(
                func.lower(Customer.email) == email.lower(),
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

        result: Result[tuple[Customer]] = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def update_customer(
        self,
        customer_id: UUID | str,
        data: CustomerUpdate,
        updated_by: str | None = None,
    ) -> Customer | None:
        """Update customer using standard SQLAlchemy patterns."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        # Get existing customer
        customer = await self.get_customer(customer_id)
        if not customer:
            return None

        # Update using Pydantic exclude_unset (standard pattern)
        update_data = data.model_dump(
            exclude_unset=True, exclude={"tags", "metadata", "custom_fields"}
        )

        if update_data:
            update_data["updated_at"] = datetime.now(UTC).replace(tzinfo=None)
            update_data["updated_by"] = updated_by

            # Standard SQLAlchemy update
            stmt = (
                update(Customer)
                .where(
                    and_(
                        Customer.id == customer_id,
                        Customer.tenant_id == tenant_id,
                        Customer.deleted_at.is_(None),
                    )
                )
                .values(**update_data)
            )
            await self.session.execute(stmt)

        # Handle JSON fields if provided
        changes = []
        if data.tags is not None:
            customer.tags = data.tags
            changes.append("tags")

        if data.metadata is not None:
            customer.metadata_ = data.metadata
            changes.append("metadata")

        if data.custom_fields is not None:
            customer.custom_fields = data.custom_fields
            changes.append("custom_fields")

        # Auto-geocode service address if it changed
        try:
            # Get updated customer to check if geocoding is needed
            await self.session.refresh(customer)

            # Build customer data dict for geocoding check
            new_customer_data = {
                "service_address_line1": customer.service_address_line1,
                "service_address_line2": customer.service_address_line2,
                "service_city": customer.service_city,
                "service_state_province": customer.service_state_province,
                "service_postal_code": customer.service_postal_code,
                "service_country": customer.service_country,
                "service_coordinates": customer.service_coordinates,
            }

            # Check if any service address field was updated
            service_address_fields = [
                "service_address_line1",
                "service_address_line2",
                "service_city",
                "service_state_province",
                "service_postal_code",
                "service_country",
            ]
            address_changed = any(field in update_data for field in service_address_fields)

            if address_changed or not customer.service_coordinates.get("lat"):
                coords = await geocode_customer_address(new_customer_data, force=address_changed)
                if coords:
                    customer.service_coordinates = coords
                    changes.append("service_coordinates")
                    logger.info(
                        "Auto-geocoded customer service address",
                        customer_id=str(customer.id),
                        coordinates=coords,
                    )
        except Exception as e:
            logger.warning("Failed to auto-geocode customer address", error=str(e))

        # Create activity log
        if update_data or changes:
            # Try to convert updated_by to UUID, skip if invalid
            performed_by_uuid = None
            if updated_by:
                try:
                    performed_by_uuid = UUID(updated_by)
                except (ValueError, AttributeError):
                    logger.warning("Invalid UUID for updated_by, skipping", updated_by=updated_by)

            activity = CustomerActivity(
                customer_id=customer.id,
                tenant_id=tenant_id,
                activity_type=ActivityType.UPDATED,
                title="Customer updated",
                description=f"Customer {customer.full_name} was updated",
                metadata_={"updated_fields": list(update_data.keys()) + changes},
                performed_by=performed_by_uuid,
            )
            self.session.add(activity)

        await self.session.commit()
        await self.session.refresh(customer)

        logger.info("Customer updated", customer_id=str(customer.id))

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CUSTOMER_UPDATED.value,
                event_data={
                    "customer_id": str(customer.id),
                    "customer_number": customer.customer_number,
                    "email": customer.email,
                    "first_name": customer.first_name,
                    "last_name": customer.last_name,
                    "company_name": customer.company_name,
                    "status": customer.status.value if customer.status else None,
                    "customer_type": customer.customer_type,
                    "phone": customer.phone,
                    "updated_fields": list(update_data.keys()) + changes
                    if (update_data or changes)
                    else [],
                    "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
                },
                tenant_id=tenant_id,
                db=self.session,
            )
        except Exception as e:
            logger.warning("Failed to publish customer.updated event", error=str(e))

        return customer

    async def delete_customer(
        self,
        customer_id: UUID | str,
        deleted_by: str | None = None,
        hard_delete: bool = False,
    ) -> bool:
        """Delete customer using standard soft delete pattern."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        customer = await self.get_customer(customer_id)
        if not customer:
            return False

        if hard_delete:
            # Hard delete - remove from database
            await self.session.delete(customer)
        else:
            # Soft delete using standard pattern
            customer.deleted_at = datetime.now(UTC).replace(tzinfo=None)
            customer.updated_by = deleted_by
            customer.status = CustomerStatus.ARCHIVED

            # Create activity
            activity = CustomerActivity(
                customer_id=customer.id,
                tenant_id=tenant_id,
                activity_type=ActivityType.STATUS_CHANGED,
                title="Customer deleted",
                description=f"Customer {customer.full_name} was deleted",
                performed_by=deleted_by,
            )
            self.session.add(activity)

        await self.session.commit()

        logger.info("Customer deleted", customer_id=str(customer.id), hard_delete=hard_delete)

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CUSTOMER_DELETED.value,
                event_data={
                    "customer_id": str(customer.id),
                    "customer_number": customer.customer_number,
                    "email": customer.email,
                    "first_name": customer.first_name,
                    "last_name": customer.last_name,
                    "company_name": customer.company_name,
                    "hard_delete": hard_delete,
                    "deleted_at": datetime.now(UTC).isoformat(),
                },
                tenant_id=tenant_id,
                db=self.session,
            )
        except Exception as e:
            logger.warning("Failed to publish customer.deleted event", error=str(e))

        return True

    # BASIC SEARCH (using standard SQLAlchemy filtering)

    async def search_customers(
        self,
        params: CustomerSearchParams,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Customer], int]:
        """Comprehensive search with all filter parameters from CustomerSearchParams."""
        tenant_id = self._resolve_tenant_id()

        # Start with base query
        query = select(Customer).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

        # Text search filter (searches across multiple fields)
        if params.query:
            search_term = f"%{params.query}%"
            search_fields = [
                Customer.first_name,
                Customer.last_name,
                Customer.email,
                Customer.company_name,
                Customer.customer_number,
            ]
            query = query.where(or_(*[field.ilike(search_term) for field in search_fields]))

        # Basic filters
        filter_conditions = []

        if params.status:
            filter_conditions.append(Customer.status == params.status)
        if params.customer_type:
            filter_conditions.append(Customer.customer_type == params.customer_type)
        if params.tier:
            filter_conditions.append(Customer.tier == params.tier)
        if params.country:
            filter_conditions.append(Customer.country == params.country)
        if params.assigned_to:
            filter_conditions.append(Customer.assigned_to == params.assigned_to)
        if params.segment_id:
            filter_conditions.append(Customer.segment_id == params.segment_id)

        # Tags filter (JSON array contains any of the provided tags)
        if params.tags:
            # For PostgreSQL use @> operator with JSONB, for SQLite use LIKE
            dialect_name = self.session.bind.dialect.name if self.session.bind else "sqlite"

            if dialect_name == "postgresql":
                # Use PostgreSQL's @> (contains) operator with JSONB
                # Must cast both sides to JSONB since column is JSON type
                from sqlalchemy.dialects.postgresql import JSONB

                tag_conditions = [
                    sa.cast(Customer.tags, JSONB).op("@>")(sa.cast(literal([tag]), JSONB))
                    for tag in params.tags
                ]
                filter_conditions.append(or_(*tag_conditions))
            else:
                # For SQLite and other databases, use LIKE on serialized JSON
                # This doesn't require JSON1 extension and works reliably
                tag_conditions = []
                for tag in params.tags:
                    # Cast column to text and check if tag appears in JSON array
                    # Tags are stored as ["tag1", "tag2"], so we look for "tag"
                    tag_conditions.append(sa.cast(Customer.tags, sa.String).like(f'%"{tag}"%'))
                filter_conditions.append(or_(*tag_conditions))

        # Date range filters
        if params.created_after:
            filter_conditions.append(Customer.created_at >= params.created_after)
        if params.created_before:
            filter_conditions.append(Customer.created_at <= params.created_before)
        if params.last_purchase_after:
            filter_conditions.append(Customer.last_purchase_date >= params.last_purchase_after)
        if params.last_purchase_before:
            filter_conditions.append(Customer.last_purchase_date <= params.last_purchase_before)

        # Value range filters
        if params.min_lifetime_value is not None:
            filter_conditions.append(Customer.lifetime_value >= params.min_lifetime_value)
        if params.max_lifetime_value is not None:
            filter_conditions.append(Customer.lifetime_value <= params.max_lifetime_value)

        # ISP-specific filters
        if params.installation_status:
            filter_conditions.append(Customer.installation_status == params.installation_status)
        if params.connection_type:
            filter_conditions.append(Customer.connection_type == params.connection_type)
        if params.service_city:
            filter_conditions.append(Customer.service_city == params.service_city)
        if params.service_state_province:
            filter_conditions.append(
                Customer.service_state_province == params.service_state_province
            )
        if params.service_country:
            filter_conditions.append(Customer.service_country == params.service_country)

        # Network parameter filters
        if params.static_ip_assigned:
            # Support both exact match and partial IP search (e.g., "192.168.1" finds all in subnet)
            filter_conditions.append(
                Customer.static_ip_assigned.like(f"{params.static_ip_assigned}%")
            )
        if params.ipv6_prefix:
            # Support prefix search (e.g., "2001:db8" finds all matching prefixes)
            filter_conditions.append(Customer.ipv6_prefix.like(f"{params.ipv6_prefix}%"))
        if params.current_bandwidth_profile:
            filter_conditions.append(
                Customer.current_bandwidth_profile == params.current_bandwidth_profile
            )
        if params.last_mile_technology:
            filter_conditions.append(Customer.last_mile_technology == params.last_mile_technology)
        if params.device_serial:
            # Search within assigned_devices JSON for device serial numbers
            # This searches for the serial in ONU, CPE, router IDs, MAC addresses, etc.
            dialect_name = self.session.bind.dialect.name if self.session.bind else "sqlite"

            if dialect_name == "postgresql":
                # Use PostgreSQL's JSONB text search
                from sqlalchemy.dialects.postgresql import JSONB

                assigned_devices_json = sa.cast(Customer.assigned_devices, JSONB)
                json_serial_filter = or_(
                    assigned_devices_json.op("@>")(
                        sa.cast(literal({"onu_serial": params.device_serial}), JSONB)
                    ),
                    assigned_devices_json.op("@>")(
                        sa.cast(literal({"router_id": params.device_serial}), JSONB)
                    ),
                    assigned_devices_json.op("@>")(
                        sa.cast(literal({"cpe_mac": params.device_serial}), JSONB)
                    ),
                )

                filter_conditions.append(
                    json_serial_filter
                    | sa.cast(Customer.assigned_devices, sa.Text).like(f"%{params.device_serial}%")
                )
            else:
                # For SQLite, use LIKE on the JSON text representation
                filter_conditions.append(
                    sa.cast(Customer.assigned_devices, sa.String).like(f"%{params.device_serial}%")
                )

        # Apply all filters at once
        if filter_conditions:
            query = query.where(and_(*filter_conditions))

        # Count total results before pagination
        count_query = select(func.count()).select_from(query.subquery())
        count_result: Result[tuple[int]] = await self.session.execute(count_query)
        total = count_result.scalar_one()

        # Dynamic sorting
        sort_column_map = {
            "created_at": Customer.created_at,
            "updated_at": Customer.updated_at,
            "first_name": Customer.first_name,
            "last_name": Customer.last_name,
            "email": Customer.email,
            "company_name": Customer.company_name,
            "customer_number": Customer.customer_number,
            "status": Customer.status,
            "tier": Customer.tier,
            "lifetime_value": Customer.lifetime_value,
            "total_purchases": Customer.total_purchases,
            "last_purchase_date": Customer.last_purchase_date,
            "acquisition_date": Customer.acquisition_date,
            # Network parameters
            "static_ip_assigned": Customer.static_ip_assigned,
            "ipv6_prefix": Customer.ipv6_prefix,
            "current_bandwidth_profile": Customer.current_bandwidth_profile,
            "last_mile_technology": Customer.last_mile_technology,
            "installation_date": Customer.installation_date,
        }

        sort_column = sort_column_map.get(params.sort_by, Customer.created_at)
        if sort_column is None:
            sort_column = Customer.created_at

        if params.sort_order == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        # Add pagination
        query = query.limit(limit).offset(offset)

        result: Result[tuple[Customer]] = await self.session.execute(query)
        customers = list(result.scalars().all())

        return customers, total

    # ACTIVITY MANAGEMENT (core functionality)

    async def add_activity(
        self,
        customer_id: UUID | str,
        data: CustomerActivityCreate,
        performed_by: str | UUID | None = None,
    ) -> CustomerActivity:
        """Add customer activity using standard patterns."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        # Verify customer exists
        customer = await self.get_customer(customer_id)
        if not customer:
            logger.warning(
                "Customer not found when adding activity",
                customer_id=str(customer_id),
                tenant_id=tenant_id,
            )
            raise ValueError(f"Customer not found: {customer_id}")

        # Convert performed_by to UUID if it's a string
        performed_by_uuid = None
        if performed_by:
            if isinstance(performed_by, UUID):
                performed_by_uuid = performed_by
            else:
                try:
                    performed_by_uuid = UUID(performed_by)
                except (ValueError, AttributeError):
                    logger.warning(
                        "Invalid UUID for performed_by, skipping", performed_by=performed_by
                    )

        activity = CustomerActivity(
            customer_id=customer_id,
            tenant_id=tenant_id,
            performed_by=performed_by_uuid,
            **data.model_dump(exclude={"metadata"}),
        )
        # Map metadata to metadata_ for ORM compatibility
        activity.metadata_ = data.metadata

        self.session.add(activity)
        await self.session.commit()

        return activity

    async def get_customer_activities(
        self,
        customer_id: UUID | str,
        activity_type: ActivityType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Get customer activities using standard queries."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        stmt = text(
            """
            SELECT
                id,
                customer_id,
                activity_type,
                title,
                description,
                metadata,
                performed_by,
                ip_address,
                user_agent,
                created_at
            FROM customer_activities
            WHERE customer_id = :customer_id
              AND tenant_id = :tenant_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        )

        params = {
            "customer_id": str(customer_id),
            "tenant_id": tenant_id,
            "limit": limit,
            "offset": offset,
        }

        result = await self.session.execute(stmt, params)
        rows = result.mappings().all()

        activities: list[dict[str, Any]] = []

        def _normalize_uuid(value: Any) -> str | None:
            """Normalize UUID to standard string format with hyphens."""
            if isinstance(value, str):
                # If it's already a valid UUID string (with or without hyphens), ensure proper format
                cleaned = value.replace("-", "")
                if len(cleaned) == 32:
                    # Format as standard UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                    return f"{cleaned[0:8]}-{cleaned[8:12]}-{cleaned[12:16]}-{cleaned[16:20]}-{cleaned[20:32]}"
                return value
            if isinstance(value, (bytes, bytearray)):
                # Convert bytes to hex and format as UUID
                hex_str = value.hex()
                return f"{hex_str[0:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:32]}"
            return None

        for row in rows:
            data = dict(row)
            data["id"] = _normalize_uuid(data.get("id")) or ""
            data["customer_id"] = _normalize_uuid(data.get("customer_id")) or ""
            data["performed_by"] = _normalize_uuid(data.get("performed_by"))
            activity_type = data.get("activity_type")
            if isinstance(activity_type, str):
                data["activity_type"] = activity_type.lower()
            metadata_value = data.get("metadata")
            if isinstance(metadata_value, str):
                try:
                    data["metadata"] = json.loads(metadata_value)
                except json.JSONDecodeError:
                    data["metadata"] = {}
            elif metadata_value is None:
                data["metadata"] = {}
            activities.append(data)

        return activities

    # NOTE MANAGEMENT (core functionality)

    async def add_note(
        self,
        customer_id: UUID | str,
        data: CustomerNoteCreate,
        created_by: str | None = None,
    ) -> CustomerNote:
        """Add customer note using standard patterns."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        # Verify customer exists
        customer = await self.get_customer(customer_id)
        if not customer:
            raise ValueError(f"Customer not found: {customer_id}")

        # Convert created_by string to UUID if provided
        created_by_id = None
        if created_by:
            try:
                created_by_id = UUID(created_by) if isinstance(created_by, str) else created_by
            except (ValueError, AttributeError):
                logger.warning("Invalid UUID for created_by, skipping", created_by=created_by)

        note = CustomerNote(
            customer_id=customer_id,
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            **data.model_dump(),
        )

        self.session.add(note)

        # Also create activity - use the UUID we already converted
        activity = CustomerActivity(
            customer_id=customer_id,
            tenant_id=tenant_id,
            activity_type=ActivityType.NOTE_ADDED,
            title="Note added",
            description=f"Note added: {data.subject}",
            performed_by=created_by_id,
            metadata_={"note_subject": data.subject},
        )
        self.session.add(activity)

        await self.session.commit()

        return note

    async def get_customer_notes(
        self,
        customer_id: UUID | str,
        include_internal: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> list[CustomerNote]:
        """Get customer notes using standard queries."""
        customer_id = validate_uuid(customer_id, "customer_id")
        tenant_id = self._resolve_tenant_id()

        query = (
            select(CustomerNote)
            .where(
                and_(
                    CustomerNote.customer_id == customer_id,
                    CustomerNote.tenant_id == tenant_id,
                    CustomerNote.deleted_at.is_(None),
                )
            )
            .order_by(CustomerNote.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if not include_internal:
            query = query.where(CustomerNote.is_internal.is_(False))

        result = await self.session.execute(query)
        return list(result.scalars().all())

    # UTILITY METHODS

    async def _generate_customer_number(self) -> str:
        """Generate unique customer number using standard library."""
        tenant_id = self._resolve_tenant_id()

        while True:
            # Generate random customer number with prefix
            number = f"CUST-{secrets.token_hex(4).upper()}"

            # Check uniqueness using standard query
            result = await self.session.execute(
                select(Customer.id).where(
                    and_(
                        Customer.customer_number == number,
                        Customer.tenant_id == tenant_id,
                    )
                )
            )

            if not result.scalar_one_or_none():
                return number

    async def get_customer_count(self, status: CustomerStatus | None = None) -> int:
        """Get customer count using standard aggregation."""
        tenant_id = self._resolve_tenant_id()

        query = select(func.count(Customer.id)).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

        if status:
            query = query.where(Customer.status == status)

        result: Result[tuple[int]] = await self.session.execute(query)
        return result.scalar_one()

    async def record_purchase(
        self,
        customer_id: UUID | str,
        amount: Decimal,
        order_id: str | None = None,
        performed_by: str | None = None,
    ) -> CustomerActivity:
        """Record customer purchase using standard patterns."""
        customer_id = validate_uuid(customer_id, "customer_id")

        customer = await self.get_customer(customer_id)
        if not customer:
            raise ValueError(f"Customer not found: {customer_id}")

        # Update customer purchase metrics using standard SQLAlchemy
        customer.total_purchases = (customer.total_purchases or 0) + 1
        customer.lifetime_value = (customer.lifetime_value or Decimal("0")) + amount
        customer.last_purchase_date = datetime.now(UTC).replace(tzinfo=None)

        if customer.first_purchase_date is None:
            customer.first_purchase_date = customer.last_purchase_date

        # Calculate average order value
        customer.average_order_value = customer.lifetime_value / customer.total_purchases

        # Create purchase activity
        activity = CustomerActivity(
            customer_id=customer.id,
            tenant_id=self._resolve_tenant_id(),
            activity_type=ActivityType.PURCHASE,
            title="Purchase recorded",
            description=f"Purchase of ${amount} recorded",
            performed_by=performed_by,
            metadata_={
                "amount": str(amount),
                "order_id": order_id,
                "lifetime_value": str(customer.lifetime_value),
                "total_purchases": customer.total_purchases,
            },
        )
        self.session.add(activity)

        await self.session.commit()
        await self.session.refresh(activity)

        return activity

    # ANALYTICS AND STATISTICS (using collections)

    async def get_customer_statistics(self) -> dict[str, Any]:
        """Get customer statistics using collections.Counter for efficiency."""
        tenant_id = self._resolve_tenant_id()

        # Get all customers for analysis
        query = select(Customer).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
        )

        result = await self.session.execute(query)
        customers = list(result.scalars().all())

        # Use collections for efficient statistics
        status_counts = collections.Counter(customer.status for customer in customers)
        tier_counts = collections.Counter(customer.tier for customer in customers)
        type_counts = collections.Counter(customer.customer_type for customer in customers)

        # Calculate additional stats using collections.defaultdict
        monthly_registrations: collections.defaultdict[str, int] = collections.defaultdict(int)
        for customer in customers:
            if customer.created_at:
                month_key = customer.created_at.strftime("%Y-%m")
                monthly_registrations[month_key] += 1

        return {
            "total_customers": len(customers),
            "status_breakdown": dict(status_counts),
            "tier_breakdown": dict(tier_counts),
            "type_breakdown": dict(type_counts),
            "monthly_registrations": dict(monthly_registrations),
            "most_common_status": status_counts.most_common(1)[0] if status_counts else None,
            "most_common_tier": tier_counts.most_common(1)[0] if tier_counts else None,
        }

    async def batch_process_customers(
        self, customer_ids: list[UUID | str], operation: str, batch_size: int = 100
    ) -> dict[str, list[Any]]:
        """Process customers in batches using itertools for efficiency."""
        results: dict[str, list[UUID | str]] = {"success": [], "failed": []}

        # Check if itertools.batched is available (Python 3.12+)
        try:
            batched_fn: Callable[[Iterable[_T], int], Iterable[tuple[_T, ...]]] = itertools.batched
        except AttributeError:
            # Fallback for Python < 3.12
            def batched_fn(iterable: Iterable[_T], n: int) -> Iterator[tuple[_T, ...]]:
                iterator = iter(iterable)
                while True:
                    batch_tuple = tuple(itertools.islice(iterator, n))
                    if not batch_tuple:
                        break
                    yield batch_tuple

        # Use itertools for efficient batching
        for batch in batched_fn(customer_ids, batch_size):
            try:
                batch_uuids = [validate_uuid(cid) for cid in batch]

                if operation == "archive":
                    await self._batch_archive_customers(batch_uuids)
                elif operation == "activate":
                    await self._batch_activate_customers(batch_uuids)
                else:
                    raise ValueError(f"Unknown operation: {operation}")

                results["success"].extend(batch_uuids)

            except Exception as e:
                logger.error(
                    "Batch processing failed", batch=batch, operation=operation, error=str(e)
                )
                results["failed"].extend(batch)

        return results

    async def _batch_archive_customers(self, customer_ids: list[UUID]) -> None:
        """Archive customers in batch using standard SQLAlchemy."""
        stmt = (
            update(Customer)
            .where(
                and_(
                    Customer.id.in_(customer_ids),
                    Customer.tenant_id == self._resolve_tenant_id(),
                    Customer.deleted_at.is_(None),
                )
            )
            .values(
                status=CustomerStatus.ARCHIVED,
                updated_at=datetime.now(UTC).replace(tzinfo=None),
            )
        )
        await self.session.execute(stmt)
        await self.session.commit()

    async def _batch_activate_customers(self, customer_ids: list[UUID]) -> None:
        """Activate customers in batch using standard SQLAlchemy."""
        stmt = (
            update(Customer)
            .where(
                and_(
                    Customer.id.in_(customer_ids),
                    Customer.tenant_id == self._resolve_tenant_id(),
                    Customer.deleted_at.is_(None),
                )
            )
            .values(
                status=CustomerStatus.ACTIVE,
                updated_at=datetime.now(UTC).replace(tzinfo=None),
            )
        )
        await self.session.execute(stmt)
        await self.session.commit()

    def get_customers_by_criteria(
        self, customers: list[Customer], **criteria: Any
    ) -> list[Customer]:
        """Filter customers using operator and standard library functions."""
        filtered = customers

        # Use operator for efficient filtering
        if "status" in criteria:
            filtered = [c for c in filtered if operator.eq(c.status, criteria["status"])]
        if "tier" in criteria:
            filtered = [c for c in filtered if operator.eq(c.tier, criteria["tier"])]
        if "min_lifetime_value" in criteria:
            min_value = criteria["min_lifetime_value"]
            filtered = [c for c in filtered if operator.ge(c.lifetime_value or 0, min_value)]

        return filtered

    def sort_customers(
        self, customers: list[Customer], sort_by: str = "created_at", reverse: bool = True
    ) -> list[Customer]:
        """Sort customers using operator for cleaner code."""
        sort_key_map = {
            "created_at": operator.attrgetter("created_at"),
            "lifetime_value": operator.attrgetter("lifetime_value"),
            "last_purchase_date": operator.attrgetter("last_purchase_date"),
            "full_name": operator.attrgetter("full_name"),
            "email": operator.attrgetter("email"),
        }

        if sort_by not in sort_key_map:
            sort_by = "created_at"

        return sorted(customers, key=sort_key_map[sort_by], reverse=reverse)

    async def update_metrics(
        self,
        customer_id: UUID,
        purchase_amount: float | None = None,
    ) -> None:
        """
        Update customer metrics - wrapper for record_purchase.

        Args:
            customer_id: Customer UUID
            purchase_amount: Purchase amount to record
        """
        if purchase_amount:
            await self.record_purchase(
                customer_id=customer_id, amount=Decimal(str(purchase_amount))
            )

    async def create_segment(
        self,
        data: CustomerSegmentCreate,
    ) -> CustomerSegment:
        """
        Create a customer segment.

        Args:
            data: Segment creation data

        Returns:
            Created segment entity
        """
        from uuid import uuid4

        tenant_id = self._resolve_tenant_id()

        # Calculate initial member count based on criteria
        member_count = 0
        if data.is_dynamic and data.criteria:
            member_count = await self._calculate_segment_members(data.criteria, tenant_id)

        # Create segment entity
        segment = CustomerSegment(
            id=uuid4(),
            tenant_id=tenant_id,
            name=data.name,
            description=data.description,
            criteria=data.criteria,
            is_dynamic=data.is_dynamic,
            member_count=member_count,
            last_calculated=datetime.now(UTC) if data.is_dynamic else None,
            priority=data.priority if hasattr(data, "priority") else 0,
        )

        self.session.add(segment)
        await self.session.commit()
        await self.session.refresh(segment)

        logger.info(
            "Created customer segment",
            tenant_id=tenant_id,
            segment_name=segment.name,
            segment_id=str(segment.id),
            member_count=member_count,
        )

        return segment

    async def recalculate_segment(
        self,
        segment_id: UUID,
    ) -> int:
        """
        Recalculate dynamic segment membership.

        Args:
            segment_id: Segment UUID

        Returns:
            Number of members in the segment
        """
        tenant_id = self._resolve_tenant_id()

        # Fetch segment from database
        segment_query = select(CustomerSegment).filter(
            CustomerSegment.id == segment_id, CustomerSegment.tenant_id == tenant_id
        )
        result = await self.session.execute(segment_query)
        segment = result.scalar_one_or_none()

        if not segment:
            raise ValueError(f"Segment {segment_id} not found")

        if not segment.is_dynamic:
            logger.warning(
                "Attempted to recalculate static segment",
                segment_id=str(segment_id),
                segment_name=segment.name,
            )
            return int(segment.member_count)

        # Calculate new member count based on criteria
        member_count = await self._calculate_segment_members(segment.criteria, tenant_id)

        # Update segment with new member count
        segment.member_count = member_count
        segment.last_calculated = datetime.now(UTC)

        await self.session.commit()

        logger.info(
            "Recalculated segment membership",
            tenant_id=tenant_id,
            segment_id=str(segment_id),
            segment_name=segment.name,
            member_count=member_count,
        )

        return member_count

    async def get_customer_metrics(self) -> dict[str, Any]:
        """
        Get aggregated customer metrics.

        Returns:
            Dictionary containing various customer metrics
        """
        tenant_id = self._resolve_tenant_id()

        # Get total and active customers
        total_query = select(func.count(Customer.id)).filter(Customer.tenant_id == tenant_id)
        total_result = await self.session.execute(total_query)
        total_customers = total_result.scalar() or 0

        active_query = select(func.count(Customer.id)).filter(
            Customer.tenant_id == tenant_id, Customer.status == CustomerStatus.ACTIVE
        )
        active_result = await self.session.execute(active_query)
        active_customers = active_result.scalar() or 0

        # Calculate churn rate
        churn_rate = 0.0
        if total_customers > 0:
            inactive_customers = total_customers - active_customers
            churn_rate = (inactive_customers / total_customers) * 100

        # Get revenue metrics
        revenue_query = select(
            func.sum(Customer.lifetime_value), func.avg(Customer.lifetime_value)
        ).filter(Customer.tenant_id == tenant_id, Customer.status == CustomerStatus.ACTIVE)
        revenue_result = await self.session.execute(revenue_query)
        revenue_row = revenue_result.one()

        total_revenue = float(revenue_row[0] or 0)
        avg_lifetime_value = float(revenue_row[1] or 0)

        # Get customers by status
        status_query = (
            select(Customer.status, func.count(Customer.id))
            .filter(Customer.tenant_id == tenant_id)
            .group_by(Customer.status)
        )

        status_result = await self.session.execute(status_query)
        customers_by_status = {status.value: count for status, count in status_result}

        # Get customers by tier
        tier_query = (
            select(Customer.tier, func.count(Customer.id))
            .filter(Customer.tenant_id == tenant_id)
            .group_by(Customer.tier)
        )

        tier_result = await self.session.execute(tier_query)
        customers_by_tier = {tier.value if tier else "none": count for tier, count in tier_result}

        # Get customers by type
        type_query = (
            select(Customer.customer_type, func.count(Customer.id))
            .filter(Customer.tenant_id == tenant_id)
            .group_by(Customer.customer_type)
        )

        type_result = await self.session.execute(type_query)
        customers_by_type = {
            customer_type.value if customer_type else "none": count
            for customer_type, count in type_result
        }

        # Get new customers this month
        from datetime import datetime

        start_of_month = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        new_customers_query = select(func.count(Customer.id)).filter(
            Customer.tenant_id == tenant_id, Customer.created_at >= start_of_month
        )
        new_customers_result = await self.session.execute(new_customers_query)
        new_customers_this_month = new_customers_result.scalar() or 0

        # Get top segments (limit to 5)
        segments_query = (
            select(CustomerSegment)
            .filter(CustomerSegment.tenant_id == tenant_id)
            .order_by(CustomerSegment.member_count.desc())
            .limit(5)
        )

        segments_result = await self.session.execute(segments_query)
        segments = segments_result.scalars().all()

        top_segments = [
            {
                "segment_id": str(segment.id),
                "name": segment.name,
                "member_count": segment.member_count,
                "is_dynamic": segment.is_dynamic,
            }
            for segment in segments
        ]

        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "new_customers_this_month": new_customers_this_month,
            "churn_rate": churn_rate,
            "total_revenue": total_revenue,
            "average_lifetime_value": avg_lifetime_value,
            "customers_by_status": customers_by_status,
            "customers_by_tier": customers_by_tier,
            "customers_by_type": customers_by_type,
            "top_segments": top_segments,
        }

    async def _calculate_segment_members(self, criteria: dict[str, Any], tenant_id: str) -> int:
        """
        Calculate number of customers matching segment criteria.

        Args:
            criteria: Segment criteria dictionary
            tenant_id: Tenant ID

        Returns:
            Number of matching customers
        """
        query = select(func.count(Customer.id)).filter(Customer.tenant_id == tenant_id)

        # Apply criteria filters
        if "status" in criteria:
            query = query.filter(Customer.status == CustomerStatus(criteria["status"]))

        if "tier" in criteria:
            from dotmac.platform.customer_management.models import CustomerTier

            query = query.filter(Customer.tier == CustomerTier(criteria["tier"]))

        if "min_lifetime_value" in criteria:
            query = query.filter(Customer.lifetime_value >= criteria["min_lifetime_value"])

        if "max_lifetime_value" in criteria:
            query = query.filter(Customer.lifetime_value <= criteria["max_lifetime_value"])

        if "created_after" in criteria:
            query = query.filter(Customer.created_at >= criteria["created_after"])

        if "created_before" in criteria:
            query = query.filter(Customer.created_at <= criteria["created_before"])

        result = await self.session.execute(query)
        return result.scalar() or 0
