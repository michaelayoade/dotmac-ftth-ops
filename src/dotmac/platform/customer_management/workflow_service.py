"""
Customer Management Workflow Service

Provides workflow-compatible methods for customer management operations.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.customer_management.schemas import CustomerCreate, CustomerUpdate
from dotmac.platform.tenant import get_current_tenant_id, set_current_tenant_id

from .service import CustomerService as CoreCustomerService

logger = logging.getLogger(__name__)


class CustomerService:
    """
    Customer management service for workflow integration.

    Wraps the core CustomerService with workflow-compatible methods.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_service = CoreCustomerService(db)

    @contextmanager
    def _tenant_context(self, tenant_id: str | None) -> Iterator[None]:
        """Temporarily override the tenant context for service operations."""
        previous_tenant = get_current_tenant_id()
        if tenant_id is not None:
            set_current_tenant_id(tenant_id)
        try:
            yield
        finally:
            set_current_tenant_id(previous_tenant)

    async def _create_customer_in_tenant(
        self,
        tenant_id: str,
        customer_data: CustomerCreate,
        status: CustomerStatus | None = None,
    ) -> Customer:
        """Create a customer while ensuring the correct tenant context."""
        with self._tenant_context(tenant_id):
            customer = await self.customer_service.create_customer(data=customer_data)
            if status is not None:
                updated = await self.customer_service.update_customer(
                    customer_id=customer.id,
                    data=CustomerUpdate(status=status),
                )
                if updated:
                    customer = updated
        return customer

    async def create_from_lead(
        self,
        lead_id: int | str,
        tenant_id: str,
    ) -> dict[str, Any]:
        """
        Create a customer record from a qualified lead.

        Args:
            lead_id: Lead ID (UUID string or int)
            tenant_id: Tenant ID

        Returns:
            Dict with customer_id, name, email
        """
        from ..crm.models import Lead

        logger.info(f"Creating customer from lead {lead_id} for tenant {tenant_id}")

        # Convert lead_id to UUID if needed
        if isinstance(lead_id, int):
            raise ValueError("Lead ID must be UUID string, not int")

        lead_uuid = UUID(str(lead_id)) if not isinstance(lead_id, UUID) else lead_id

        # Fetch the lead
        stmt = select(Lead).where(Lead.id == lead_uuid, Lead.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        lead = result.scalar_one_or_none()

        if not lead:
            raise ValueError(f"Lead {lead_id} not found in tenant {tenant_id}")

        # Check if customer already exists with this email
        from .models import Customer

        existing_stmt = select(Customer).where(
            Customer.email == lead.email, Customer.tenant_id == tenant_id
        )
        existing_result = await self.db.execute(existing_stmt)
        existing_customer = existing_result.scalar_one_or_none()

        if existing_customer:
            logger.info(f"Customer already exists for lead {lead_id}: {existing_customer.id}")
            return {
                "customer_id": existing_customer.id,
                "name": existing_customer.full_name,
                "email": existing_customer.email,
            }

        # Create new customer from lead data
        customer_data = CustomerCreate(
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            company_name=lead.company_name,
            metadata={
                "converted_from_lead_id": str(lead.id),
                "source": lead.source.value,
            },
            address_line1=lead.service_address_line1,
            address_line2=lead.service_address_line2,
            city=lead.service_city,
            state_province=lead.service_state_province,
            postal_code=lead.service_postal_code,
            country=lead.service_country,
            service_address_line1=lead.service_address_line1,
            service_address_line2=lead.service_address_line2,
            service_city=lead.service_city,
            service_state_province=lead.service_state_province,
            service_postal_code=lead.service_postal_code,
            service_country=lead.service_country,
            service_coordinates=lead.service_coordinates or {},
        )

        customer = await self._create_customer_in_tenant(
            tenant_id=tenant_id,
            customer_data=customer_data,
            status=CustomerStatus.ACTIVE,
        )

        logger.info(f"Created customer {customer.id} from lead {lead_id}")

        return {
            "customer_id": customer.id,
            "name": customer.full_name,
            "email": customer.email,
        }

    async def create_partner_customer(
        self,
        partner_id: int | str,
        customer_data: dict[str, Any],
        tenant_id: str | None = None,
        engagement_type: str = "managed",
        custom_commission_rate: float | None = None,
    ) -> dict[str, Any]:
        """
        Create a customer under a partner account.

        This method creates a customer and links them to a partner account.
        The partner will manage this customer and earn commissions on their
        transactions. Partner quota is checked before creation.

        Args:
            partner_id: Partner ID (UUID or string)
            customer_data: Customer data dictionary with fields:
                - first_name (required)
                - last_name (required)
                - email (required)
                - phone (optional)
                - company_name (optional)
                - service_address (optional)
                - billing_address (optional)
                - tier (optional, default "standard")
            tenant_id: Tenant ID for multi-tenant isolation
            engagement_type: Type of partner engagement:
                - "managed": Partner manages customer fully
                - "referral": Partner referred, platform manages
                - "reseller": Partner resells platform service
            custom_commission_rate: Custom commission rate for this account (0-1)

        Returns:
            Dict with customer and partnership details:
            {
                "customer_id": str,  # Customer UUID
                "customer_number": str,  # Customer account number
                "name": str,  # Full customer name
                "email": str,  # Customer email
                "partner_id": str,  # Partner UUID
                "partner_account_id": str,  # PartnerAccount link UUID
                "engagement_type": str,  # Engagement type
                "commission_rate": str,  # Applied commission rate
                "created_at": str,  # ISO timestamp
            }

        Raises:
            ValueError: If partner not found, quota exceeded, or invalid data
            RuntimeError: If customer creation fails
        """
        logger.info(f"Creating partner customer for partner {partner_id}")

        # Validate required fields
        required_fields = ["first_name", "last_name", "email"]
        for field in required_fields:
            if field not in customer_data or not customer_data[field]:
                raise ValueError(f"Missing required field: {field}")

        # Convert partner_id to UUID
        try:
            partner_uuid = (
                UUID(partner_id) if isinstance(partner_id, str) else UUID(str(partner_id))
            )
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid partner_id: {partner_id}") from e

        try:
            # Check if partner exists and has quota
            from ..partner_management.models import Partner, PartnerAccount, PartnerStatus

            partner_result = await self.db.execute(
                select(Partner).where(
                    Partner.id == partner_uuid,
                    Partner.deleted_at.is_(None),
                )
            )
            partner = partner_result.scalar_one_or_none()

            if not partner:
                raise ValueError(f"Partner not found: {partner_id}")

            if partner.status != PartnerStatus.ACTIVE:
                raise ValueError(
                    f"Partner {partner_id} is not active (status: {partner.status.value})"
                )

            # Check partner quota using quota check method
            from ..partner_management.workflow_service import (
                PartnerService as PartnerWorkflowService,
            )

            partner_workflow = PartnerWorkflowService(self.db)
            quota_check = await partner_workflow.check_license_quota(
                partner_id=str(partner_uuid),
                requested_licenses=1,
                tenant_id=tenant_id,
            )

            if not quota_check["available"]:
                raise ValueError(
                    f"Partner {partner_id} has insufficient quota. "
                    f"Allocated: {quota_check['quota_allocated']}, "
                    f"Used: {quota_check['quota_used']}, "
                    f"Remaining: {quota_check['quota_remaining']}"
                )

            # Use tenant_id from partner if not provided
            tenant_id = tenant_id or partner.tenant_id

            # Prepare customer creation payload
            billing_address_raw = customer_data.get("billing_address")
            service_address_raw = customer_data.get("service_address")

            billing_address = billing_address_raw if isinstance(billing_address_raw, dict) else {}
            service_address = service_address_raw if isinstance(service_address_raw, dict) else {}

            customer_create = CustomerCreate(
                first_name=customer_data["first_name"],
                last_name=customer_data["last_name"],
                email=customer_data["email"],
                phone=customer_data.get("phone"),
                company_name=customer_data.get("company_name"),
                tier=customer_data.get("tier", "standard"),
                address_line1=(
                    billing_address_raw
                    if isinstance(billing_address_raw, str)
                    else billing_address.get("line1")
                    or billing_address.get("address_line1")
                    or billing_address.get("street")
                ),
                address_line2=billing_address.get("line2") or billing_address.get("address_line2"),
                city=billing_address.get("city"),
                state_province=billing_address.get("state")
                or billing_address.get("state_province"),
                postal_code=billing_address.get("postal_code") or billing_address.get("zip"),
                country=billing_address.get("country"),
                service_address_line1=(
                    service_address_raw
                    if isinstance(service_address_raw, str)
                    else service_address.get("line1")
                    or service_address.get("address_line1")
                    or service_address.get("street")
                ),
                service_address_line2=(
                    service_address.get("line2") if isinstance(service_address, dict) else None
                ),
                service_city=(
                    service_address.get("city") if isinstance(service_address, dict) else None
                ),
                service_state_province=(
                    service_address.get("state") if isinstance(service_address, dict) else None
                ),
                service_postal_code=(
                    service_address.get("postal_code")
                    if isinstance(service_address, dict)
                    else None
                ),
                service_country=(
                    service_address.get("country") if isinstance(service_address, dict) else None
                ),
            )

            desired_status = customer_data.get("status", CustomerStatus.ACTIVE.value)
            try:
                status_enum = CustomerStatus(desired_status)
            except ValueError:
                status_enum = CustomerStatus.ACTIVE

            customer = await self._create_customer_in_tenant(
                tenant_id=tenant_id,
                customer_data=customer_create,
                status=status_enum,
            )

            # Create partner account linkage
            partner_account = PartnerAccount(
                partner_id=partner_uuid,
                customer_id=customer.id,
                engagement_type=engagement_type,
                start_date=datetime.now(UTC),
                is_active=True,
                custom_commission_rate=custom_commission_rate,
                notes=f"Customer created via partner workflow on {datetime.now(UTC).isoformat()}",
                metadata_={"created_via": "workflow", "workflow_version": "1.0"},
            )

            self.db.add(partner_account)

            # Update partner metrics
            partner.total_customers += 1

            # Commit transaction
            await self.db.flush()
            await self.db.commit()

            # Determine commission rate
            commission_rate = custom_commission_rate or partner.default_commission_rate or 0.0

            logger.info(
                f"Partner customer created successfully: customer={customer.id}, "
                f"partner={partner_id}, engagement={engagement_type}, "
                f"commission_rate={commission_rate}"
            )

            return {
                "customer_id": customer.id,
                "customer_number": customer.customer_number,
                "name": customer.full_name,
                "email": customer.email,
                "phone": customer.phone,
                "company_name": customer.company_name,
                "tier": customer.tier,
                "partner_id": str(partner_uuid),
                "partner_number": partner.partner_number,
                "partner_name": partner.company_name,
                "partner_account_id": str(partner_account.id),
                "engagement_type": engagement_type,
                "commission_rate": str(commission_rate) if commission_rate else "0.0000",
                "quota_remaining": quota_check["quota_remaining"],
                "created_at": customer.created_at.isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating partner customer: {e}", exc_info=True)
            await self.db.rollback()
            raise RuntimeError(f"Failed to create partner customer: {e}") from e
